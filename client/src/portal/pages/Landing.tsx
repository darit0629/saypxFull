import { Link } from 'react-router-dom';
import PortalHeader from '../components/PortalHeader';
import {
  BookImage,
  Sparkles,
  QrCode,
  Cloud,
  ShieldCheck,
  Smartphone,
  Music,
  Upload,
  BookOpen,
  Share2,
  Heart,
  Zap,
  Infinity as InfinityIcon,
  CreditCard,
  Mail,
  Phone,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

const CAPABILITY_BADGES = [
  { Icon: Smartphone, label: 'No App for Clients' },
  { Icon: QrCode, label: 'QR Code Sharing' },
  { Icon: Cloud, label: 'Cloud Storage' },
  { Icon: ShieldCheck, label: 'Secure & Reliable' },
  { Icon: Smartphone, label: 'Works Anywhere' },
];

const FEATURES = [
  { Icon: Zap, title: 'Instant Activation', desc: 'Start creating albums right after your plan is active.' },
  { Icon: QrCode, title: 'QR Code Sharing', desc: 'Every album gets a shareable link and QR code, no app needed.' },
  { Icon: Cloud, title: 'Cloud Storage', desc: 'Albums live online, accessible anytime from any device.' },
  { Icon: ShieldCheck, title: 'Secure & Private', desc: 'Your albums and your clients\' photos, kept protected.' },
  { Icon: Smartphone, title: 'Works Anywhere', desc: 'On web, mobile and tablet - no special software needed.' },
  { Icon: Music, title: 'Audio Support', desc: 'Add background music to bring albums to life.' },
];

const STEPS = [
  { n: '01', Icon: Upload, title: 'Upload Photos', desc: 'Upload your photos in high quality.' },
  { n: '02', Icon: BookOpen, title: 'Create Album', desc: 'Arrange, customize & design your album.' },
  { n: '03', Icon: Share2, title: 'Share Instantly', desc: 'Generate a link or QR code and share with clients.' },
  { n: '04', Icon: Heart, title: 'Delight Your Clients', desc: 'A page-flip digital photo book they\'ll love to revisit.' },
];

const TRUST_ROW = [
  { Icon: CreditCard, title: 'Secure Payments', desc: 'Checkout handled by Razorpay' },
  { Icon: InfinityIcon, title: 'No Expiry of Albums', desc: 'Your albums stay online, always' },
  { Icon: Smartphone, title: 'Access Anywhere', desc: 'Web, mobile & tablet' },
  { Icon: Zap, title: 'Instant Activation', desc: 'Start right after payment' },
];

export default function PortalLanding() {
  return (
    <div className="relative z-10 min-h-screen">
      <PortalHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-14 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand mb-4">
              <Sparkles size={12} /> Digital Photo Book Platform
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-3">
              SAYPX <span className="text-brand">Digital Photo Books</span>
            </h1>
            <p className="text-lg text-text-muted italic mb-4">Where every page holds a memory.</p>
            <p className="text-sm text-text-muted max-w-md mb-6">
              Create stunning digital albums, share instantly, and deliver unforgettable experiences to your clients.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mb-8 text-xs text-text-muted">
              {CAPABILITY_BADGES.map(({ Icon, label }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <Icon size={13} className="text-brand" /> {label}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Link to="/album/signup" className="flex items-center gap-1.5 rounded-lg gradient-brand px-5 py-2.5 text-sm font-semibold">
                Get Started Now <ArrowRight size={14} />
              </Link>
              <Link to="/album/plans" className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold hover:bg-white/5">
                View Plans
              </Link>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
            <div className="relative rounded-2xl border border-border bg-card p-10 shadow-2xl">
              <BookImage size={90} className="text-brand" />
            </div>
          </div>
        </section>

        {/* Capability grid */}
        <section id="features" className="mx-auto max-w-6xl px-6 pb-16">
          <div className="rounded-2xl border border-border bg-card p-6 grid grid-cols-2 sm:grid-cols-3 gap-6">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className="text-center">
                <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-brand/15 text-brand">
                  <Icon size={20} />
                </span>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-text-muted mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-6 pb-16">
          <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-brand mb-1">How It Works</p>
          <h2 className="text-center text-2xl sm:text-3xl font-bold mb-10">Simple Steps, Powerful Results</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            {STEPS.map(({ n, Icon, title, desc }) => (
              <div key={n} className="text-center">
                <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-brand/40 bg-brand/10">
                  <Icon size={22} className="text-brand" />
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold">
                    {n}
                  </span>
                </div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-text-muted mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA banner */}
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="rounded-2xl border border-brand/40 bg-brand/5 p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-center sm:text-left">
              <h3 className="text-2xl font-bold mb-1">
                Ready to Get <span className="text-brand">Started?</span>
              </h3>
              <p className="text-sm text-text-muted">Choose a plan and start creating digital photo books for your clients.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link to="/album/signup" className="flex items-center gap-1.5 rounded-lg gradient-brand px-5 py-2.5 text-sm font-semibold whitespace-nowrap">
                Get Started Now <ArrowRight size={14} />
              </Link>
              <Link to="/album/plans" className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold hover:bg-white/5 whitespace-nowrap">
                View Plans
              </Link>
            </div>
          </div>
        </section>

        {/* Trust row */}
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {TRUST_ROW.map(({ Icon, title, desc }) => (
              <div key={title}>
                <Icon size={18} className="mx-auto mb-1.5 text-brand" />
                <p className="text-xs font-semibold">{title}</p>
                <p className="text-[10px] text-text-muted">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <img src="/saypx-wordmark.png" alt="SAYPX" className="h-7 w-auto" />
            <p className="text-xs text-text-muted mt-3 max-w-xs">
              Turn your clients' albums into realistic, interactive digital photo books.
            </p>
            <div className="flex items-center gap-3 mt-4 text-xs">
              <a href="https://www.instagram.com/sayan.saypx/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-text-muted hover:text-brand">
                Instagram <ExternalLink size={10} />
              </a>
              <a href="https://www.facebook.com/sayanarit.das" target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-text-muted hover:text-brand">
                Facebook <ExternalLink size={10} />
              </a>
              <a href="https://www.youtube.com/@sayanaritdas" target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-text-muted hover:text-brand">
                YouTube <ExternalLink size={10} />
              </a>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Quick Links</p>
            <ul className="space-y-2 text-sm">
              <li><a href="#how-it-works" className="text-text-muted hover:text-text">How It Works</a></li>
              <li><a href="#features" className="text-text-muted hover:text-text">Features</a></li>
              <li><Link to="/album/plans" className="text-text-muted hover:text-text">Pricing</Link></li>
              <li><Link to="/album/login" className="text-text-muted hover:text-text">Customer Login</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Contact</p>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="mailto:sayandas0629@gmail.com" className="flex items-center gap-1.5 text-text-muted hover:text-text">
                  <Mail size={13} /> sayandas0629@gmail.com
                </a>
              </li>
              <li>
                <a href="https://api.whatsapp.com/send/?phone=916294011684&type=phone_number&app_absent=0" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-text-muted hover:text-text">
                  <Phone size={13} /> +91 62940 11684
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60">
          <p className="mx-auto max-w-6xl px-6 py-4 text-[11px] text-text-muted">© {new Date().getFullYear()} SAYPX. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
