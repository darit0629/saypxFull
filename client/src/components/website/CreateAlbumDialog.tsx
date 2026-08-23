import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { api, type DigitalAlbum, type PageMode } from '../../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

const EVENT_TYPES = [
  'Wedding', 'Engagement', 'Pre-Wedding', 'Birthday', 'Anniversary', 'Baby',
  'Maternity', 'Travel', 'Fashion', 'Corporate', 'Event', 'Portfolio', 'Other',
];

export default function CreateAlbumDialog({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [pageMode, setPageMode] = useState<PageMode>('SINGLE_PAGE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setClientName('');
      setEventType(EVENT_TYPES[0]);
      setPageMode('SINGLE_PAGE');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleCreate() {
    if (!title.trim()) return setError('Album name is required');
    setSaving(true);
    setError(null);
    try {
      const album = await api.post<DigitalAlbum>('/api/website/albums', {
        title: title.trim(),
        clientName: clientName.trim(),
        eventType,
        pageMode,
      });
      onClose();
      navigate(`/website/photo-books/${album.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create album');
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
          <p className="text-sm font-semibold">Create Digital Photo Book</p>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Album Name</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Riya & Arjun's Wedding"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Client Name</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Event Type</label>
            <select
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Page Format</label>
            <div className="space-y-2">
              <button
                onClick={() => setPageMode('SINGLE_PAGE')}
                className={`w-full rounded-lg border p-3 text-left text-sm ${
                  pageMode === 'SINGLE_PAGE' ? 'border-brand bg-brand/10' : 'border-border'
                }`}
              >
                <p className="font-medium">Single Page</p>
                <p className="text-[11px] text-text-muted mt-0.5">Each uploaded image represents one page.</p>
              </button>
              <button
                onClick={() => setPageMode('FULL_SPREAD')}
                className={`w-full rounded-lg border p-3 text-left text-sm ${
                  pageMode === 'FULL_SPREAD' ? 'border-brand bg-brand/10' : 'border-border'
                }`}
              >
                <p className="font-medium">Full Spread / Center Fold</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Choose this if each JPG contains both the left and right pages of your physical album.
                </p>
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full rounded-lg gradient-brand py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
