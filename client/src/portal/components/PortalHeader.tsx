import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function PortalHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-bg/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/album" className="flex items-center">
          <img src="/saypx-wordmark.png" alt="SAYPX" className="h-8 w-auto" />
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-text-muted">
          <a href="/album#how-it-works" className="hover:text-text">How It Works</a>
          <a href="/album#features" className="hover:text-text">Features</a>
          <Link to="/album/plans" className="hover:text-text">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/album/login" className="rounded-lg border border-border px-3.5 py-1.5 text-sm font-semibold hover:bg-white/5">
            Log In
          </Link>
          <Link to="/album/signup" className="flex items-center gap-1 rounded-lg gradient-brand px-3.5 py-1.5 text-sm font-semibold">
            Get Started <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </header>
  );
}
