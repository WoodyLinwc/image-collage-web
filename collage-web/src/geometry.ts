import type { Rect, StyleSettings, Template } from './types';

export const MAX_ZOOM = 4;
const EPS = 1e-6;

/**
 * 把模板的归一化格子换算成像素矩形。
 * 预览和导出共用这一个函数，所以两者的排版完全一致，只是分辨率不同。
 */
export function cellRects(t: Template, W: number, H: number, st: StyleSettings, round = true): Rect[] {
  const s = Math.min(W, H);
  const pad = (st.padding / 1000) * s;
  const half = ((st.gap / 1000) * s) / 2;
  const iw = W - pad * 2;
  const ih = H - pad * 2;
  return t.cells.map((c) => {
    let x0 = pad + c.x * iw;
    let x1 = pad + (c.x + c.w) * iw;
    let y0 = pad + c.y * ih;
    let y1 = pad + (c.y + c.h) * ih;
    // 只有内部边缘才留间距，外圈由 padding 控制
    if (c.x > EPS) x0 += half;
    if (c.x + c.w < 1 - EPS) x1 -= half;
    if (c.y > EPS) y0 += half;
    if (c.y + c.h < 1 - EPS) y1 -= half;
    if (round) {
      // 相邻格子共用同一条取整后的边，避免出现细缝
      x0 = Math.round(x0);
      x1 = Math.round(x1);
      y0 = Math.round(y0);
      y1 = Math.round(y1);
    }
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  });
}

export function cornerRadius(st: StyleSettings, W: number, H: number, r: Rect): number {
  const radius = (st.radius / 1000) * Math.min(W, H);
  return Math.max(0, Math.min(radius, r.w / 2, r.h / 2));
}

/**
 * 计算图片在格子内的位置（相对格子左上角）。
 * zoom=1 时图片刚好铺满（cover），px/py 决定多出来的部分往哪边裁。
 * 只依赖宽高比例，与分辨率无关。
 */
export function placeImage(cw: number, ch: number, iw: number, ih: number, zoom: number, px: number, py: number) {
  const scale = Math.max(cw / iw, ch / ih) * zoom;
  const w = iw * scale;
  const h = ih * scale;
  return { x: -(w - cw) * px, y: -(h - ch) * py, w, h, scale };
}
