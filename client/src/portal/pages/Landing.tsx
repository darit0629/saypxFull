import { Link } from 'react-router-dom';
import { BookImage } from 'lucide-react';

export default function PortalLanding() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-bg">
      <BookImage size={40} className="mb-4 text-brand" />
      <h1 className="text-3xl font-semibold mb-2 bg-gradient-to-r from-brand to-orange-300 bg-clip-text text-transparent">
        SAYPX Digital Photo Books
      </h1>
      <p className="max-w-md text-sm text-text-muted mb-8">
        Turn your clients' albums into realistic, interactive digital photo books — page-flip animation, sound, and
        shareable QR codes.
      </p>
      <div className="flex items-center gap-3">
        <Link to="/portal/signup" className="rounded-lg gradient-brand px-5 py-2.5 text-sm font-semibold">
          Get Started
        </Link>
        <Link
          to="/portal/login"
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-text-muted hover:bg-white/5"
        >
          Log In
        </Link>
      </div>
    </div>
  );
}
