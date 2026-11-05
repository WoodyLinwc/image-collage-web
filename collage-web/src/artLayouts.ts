import type { Rect, Template } from './types';

/* ------------------------------------------------------------------
 * 「留白」布局：像杂志排版一样，图片按自己的原始比例摆放，周围留白。
 *
 * 每个布局是从上到下的一列图片：
 *   blocks  每张图横向占的范围（0～1），l=0 或 r=1 表示贴边出血
 *   gaps    上边距、图与图之间、下边距的相对留白；0 = 贴边
 *           图与图之间为负数时表示叠放，-0.3 = 后一张往上压住自己高度的 30%
 *   frame   叠在上面的图，外圈加一道背景色描边
 *
 * 图片高度由照片自身比例算出，所以默认不裁切；放不下时整体等比缩小。
 * 横版画布（比如 16:9）会自动转成从左到右排列。
 * ------------------------------------------------------------------ */

interface Block {
  l: number;
  r: number;
  frame?: boolean;
}
interface ArtDef {
  id: string;
  blocks: Block[];
  gaps: number[];
  /** 缩放系数低于这个值就不显示（比如上下出血的布局缩小后就只是普通拼图了） */
  minK?: number;
}

const ART: Record<number, ArtDef[]> = {
  1: [
    { id: 'art1-frame', blocks: [{ l: 0.1, r: 0.9 }], gaps: [1, 1.6] },
    { id: 'art1-low', blocks: [{ l: 0, r: 1 }], gaps: [1, 0] },
    { id: 'art1-side', blocks: [{ l: 0.08, r: 0.7 }], gaps: [1.5, 1] },
  ],
  2: [
    // 上小下大，下面出血（截图那种）
    { id: 'art2-a', blocks: [{ l: 0.12, r: 0.88 }, { l: 0, r: 1 }], gaps: [1.2, 1, 0] },
    // 上小靠左，下面出血
    { id: 'art2-b', blocks: [{ l: 0.08, r: 0.6 }, { l: 0, r: 1 }], gaps: [1, 0.7, 0] },
    // 上小靠左，下大靠右出血
    { id: 'art2-c', blocks: [{ l: 0.08, r: 0.6 }, { l: 0.2, r: 1 }], gaps: [1.1, 0.8, 0] },
    // 上大出血，下小
    { id: 'art2-d', blocks: [{ l: 0, r: 1 }, { l: 0.12, r: 0.88 }], gaps: [0, 1, 1.2] },
    // 错位阶梯
    { id: 'art2-e', blocks: [{ l: 0.06, r: 0.66 }, { l: 0.34, r: 0.94 }], gaps: [1, 0.6, 1] },
    // 画廊双框
    { id: 'art2-f', blocks: [{ l: 0.1, r: 0.9 }, { l: 0.1, r: 0.9 }], gaps: [1, 0.5, 1] },
    // 上下出血，中间留白
    { id: 'art2-g', blocks: [{ l: 0, r: 1 }, { l: 0, r: 1 }], gaps: [0, 1, 0], minK: 0.9 },
    // 大图左右出血 + 小图压角
    { id: 'art2-h', blocks: [{ l: 0, r: 1 }, { l: 0.48, r: 0.94, frame: true }], gaps: [1, -0.35, 1.2] },
    // 小图在后，大图叠上去
    { id: 'art2-i', blocks: [{ l: 0.04, r: 0.68 }, { l: 0.3, r: 0.96, frame: true }], gaps: [1, -0.25, 1.2] },
  ],
  3: [
    // 三级阶梯
    { id: 'art3-a', blocks: [{ l: 0.06, r: 0.56 }, { l: 0.25, r: 0.75 }, { l: 0.44, r: 0.94 }], gaps: [1, 0.5, 0.5, 1] },
    // 叠放瀑布
    {
      id: 'art3-b',
      blocks: [{ l: 0.04, r: 0.6 }, { l: 0.22, r: 0.78, frame: true }, { l: 0.4, r: 0.96, frame: true }],
      gaps: [1, -0.3, -0.3, 1],
    },
    // 大图出血 + 两张错位小图
    { id: 'art3-c', blocks: [{ l: 0, r: 1 }, { l: 0.08, r: 0.6 }, { l: 0.4, r: 0.92 }], gaps: [0, 0.6, 0.4, 1] },
    // 上小、中出血、下小
    { id: 'art3-d', blocks: [{ l: 0.2, r: 0.8 }, { l: 0, r: 1 }, { l: 0.2, r: 0.8 }], gaps: [1, 0.6, 0.6, 1] },
  ],
};

/** 两图之间最少留白（占画布高度） */
const MIN_UNIT = 0.025;
const DEFAULT_ASPECT = 1.5;

/**
 * 竖向求解：A = 画布宽/高，ars = 每张照片宽/高
 * 返回归一化矩形和缩放系数 k（1 = 按设计宽度放下，越小说明越挤）
 */
function solveVertical(def: ArtDef, A: number, ars: number[]): { rects: Rect[]; k: number } {
  const base = def.blocks.map((b, i) => ((b.r - b.l) * A) / ars[i]);
  let overlap = 0;
  let posW = 0;
  def.gaps.forEach((g, i) => {
    if (g > 0) posW += g;
    else if (g < 0 && i > 0 && i < def.blocks.length) overlap += -g * base[i];
  });
  const net = base.reduce((a, b) => a + b, 0) - overlap;
  const k = Math.min(1, (1 - posW * MIN_UNIT) / net);
  const unit = posW > 0 ? (1 - k * net) / posW : 0;
  let y = posW > 0 ? 0 : (1 - k * net) / 2;

  const rects: Rect[] = def.blocks.map((b, i) => {
    const g = def.gaps[i];
    const h = base[i] * k;
    if (g >= 0) y += g * unit;
    else y += g * h; // 叠放：往上压
    const w = (b.r - b.l) * k;
    let x: number;
    if (b.l <= 0 && b.r < 1) x = 0;
    else if (b.r >= 1 && b.l > 0) x = 1 - w;
    else x = (b.l + b.r) / 2 - w / 2;
    const rect = { x, y, w, h };
    y += h;
    return rect;
  });
  return { rects, k };
}

export function artTemplates(n: number, pageAspect: number, photoAspects: number[]): Template[] {
  const defs = ART[n];
  if (!defs) return [];
  const ars = Array.from({ length: n }, (_, i) => Math.min(2.4, Math.max(0.5, photoAspects[i] || DEFAULT_ASPECT)));
  const out: Template[] = [];
  for (const def of defs) {
    const vertical = solveVertical(def, pageAspect, ars);
    const sideRaw = solveVertical(def, 1 / pageAspect, ars.map((a) => 1 / a));
    const side = { k: sideRaw.k, rects: sideRaw.rects.map((r) => ({ x: r.y, y: r.x, w: r.h, h: r.w })) };
    // 竖版画布优先上下排，横版优先左右排；放不下时换另一个方向
    const [natural, other] = pageAspect <= 1.1 ? [vertical, side] : [side, vertical];
    const pick = natural.k >= 0.72 || natural.k >= other.k ? natural : other;
    if (pick.k < (def.minK ?? 0.45)) continue;
    out.push({ id: def.id, cells: pick.rects, free: true, frames: def.blocks.map((b) => !!b.frame) });
  }
  return out;
}
