import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Fit, Photo, StyleSettings } from './types';
import { RATIOS } from './ratios';
import { templatesFor } from './layouts';
import { cellRects, cornerRadius, frameWidth, MAX_ZOOM, styleUnit } from './geometry';
import { isImageFile, loadPhoto, MAX_PHOTOS } from './imageLoader';
import { Board } from './components/Board';
import { FitIcon, PagesButton, RatioButton, TemplateThumb } from './components/Thumbs';
import { ExportSheet } from './components/ExportSheet';
import { Icon } from './components/Icon';

const PAGE_OPTIONS = [1, 2, 3, 4, 5];
/** 预览时页与页之间的空隙 */
const PAGE_GAP = 10;
const BG_SWATCHES = ['#ffffff', '#f4efe6', '#e9d8c8', '#f6d4d8', '#cfdde6', '#dbe5cf', '#1d1b18', '#000000'];

type Tab = 'layout' | 'ratio' | 'pages' | 'style' | 'bg';
const TABS: { id: Tab; label: string }[] = [
  { id: 'layout', label: '布局' },
  { id: 'ratio', label: '比例' },
  { id: 'pages', label: '拆分' },
  { id: 'style', label: '边框' },
  { id: 'bg', label: '背景' },
];

function Slider({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span className="slider-label">{label}</span>
      <input type="range" min={0} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="slider-value">{value}</span>
    </label>
  );
}

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [ratioId, setRatioId] = useState('4:5');
  /** 横向拆成几张（Ins / 小红书左右滑动的无缝拼图） */
  const [pages, setPages] = useState(1);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [style, setStyle] = useState<StyleSettings>({ gap: 12, padding: 12, radius: 0, background: '#ffffff', fit: 'cover' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [tab, setTab] = useState<Tab>('layout');
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const ratio = RATIOS.find((r) => r.id === ratioId) ?? RATIOS[0];
  // 只在照片比例变化时重算布局（拖动、缩放不会触发）
  const aspectsKey = photos.map((p) => (p.width / p.height).toFixed(3)).join(',');
  const templates = useMemo(
    () => templatesFor(photos.length, pages, ratio.w / ratio.h, aspectsKey ? aspectsKey.split(',').map(Number) : []),
    [photos.length, pages, ratio, aspectsKey],
  );
  const artList = templates.filter((t) => t.free);
  const gridList = templates.filter((t) => !t.free);
  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const selected = photos.find((p) => p.id === selectedId) ?? null;

  // ---------- 提示 ----------
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  // ---------- 画布尺寸自适应 ----------
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setStage({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const board = useMemo(() => {
    if (stage.w <= 0 || stage.h <= 0) return null;
    // 先算单页宽度并取整，保证每条分页线都落在整像素上
    let pw = (stage.w - (pages - 1) * PAGE_GAP) / pages;
    if ((pw * ratio.h) / ratio.w > stage.h) pw = (stage.h * ratio.w) / ratio.h;
    pw = Math.floor(pw);
    return { W: pw * pages, H: Math.floor((pw * ratio.h) / ratio.w) };
  }, [stage, ratio, pages]);

  const unit = board ? styleUnit(board.W, board.H, pages) : 0;
  const rects = useMemo(
    () => (board && template ? cellRects(template, board.W, board.H, style, true, unit) : []),
    [board, template, style, unit],
  );
  const radii = useMemo(() => rects.map((r) => cornerRadius(style, unit, r)), [rects, style, unit]);

  // ---------- 图片增删改 ----------
  const addFiles = useCallback(
    async (list: File[]) => {
      const files = list.filter(isImageFile);
      if (!files.length) return;
      const room = MAX_PHOTOS - photosRef.current.length;
      if (room <= 0) {
        showToast(`最多 ${MAX_PHOTOS} 张图片`);
        return;
      }
      const take = files.slice(0, room);
      setBusy({ done: 0, total: take.length });
      const loaded: Photo[] = [];
      let failed = 0;
      for (let i = 0; i < take.length; i++) {
        try {
          loaded.push(await loadPhoto(take[i]));
        } catch {
          failed++;
        }
        setBusy({ done: i + 1, total: take.length });
      }
      setBusy(null);
      if (loaded.length) setPhotos((prev) => [...prev, ...loaded]);
      if (failed) showToast(`${failed} 张图片无法读取（可能是 HEIC 等格式），可以先转成 JPG 再试`);
      else if (files.length > room) showToast(`最多 ${MAX_PHOTOS} 张，已添加前 ${room} 张`);
    },
    [showToast],
  );

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    void addFiles(files);
  };

  const onReplace = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedId) return;
    const target = selectedId;
    try {
      const next = await loadPhoto(file);
      setPhotos((prev) =>
        prev.map((p) => {
          if (p.id !== target) return p;
          URL.revokeObjectURL(p.previewUrl);
          return next;
        }),
      );
      setSelectedId(next.id);
    } catch {
      showToast('这张图片无法读取，换一张试试');
    }
  };

  const updatePhoto = useCallback((id: string, patch: Partial<Photo>) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const fitOf = (p: Photo): Fit => p.fit ?? style.fit;

  /** 全局切换铺满 / 完整显示：所有图片跟随，并回到居中、不缩放 */
  const setFitAll = (fit: Fit) => {
    setStyle((s) => ({ ...s, fit }));
    setPhotos((prev) => prev.map((p) => ({ ...p, fit: undefined, zoom: 1, px: 0.5, py: 0.5 })));
  };

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    setPhotos((prev) => {
      const p = prev.find((x) => x.id === selectedId);
      if (p) URL.revokeObjectURL(p.previewUrl);
      return prev.filter((x) => x.id !== selectedId);
    });
    setSelectedId(null);
    setSwapMode(false);
  }, [selectedId]);

  const clearTimer = useRef<number | undefined>(undefined);
  const clearAll = () => {
    window.clearTimeout(clearTimer.current);
    if (!confirmClear) {
      setConfirmClear(true);
      clearTimer.current = window.setTimeout(() => setConfirmClear(false), 2500);
      return;
    }
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
    setSelectedId(null);
    setSwapMode(false);
    setConfirmClear(false);
  };

  const handleTap = useCallback(
    (id: string | null) => {
      if (id === null) {
        setSelectedId(null);
        setSwapMode(false);
        return;
      }
      if (swapMode && selectedId && id !== selectedId) {
        setPhotos((prev) => {
          const a = [...prev];
          const i = a.findIndex((p) => p.id === selectedId);
          const j = a.findIndex((p) => p.id === id);
          if (i < 0 || j < 0) return prev;
          [a[i], a[j]] = [a[j], a[i]];
          return a;
        });
        setSwapMode(false);
        return;
      }
      setSwapMode(false);
      setSelectedId((cur) => (cur === id ? null : id));
    },
    [swapMode, selectedId],
  );

  // ---------- 键盘（电脑端） ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (exportOpen) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') handleTap(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exportOpen, handleTap, removeSelected, selectedId]);

  const openPicker = () => addInputRef.current?.click();
  const closeExport = useCallback(() => setExportOpen(false), []);

  return (
    <div
      className="app"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        void addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="layers" size={18} />
          </span>
          拼图
        </div>
        {photos.length > 0 && (
          <button type="button" className={`btn btn-ghost ${confirmClear ? 'danger' : ''}`} onClick={clearAll}>
            {confirmClear ? '确认清空?' : '清空'}
          </button>
        )}
        <button type="button" className="btn" onClick={openPicker} disabled={photos.length >= MAX_PHOTOS}>
          <Icon name="plus" size={18} />
          图片
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setExportOpen(true)} disabled={photos.length === 0}>
          <Icon name="download" size={18} />
          导出
        </button>
      </header>

      <main className="workspace">
        <div className={`stage ${pages > 1 && photos.length > 0 ? 'multi' : ''}`} ref={stageRef} onClick={(e) => e.target === e.currentTarget && handleTap(null)}>
          {photos.length === 0 ? (
            <div className="empty">
              <div className="empty-art" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <h1>把多张照片拼成一张</h1>
              <p className="muted">支持 1:1、4:5、3:4、3:2、16:9 等比例，最多 {MAX_PHOTOS} 张</p>
              <button type="button" className="btn btn-lg btn-primary" onClick={openPicker}>
                <Icon name="plus" size={18} />
                选择图片
              </button>
              <p className="muted small">图片只在你的设备上处理，不会上传到任何服务器</p>
            </div>
          ) : board && template ? (
            <Board
              photos={photos}
              rects={rects}
              radii={radii}
              width={board.W}
              height={board.H}
              background={style.background}
              selectedId={selectedId}
              swapMode={swapMode}
              pages={pages}
              pageGap={PAGE_GAP}
              frames={template.frames}
              frameWidth={frameWidth(unit)}
              defaultFit={style.fit}
              onTap={handleTap}
              onChange={updatePhoto}
            />
          ) : null}
          {photos.length > 0 && !selected && <p className="hint">{pages > 1 ? `预览已按导出的 ${pages} 张分开显示 · 拖动或双指调整画面` : '拖动调整画面 · 双指或滚轮缩放 · 轻点选中图片'}</p>}
          {busy && (
            <div className="busy">
              <div className="spinner" />
              正在载入 {busy.done}/{busy.total}
            </div>
          )}
        </div>

        <aside className={`panel ${selected ? 'has-sel' : ''}`}>
          {selected && (
            <div className="selbar">
              {swapMode ? (
                <div className="selbar-tip">点另一张图片，与它交换位置</div>
              ) : (
                <label className="slider">
                  <span className="slider-label">缩放</span>
                  <input
                    type="range"
                    min={1}
                    max={MAX_ZOOM}
                    step={0.01}
                    value={selected.zoom}
                    onChange={(e) => updatePhoto(selected.id, { zoom: Number(e.target.value) })}
                  />
                  <span className="slider-value">{selected.zoom.toFixed(1)}×</span>
                </label>
              )}
              <div className="selbar-actions">
                <button type="button" className={`sel-btn ${swapMode ? 'on' : ''}`} onClick={() => setSwapMode((v) => !v)} disabled={photos.length < 2}>
                  <Icon name="swap" />
                  换位
                </button>
                <button
                  type="button"
                  className={`sel-btn ${fitOf(selected) === 'contain' ? 'on' : ''}`}
                  onClick={() => updatePhoto(selected.id, { fit: fitOf(selected) === 'contain' ? 'cover' : 'contain', zoom: 1, px: 0.5, py: 0.5 })}
                >
                  <Icon name="fit" />
                  完整
                </button>
                <button type="button" className="sel-btn" onClick={() => replaceInputRef.current?.click()}>
                  <Icon name="image" />
                  替换
                </button>
                <button type="button" className="sel-btn" onClick={() => updatePhoto(selected.id, { zoom: 1, px: 0.5, py: 0.5 })}>
                  <Icon name="reset" />
                  复位
                </button>
                <button type="button" className="sel-btn" onClick={removeSelected}>
                  <Icon name="trash" />
                  删除
                </button>
                <button type="button" className="sel-btn" onClick={() => handleTap(null)}>
                  <Icon name="check" />
                  完成
                </button>
              </div>
            </div>
          )}

          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button type="button" role="tab" aria-selected={tab === t.id} key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>

          <section className={`section ${tab === 'layout' ? 'active' : ''}`}>
            <h3 className="section-title">
              布局{photos.length > 0 && <span className="muted"> · {photos.length} 张</span>}
            </h3>
            {photos.length === 0 ? (
              <p className="muted small">添加图片后，这里会按张数给出可选布局</p>
            ) : (
              <div className="hscroll">
                {artList.length > 0 && <span className="thumb-group">留白</span>}
                {artList.map((t) => (
                  <TemplateThumb key={t.id} template={t} aspect={(pages * ratio.w) / ratio.h} pages={pages} active={t.id === template?.id} onClick={() => setTemplateId(t.id)} />
                ))}
                {artList.length > 0 && <span className="thumb-group">拼接</span>}
                {gridList.map((t) => (
                  <TemplateThumb key={t.id} template={t} aspect={(pages * ratio.w) / ratio.h} pages={pages} active={t.id === template?.id} onClick={() => setTemplateId(t.id)} />
                ))}
              </div>
            )}
          </section>

          <section className={`section ${tab === 'ratio' ? 'active' : ''}`}>
            <h3 className="section-title">每张比例</h3>
            <div className="hscroll">
              {RATIOS.map((r) => (
                <RatioButton key={r.id} ratio={r} active={r.id === ratio.id} onClick={() => setRatioId(r.id)} />
              ))}
            </div>
            <h3 className="section-title fit-title">图片填充</h3>
            <div className="fit-row">
              <span className="fit-label">图片</span>
              <div className="seg fit-seg" role="radiogroup" aria-label="图片填充方式">
                {(
                  [
                    ['cover', '铺满裁切', '多出的部分裁掉'],
                    ['contain', '完整显示', '空白处补背景色'],
                  ] as const
                ).map(([kind, title, desc]) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={style.fit === kind}
                    key={kind}
                    className={style.fit === kind ? 'active' : ''}
                    onClick={() => setFitAll(kind)}
                  >
                    <FitIcon kind={kind} />
                    <span className="fit-text">
                      <span className="fit-name">{title}</span>
                      <small>{desc}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className={`section ${tab === 'pages' ? 'active' : ''}`}>
            <h3 className="section-title">拆成多张</h3>
            <div className="pages-row">
              <span className="pages-label">拆成</span>
              <div className="hscroll pages-scroll">
                {PAGE_OPTIONS.map((n) => (
                  <PagesButton key={n} n={n} ratio={ratio} active={n === pages} onClick={() => setPages(n)} />
                ))}
              </div>
            </div>
            <p className="muted small pages-note">拆成多张时画面左右无缝衔接，适合 Ins / 小红书左右滑动</p>
          </section>

          <section className={`section ${tab === 'style' ? 'active' : ''}`}>
            <h3 className="section-title">边框</h3>
            <div className="sliders">
              <Slider label="间距" value={style.gap} max={60} onChange={(v) => setStyle((s) => ({ ...s, gap: v }))} />
              <Slider label="外框" value={style.padding} max={80} onChange={(v) => setStyle((s) => ({ ...s, padding: v }))} />
              <Slider label="圆角" value={style.radius} max={80} onChange={(v) => setStyle((s) => ({ ...s, radius: v }))} />
            </div>
            {template?.free && <p className="muted small style-note">当前是留白布局，留白由布局决定，间距和外框不生效</p>}
          </section>

          <section className={`section ${tab === 'bg' ? 'active' : ''}`}>
            <h3 className="section-title">背景颜色</h3>
            <div className="swatches">
              {BG_SWATCHES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`swatch ${style.background === c ? 'active' : ''}`}
                  style={{ background: c }}
                  aria-label={`背景 ${c}`}
                  onClick={() => setStyle((s) => ({ ...s, background: c }))}
                />
              ))}
              <label className={`swatch swatch-custom ${BG_SWATCHES.includes(style.background) ? '' : 'active'}`} aria-label="自定义颜色">
                <input type="color" value={style.background} onChange={(e) => setStyle((s) => ({ ...s, background: e.target.value }))} />
              </label>
            </div>
          </section>
        </aside>
      </main>

      <input ref={addInputRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
      <input ref={replaceInputRef} type="file" accept="image/*" hidden onChange={onReplace} />

      {toast && <div className="toast">{toast}</div>}

      {exportOpen && template && <ExportSheet photos={photos} template={template} ratio={ratio} style={style} pages={pages} onClose={closeExport} />}
    </div>
  );
}
