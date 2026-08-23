import { X, HelpCircle } from 'lucide-react';

const TIPS = [
  { q: 'How do I create an invoice?', a: 'Tap the orange + button (mobile) or "New Invoice" on the Bills page. Pick a client, add line items, and the totals calculate live.' },
  { q: 'How do I get paid faster?', a: 'Open an invoice and use Share or Download PDF to send it straight to your client over WhatsApp, email, or any app.' },
  { q: 'What does "Overdue" mean?', a: 'Any unpaid or partially-paid invoice whose due date has passed is automatically shown as Overdue — no manual update needed.' },
  { q: 'Can I customize how invoices look?', a: 'Yes — go to Templates to design your own layout with drag-and-drop text, your logo, and a custom background.' },
  { q: 'Deleting a client — do I lose their invoice history?', a: "No. Deleting a client keeps all their past invoices; the client's name is preserved on each one." },
  { q: 'How does App Lock work?', a: "Register a passkey in Settings, then the app will require your fingerprint, face, or device PIN after it's been idle." },
];

export default function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-bg-secondary p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <HelpCircle size={16} className="text-brand" /> Help &amp; Tips
          </p>
          <button onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4">
          {TIPS.map((t) => (
            <div key={t.q}>
              <p className="text-sm font-medium mb-1">{t.q}</p>
              <p className="text-xs text-text-muted">{t.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
