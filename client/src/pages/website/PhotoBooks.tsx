import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, BookImage, Eye } from 'lucide-react';
import { api, type DigitalAlbum, type AlbumStatus } from '../../lib/api';
import CreateAlbumDialog from '../../components/website/CreateAlbumDialog';
import { WEBSITE_BASE } from '../../lib/config';

const STATUS_TABS: { key: AlbumStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'UNPUBLISHED', label: 'Unpublished' },
  { key: 'ARCHIVED', label: 'Archived' },
];

const STATUS_STYLES: Record<AlbumStatus, string> = {
  DRAFT: 'bg-white/10 text-text-muted',
  PROCESSING: 'bg-amber-500/15 text-amber-400',
  PUBLISHED: 'bg-emerald-500/15 text-emerald-400',
  UNPUBLISHED: 'bg-white/10 text-text-muted',
  ARCHIVED: 'bg-white/5 text-text-muted',
};

const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'updated', label: 'Recently Updated' },
  { key: 'name_asc', label: 'Name A–Z' },
  { key: 'name_desc', label: 'Name Z–A' },
  { key: 'views', label: 'Most Viewed' },
];

export default function PhotoBooks() {
  const navigate = useNavigate();
  const location = useLocation();
  const isNewRoute = location.pathname === '/website/photo-books/new';
  const [albums, setAlbums] = useState<DigitalAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [status, setStatus] = useState<AlbumStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [createOpen, setCreateOpen] = useState(isNewRoute);

  function load() {
    setLoading(true);
    api
      .get<DigitalAlbum[]>(`/api/website/albums?status=${status}&search=${encodeURIComponent(search)}&sort=${sort}`)
      .then((res) => {
        setAlbums(res);
        setNotConfigured(false);
      })
      .catch(() => setNotConfigured(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, [status, sort]);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  if (notConfigured) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-text-muted">Website integration isn't configured, or the photography site's server isn't running.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Digital Photo Books</h1>
          <p className="text-sm text-text-muted mt-1">Create and manage interactive digital albums for your clients.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-lg gradient-brand px-3.5 py-2 text-sm font-semibold whitespace-nowrap"
        >
          <Plus size={16} /> Create Digital Photo Book
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                status === t.key ? 'bg-brand/15 text-brand' : 'text-text-muted hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search albums…"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-brand"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : albums.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <BookImage size={32} className="mx-auto mb-3 text-text-muted" />
          <p className="text-sm font-medium mb-1">No Digital Photo Books Yet</p>
          <p className="text-sm text-text-muted mb-4">
            Create your first digital album and give your clients a beautiful way to relive their memories.
          </p>
          <button onClick={() => setCreateOpen(true)} className="rounded-lg gradient-brand px-4 py-2 text-sm font-semibold">
            Create Digital Photo Book
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/website/photo-books/${a.id}`)}
              className="rounded-xl border border-border bg-card overflow-hidden text-left hover:border-brand/40 transition-colors"
            >
              <div className="aspect-[4/3] bg-black/20 flex items-center justify-center overflow-hidden">
                {a.cover_thumbnail ? (
                  <img src={`${WEBSITE_BASE}/${a.cover_thumbnail}`} alt="" className="h-full w-full object-cover" />
                ) : (
                  <BookImage size={28} className="text-text-muted" />
                )}
              </div>
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <span className={`shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLES[a.status]}`}>
                    {a.status}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted truncate">{a.client_name || 'No client set'}</p>
                <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
                  <span>
                    {a.page_mode === 'FULL_SPREAD' && a.spread_count
                      ? `${a.spread_count} Spreads · ${a.page_count} Pages`
                      : `${a.page_count} Pages`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye size={12} /> {a.view_count}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <CreateAlbumDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          if (isNewRoute) navigate('/website/photo-books', { replace: true });
          load();
        }}
      />
    </div>
  );
}
