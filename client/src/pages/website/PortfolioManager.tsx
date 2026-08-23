import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, PlayCircle, X, CheckSquare, Square } from 'lucide-react';
import { api, type PortfolioItem, type PortfolioCategories } from '../../lib/api';
import MediaDialog from '../../components/website/MediaDialog';
import { WEBSITE_BASE } from '../../lib/config';

export default function PortfolioManager() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAddRoute = location.pathname === '/website/add';
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [categories, setCategories] = useState<PortfolioCategories>({});
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(isAddRoute);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<{ items: PortfolioItem[]; categories: PortfolioCategories }>('/api/website/portfolio')
      .then((res) => {
        setItems(res.items);
        setCategories(res.categories);
        setNotConfigured(false);
      })
      .catch(() => setNotConfigured(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Navigating to /website/add while PortfolioManager is already mounted
  // (e.g. from the mobile nav's FAB) doesn't remount the component, so the
  // dialogOpen useState initializer above only fires on the very first mount
  // - this catches the route change on subsequent navigations too.
  useEffect(() => {
    if (isAddRoute) setDialogOpen(true);
  }, [isAddRoute]);

  async function handleDelete(index: number) {
    await api.delete(`/api/website/portfolio/${index}`);
    setConfirmDeleteIndex(null);
    load();
  }

  function toggleSelected(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      // Delete highest index first — each delete shifts the array, so lower
      // indices must stay untouched until later deletes have already happened.
      const indices = Array.from(selected).sort((a, b) => b - a);
      for (const index of indices) {
        await api.delete(`/api/website/portfolio/${index}`);
      }
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDelete(false);
      exitSelectMode();
      load();
    }
  }

  if (notConfigured) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-text-muted">Website integration isn't configured, or the photography site's server isn't running.</p>
      </div>
    );
  }

  const filtered = filter === 'all' ? items : items.filter((i) => i.category === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Website Portfolio</h1>
          <p className="text-sm text-text-muted mt-1">{items.length} media items on saypx.in</p>
        </div>
        {selectMode ? (
          <button
            onClick={exitSelectMode}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-text-muted"
          >
            <X size={16} /> Cancel
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={() => setSelectMode(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-text-muted"
              >
                <CheckSquare size={16} /> Select
              </button>
            )}
            <button
              onClick={() => {
                setEditingItem(null);
                setDialogOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg gradient-brand px-3.5 py-2 text-sm font-semibold"
            >
              <Plus size={16} /> Add Media
            </button>
          </div>
        )}
      </div>

      {selectMode && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5">
          <span className="text-sm text-text-muted">{selected.size} selected</span>
          <button
            onClick={() => setConfirmBulkDelete(true)}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 rounded-lg bg-danger/90 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            <Trash2 size={13} /> Delete Selected
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
            filter === 'all' ? 'bg-brand/15 text-brand' : 'text-text-muted hover:bg-white/5'
          }`}
        >
          All
        </button>
        {Object.entries(categories).map(([slug, label]) => (
          <button
            key={slug}
            onClick={() => setFilter(slug)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
              filter === slug ? 'bg-brand/15 text-brand' : 'text-text-muted hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-text-muted">No media in this category yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item) => {
            const thumbSrc = item.type === 'video' ? item.poster : item.src;
            const isSelected = selected.has(item._index);
            return (
              <div
                key={item._index}
                onClick={() => selectMode && toggleSelected(item._index)}
                className={`rounded-xl border overflow-hidden ${
                  selectMode ? 'cursor-pointer' : ''
                } ${isSelected ? 'border-brand ring-2 ring-brand/40' : 'border-border'} bg-card`}
              >
                <div className="relative aspect-square bg-black/20">
                  {thumbSrc && (
                    <img src={`${WEBSITE_BASE}/${thumbSrc}`} alt={item.alt} className="h-full w-full object-cover" />
                  )}
                  {item.type === 'video' && (
                    <PlayCircle size={28} className="absolute inset-0 m-auto text-white drop-shadow-lg" />
                  )}
                  {selectMode && (
                    <div className="absolute top-2 right-2 rounded-md bg-black/50 p-0.5 text-white">
                      {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-[11px] text-text-muted truncate">{categories[item.category] || item.category}</p>
                  {!selectMode && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setDialogOpen(true);
                      }}
                      className="flex-1 flex items-center justify-center rounded-lg border border-border py-1.5 text-text-muted hover:text-brand"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteIndex(item._index)}
                      className="flex-1 flex items-center justify-center rounded-lg border border-border py-1.5 text-text-muted hover:text-danger"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MediaDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          if (isAddRoute) navigate('/website', { replace: true });
        }}
        onSaved={load}
        categories={categories}
        editingItem={editingItem}
      />

      {confirmDeleteIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setConfirmDeleteIndex(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-bg-secondary p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold mb-2">Delete this media?</p>
            <p className="text-xs text-text-muted mb-4">
              This permanently removes the file from the live website. This can't be undone.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmDeleteIndex(null)}
                className="flex-1 rounded-lg border border-border py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteIndex)}
                className="flex-1 rounded-lg bg-danger/90 py-2 text-sm font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmBulkDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => !bulkDeleting && setConfirmBulkDelete(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-bg-secondary p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold mb-2">Delete {selected.size} media items?</p>
            <p className="text-xs text-text-muted mb-4">
              This permanently removes {selected.size} file{selected.size === 1 ? '' : 's'} from the live website. This can't be undone.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmBulkDelete(false)}
                disabled={bulkDeleting}
                className="flex-1 rounded-lg border border-border py-2 text-sm disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 rounded-lg bg-danger/90 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {bulkDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
