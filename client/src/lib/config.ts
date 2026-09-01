// The photography site's own domain - where /admin, portfolio media, and
// digital-album viewer links all resolve. Overridable via VITE_WEBSITE_BASE
// for local dev (server/.env's own WEBSITE_API_BASE must point at the same
// place); defaults to the real production domain otherwise.
export const WEBSITE_BASE = import.meta.env.VITE_WEBSITE_BASE || 'https://saypx.in';

// Stored media paths come in two shapes: a legacy relative path with no
// leading slash ("images/portfolio/x.jpg") or a newer object-storage
// reference that already has one ("/media/<key>") - joining either with a
// bare "/" produces a broken "//media/..." URL for the newer shape, which
// the site's server doesn't route. This normalizes both to one real slash.
export function websiteAssetUrl(assetPath: string | null | undefined): string {
  if (!assetPath) return '';
  return `${WEBSITE_BASE}${assetPath.startsWith('/') ? '' : '/'}${assetPath}`;
}
