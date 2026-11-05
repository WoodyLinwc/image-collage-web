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

interface Output {
  url: string;
  blob: Blob;
  name: string;
}
interface Result {
  outputs: Output[];
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
  pages: number;
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
const toFiles = (outs: Output[]) => outs.map((o) => new File([o.blob], o.name, { type: o.blob.type }));

function triggerDownload(o: Output) {
  const a = document.createElement('a');
  a.href = o.url;
  a.download = o.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ExportSheet({ photos, template, ratio, style, pages, onClose }: Props) {
  const [sizeId, setSizeId] = useState<SizeId>('hd');
  const [format, setFormat] = useState<ExportFormat>('jpeg');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const urlsRef = useRef<string[]>([]);
  const alive = useRef(true);
  const runId = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
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
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setState({ kind: 'idle' });
  };

  const size = SIZES.find((s) => s.id === sizeId)!;
  const multi = pages > 1;

  async function generate() {
    clearResult();
    const id = runId.current;
    setState({ kind: 'working', progress: 0 });
    try {
      const blobs = await renderCollage({
        photos,
        template,
        ratio,
        style,
        pages,
        longSide: size.long,
        format,
        quality: 0.95,
        onProgress: (p) => {
          if (alive.current && runId.current === id) setState({ kind: 'working', progress: p });
        },
      });
      if (!alive.current || runId.current !== id) return;
      const base = `collage-${stamp()}`;
      const ext = format === 'png' ? 'png' : 'jpg';
      const outputs = blobs.map((blob, i) => {
        const url = URL.createObjectURL(blob);
        urlsRef.current.push(url);
        return { url, blob, name: multi ? `${base}-${i + 1}.${ext}` : `${base}.${ext}` };
      });
      let canShare = false;
      try {
        canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: toFiles(outputs) });
      } catch {
        canShare = false;
      }
      const { W, H } = exportSize(ratio, size.long);
      setState({ kind: 'done', result: { outputs, W, H, canShare } });
    } catch (err) {
      console.error(err);
      if (alive.current && runId.current === id) {
        setState({ kind: 'error', message: '生成失败了，可能是图片太大或手机内存不足，试试选小一点的尺寸。' });
      }
    }
  }

  async function shareAll(r: Result) {
    try {
      await navigator.share({ files: toFiles(r.outputs) });
    } catch {
      /* 用户取消分享 */
    }
  }

  async function downloadAll(r: Result) {
    for (const o of r.outputs) {
      triggerDownload(o);
      // 连续下载之间稍等一下，否则部分浏览器只会保存第一张
      await new Promise((res) => setTimeout(res, 400));
    }
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="导出图片">
        <div className="sheet-head">
          <h2>{multi ? `导出 ${pages} 张图片` : '导出图片'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <Icon name="close" />
          </button>
        </div>

        <div className="field">
          <div className="field-label">{multi ? '每张尺寸' : '尺寸'}</div>
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
            {multi ? (
              <div className="result-strip">
                {state.result.outputs.map((o, i) => (
                  <figure key={o.url}>
                    <img src={o.url} alt={`第 ${i + 1} 张`} style={{ aspectRatio: `${state.result.W} / ${state.result.H}` }} />
                    <figcaption>
                      <span>
                        {i + 1}/{pages}
                      </span>
                      <a href={o.url} download={o.name} aria-label={`下载第 ${i + 1} 张`}>
                        <Icon name="download" size={16} />
                      </a>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <img className="result-single" src={state.result.outputs[0].url} alt="拼图结果" />
            )}
            <p className="muted small center">
              {multi ? `每张 ` : ''}
              {state.result.W}×{state.result.H} ·{' '}
              {formatBytes(state.result.outputs.reduce((a, o) => a + o.blob.size, 0))}
              {multi ? ` · 发布时按 1→${pages} 的顺序上传` : ''} · 也可以长按图片保存
            </p>
            <div className="row">
              {state.result.canShare && (
                <button type="button" className="btn btn-lg" onClick={() => shareAll(state.result)}>
                  <Icon name="share" size={18} />
                  {multi ? '分享 / 全部存相册' : '分享 / 存相册'}
                </button>
              )}
              {multi ? (
                <button type="button" className="btn btn-lg btn-primary" onClick={() => downloadAll(state.result)}>
                  <Icon name="download" size={18} />
                  下载全部
                </button>
              ) : (
                <a className="btn btn-lg btn-primary" href={state.result.outputs[0].url} download={state.result.outputs[0].name}>
                  <Icon name="download" size={18} />
                  下载
                </a>
              )}
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
              {state.kind === 'working' ? `正在生成… ${Math.round(state.progress * 100)}%` : multi ? `生成 ${pages} 张图片` : '生成图片'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
