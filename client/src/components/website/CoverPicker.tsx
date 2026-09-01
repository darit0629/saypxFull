import { useRef, useState } from 'react';
import { X, Upload } from 'lucide-react';
import { api, apiUpload, type AlbumPage, type AlbumImageRef } from '../../lib/api';
import { websiteAssetUrl } from '../../lib/config';

interface Props {
  albumId: number;
  which: 'cover' | 'back-cover';
  label: string;
  current: AlbumImageRef | null | undefined;
  pages: AlbumPage[];
  onChange: () => void;
}

export default function CoverPicker({ albumId, which, label, current, pages, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const field = which === 'cover' ? 'coverImageId' : 'backCoverImageId';

  async function selectExistingPage(page: AlbumPage) {
    await api.patch(`/api/website/albums/${albumId}`, { [field]: page.image_id });
    setPickerOpen(false);
    onChange();
  }

  async function uploadNew(files: FileList | null) {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    formData.append('file', files[0]);
    await apiUpload(`/api/website/albums/${albumId}/${which}`, formData);
    setPickerOpen(false);
    onChange();
  }

  async function clearCover() {
    await api.patch(`/api/website/albums/${albumId}`, { [field]: null });
    onChange();
  }

  return (
    <div>
      <p className="text-[10px] text-text-muted uppercase mb-1">{label}</p>
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 rounded-lg border border-border bg-black/20 overflow-hidden shrink-0">
          {current ? (
            <img src={websiteAssetUrl(current.thumbnail_path)} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-[9px] text-text-muted">None</div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={() => setPickerOpen(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs">
            Choose {label}
          </button>
          {current && (
            <button onClick={clearCover} className="text-[11px] text-text-muted text-left">
              Clear
            </button>
          )}
        </div>
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setPickerOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-bg-secondary p-5 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold">Choose {label}</p>
              <button onClick={() => setPickerOpen(false)} aria-label="Close">
                <X size={18} className="text-text-muted" />
              </button>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-sm text-text-muted mb-4"
            >
              <Upload size={14} /> Upload a dedicated {label.toLowerCase()} image
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadNew(e.target.files)} />

            <p className="text-[10px] text-text-muted uppercase mb-2">Or use an existing page</p>
            <div className="grid grid-cols-4 gap-2">
              {pages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectExistingPage(p)}
                  className="aspect-square rounded-lg border border-border overflow-hidden hover:border-brand"
                >
                  <img src={websiteAssetUrl(p.thumbnail_path)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
