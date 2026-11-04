import type { Ratio, Template } from '../types';
import { cellRects } from '../geometry';

function fitBox(ratio: Ratio, max: number) {
  return ratio.w >= ratio.h ? { w: max, h: (max * ratio.h) / ratio.w } : { w: (max * ratio.w) / ratio.h, h: max };
}

export function TemplateThumb({ template, ratio, active, onClick }: { template: Template; ratio: Ratio; active: boolean; onClick: () => void }) {
  const { w, h } = fitBox(ratio, 46);
  const rects = cellRects(template, w, h, { gap: 70, padding: 0, radius: 0, background: '' }, false);
  return (
    <button type="button" className={`thumb ${active ? 'active' : ''}`} onClick={onClick} aria-label={`布局 ${template.id}`} aria-pressed={active}>
      <span className="thumb-box" style={{ width: w, height: h }}>
        {rects.map((r, i) => (
          <span key={i} className="thumb-cell" style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />
        ))}
      </span>
    </button>
  );
}

export function RatioButton({ ratio, active, onClick }: { ratio: Ratio; active: boolean; onClick: () => void }) {
  const { w, h } = fitBox(ratio, 26);
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
