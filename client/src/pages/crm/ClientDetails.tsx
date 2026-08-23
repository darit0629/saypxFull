import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, MessageCircle, Edit, Trash2, Plus } from 'lucide-react';
import { api, formatMoney, formatDate, type Client, type Invoice } from '../../lib/api';
import ClientDialog from '../../components/ClientDialog';

interface ClientWithInvoices extends Client {
  invoices: Invoice[];
}

export default function ClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientWithInvoices | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<ClientWithInvoices>(`/api/clients/${id}`)
      .then(setClient)
      .catch((e) => setError(e.message));
  }

  useEffect(load, [id]);

  async function handleDelete() {
    try {
      await api.delete(`/api/clients/${id}`);
      navigate('/crm');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error) return <div className="text-sm text-red-300">{error}</div>;
  if (!client) return <div className="text-sm text-text-muted">Loading…</div>;

  const whatsappPhone = (client.phone || '').replace(/[^0-9]/g, '');

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate('/crm')}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft size={16} /> Back to CRM
      </button>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-brand text-lg font-semibold">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-semibold">{client.name}</h1>
              <p className="text-xs text-text-muted mt-0.5">{client.address || 'No address'}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setEditOpen(true)}
              aria-label="Edit"
              className="rounded-lg border border-border p-2 text-text-muted hover:text-brand hover:border-brand/50"
            >
              <Edit size={15} />
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete"
              className="rounded-lg border border-border p-2 text-text-muted hover:text-danger hover:border-danger/50"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {client.phone && (
            <a
              href={`tel:${client.phone}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-medium hover:border-brand/50"
            >
              <Phone size={14} /> Call
            </a>
          )}
          {whatsappPhone && (
            <a
              href={`https://wa.me/${whatsappPhone}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-medium hover:border-success/50"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          <button
            onClick={() => navigate(`/bills/new?clientId=${client.id}`)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg gradient-brand py-2 text-xs font-semibold"
          >
            <Plus size={14} /> Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-lg font-bold">{formatMoney(client.total_revenue || 0)}</p>
          <p className="text-xs text-text-muted mt-1">Revenue</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-lg font-bold">{formatMoney(client.total_due || 0)}</p>
          <p className="text-xs text-text-muted mt-1">Due</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-lg font-bold">{client.invoice_count || 0}</p>
          <p className="text-xs text-text-muted mt-1">Invoices</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium mb-3">Invoice History</p>
        {client.invoices.length === 0 ? (
          <p className="text-sm text-text-muted">No invoices yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {client.invoices.map((inv) => (
              <button
                key={inv.id}
                onClick={() => navigate(`/bills/${inv.id}`)}
                className="w-full flex items-center justify-between py-3 text-left hover:bg-white/5 rounded-lg px-2 -mx-2"
              >
                <div>
                  <p className="text-sm font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-text-muted mt-0.5">{formatDate(inv.invoice_date)}</p>
                </div>
                <p className="text-sm font-semibold">{formatMoney(inv.total_amount)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <ClientDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => load()}
        editingClient={client}
      />

      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setDeleteOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-bg-secondary p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-2">Delete Client?</h3>
            <p className="text-sm text-text-muted mb-5">
              {client.invoice_count && client.invoice_count > 0
                ? `This client has ${client.invoice_count} existing invoice(s). Their invoice history will be preserved.`
                : 'This cannot be undone.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteOpen(false)}
                className="flex-1 rounded-lg border border-border py-2 text-sm text-text-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-lg bg-danger py-2 text-sm font-semibold text-white"
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
