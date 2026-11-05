import type { Photo, Ratio, StyleSettings, Template } from './types';
import { cellRects, cornerRadius, placeImage, styleUnit } from './geometry';
import { canvasToBlob, loadImageElement } from './imageLoader';

export type ExportFormat = 'jpeg' | 'png';

/** iOS Safari 的画布上限约 1677 万像素，留一点余量 */
export const MAX_EXPORT_PIXELS = 16_000_000;

export function exportSize(ratio: Ratio, longSide: number) {
  let W: number;
  let H: number;
  if (ratio.w >= ratio.h) {
    W = longSide;
    H = Math.round((longSide * ratio.h) / ratio.w);
  } else {
    H = longSide;
    W = Math.round((longSide * ratio.w) / ratio.h);
  }
  const area = W * H;
  if (area > MAX_EXPORT_PIXELS) {
    const k = Math.sqrt(MAX_EXPORT_PIXELS / area);
    W = Math.floor(W * k);
    H = Math.floor(H * k);
  }
  return { W, H };
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 逐级减半缩小：大图一次性缩到很小时，浏览器的插值会丢细节、出锯齿。
 * 每次只缩一半，最后一步再画到目标尺寸，锐度明显更好。
 */
function stepDown(img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, tw: number, th: number) {
  let src: CanvasImageSource = img;
  let x = sx;
  let y = sy;
  let w = sw;
  let h = sh;
  let temp: HTMLCanvasElement | null = null;
  while (w > tw * 2 && h > th * 2) {
    const nw = Math.max(tw, Math.round(w / 2));
    const nh = Math.max(th, Math.round(h / 2));
    const c = document.createElement('canvas');
    c.width = nw;
    c.height = nh;
    const cx = c.getContext('2d');
    if (!cx) break;
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(src, x, y, w, h, 0, 0, nw, nh);
    if (temp) {
      temp.width = 0;
      temp.height = 0;
    }
    temp = c;
    src = c;
    x = 0;
    y = 0;
    w = nw;
    h = nh;
  }
  return {
    image: src,
    sx: x,
    sy: y,
    sw: w,
    sh: h,
    dispose() {
      if (temp) {
        temp.width = 0;
        temp.height = 0;
      }
    },
  };
}

export interface RenderOptions {
  photos: Photo[];
  template: Template;
  ratio: Ratio;
  style: StyleSettings;
  /** 横向拆成几张，1 = 普通拼图 */
  pages: number;
  longSide: number;
  format: ExportFormat;
  quality: number;
  onProgress?: (p: number) => void;
}

/**
 * 按页渲染：整幅拼图宽 = 单页宽 × 页数，每页单独开一块画布、平移后绘制，
 * 所以多页拼图的内存占用和单页一样，手机上也不会爆。
 * 跨页的图片会在相邻两页各画一次，接缝处像素完全对齐。
 */
export async function renderCollage(o: RenderOptions): Promise<Blob[]> {
  const { W: PW, H } = exportSize(o.ratio, o.longSide);
  const P = Math.max(1, o.pages);
  const W = PW * P;
  const unit = styleUnit(W, H, P);
  const rects = cellRects(o.template, W, H, o.style, true, unit);
  const n = Math.min(rects.length, o.photos.length);

  // 每页需要画哪些格子
  const jobs: number[][] = Array.from({ length: P }, (_, k) =>
    Array.from({ length: n }, (_, i) => i).filter((i) => rects[i].x < (k + 1) * PW && rects[i].x + rects[i].w > k * PW),
  );
  const totalSteps = jobs.reduce((a, j) => a + j.length, 0) + P;
  let done = 0;
  const tick = async () => {
    done++;
    o.onProgress?.(done / totalSteps);
    // 让出主线程，进度条才能刷新
    await new Promise((res) => setTimeout(res, 0));
  };

  const blobs: Blob[] = [];
  for (let k = 0; k < P; k++) {
    const canvas = document.createElement('canvas');
    canvas.width = PW;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建画布');
    ctx.fillStyle = o.style.background;
    ctx.fillRect(0, 0, PW, H);
    ctx.translate(-k * PW, 0);

    // 一张一张读取原图并立即释放，避免手机内存爆掉
    for (const i of jobs[k]) {
      const photo = o.photos[i];
      const r = rects[i];
      const url = URL.createObjectURL(photo.file);
      let img: HTMLImageElement | null = null;
      try {
        img = await loadImageElement(url);
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const pl = placeImage(r.w, r.h, iw, ih, photo.zoom, photo.px, photo.py);
        const sw = Math.min(iw, r.w / pl.scale);
        const sh = Math.min(ih, r.h / pl.scale);
        const sx = Math.min(Math.max(0, -pl.x / pl.scale), iw - sw);
        const sy = Math.min(Math.max(0, -pl.y / pl.scale), ih - sh);
        const src = stepDown(img, sx, sy, sw, sh, r.w, r.h);

        ctx.save();
        roundedRectPath(ctx, r.x, r.y, r.w, r.h, cornerRadius(o.style, unit, r));
        ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(src.image, src.sx, src.sy, src.sw, src.sh, r.x, r.y, r.w, r.h);
        ctx.restore();
        src.dispose();
      } finally {
        URL.revokeObjectURL(url);
        if (img) img.src = '';
      }
      await tick();
    }

    const blob = await canvasToBlob(
      canvas,
      o.format === 'png' ? 'image/png' : 'image/jpeg',
      o.format === 'jpeg' ? o.quality : undefined,
    );
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) throw new Error('导出失败');
    blobs.push(blob);
    await tick();
  }
  return blobs;
}
