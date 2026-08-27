import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Copy, Check, Download, ExternalLink, Upload, X } from 'lucide-react';
import { api, apiUpload, type DigitalAlbum } from '../../lib/api';
import { WEBSITE_BASE } from '../../lib/config';
import PageManager from '../../components/website/PageManager';
import CoverPicker from '../../components/website/CoverPicker';

const AUDIO_MODES: { value: DigitalAlbum['audio_mode']; label: string }[] = [
  { value: 'page-flip-sound-only', label: 'Page-flip sound only' },
  { value: 'music-only', label: 'Background music only' },
  { value: 'both', label: 'Both page-flip sound and music' },
  { value: 'silent', label: 'Silent' },
];

function AudioAndExtras({ album, onChange }: { album: DigitalAlbum; onChange: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagline, setTagline] = useState(album.loading_tagline || '');
  useEffect(() => setTagline(album.loading_tagline || ''), [album.id, album.loading_tagline]);

  async function uploadMusic(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      await apiUpload(`/api/website/albums/${album.id}/music`, formData);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload music');
    } finally {
      setUploading(false);
    }
  }

  async function removeMusic() {
    if (!confirm('Remove the background music track?')) return;
    await api.delete(`/api/website/albums/${album.id}/music`);
    onChange();
  }

  async function uploadLogo(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingLogo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      await apiUpload(`/api/website/albums/${album.id}/logo`, formData);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload logo');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    if (!confirm('Remove the brand logo? The loading screen will fall back to the default SAYPX wordmark.')) return;
    await api.delete(`/api/website/albums/${album.id}/logo`);
    onChange();
  }

  // The Saypxmain PATCH route maps camelCase body keys to snake_case
  // columns by hand (matching CoverPicker's coverImageId/backCoverImageId
  // convention) - it does NOT accept the snake_case keys the GET response
  // itself uses, so this must not be typed as Partial<DigitalAlbum>.
  async function patch(fields: {
    audioMode?: DigitalAlbum['audio_mode'];
    musicVolume?: number;
    musicLoop?: 0 | 1;
    loadingTagline?: string | null;
  }) {
    setError(null);
    try {
      await api.patch(`/api/website/albums/${album.id}`, fields);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <p className="text-sm font-medium">Audio & Extras</p>
      {error && <p className="text-xs text-danger">{error}</p>}

      <div>
        <p className="text-[10px] text-text-muted uppercase mb-1.5">Background Music</p>
        {album.background_music_path ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <audio controls src={`${WEBSITE_BASE}/${album.background_music_path}`} className="h-9 max-w-xs" />
            <button
              onClick={removeMusic}
              className="flex items-center gap-1.5 self-start rounded-lg border border-danger/40 px-3 py-1.5 text-xs text-danger"
            >
              <X size={13} /> Remove
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-muted disabled:opacity-50"
          >
            <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload a music track'}
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => uploadMusic(e.target.files)} />
      </div>

      <div>
        <p className="text-[10px] text-text-muted uppercase mb-1.5">Audio Mode</p>
        <select
          value={album.audio_mode}
          onChange={(e) => patch({ audioMode: e.target.value as DigitalAlbum['audio_mode'] })}
          className="w-full max-w-xs rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
        >
          {AUDIO_MODES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="flex-1 max-w-xs">
          <p className="text-[10px] text-text-muted uppercase mb-1.5">Music Volume — {Math.round(album.music_volume * 100)}%</p>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            defaultValue={album.music_volume}
            onMouseUp={(e) => patch({ musicVolume: Number((e.target as HTMLInputElement).value) })}
            onTouchEnd={(e) => patch({ musicVolume: Number((e.target as HTMLInputElement).value) })}
            className="w-full"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!album.music_loop}
            onChange={(e) => patch({ musicLoop: e.target.checked ? 1 : 0 })}
          />
          Loop music
        </label>
      </div>

      <div>
        <p className="text-[10px] text-text-muted uppercase mb-1.5">Brand Logo (shown on the loading screen)</p>
        {album.logo_path ? (
          <div className="flex items-center gap-3">
            <img
              src={`${WEBSITE_BASE}/${album.logo_path}`}
              alt="Brand logo"
              className="h-10 max-w-[140px] object-contain rounded border border-border bg-black/20 p-1"
            />
            <button
              onClick={removeLogo}
              className="flex items-center gap-1.5 rounded-lg border border-danger/40 px-3 py-1.5 text-xs text-danger"
            >
              <X size={13} /> Remove
            </button>
          </div>
        ) : (
          <button
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
            className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-muted disabled:opacity-50"
          >
            <Upload size={14} /> {uploadingLogo ? 'Uploading…' : 'Upload a brand logo'}
          </button>
        )}
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files)} />
      </div>

      <div>
        <p className="text-[10px] text-text-muted uppercase mb-1.5">Loading Screen Tagline</p>
        <div className="flex gap-2 max-w-md">
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Leave blank for a default tagline"
            className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
          />
          <button
            onClick={() => patch({ loadingTagline: tagline.trim() || null })}
            className="rounded-lg border border-border px-3 py-2 text-sm shrink-0"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-white/10 text-text-muted',
  PROCESSING: 'bg-amber-500/15 text-amber-400',
  PUBLISHED: 'bg-emerald-500/15 text-emerald-400',
  UNPUBLISHED: 'bg-white/10 text-text-muted',
  ARCHIVED: 'bg-white/10 text-text-muted',
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm"
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export default function AlbumDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<DigitalAlbum | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .get<DigitalAlbum>(`/api/website/albums/${id}`)
      .then(setAlbum)
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  async function handleDuplicate() {
    const copy = await api.post<DigitalAlbum>(`/api/website/albums/${id}/duplicate`);
    navigate(`/website/photo-books/${copy.id}`);
  }

  async function handleDelete() {
    if (!confirm('Delete this digital photo book? This cannot be undone.')) return;
    await api.delete(`/api/website/albums/${id}`);
    navigate('/website/photo-books');
  }

  async function togglePublish() {
    if (!album) return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      const nextStatus = album.status === 'PUBLISHED' ? 'UNPUBLISHED' : 'PUBLISHED';
      await api.patch(`/api/website/albums/${id}`, { status: nextStatus });
      load();
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Could not update status');
    } finally {
      setStatusBusy(false);
    }
  }

  async function downloadQr(format: 'png' | 'svg') {
    const res = await fetch(`/api/website/albums/${id}/qr?format=${format}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${album?.public_code || 'album'}-qr.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!album) return <p className="text-sm text-text-muted">Album not found.</p>;

  return (
    <div className="space-y-5 max-w-4xl">
      <button
        onClick={() => navigate('/website/photo-books')}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft size={16} /> Back to Photo Books
      </button>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">{album.title}</h1>
          <p className="text-sm text-text-muted mt-1">{album.client_name || 'No client set'} · {album.event_type || 'No event type'}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[10px] text-text-muted uppercase mb-0.5">Album Code</p>
            <p className="font-mono">{album.public_code}</p>
          </div>
          <div>
            <p className="text-[10px] text-text-muted uppercase mb-0.5">Status</p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[album.status]}`}>
              {album.status}
            </span>
          </div>
          <div>
            <p className="text-[10px] text-text-muted uppercase mb-0.5">Page Format</p>
            <p>{album.page_mode === 'FULL_SPREAD' ? 'Full Spread / Center Fold' : 'Single Page'}</p>
          </div>
          <div>
            <p className="text-[10px] text-text-muted uppercase mb-0.5">Pages</p>
            <p>{album.page_mode === 'FULL_SPREAD' && album.spread_count ? `${album.spread_count} Spreads · ${album.page_count} Pages` : `${album.page_count} Pages`}</p>
          </div>
        </div>

        {statusError && <p className="text-xs text-danger">{statusError}</p>}

        <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
          <button
            onClick={togglePublish}
            disabled={statusBusy || album.status === 'ARCHIVED'}
            className="rounded-lg gradient-brand px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {statusBusy ? 'Working…' : album.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
          </button>
          <button onClick={handleDuplicate} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm">
            <Copy size={14} /> Duplicate
          </button>
          <button onClick={handleDelete} className="flex items-center gap-1.5 rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger ml-auto">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium mb-3">Share & QR</p>
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="h-36 w-36 shrink-0 rounded-lg bg-white p-2">
            <img src={`/api/website/albums/${album.id}/qr`} alt="Album QR code" className="h-full w-full object-contain" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-xs text-text-muted break-all">{album.public_url}</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={album.public_url} label="Copy Link" />
              <CopyButton text={album.public_code} label="Copy Code" />
              <a
                href={album.public_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <ExternalLink size={14} /> Open
              </a>
              <button onClick={() => downloadQr('png')} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm">
                <Download size={14} /> PNG
              </button>
              <button onClick={() => downloadQr('svg')} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm">
                <Download size={14} /> SVG
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium mb-3">Cover & Back Cover</p>
        <div className="flex flex-col sm:flex-row gap-6">
          <CoverPicker
            albumId={album.id}
            which="cover"
            label="Cover"
            current={album.coverImage}
            pages={album.pages || []}
            onChange={load}
          />
          <CoverPicker
            albumId={album.id}
            which="back-cover"
            label="Back Cover"
            current={album.backCoverImage}
            pages={album.pages || []}
            onChange={load}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <PageManager albumId={album.id} pages={album.pages || []} pageMode={album.page_mode} onChange={load} />
      </div>

      <AudioAndExtras album={album} onChange={load} />
    </div>
  );
}
