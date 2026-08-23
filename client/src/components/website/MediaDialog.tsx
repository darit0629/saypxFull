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

export default function MediaDialog({ open, onClose, onSaved, categories, editingItem }: Props) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('');
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryEntries = Object.entries(categories);

  useEffect(() => {
    if (open) {
      setTitle(editingItem?.title || '');
      setSubtitle(editingItem?.subtitle || '');
      setCategory(editingItem?.category || categoryEntries[0]?.[0] || NEW_CATEGORY);
      setNewCategoryLabel('');
      setFile(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingItem]);

  if (!open) return null;
  const isEditing = !!editingItem;

  async function handleSave() {
    if (!title.trim()) return setError('Title is required');
    if (category === NEW_CATEGORY && !newCategoryLabel.trim()) return setError('New category name is required');
    if (!isEditing && !file) return setError('A photo or video file is required');

    setSaving(true);
    setError(null);
    try {
      if (isEditing) {
        await api.put(`/api/website/portfolio/${editingItem._index}`, {
          title: title.trim(),
          subtitle: subtitle.trim(),
          category: category === NEW_CATEGORY ? newCategoryLabel.trim() : category,
        });
      } else {
        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('subtitle', subtitle.trim());
        formData.append('category', category);
        if (category === NEW_CATEGORY) formData.append('newCategoryLabel', newCategoryLabel.trim());
        formData.append('file', file as File);
        await apiUpload('/api/website/portfolio', formData);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl border border-border bg-bg-secondary p-5 sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">{isEditing ? 'Edit Media' : 'Add Media'}</p>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="space-y-3">
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
              <label className="block text-[10px] text-text-muted mb-1">Photo or Video</label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-text-muted"
              >
                {file ? file.name : 'Choose file…'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg gradient-brand py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
