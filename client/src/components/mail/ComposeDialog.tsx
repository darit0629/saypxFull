import { useEffect, useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { apiUpload } from '../../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  mode: 'new' | 'reply' | 'forward';
  replyToId?: number;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
}

const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export default function ComposeDialog({ open, onClose, onSent, mode, replyToId, initialTo, initialSubject, initialBody }: Props) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTo(initialTo || '');
      setCc('');
      setSubject(initialSubject || '');
      setBody(initialBody || '');
      setFiles([]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTo, initialSubject, initialBody]);

  if (!open) return null;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)];
    const totalBytes = next.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      setError('Attachments exceed 20MB total');
      return;
    }
    setError(null);
    setFiles(next);
  }

  async function handleSend() {
    if (!to.trim()) return setError('Recipient is required');
    if (mode !== 'reply' && !subject.trim()) return setError('Subject is required');
    setSending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('to', to.trim());
      if (cc.trim()) formData.append('cc', cc.trim());
      if (subject.trim()) formData.append('subject', subject.trim());
      formData.append('bodyHtml', body.replace(/\n/g, '<br>'));
      files.forEach((f) => formData.append('files', f));

      const url =
        mode === 'reply'
          ? `/api/mail/messages/${replyToId}/reply`
          : mode === 'forward'
          ? `/api/mail/messages/${replyToId}/forward`
          : '/api/mail/send';

      await apiUpload(url, formData);
      onSent();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  const title = mode === 'reply' ? 'Reply' : mode === 'forward' ? 'Forward' : 'New Message';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl border border-border bg-bg-secondary p-5 sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">{title}</p>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-text-muted mb-1">To</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="name@example.com"
              autoComplete="off"
              name="mail-to"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Cc (optional)</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              autoComplete="off"
              name="mail-cc"
            />
          </div>
          {mode !== 'reply' && (
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Subject</label>
              <input
                className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Message</label>
            <textarea
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand min-h-[140px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted"
            >
              <Paperclip size={13} /> Attach files
            </button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {files.map((f, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[11px]">
                    {f.name}
                    <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} aria-label="Remove file">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full rounded-lg gradient-brand py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
