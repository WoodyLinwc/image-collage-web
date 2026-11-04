import { useEffect, useRef, useState } from 'react';
import type { Photo, Ratio, StyleSettings, Template } from '../types';
import { exportSize, renderCollage } from '../exporter';
import type { ExportFormat } from '../exporter';
import { Icon } from './Icon';

const SIZES = [
  { id: 'std', label: '标准', long: 2048 },
  { id: 'hd', label: '高清', long: 3072 },
  { id: 'max', label: '超清', long: 4096 },
] as const;
type SizeId = (typeof SIZES)[number]['id'];

interface Result {
  url: string;
  blob: Blob;
  name: string;
  W: number;
  H: number;
  canShare: boolean;
}
type State =
  | { kind: 'idle' }
  | { kind: 'working'; progress: number }
  | { kind: 'done'; result: Result }
  | { kind: 'error'; message: string };

interface Props {
  photos: Photo[];
  template: Template;
  ratio: Ratio;
  style: StyleSettings;
  onClose: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function formatBytes(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

export function ExportSheet({ photos, template, ratio, style, onClose }: Props) {
  const [sizeId, setSizeId] = useState<SizeId>('hd');
  const [format, setFormat] = useState<ExportFormat>('jpeg');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const urlRef = useRef<string | null>(null);
  const alive = useRef(true);
  const runId = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const clearResult = () => {
    runId.current++;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setState({ kind: 'idle' });
  };

  const size = SIZES.find((s) => s.id === sizeId)!;

  async function generate() {
    clearResult();
    const id = runId.current;
    setState({ kind: 'working', progress: 0 });
    try {
      const blob = await renderCollage({
        photos,
        template,
        ratio,
        style,
        longSide: size.long,
        format,
        quality: 0.95,
        onProgress: (p) => {
          if (alive.current && runId.current === id) setState({ kind: 'working', progress: p });
        },
      });
      if (!alive.current || runId.current !== id) return;
      const name = `collage-${stamp()}.${format === 'png' ? 'png' : 'jpg'}`;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      let canShare = false;
      try {
        canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([blob], name, { type: blob.type })] });
      } catch {
        canShare = false;
      }
      const { W, H } = exportSize(ratio, size.long);
      setState({ kind: 'done', result: { url, blob, name, W, H, canShare } });
    } catch (err) {
      console.error(err);
      if (alive.current && runId.current === id) {
        setState({ kind: 'error', message: '生成失败了，可能是图片太大或手机内存不足，试试选小一点的尺寸。' });
      }
    }
  }

  async function share(r: Result) {
    try {
      await navigator.share({ files: [new File([r.blob], r.name, { type: r.blob.type })] });
    } catch {
      /* 用户取消分享 */
    }
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="导出图片">
        <div className="sheet-head">
          <h2>导出图片</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <Icon name="close" />
          </button>
        </div>

        <div className="field">
          <div className="field-label">尺寸</div>
          <div className="seg">
            {SIZES.map((s) => {
              const d = exportSize(ratio, s.long);
              return (
                <button
                  type="button"
                  key={s.id}
                  className={s.id === sizeId ? 'active' : ''}
                  onClick={() => {
                    setSizeId(s.id);
                    clearResult();
                  }}
                >
                  {s.label}
                  <small>
                    {d.W}×{d.H}
                  </small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <div className="field-label">格式</div>
          <div className="seg">
            <button
              type="button"
              className={format === 'jpeg' ? 'active' : ''}
              onClick={() => {
                setFormat('jpeg');
                clearResult();
              }}
            >
              JPG<small>质量 95% · 体积小</small>
            </button>
            <button
              type="button"
              className={format === 'png' ? 'active' : ''}
              onClick={() => {
                setFormat('png');
                clearResult();
              }}
            >
              PNG<small>无损 · 体积大</small>
            </button>
          </div>
        </div>

        {state.kind === 'error' && <p className="error">{state.message}</p>}

        {state.kind === 'done' ? (
          <div className="result">
            <img src={state.result.url} alt="拼图结果" />
            <p className="muted small center">
              {state.result.W}×{state.result.H} · {formatBytes(state.result.blob.size)} · 手机上也可以长按图片保存
            </p>
            <div className="row">
              {state.result.canShare && (
                <button type="button" className="btn btn-lg" onClick={() => share(state.result)}>
                  <Icon name="share" size={18} />
                  分享 / 存相册
                </button>
              )}
              <a className="btn btn-lg btn-primary" href={state.result.url} download={state.result.name}>
                <Icon name="download" size={18} />
                下载
              </a>
            </div>
          </div>
        ) : (
          <>
            {state.kind === 'working' && (
              <div className="progress">
                <div style={{ width: `${Math.round(state.progress * 100)}%` }} />
              </div>
            )}
            <button type="button" className="btn btn-lg btn-primary btn-block" disabled={state.kind === 'working'} onClick={generate}>
              {state.kind === 'working' ? `正在生成… ${Math.round(state.progress * 100)}%` : '生成图片'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
