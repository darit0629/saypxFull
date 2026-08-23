// The photography site's own domain - where /admin, portfolio media, and
// digital-album viewer links all resolve. Overridable via VITE_WEBSITE_BASE
// for local dev (server/.env's own WEBSITE_API_BASE must point at the same
// place); defaults to the real production domain otherwise.
export const WEBSITE_BASE = import.meta.env.VITE_WEBSITE_BASE || 'https://saypx.in';
