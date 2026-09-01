import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { ArrowLeft, Download, Forward, Paperclip, Reply, Trash2 } from 'lucide-react';
import { api, formatDate, type MailMessage } from '../../lib/api';
import ComposeDialog from '../../components/mail/ComposeDialog';

export default function MessageView() {
  const { folder = 'inbox', id } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState<MailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [composeMode, setComposeMode] = useState<'reply' | 'forward' | null>(null);

  function load() {
    setLoading(true);
    api
      .get<MailMessage>(`/api/mail/messages/${id}`)
      .then(setMessage)
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleTrash() {
    if (!message) return;
    await api.post(`/api/mail/messages/${message.id}/trash`);
    navigate(`/mail/${folder}`);
  }

  async function handlePermanentDelete() {
    if (!message) return;
    if (!confirm('Permanently delete this message? This cannot be undone.')) return;
    await api.delete(`/api/mail/messages/${message.id}`);
    navigate(`/mail/${folder}`);
  }

  if (loading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!message) return <p className="text-sm text-text-muted">Message not found.</p>;

  const sender = message.from_name || message.from_address || '(unknown sender)';
  const toList = message.to_addresses.map((a) => a.name || a.address).join(', ');
  const cleanHtml = message.body_html ? DOMPurify.sanitize(message.body_html) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/mail/${folder}`)}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setComposeMode('reply')} className="rounded-lg border border-border p-2 text-text-muted" aria-label="Reply">
            <Reply size={15} />
          </button>
          <button onClick={() => setComposeMode('forward')} className="rounded-lg border border-border p-2 text-text-muted" aria-label="Forward">
            <Forward size={15} />
          </button>
          {folder !== 'trash' ? (
            <button onClick={handleTrash} className="rounded-lg border border-danger/40 p-2 text-danger" aria-label="Move to Trash">
              <Trash2 size={15} />
            </button>
          ) : (
            <button
              onClick={handlePermanentDelete}
              className="rounded-lg border border-danger/40 p-2 text-danger"
              aria-label="Delete Permanently"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <h1 className="text-lg font-semibold">{message.subject}</h1>
          <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-medium">{sender}</p>
              <p className="text-xs text-text-muted">to {toList || '—'}</p>
            </div>
            <p className="text-xs text-text-muted">{formatDate(message.date_ts)}</p>
          </div>
        </div>

        {message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {message.attachments.map((att) => (
              <a
                key={att.id}
                href={`/api/mail/messages/${message.id}/attachments/${att.id}`}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-brand"
              >
                <Paperclip size={12} />
                {att.filename}
                <Download size={12} className="text-text-muted" />
              </a>
            ))}
          </div>
        )}

        <div className="border-t border-border pt-4">
          {cleanHtml ? (
            <div className="text-sm leading-relaxed [&_a]:text-brand" dangerouslySetInnerHTML={{ __html: cleanHtml }} />
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.body_text}</p>
          )}
        </div>
      </div>

      <ComposeDialog
        open={composeMode !== null}
        onClose={() => setComposeMode(null)}
        onSent={load}
        mode={composeMode || 'reply'}
        replyToId={message.id}
        initialTo={composeMode === 'reply' ? message.from_address || '' : ''}
        initialSubject={composeMode === 'forward' ? `Fwd: ${message.subject}` : undefined}
      />
    </div>
  );
}
