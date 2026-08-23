import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { apiUpload, api, type PortfolioItem, type PortfolioCategories } from '../../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: PortfolioCategories;
  editingItem?: PortfolioItem | null;
}

const NEW_CATEGORY = '__new__';

function titleFromFilename(name: string) {
  const base = name.replace(/\.[^./\\]+$/, '');
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function MediaDialog({ open, onClose, onSaved, categories, editingItem }: Props) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('');
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const categoryEntries = Object.entries(categories);
  const isBatch = files.length > 1;

  useEffect(() => {
    if (open) {
      setTitle(editingItem?.title || '');
      setSubtitle(editingItem?.subtitle || '');
      setCategory(editingItem?.category || categoryEntries[0]?.[0] || NEW_CATEGORY);
      setNewCategoryLabel('');
      setFiles([]);
      setProgress(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingItem]);

  if (!open) return null;
  const isEditing = !!editingItem;

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (category === NEW_CATEGORY && !newCategoryLabel.trim()) return setError('New category name is required');
    const resolvedCategory = category === NEW_CATEGORY ? newCategoryLabel.trim() : category;

    setSaving(true);
    setError(null);
    try {
      if (isEditing) {
        if (!title.trim()) return setError('Title is required');
        await api.put(`/api/website/portfolio/${editingItem._index}`, {
          title: title.trim(),
          subtitle: subtitle.trim(),
          category: resolvedCategory,
        });
      } else if (isBatch) {
        const failed: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          setProgress({ done: i, total: files.length });
          try {
            const formData = new FormData();
            formData.append('title', titleFromFilename(f.name) || f.name);
            formData.append('category', category);
            if (category === NEW_CATEGORY) formData.append('newCategoryLabel', newCategoryLabel.trim());
            formData.append('file', f);
            await apiUpload('/api/website/portfolio', formData);
          } catch {
            failed.push(f.name);
          }
        }
        setProgress(null);
        if (failed.length) {
          setError(`${files.length - failed.length} of ${files.length} uploaded. Failed: ${failed.join(', ')}`);
          onSaved();
          return;
        }
      } else {
        if (!title.trim()) return setError('Title is required');
        if (!files[0]) return setError('A photo or video file is required');
        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('subtitle', subtitle.trim());
        formData.append('category', category);
        if (category === NEW_CATEGORY) formData.append('newCategoryLabel', newCategoryLabel.trim());
        formData.append('file', files[0]);
        await apiUpload('/api/website/portfolio', formData);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl border border-border bg-bg-secondary p-5 sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">
            {isEditing ? 'Edit Media' : isBatch ? `Add Media (${files.length} files)` : 'Add Media'}
          </p>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="space-y-3">
          {!isBatch && (
            <>
              <div>
                <label className="block text-[10px] text-text-muted mb-1">Title</label>
                <input
                  className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted mb-1">Subtitle (optional)</label>
                <input
                  className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                />
              </div>
            </>
          )}
          {isBatch && (
            <p className="text-xs text-text-muted">
              Titles will be set from each file's name — you can rename them individually afterward.
            </p>
          )}
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Category</label>
            <select
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categoryEntries.map(([slug, label]) => (
                <option key={slug} value={slug}>
                  {label}
                </option>
              ))}
              <option value={NEW_CATEGORY}>+ New category…</option>
            </select>
          </div>
          {category === NEW_CATEGORY && (
            <div>
              <label className="block text-[10px] text-text-muted mb-1">New Category Name</label>
              <input
                className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
              />
            </div>
          )}
          {!isEditing && (
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Photos or Videos</label>
              {/* Two separate pickers, not one accept="image/*,video/*" input: Android's
                  native photo picker only offers multi-select when the accept type is a
                  single category - mixing image and video drops it back to single-select. */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-left text-sm text-text-muted"
                >
                  {files.length === 0
                    ? 'Choose photos…'
                    : files.length === 1
                      ? files[0].name
                      : `${files.length} files selected`}
                </button>
                <button
                  onClick={() => videoInputRef.current?.click()}
                  className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm text-text-muted"
                >
                  + Video
                </button>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
              />
              {isBatch && (
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-[#171921] px-2.5 py-1.5 text-xs"
                    >
                      <span className="truncate">{f.name}</span>
                      <button
                        onClick={() => removeFile(i)}
                        aria-label={`Remove ${f.name}`}
                        className="shrink-0 text-text-muted hover:text-danger"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving || (isBatch && files.length === 0)}
            className="w-full rounded-lg gradient-brand py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving
              ? progress
                ? `Uploading ${progress.done + 1} of ${progress.total}…`
                : 'Saving…'
              : isEditing
                ? 'Save Changes'
                : isBatch
                  ? `Upload ${files.length} Files`
                  : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
