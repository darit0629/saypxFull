import { useEffect, useState } from 'react';
import { api, type Client } from '../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (client: Client) => void;
  editingClient?: Client | null;
}

export default function ClientDialog({ open, onClose, onSaved, editingClient }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editingClient?.name || '');
      setPhone(editingClient?.phone || '');
      setEmail(editingClient?.email || '');
      setAddress(editingClient?.address || '');
      setError(null);
    }
  }, [open, editingClient]);

  if (!open) return null;

  async function handleSave() {
    if (!name.trim()) {
      setError('Client name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = { name, phone, email, address };
      const client = editingClient
        ? await api.put<Client>(`/api/clients/${editingClient.id}`, body)
        : await api.post<Client>('/api/clients', body);
      onSaved(client);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-bg-secondary p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-4">
          {editingClient ? 'Edit Client' : 'Add Client'}
        </h3>

        {error && (
          <div className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Name *</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Phone</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Email</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Address</label>
            <textarea
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 text-sm text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg gradient-brand py-2 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
