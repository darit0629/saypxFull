import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Pencil, RefreshCw, Search } from 'lucide-react';
import { api, type MailListItem } from '../../lib/api';
import MessageListItem from '../../components/mail/MessageListItem';
import ComposeDialog from '../../components/mail/ComposeDialog';

export default function MailInbox() {
  const { folder: rawFolder } = useParams();
  const location = useLocation();
  const isComposeRoute = location.pathname === '/mail/compose';
  const folder = isComposeRoute ? 'inbox' : rawFolder || 'inbox';
  const navigate = useNavigate();
  const [messages, setMessages] = useState<MailListItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(isComposeRoute);
  const [notConfigured, setNotConfigured] = useState(false);

  function loadMessages() {
    setLoading(true);
    api
      .get<{ messages: MailListItem[] }>(`/api/mail/messages?folder=${folder}&search=${encodeURIComponent(search)}`)
      .then((res) => {
        setMessages(res.messages);
        setNotConfigured(false);
      })
      .catch(() => setNotConfigured(true))
      .finally(() => setLoading(false));
  }

  // Navigating to /mail/compose while MailInbox is already mounted (e.g. from
  // the mobile nav's FAB) doesn't remount the component, so the composeOpen
  // useState initializer above only fires on the very first mount - this
  // catches the route change on subsequent navigations too.
  useEffect(() => {
    if (isComposeRoute) setComposeOpen(true);
  }, [isComposeRoute]);

  useEffect(() => {
    loadMessages();
    // Sync-on-open: fetch fresh mail the moment this folder is viewed.
    setSyncing(true);
    api
      .post(`/api/mail/sync/${folder}`)
      .then(loadMessages)
      .catch(() => {})
      .finally(() => setSyncing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder]);

  useEffect(() => {
    const t = setTimeout(loadMessages, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleManualSync() {
    setSyncing(true);
    try {
      await api.post(`/api/mail/sync/${folder}`);
      loadMessages();
    } finally {
      setSyncing(false);
    }
  }

  if (notConfigured) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-text-muted">Mail isn't configured yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Mail</h1>
          <p className="text-sm text-text-muted mt-1">{messages.length} messages</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSync}
            disabled={syncing}
            aria-label="Sync now"
            className="rounded-lg border border-border p-2 text-text-muted disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setComposeOpen(true)}
            className="flex items-center gap-1.5 rounded-lg gradient-brand px-3.5 py-2 text-sm font-semibold"
          >
            <Pencil size={15} /> Compose
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2.5 text-sm outline-none focus:border-brand"
          placeholder="Search mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : messages.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-text-muted">No messages in this folder.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => (
            <MessageListItem key={m.id} message={m} onClick={() => navigate(`/mail/${folder}/${m.id}`)} />
          ))}
        </div>
      )}

      <ComposeDialog
        open={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          if (isComposeRoute) navigate('/mail', { replace: true });
        }}
        onSent={loadMessages}
        mode="new"
      />
    </div>
  );
}
