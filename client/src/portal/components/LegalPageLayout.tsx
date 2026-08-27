import type { ReactNode } from 'react';
import PortalHeader from './PortalHeader';

export default function LegalPageLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen">
      <PortalHeader />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">{title}</h1>
        <p className="text-xs text-text-muted mb-8">Last updated: {updated}</p>
        <div className="space-y-6 text-sm text-text-muted leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text [&_h2]:mb-2 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-brand [&_a]:hover:underline">
          {children}
        </div>
      </div>
    </div>
  );
}
