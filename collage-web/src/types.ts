/** 归一化或像素矩形 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Photo {
  id: string;
  /** 原图文件，导出时使用，保证画质 */
  file: File;
  /** 预览用的缩小版本 */
  previewUrl: string;
  /** 原图（已按 EXIF 方向校正）的宽高 */
  width: number;
  height: number;
  /** 在格子里的缩放，1 = 刚好铺满格子 */
  zoom: number;
  /** 裁切位置 0..1，0.5 为居中 */
  px: number;
  py: number;
}

/** 布局模板：cells 为 0..1 的归一化矩形 */
export interface Template {
  id: string;
  cells: Rect[];
}

export interface Ratio {
  id: string;
  label: string;
  hint?: string;
  w: number;
  h: number;
}

export interface StyleSettings {
  /** 图片间距，单位：画布短边的千分之一 */
  gap: number;
  /** 外边框，单位同上 */
  padding: number;
  /** 圆角，单位同上 */
  radius: number;
  background: string;
}
