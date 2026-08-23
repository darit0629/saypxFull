import { Paperclip } from 'lucide-react';
import type { MailListItem } from '../../lib/api';

function formatMailDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

interface Props {
  message: MailListItem;
  onClick: () => void;
}

export default function MessageListItem({ message, onClick }: Props) {
  const sender = message.from_name || message.from_address || '(unknown sender)';
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border border-border px-4 py-3 flex items-start gap-3 hover:bg-white/5 ${
        message.is_read ? 'bg-card' : 'bg-white/[0.03]'
      }`}
    >
      <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${message.is_read ? 'bg-transparent' : 'bg-brand'}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-sm ${message.is_read ? 'text-text' : 'font-semibold text-text'}`}>{sender}</p>
          <span className="shrink-0 text-[11px] text-text-muted">{formatMailDate(message.date_ts)}</span>
        </div>
        <p className={`truncate text-sm ${message.is_read ? 'text-text-muted' : 'text-text'}`}>{message.subject}</p>
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs text-text-muted">{message.snippet}</p>
          {message.has_attachments && <Paperclip size={12} className="shrink-0 text-text-muted" />}
        </div>
      </div>
    </button>
  );
}
