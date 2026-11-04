import type { Rect, Template } from './types';

/**
 * 布局用一个简短的描述字符串定义：
 *   "r:1,2"      按行排：第 1 行 1 张，第 2 行 2 张
 *   "c:1,2"      按列排：第 1 列 1 张，第 2 列 2 张
 *   "r:1,2/2,1"  斜杠后是每行（列）的相对大小，这里第 1 行占 2/3
 */
const CURATED: Record<number, string[]> = {
  1: ['r:1'],
  2: ['c:1,1', 'r:1,1', 'c:1,1/3,2', 'r:1,1/3,2'],
  3: ['c:1,2/3,2', 'r:1,2/3,2', 'c:1,1,1', 'r:1,1,1', 'r:2,1/2,3', 'c:2,1/2,3', 'r:1,2', 'c:1,2'],
  4: ['r:2,2', 'c:1,3/2,1', 'r:1,3/2,1', 'r:3,1/1,2', 'c:3,1/1,2', 'r:1,2,1', 'c:1,2,1', 'c:1,1,1,1', 'r:1,1,1,1'],
  5: ['r:2,3', 'r:3,2', 'c:2,3', 'c:3,2', 'r:1,4/2,1', 'c:1,2,2/2,1,1', 'r:2,1,2', 'c:2,1,2'],
  6: ['r:3,3', 'r:2,2,2', 'r:1,2,3/2,1,1', 'c:1,2,3/2,1,1', 'r:1,5/3,1', 'r:3,3/2,1'],
  7: ['r:2,3,2', 'r:3,1,3/1,2,1', 'r:3,4', 'r:4,3', 'c:2,3,2', 'r:1,3,3/2,1,1', 'c:3,1,3/1,2,1'],
  8: ['r:4,4', 'r:2,2,2,2', 'r:3,2,3', 'r:2,3,3', 'c:3,2,3', 'r:1,3,4/2,1,1', 'c:2,3,3'],
  9: ['r:3,3,3', 'r:4,1,4/1,2,1', 'r:1,4,4/2,1,1', 'r:2,3,4', 'c:2,3,4', 'r:2,2,2,3', 'c:4,1,4/1,2,1'],
};

function build(spec: string): { template: Template; count: number } {
  const [kind, rest] = spec.split(':');
  const [groupsStr, weightsStr] = rest.split('/');
  const groups = groupsStr.split(',').map(Number);
  const weights = weightsStr ? weightsStr.split(',').map(Number) : groups.map(() => 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const cells: Rect[] = [];
  let offset = 0;
  groups.forEach((n, i) => {
    const size = weights[i] / total;
    for (let j = 0; j < n; j++) {
      const a = j / n;
      const b = 1 / n;
      cells.push(kind === 'r' ? { x: a, y: offset, w: b, h: size } : { x: offset, y: a, w: size, h: b });
    }
    offset += size;
  });
  return { template: { id: spec, cells }, count: groups.reduce((a, b) => a + b, 0) };
}

/** 超过 9 张时自动生成均匀的行/列布局 */
function generatedSpecs(n: number): string[] {
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

function signature(t: Template): string {
  return t.cells
    .map((c) => [c.x, c.y, c.w, c.h].map((v) => v.toFixed(4)).join(','))
    .sort()
    .join('|');
}

const cache = new Map<number, Template[]>();

export function templatesFor(n: number): Template[] {
  if (n <= 0) return [];
  const hit = cache.get(n);
  if (hit) return hit;
  const specs = [...(CURATED[n] ?? []), ...generatedSpecs(n)];
  const seen = new Set<string>();
  const list: Template[] = [];
  for (const spec of specs) {
    const { template, count } = build(spec);
    if (count !== n) continue;
    const sig = signature(template);
    if (seen.has(sig)) continue;
    seen.add(sig);
    list.push(template);
  }
  cache.set(n, list);
  return list;
}
