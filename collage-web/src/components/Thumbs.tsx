import type { Ratio, Template } from '../types';
import { cellRects } from '../geometry';

function fitBox(aspect: number, maxW: number, maxH: number) {
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { w, h };
}

/** aspect = 整幅画布的宽高比（多页时是所有页拼起来的宽高比） */
export function TemplateThumb({
  template,
  aspect,
  pages,
  active,
  onClick,
}: {
  template: Template;
  aspect: number;
  pages: number;
  active: boolean;
  onClick: () => void;
}) {
  const { w, h } = fitBox(aspect, pages > 1 ? 84 : 46, 46);
  const rects = cellRects(template, w, h, { gap: 70, padding: 0, radius: 0, background: '' }, false, Math.min(w / pages, h));
  return (
    <button
      type="button"
      className={`thumb ${active ? 'active' : ''}`}
      style={{ width: Math.max(64, w + 18) }}
      onClick={onClick}
      aria-label={`布局 ${template.id}`}
      aria-pressed={active}
    >
      <span className={`thumb-box ${template.free ? 'free' : ''}`} style={{ width: w, height: h }}>
        {rects.map((r, i) => (
          <span
            key={i}
            className={`thumb-cell ${template.frames?.[i] ? 'framed' : ''}`}
            style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
          />
        ))}
        {Array.from({ length: pages - 1 }, (_, k) => (
          <span key={`s${k}`} className="thumb-seam" style={{ left: ((k + 1) * w) / pages }} />
        ))}
      </span>
    </button>
  );
}

export function RatioButton({ ratio, active, onClick }: { ratio: Ratio; active: boolean; onClick: () => void }) {
  const { w, h } = fitBox(ratio.w / ratio.h, 26, 26);
  return (
    <button type="button" className={`ratio ${active ? 'active' : ''}`} onClick={onClick} aria-pressed={active}>
      <span className="ratio-slot">
        <span className="ratio-icon" style={{ width: w, height: h }} />
      </span>
      <span className="ratio-label">{ratio.label}</span>
      <span className="ratio-hint">{ratio.hint ?? ' '}</span>
    </button>
  );
}

/** 页数选择的小图标：几个并排的竖框 */
export function PagesButton({ n, ratio, active, onClick }: { n: number; ratio: Ratio; active: boolean; onClick: () => void }) {
  const { w, h } = fitBox(ratio.w / ratio.h, 11, 18);
  return (
    <button type="button" className={`pages-btn ${active ? 'active' : ''}`} onClick={onClick} aria-pressed={active}>
      <span className="pages-icon">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} style={{ width: w, height: h }} />
        ))}
      </span>
      <span>{n === 1 ? '单张' : `${n} 张`}</span>
    </button>
  );
}
