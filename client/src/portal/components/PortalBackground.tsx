import { useEffect } from 'react';

// Fixed, full-viewport animated backdrop shared by every /album/* page -
// rendered once at the router level (App.tsx) rather than per-page, so it
// never restarts/flickers on navigation between portal routes.
export default function PortalBackground() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'SAYPX Digital Photo Books';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="portal-bg" aria-hidden="true">
      <div className="portal-orb portal-orb-1" />
      <div className="portal-orb portal-orb-2" />
      <div className="portal-orb portal-orb-3" />
    </div>
  );
}
