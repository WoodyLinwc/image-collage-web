import type { Rect, Template } from './types';
import { artTemplates } from './artLayouts';

/* ------------------------------------------------------------------
 * 布局树：H 为左右并排，V 为上下堆叠，L 为一张图。
 * [权重, 节点] 可以指定相对大小，例如 V([1, L], [2, L]) = 上小下大。
 * ------------------------------------------------------------------ */
type Node = { k: 'leaf' } | { k: 'h' | 'v'; items: Node[]; weights: number[] };
type Item = Node | [number, Node];

const L: Node = { k: 'leaf' };
const group = (k: 'h' | 'v', items: Item[]): Node => ({
  k,
  items: items.map((i) => (Array.isArray(i) ? i[1] : i)),
  weights: items.map((i) => (Array.isArray(i) ? i[0] : 1)),
});
const H = (...items: Item[]) => group('h', items);
const V = (...items: Item[]) => group('v', items);

/**
 * 简写字符串，最常用的两层布局：
 *   "r:1,2"      按行：第 1 行 1 张，第 2 行 2 张
 *   "c:1,2"      按列：第 1 列 1 张，第 2 列 2 张
 *   "r:1,1/1,2"  斜杠后是每行（列）的相对大小，这里上小下大
 */
function parseSpec(spec: string): Node {
  const [kind, rest] = spec.split(':');
  const [groupsStr, weightsStr] = rest.split('/');
  const groups = groupsStr.split(',').map(Number);
  const weights = weightsStr ? weightsStr.split(',').map(Number) : groups.map(() => 1);
  const inner = (n: number) => {
    const leaves = Array.from({ length: n }, () => L);
    return kind === 'r' ? H(...leaves) : V(...leaves);
  };
  const items: Item[] = groups.map((n, i) => [weights[i], inner(n)]);
  return kind === 'r' ? V(...items) : H(...items);
}

const SPECS: Record<number, string[]> = {
  1: ['r:1'],
  2: ['c:1,1', 'r:1,1', 'r:1,1/2,3', 'r:1,1/3,2', 'r:1,1/1,2', 'r:1,1/2,1', 'c:1,1/2,3', 'c:1,1/3,2', 'c:1,1/1,2', 'c:1,1/2,1'],
  3: [
    'c:1,2/3,2', 'r:1,2/3,2', 'r:2,1/2,3', 'r:2,1/1,2', 'c:2,1/2,3', 'c:1,1,1', 'r:1,1,1',
    'r:1,1,1/1,2,1', 'c:1,1,1/1,2,1', 'r:1,2', 'c:1,2', 'r:1,2/2,1',
  ],
  4: [
    'r:2,2', 'c:1,3/2,1', 'r:1,3/2,1', 'r:3,1/1,2', 'c:3,1/1,2', 'r:2,2/2,3', 'r:2,2/3,2', 'c:2,2/3,2',
    'r:1,2,1', 'c:1,2,1', 'r:1,1,2/2,1,1', 'c:1,1,1,1', 'r:1,1,1,1',
  ],
  5: ['r:2,3', 'r:3,2', 'c:2,3', 'c:3,2', 'r:1,4/2,1', 'c:1,2,2/2,1,1', 'r:2,1,2', 'c:2,1,2', 'r:3,2/1,2'],
  6: ['r:3,3', 'r:2,2,2', 'r:1,2,3/2,1,1', 'c:1,2,3/2,1,1', 'r:1,5/3,1', 'r:3,3/2,1', 'c:2,2,2/1,1.4,1'],
  7: ['r:2,3,2', 'r:3,1,3/1,2,1', 'r:3,4', 'r:4,3', 'c:2,3,2', 'r:1,3,3/2,1,1', 'c:3,1,3/1,2,1'],
  8: ['r:4,4', 'r:2,2,2,2', 'r:3,2,3', 'r:2,3,3', 'c:3,2,3', 'r:1,3,4/2,1,1', 'c:2,3,3'],
  9: ['r:3,3,3', 'r:4,1,4/1,2,1', 'r:1,4,4/2,1,1', 'r:2,3,4', 'c:2,3,4', 'r:2,2,2,3', 'c:4,1,4/1,2,1'],
};

/** 两层以上的组合布局：交错、L 形、中间大图等 */
const NESTED: Record<number, [string, Node][]> = {
  3: [['n3a', V([2, H(L, L)], [3, L])]],
  4: [
    ['n4a', H(V([2, L], [1, L]), V([1, L], [2, L]))],
    ['n4b', H([2, V([2, L], [1, L])], [1, V(L, L)])],
    ['n4c', V([2, H([2, L], [1, L])], [1, H([1, L], [2, L])])],
  ],
  5: [
    ['n5a', V([2, H([2, L], [1, V(L, L)])], [1, H(L, L)])],
    ['n5b', H([1, V(L, L)], [1.4, L], [1, V(L, L)])],
    ['n5c', V([1, H(L, L)], [1.4, L], [1, H(L, L)])],
    ['n5d', H(V([3, L], [2, L]), V([2, L], [3, L]), [1, V(L)]) ],
  ],
  6: [
    ['n6a', H(V([2, L], [1, L]), V([1, L], [2, L]), V([2, L], [1, L]))],
    ['n6b', V([2, H([2, L], [1, V(L, L)])], [1, H(L, L, L)])],
    ['n6c', H([1, V(L, L)], [1.5, V(L, L)], [1, V(L, L)])],
  ],
  7: [
    ['n7a', H([1, V(L, L, L)], [1.6, L], [1, V(L, L, L)])],
    ['n7b', V([2, H([2, L], [1, V(L, L)])], [1, H(L, L, L, L)])],
    ['n7c', H(V([2, L], [1, L]), V([1, L], [1.4, L], [1, L]), V([1, L], [2, L]))],
  ],
  8: [
    ['n8a', H(V([3, L], [2, L]), V([2, L], [3, L]), V([3, L], [2, L]), V([2, L], [3, L]))],
    ['n8b', V([2, H([2, L], [1, V(L, L)])], [1, H(L, L, L)], [1, H(L, L)])],
    ['n8c', H([1, V(L, L, L)], [1.4, V([2, L], [1, L])], [1, V(L, L, L)])],
  ],
  9: [
    ['n9a', H(V([2, L], [1, L], [1.5, L]), V([1, L], [1.5, L], [2, L]), V([1.5, L], [2, L], [1, L]))],
    ['n9b', H([1, V(L, L, L, L)], [1.5, L], [1, V(L, L, L, L)])],
    ['n9c', V([2, H([2, L], [1, V(L, L)])], [1, H(L, L, L)], [1, H(L, L, L)])],
  ],
};

function layoutNode(n: Node, x: number, y: number, w: number, h: number, out: Rect[]) {
  if (n.k === 'leaf') {
    out.push({ x, y, w, h });
    return;
  }
  const total = n.weights.reduce((a, b) => a + b, 0);
  let off = 0;
  n.items.forEach((child, i) => {
    const f = n.weights[i] / total;
    if (n.k === 'h') layoutNode(child, x + off * w, y, f * w, h, out);
    else layoutNode(child, x, y + off * h, w, f * h, out);
    off += f;
  });
}

function toTemplate(id: string, node: Node): Template {
  const cells: Rect[] = [];
  layoutNode(node, 0, 0, 1, 1, cells);
  return { id, cells };
}

/** 超过 9 张时自动生成均匀的行/列布局 */
function balancedSpecs(n: number): string[] {
  const root = Math.sqrt(n);
  const ks: number[] = [];
  for (let k = Math.max(1, Math.floor(root) - 1); k <= Math.ceil(root) + 1; k++) if (k <= n) ks.push(k);
  ks.sort((a, b) => Math.abs(a - root) - Math.abs(b - root));
  const specs: string[] = [];
  for (const k of ks) {
    const base = Math.floor(n / k);
    const extra = n % k;
    const groups = Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
    if (Math.max(...groups) > 6) continue;
    specs.push(`r:${groups.join(',')}`, `c:${groups.join(',')}`);
  }
  return specs;
}

/** 多页时：把 n 张图分成若干列（每列 1～3 张）的所有组合 */
function columnSpecs(n: number, maxCols: number): string[] {
  if (n > 12) return [];
  const out: string[] = [];
  const rec = (left: number, acc: number[]) => {
    if (out.length >= 400) return;
    if (left === 0) {
      out.push(`c:${acc.join(',')}`);
      return;
    }
    if (acc.length >= maxCols) return;
    for (let k = 1; k <= Math.min(3, left); k++) rec(left - k, [...acc, k]);
  };
  rec(n, []);
  return out;
}

/**
 * 多页（轮播）布局打分：格子别太细长；有图跨过分页线时加分，
 * 因为左右滑动时画面连在一起才是这种拼图的看点。
 */
function score(t: Template, aspect: number, pages: number): number {
  const pens = t.cells.map((c) => Math.max(0, Math.abs(Math.log((c.w * aspect) / c.h)) - 0.35));
  const mean = pens.reduce((a, b) => a + b, 0) / pens.length;
  const max = Math.max(...pens);
  let crosses = false;
  for (let k = 1; k < pages; k++) {
    const s = k / pages;
    if (t.cells.some((c) => c.x < s - 0.02 && c.x + c.w > s + 0.02)) crosses = true;
  }
  return mean + 0.5 * max - (crosses ? 0.3 : 0);
}

function signature(t: Template): string {
  return t.cells
    .map((c) => [c.x, c.y, c.w, c.h].map((v) => v.toFixed(4)).join(','))
    .sort()
    .join('|');
}

const cache = new Map<string, Template[]>();

/**
 * @param n            图片张数
 * @param pages        横向拆成几张（1 = 普通拼图）
 * @param pageAspect   单页宽高比
 * @param photoAspects 每张照片的宽高比（留白布局按照片原比例排）
 * 返回：先是拼接布局，单页时后面再接「留白」布局
 */
export function templatesFor(n: number, pages = 1, pageAspect = 1, photoAspects: number[] = []): Template[] {
  if (n <= 0) return [];
  const grid = gridTemplates(n, pages, pageAspect);
  return pages > 1 ? grid : [...grid, ...artTemplates(n, pageAspect, photoAspects)];
}

function gridTemplates(n: number, pages: number, pageAspect: number): Template[] {
  const key = pages > 1 ? `${n}|${pages}|${pageAspect.toFixed(3)}` : `${n}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const candidates: Template[] = [
    ...(SPECS[n] ?? []).map((s) => toTemplate(s, parseSpec(s))),
    ...(NESTED[n] ?? []).map(([id, node]) => toTemplate(id, node)),
    ...balancedSpecs(n).map((s) => toTemplate(s, parseSpec(s))),
    ...(pages > 1 ? columnSpecs(n, Math.min(n, pages * 3)).map((s) => toTemplate(s, parseSpec(s))) : []),
  ];

  const seen = new Set<string>();
  let list: Template[] = [];
  for (const t of candidates) {
    if (t.cells.length !== n) continue;
    const sig = signature(t);
    if (seen.has(sig)) continue;
    seen.add(sig);
    list.push(t);
  }

  if (pages > 1) {
    const aspect = pages * pageAspect;
    list = list
      .map((t, i) => ({ t, i, s: score(t, aspect, pages) }))
      .sort((a, b) => a.s - b.s || a.i - b.i)
      .slice(0, 18)
      .map((x) => x.t);
  }

  cache.set(key, list);
  return list;
}
