import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Photo, Rect } from '../types';
import { MAX_ZOOM, placeImage } from '../geometry';

interface Props {
  photos: Photo[];
  rects: Rect[];
  radii: number[];
  width: number;
  height: number;
  background: string;
  selectedId: string | null;
  swapMode: boolean;
  /** 横向页数，>1 时画出分页线 */
  pages: number;
  onTap: (id: string | null) => void;
  onChange: (id: string, patch: Partial<Photo>) => void;
}

type Pt = { x: number; y: number };
type Gesture = {
  id: string | null;
  mode: 'pan' | 'pinch';
  x0: number;
  y0: number;
  px: number;
  py: number;
  zoom: number;
  d0: number;
  moved: boolean;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * 画布。手势统一在画布层处理：
 * 第一根手指落在哪张图，整个手势就作用在哪张图上，
 * 第二根手指落在别处也能双指缩放（小格子里放不下两根手指）。
 */
export function Board(props: Props) {
  const { photos, rects, radii, width, height, background, selectedId, swapMode, pages } = props;
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture | null>(null);

  const lookup = (id: string) => {
    const { photos: ps, rects: rs } = latest.current;
    const i = ps.findIndex((p) => p.id === id);
    return i >= 0 && rs[i] ? { photo: ps[i], rect: rs[i] } : null;
  };

  const beginPan = (g: Gesture, pt: Pt) => {
    const hit = g.id ? lookup(g.id) : null;
    g.mode = 'pan';
    g.x0 = pt.x;
    g.y0 = pt.y;
    g.px = hit?.photo.px ?? 0.5;
    g.py = hit?.photo.py ?? 0.5;
    g.zoom = hit?.photo.zoom ?? 1;
  };

  const beginPinch = (g: Gesture) => {
    const [a, b] = [...pointers.current.values()];
    const hit = g.id ? lookup(g.id) : null;
    g.mode = 'pinch';
    g.d0 = Math.max(1, dist(a, b));
    g.zoom = hit?.photo.zoom ?? 1;
    g.moved = true;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
      const g: Gesture = { id: el?.dataset.id ?? null, mode: 'pan', x0: 0, y0: 0, px: 0.5, py: 0.5, zoom: 1, d0: 1, moved: false };
      beginPan(g, { x: e.clientX, y: e.clientY });
      gesture.current = g;
    } else if (pointers.current.size === 2 && gesture.current?.id) {
      beginPinch(gesture.current);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.mode === 'pan') {
      if (pointers.current.size !== 1) return;
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      if (!g.moved && Math.hypot(dx, dy) < 6) return;
      g.moved = true;
      if (!g.id) return;
      const hit = lookup(g.id);
      if (!hit) return;
      const { photo, rect } = hit;
      const pl = placeImage(rect.w, rect.h, photo.width, photo.height, g.zoom, 0, 0);
      const ox = pl.w - rect.w;
      const oy = pl.h - rect.h;
      latest.current.onChange(g.id, {
        px: ox > 0.5 ? clamp(g.px - dx / ox, 0, 1) : photo.px,
        py: oy > 0.5 ? clamp(g.py - dy / oy, 0, 1) : photo.py,
      });
    } else if (g.id && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      latest.current.onChange(g.id, { zoom: clamp((g.zoom * dist(a, b)) / g.d0, 1, MAX_ZOOM) });
    }
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size === 0) {
      if (g && !g.moved && !cancelled) latest.current.onTap(g.id);
      gesture.current = null;
    } else if (g && pointers.current.size === 1) {
      // 双指松开一根，剩下那根继续拖动，不会跳
      const [pt] = [...pointers.current.values()];
      beginPan(g, pt);
    }
  };

  // 滚轮 / 触控板缩放（需要非 passive 监听才能阻止页面滚动）
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id;
      if (!id) return;
      e.preventDefault();
      const { photos: ps } = latest.current;
      const photo = ps.find((p) => p.id === id);
      if (!photo) return;
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      latest.current.onChange(id, { zoom: clamp(photo.zoom * factor, 1, MAX_ZOOM) });
    };
    // iOS Safari 的系统缩放手势
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', stop);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', stop);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="board"
      style={{ width, height, background }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endPointer(e, false)}
      onPointerCancel={(e) => endPointer(e, true)}
    >
      {rects.map((r, i) => {
        const p = photos[i];
        if (!p) return null;
        const pl = placeImage(r.w, r.h, p.width, p.height, p.zoom, p.px, p.py);
        const cls = ['cell', p.id === selectedId && 'is-selected', swapMode && p.id !== selectedId && 'is-swap']
          .filter(Boolean)
          .join(' ');
        return (
          <div key={p.id} data-id={p.id} className={cls} style={{ left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: radii[i] }}>
            <img
              src={p.previewUrl}
              alt=""
              draggable={false}
              style={{
                width: pl.w.toFixed(2) + 'px',
                height: pl.h.toFixed(2) + 'px',
                transform: `translate3d(${pl.x.toFixed(2)}px, ${pl.y.toFixed(2)}px, 0)`,
              }}
            />
          </div>
        );
      })}
      {pages > 1 &&
        Array.from({ length: pages }, (_, k) => (
          <div key={`pg${k}`} className="page-mark" style={{ left: (k * width) / pages, width: width / pages }} aria-hidden="true">
            {k > 0 && <span className="seam" />}
            <span className="page-no">
              {k + 1}/{pages}
            </span>
          </div>
        ))}
    </div>
  );
}
