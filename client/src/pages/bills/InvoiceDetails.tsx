import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Copy, Share2, Download, CheckCircle2 } from 'lucide-react';
import { api, formatMoney, formatDate, type Invoice } from '../../lib/api';

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-success/15 text-success',
  partial: 'bg-warning/15 text-warning',
  unpaid: 'bg-white/10 text-text-muted',
  overdue: 'bg-danger/15 text-danger',
};

export default function InvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function load() {
    api
      .get<Invoice>(`/api/invoices/${id}`)
      .then(setInvoice)
      .catch((e) => setError(e.message));
  }

  useEffect(load, [id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/invoices/${id}`);
      navigate('/bills');
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function handleDuplicate() {
    setBusy(true);
    try {
      const copy = await api.post<Invoice>(`/api/invoices/${id}/duplicate`);
      navigate(`/bills/${copy.id}`);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkPaid() {
    setBusy(true);
    try {
      const updated = await api.post<Invoice>(`/api/invoices/${id}/mark-paid`);
      setInvoice(updated);
      showToast('Marked as paid');
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function fetchPdfBlob(): Promise<Blob> {
    const res = await fetch(`/api/invoices/${id}/pdf`);
    if (!res.ok) throw new Error('Failed to generate PDF');
    return res.blob();
  }

  async function handleDownload() {
    setBusy(true);
    try {
      const blob = await fetchPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice!.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    setBusy(true);
    try {
      const blob = await fetchPdfBlob();
      const file = new File([blob], `${invoice!.invoice_number}.pdf`, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'SAYPX Invoice',
          text: `Invoice ${invoice!.invoice_number}`,
          files: [file],
        });
      } else if (navigator.share) {
        // Some browsers support Web Share without file support.
        await navigator.share({ title: 'SAYPX Invoice', text: `Invoice ${invoice!.invoice_number}` });
        showToast('Sharing text only — your browser doesn’t support sharing files. PDF downloaded instead.');
        await handleDownload();
      } else {
        showToast('Sharing isn’t supported in this browser — downloading the PDF instead.');
        await handleDownload();
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') showToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="text-sm text-red-300">{error}</div>;
  if (!invoice) return <div className="text-sm text-text-muted">Loading…</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <button
        onClick={() => navigate('/bills')}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft size={16} /> Back to Bills
      </button>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold">{invoice.invoice_number}</h1>
            <p className="text-sm text-text-muted mt-1">{invoice.client_name}</p>
          </div>
          <span
            className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${STATUS_STYLES[invoice.display_status]}`}
          >
            {invoice.display_status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <p className="text-text-muted text-xs">Total</p>
            <p className="font-semibold mt-0.5">{formatMoney(invoice.total_amount)}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs">Due</p>
            <p className="font-semibold mt-0.5 text-warning">{formatMoney(invoice.due_amount)}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs">Invoice Date</p>
            <p className="mt-0.5">{formatDate(invoice.invoice_date)}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs">Due Date</p>
            <p className="mt-0.5">{formatDate(invoice.due_date)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-5">
          <button
            onClick={() => navigate(`/bills/${id}/edit`)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-sm hover:border-brand/50"
          >
            <Edit size={15} /> Edit
          </button>
          <button
            onClick={handleShare}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-lg gradient-brand py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            <Share2 size={15} /> Share
          </button>
          <button
            onClick={handleDownload}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-sm hover:border-brand/50"
          >
            <Download size={15} /> PDF
          </button>
          <button
            onClick={handleDuplicate}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-sm hover:border-brand/50"
          >
            <Copy size={15} /> Duplicate
          </button>
          {invoice.display_status !== 'paid' && (
            <button
              onClick={handleMarkPaid}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-success/40 text-success py-2.5 text-sm"
            >
              <CheckCircle2 size={15} /> Mark Paid
            </button>
          )}
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-danger/40 text-danger py-2.5 text-sm"
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium mb-3">Items</p>
        <div className="space-y-2">
          {invoice.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm py-2 border-b border-border last:border-0">
              <div>
                <p>{item.description}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {item.quantity} × {formatMoney(item.rate)}
                </p>
              </div>
              <p className="font-medium">{formatMoney(item.amount || 0)}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-border space-y-1 text-sm">
          <div className="flex justify-between text-text-muted">
            <span>Subtotal</span>
            <span>{formatMoney(invoice.subtotal)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between text-text-muted">
              <span>Discount</span>
              <span>-{formatMoney(invoice.discount)}</span>
            </div>
          )}
          {invoice.tax > 0 && (
            <div className="flex justify-between text-text-muted">
              <span>Tax</span>
              <span>{formatMoney(invoice.tax)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base pt-1">
            <span>Total</span>
            <span>{formatMoney(invoice.total_amount)}</span>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-bg-secondary border border-border px-4 py-2.5 text-sm shadow-xl z-50">
          {toast}
        </div>
      )}

      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setDeleteOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-bg-secondary p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-2">Delete Invoice?</h3>
            <p className="text-sm text-text-muted mb-5">This cannot be undone.</p>
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
