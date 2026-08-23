import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Star, Copy, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { InvoiceTemplate } from '../../lib/templateTypes';

export default function TemplateList() {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  function load() {
    setLoading(true);
    api
      .get<InvoiceTemplate[]>('/api/templates')
      .then(setTemplates)
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleCreate() {
    const tpl = await api.post<InvoiceTemplate>('/api/templates', { name: 'New Template', elements: [] });
    navigate(`/templates/${tpl.id}`);
  }

  async function handleSetDefault(id: number) {
    await api.post(`/api/templates/${id}/set-default`);
    load();
  }

  async function handleDuplicate(id: number) {
    await api.post(`/api/templates/${id}/duplicate`);
    load();
  }

  async function handleDelete(id: number) {
    await api.delete(`/api/templates/${id}`);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Invoice Templates</h1>
          <p className="text-sm text-text-muted mt-1">
            Design how your invoices look. The default template is used on every PDF.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 rounded-lg gradient-brand px-3.5 py-2 text-sm font-semibold"
        >
          <Plus size={16} /> New
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-text-muted mb-3">
            No custom templates yet — invoices use the built-in default layout.
          </p>
          <button onClick={handleCreate} className="rounded-lg gradient-brand px-4 py-2 text-sm font-semibold">
            Create your first template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-card p-4">
              <button
                onClick={() => navigate(`/templates/${t.id}`)}
                className="w-full aspect-[210/297] rounded-lg bg-white/95 mb-3 relative overflow-hidden text-left"
              >
                {t.elements.slice(0, 6).map((el) => (
                  <div
                    key={el.id}
                    className="absolute bg-gray-200 rounded-sm"
                    style={{
                      left: `${(el.x / 794) * 100}%`,
                      top: `${(el.y / 1123) * 100}%`,
                      width: `${(el.width / 794) * 100}%`,
                      height: `${(el.height / 1123) * 100}%`,
                    }}
                  />
                ))}
              </button>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium truncate">{t.name}</p>
                {t.is_default === 1 && (
                  <span className="text-[10px] font-semibold uppercase text-brand bg-brand/15 px-2 py-0.5 rounded-full">
                    Default
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-3">
                <button
                  onClick={() => handleSetDefault(t.id)}
                  disabled={t.is_default === 1}
                  aria-label="Set default"
                  className="flex-1 flex items-center justify-center rounded-lg border border-border py-1.5 text-text-muted hover:text-brand disabled:opacity-30"
                >
                  <Star size={14} />
                </button>
                <button
                  onClick={() => handleDuplicate(t.id)}
                  aria-label="Duplicate"
                  className="flex-1 flex items-center justify-center rounded-lg border border-border py-1.5 text-text-muted hover:text-brand"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  aria-label="Delete"
                  className="flex-1 flex items-center justify-center rounded-lg border border-border py-1.5 text-text-muted hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
