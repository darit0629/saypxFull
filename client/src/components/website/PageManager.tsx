import { useCallback, useRef, useState } from 'react';
import { Upload, Trash2, Copy, RefreshCw, GripVertical } from 'lucide-react';
import { api, apiUploadWithProgress, type AlbumPage, type PageMode } from '../../lib/api';
import { WEBSITE_BASE } from '../../lib/config';

interface Props {
  albumId: number;
  pages: AlbumPage[];
  pageMode: PageMode;
  onChange: () => void;
}

interface UploadTask {
  name: string;
  totalBytes: number;
  status: 'pending' | 'uploading' | 'done' | 'failed';
  percent: number;
  loadedBytes: number;
  bytesPerSecond: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PageManager({ albumId, pages, pageMode, onChange }: Props) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<number | null>(null);
  const dragRef = useRef<{ pageId: number; order: number[] } | null>(null);
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);

  const orderedPages = (localOrder || pages.map((p) => p.id))
    .map((id) => pages.find((p) => p.id === id))
    .filter((p): p is AlbumPage => !!p);

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setTasks(list.map((f) => ({ name: f.name, totalBytes: f.size, status: 'pending', percent: 0, loadedBytes: 0, bytesPerSecond: 0 })));
    setUploading(true);
    for (let i = 0; i < list.length; i++) {
      setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, status: 'uploading' } : t)));
      try {
        const formData = new FormData();
        formData.append('file', list[i]);
        await apiUploadWithProgress(`/api/website/albums/${albumId}/pages`, formData, (p) => {
          setTasks((prev) =>
            prev.map((t, idx) => (idx === i ? { ...t, percent: p.percent, loadedBytes: p.loadedBytes, bytesPerSecond: p.bytesPerSecond } : t))
          );
        });
        setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, status: 'done', percent: 100 } : t)));
      } catch {
        setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, status: 'failed' } : t)));
      }
    }
    setUploading(false);
    onChange();
  }

  async function handleReplace(files: FileList | null) {
    const pageId = replaceTargetRef.current;
    if (!files || files.length === 0 || pageId == null) return;
    const formData = new FormData();
    formData.append('file', files[0]);
    await apiUploadWithProgress(`/api/website/albums/${albumId}/pages/${pageId}/replace`, formData);
    onChange();
  }

  async function handleDuplicate(pageId: number) {
    await api.post(`/api/website/albums/${albumId}/pages/${pageId}/duplicate`);
    onChange();
  }

  async function handleSetCenter(imageId: number, pct: number) {
    const clamped = Math.max(0, Math.min(100, pct));
    await api.patch(`/api/website/albums/${albumId}/images/${imageId}/center`, { centerXPct: clamped });
    onChange();
  }

  async function handleDelete(pageId: number) {
    await api.delete(`/api/website/albums/${albumId}/pages/${pageId}`);
    setConfirmDeleteId(null);
    onChange();
  }

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest<HTMLElement>('[data-page-id]');
    if (!target) return;
    const overId = Number(target.dataset.pageId);
    if (overId === drag.pageId) return;
    const order = drag.order;
    const fromIdx = order.indexOf(drag.pageId);
    const toIdx = order.indexOf(overId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...order];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, drag.pageId);
    dragRef.current = { pageId: drag.pageId, order: next };
    setLocalOrder(next);
  }, []);

  const onPointerUp = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    if (drag) {
      api
        .patch(`/api/website/albums/${albumId}/pages/reorder`, { pageIds: drag.order })
        .then(() => {
          setLocalOrder(null);
          onChange();
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId, onPointerMove]);

  function startDrag(pageId: number, e: React.PointerEvent) {
    e.preventDefault();
    dragRef.current = { pageId, order: orderedPages.map((p) => p.id) };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {pageMode === 'FULL_SPREAD' ? `${pages.length} Spreads · ${pages.length * 2} Pages` : `${pages.length} Pages`}
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs"
        >
          <Upload size={14} /> Upload Pages
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleReplace(e.target.files)}
        />
      </div>

      {tasks.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
          {tasks.map((t, i) => (
            <div key={i} className="text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="truncate">{t.name}</span>
                <span
                  className={
                    t.status === 'done'
                      ? 'text-emerald-400'
                      : t.status === 'failed'
                        ? 'text-danger'
                        : 'text-text-muted'
                  }
                >
                  {t.status === 'uploading'
                    ? `${t.percent}%`
                    : t.status === 'done'
                      ? 'Done'
                      : t.status === 'failed'
                        ? 'Failed'
                        : 'Pending'}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-150 ${
                    t.status === 'failed' ? 'bg-danger' : t.status === 'done' ? 'bg-emerald-400' : 'gradient-brand'
                  }`}
                  style={{ width: `${t.status === 'pending' ? 0 : t.percent}%` }}
                />
              </div>
              {t.status === 'uploading' && (
                <div className="flex items-center justify-between mt-0.5 text-[10px] text-text-muted">
                  <span>
                    {formatBytes(t.loadedBytes)} / {formatBytes(t.totalBytes)}
                  </span>
                  <span>{formatBytes(t.bytesPerSecond)}/s</span>
                </div>
              )}
            </div>
          ))}
          {!uploading && (
            <button onClick={() => setTasks([])} className="text-[11px] text-text-muted mt-1">
              Clear
            </button>
          )}
        </div>
      )}

      {orderedPages.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-text-muted">No pages uploaded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {orderedPages.map((p, i) => (
            <div
              key={p.id}
              data-page-id={p.id}
              className="rounded-lg border border-border bg-card overflow-hidden select-none"
            >
              <div
                onPointerDown={(e) => startDrag(p.id, e)}
                className="relative aspect-square bg-black/20 cursor-grab active:cursor-grabbing"
              >
                <img src={`${WEBSITE_BASE}/${p.thumbnail_path}`} alt="" className="h-full w-full object-cover pointer-events-none" />
                <span className="absolute top-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                  <GripVertical size={10} />
                  {pageMode === 'FULL_SPREAD' ? `Spread ${i + 1}` : `Page ${i + 1}`}
                </span>
              </div>
              {pageMode === 'FULL_SPREAD' && (
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-[10px] text-text-muted">2 Pages</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSetCenter(p.image_id, (p.center_x_pct ?? 50) - 1)}
                      className="h-4 w-4 flex items-center justify-center rounded text-text-muted hover:text-brand text-[10px]"
                      aria-label="Shift center left"
                    >
                      −
                    </button>
                    <span className="text-[9px] text-text-muted tabular-nums">Center {Math.round(p.center_x_pct ?? 50)}%</span>
                    <button
                      onClick={() => handleSetCenter(p.image_id, (p.center_x_pct ?? 50) + 1)}
                      className="h-4 w-4 flex items-center justify-center rounded text-text-muted hover:text-brand text-[10px]"
                      aria-label="Shift center right"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1 p-1.5">
                <button
                  onClick={() => {
                    replaceTargetRef.current = p.id;
                    replaceInputRef.current?.click();
                  }}
                  className="flex-1 flex items-center justify-center rounded border border-border py-1 text-text-muted hover:text-brand"
                  aria-label="Replace"
                >
                  <RefreshCw size={12} />
                </button>
                <button
                  onClick={() => handleDuplicate(p.id)}
                  className="flex-1 flex items-center justify-center rounded border border-border py-1 text-text-muted hover:text-brand"
                  aria-label="Duplicate"
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(p.id)}
                  className="flex-1 flex items-center justify-center rounded border border-border py-1 text-text-muted hover:text-danger"
                  aria-label="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setConfirmDeleteId(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-secondary p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-2">Delete this page?</p>
            <p className="text-xs text-text-muted mb-4">Remaining pages will be renumbered automatically.</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 rounded-lg border border-border py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 rounded-lg bg-danger/90 py-2 text-sm font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
