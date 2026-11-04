import type { Photo } from './types';

export const MAX_PHOTOS = 20;
/** 预览图最长边。原图只在导出时读取，编辑时更省内存、更流畅 */
const PREVIEW_MAX = 1600;

let counter = 0;
const uid = () => `p${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** 用 <img> 解码：现代浏览器会自动按 EXIF 方向旋转，手机照片不会歪 */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('无法解码图片'));
    img.src = src;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export function isImageFile(f: File): boolean {
  return f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp)$/i.test(f.name);
}

export async function loadPhoto(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await loadImageElement(url);
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) {
    URL.revokeObjectURL(url);
    throw new Error('图片尺寸无效');
  }

  let previewUrl = url;
  const scale = PREVIEW_MAX / Math.max(width, height);
  if (scale < 1) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(width * scale));
    c.height = Math.max(1, Math.round(height * scale));
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      // 可能带透明通道的格式用 PNG，其他用 JPEG
      const transparent = /png|gif|webp|avif/i.test(file.type);
      const blob = await canvasToBlob(c, transparent ? 'image/png' : 'image/jpeg', 0.88);
      if (blob) {
        previewUrl = URL.createObjectURL(blob);
        URL.revokeObjectURL(url);
      }
    }
    c.width = 0;
    c.height = 0;
  }
  img.src = '';

  return { id: uid(), file, previewUrl, width, height, zoom: 1, px: 0.5, py: 0.5 };
}
