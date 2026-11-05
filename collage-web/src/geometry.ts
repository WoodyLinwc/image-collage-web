import type { Fit, Rect, StyleSettings, Template } from './types';

export const MAX_ZOOM = 4;
const EPS = 1e-6;

/** 间距、边框、圆角的基准长度：单页的短边（多页拼图时每页看起来一致） */
export function styleUnit(W: number, H: number, pages = 1): number {
  return Math.min(W / pages, H);
}

/**
 * 把模板的归一化格子换算成像素矩形。
 * 预览和导出共用这一个函数，所以两者的排版完全一致，只是分辨率不同。
 */
export function cellRects(t: Template, W: number, H: number, st: StyleSettings, round = true, unit = Math.min(W, H)): Rect[] {
  if (t.free) {
    // 留白布局：位置是布局自己定的，直接按比例换算
    return t.cells.map((c) => {
      let x0 = c.x * W;
      let x1 = (c.x + c.w) * W;
      let y0 = c.y * H;
      let y1 = (c.y + c.h) * H;
      if (round) {
        x0 = Math.round(x0);
        x1 = Math.round(x1);
        y0 = Math.round(y0);
        y1 = Math.round(y1);
      }
      return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
    });
  }
  const pad = (st.padding / 1000) * unit;
  const half = ((st.gap / 1000) * unit) / 2;
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

/** 叠放图片外圈描边的宽度 */
export function frameWidth(unit: number): number {
  return Math.max(1, Math.round(unit * 0.016));
}

export function cornerRadius(st: StyleSettings, unit: number, r: Rect): number {
  const radius = (st.radius / 1000) * unit;
  return Math.max(0, Math.min(radius, r.w / 2, r.h / 2));
}

/**
 * 计算图片在格子内的位置（相对格子左上角）。
 * cover：zoom=1 时图片刚好铺满格子，px/py 决定多出来的部分往哪边裁。
 * contain：zoom=1 时图片完整放进格子，px/py 决定图片在空白里靠哪边。
 * 只依赖宽高比例，与分辨率无关。
 */
export function placeImage(cw: number, ch: number, iw: number, ih: number, zoom: number, px: number, py: number, fit: Fit = 'cover') {
  const base = fit === 'contain' ? Math.min(cw / iw, ch / ih) : Math.max(cw / iw, ch / ih);
  const scale = base * zoom;
  const w = iw * scale;
  const h = ih * scale;
  return { x: -(w - cw) * px, y: -(h - ch) * py, w, h, scale };
}

/**
 * 图片在格子里真正露出来的区域（格子和图片的交集），坐标相对画布。
 * 铺满时就是整个格子；完整显示时是照片本身占的那一块。
 */
export function visibleRect(r: Rect, pl: { x: number; y: number; w: number; h: number }): Rect {
  const snap = (v: number, edge: number) => (Math.abs(v - edge) < 0.01 ? edge : v);
  const x0 = snap(Math.max(r.x, r.x + pl.x), r.x);
  const y0 = snap(Math.max(r.y, r.y + pl.y), r.y);
  const x1 = snap(Math.min(r.x + r.w, r.x + pl.x + pl.w), r.x + r.w);
  const y1 = snap(Math.min(r.y + r.h, r.y + pl.y + pl.h), r.y + r.h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}
