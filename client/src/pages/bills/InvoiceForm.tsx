import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { api, formatMoney, type Client, type Invoice, type InvoiceItem } from '../../lib/api';
import ClientDialog from '../../components/ClientDialog';

function toDateInput(ts: number | null | undefined): string {
  if (!ts) return '';
  return new Date(ts).toISOString().slice(0, 10);
}

export default function InvoiceForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<number | ''>('');
  const [invoiceDate, setInvoiceDate] = useState(toDateInput(Date.now()));
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, rate: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Client[]>('/api/clients').then(setClients);
  }, []);

  useEffect(() => {
    const preselect = searchParams.get('clientId');
    if (preselect) setClientId(Number(preselect));
  }, [searchParams]);

  useEffect(() => {
    if (isEdit) {
      api.get<Invoice>(`/api/invoices/${id}`).then((inv) => {
        setClientId(inv.client_id || '');
        setInvoiceDate(toDateInput(inv.invoice_date));
        setDueDate(toDateInput(inv.due_date));
        setItems(inv.items.map((it) => ({ ...it })));
        setDiscount(inv.discount);
        setTax(inv.tax);
        setReceivedAmount(inv.received_amount);
        setNotes(inv.notes || '');
        setTerms(inv.terms || '');
        setEventDate(toDateInput(inv.event_date));
        setEventLocation(inv.event_location || '');
      });
    }
  }, [id, isEdit]);

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0),
    [items]
  );
  const total = Math.max(0, subtotal - discount + tax);
  const due = Math.max(0, total - receivedAmount);

  function updateItem(idx: number, patch: Partial<InvoiceItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { description: '', quantity: 1, rate: 0 }]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setError(null);
    if (!clientId) return setError('Please select a client');
    if (items.length === 0 || items.some((it) => !it.description.trim()))
      return setError('Every item needs a description');

    setSaving(true);
    try {
      const body = {
        clientId,
        invoiceDate,
        dueDate: dueDate || null,
        items,
        discount,
        tax,
        receivedAmount,
        notes,
        terms,
        eventDate: eventDate || null,
        eventLocation: eventLocation || null,
      };
      const saved = isEdit
        ? await api.put<Invoice>(`/api/invoices/${id}`, body)
        : await api.post<Invoice>('/api/invoices', body);
      navigate(`/bills/${saved.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="text-xl font-semibold">{isEdit ? 'Edit Invoice' : 'Create Invoice'}</h1>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <label className="block text-xs text-text-muted mb-1.5">Client</label>
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-lg border border-border bg-[#171921] px-3 py-2.5 text-sm outline-none focus:border-brand"
              value={clientId}
              onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setClientDialogOpen(true)}
              className="rounded-lg border border-border px-3 text-sm text-text-muted hover:text-brand"
            >
              + New
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Invoice Date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2.5 text-sm outline-none focus:border-brand"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Due Date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2.5 text-sm outline-none focus:border-brand"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Items</p>
          <button onClick={addItem} className="flex items-center gap-1 text-xs text-brand">
            <Plus size={14} /> Add Item
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                />
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(idx)}
                    className="text-text-muted hover:text-danger px-1"
                    aria-label="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Qty</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-sm outline-none focus:border-brand"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Rate</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-sm outline-none focus:border-brand"
                    value={item.rate}
                    onChange={(e) => updateItem(idx, { rate: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Amount</label>
                  <div className="rounded-lg border border-border bg-white/5 px-2 py-1.5 text-sm text-text-muted">
                    {formatMoney((Number(item.quantity) || 0) * (Number(item.rate) || 0))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Discount</label>
              <input
                type="number"
                className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Tax</label>
              <input
                type="number"
                className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                value={tax}
                onChange={(e) => setTax(Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Amount Received</label>
            <input
              type="number"
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={receivedAmount}
              onChange={(e) => setReceivedAmount(Number(e.target.value))}
            />
          </div>

          <div className="pt-2 space-y-1 text-sm">
            <div className="flex justify-between text-text-muted">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-1">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
            <div className="flex justify-between text-warning">
              <span>Due</span>
              <span>{formatMoney(due)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <p className="text-sm font-medium">Work / Event Details</p>
        <p className="text-xs text-text-muted -mt-2">Optional — shows as "Work For" on the invoice, separate from the invoice date.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Event Date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2.5 text-sm outline-none focus:border-brand"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Short Address</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2.5 text-sm outline-none focus:border-brand"
              placeholder="e.g. Payradanga"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div>
          <label className="block text-xs text-text-muted mb-1.5">Notes</label>
          <textarea
            className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1.5">Terms</label>
          <textarea
            className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
            rows={2}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg gradient-brand py-3 text-sm font-semibold disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save & Preview'}
      </button>

      <ClientDialog
        open={clientDialogOpen}
        onClose={() => setClientDialogOpen(false)}
        onSaved={(c) => {
          setClients((prev) => [...prev, c]);
          setClientId(c.id);
        }}
      />
    </div>
  );
}
