const fs = require('fs');

const BASE = process.env.WEBSITE_API_BASE || 'http://localhost:5000';

function isWebsiteConfigured() {
  return Boolean(process.env.WEBSITE_API_BASE && process.env.INTERNAL_API_TOKEN);
}

function headers(extra) {
  return { 'X-Internal-Token': process.env.INTERNAL_API_TOKEN || '', ...extra };
}

async function parseOrThrow(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Website API request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function getPortfolio() {
  const res = await fetch(`${BASE}/api/admin/portfolio`, { headers: headers() });
  return parseOrThrow(res);
}

async function uploadPortfolioItem({ title, subtitle, category, newCategoryLabel }, file) {
  const form = new FormData();
  form.append('title', title);
  if (subtitle) form.append('subtitle', subtitle);
  form.append('category', category);
  if (newCategoryLabel) form.append('newCategoryLabel', newCategoryLabel);
  const buffer = fs.readFileSync(file.path);
  form.append('file', new Blob([buffer], { type: file.mimetype }), file.originalname);

  const res = await fetch(`${BASE}/api/admin/portfolio`, { method: 'POST', headers: headers(), body: form });
  return parseOrThrow(res);
}

async function updatePortfolioItem(index, fields) {
  const res = await fetch(`${BASE}/api/admin/portfolio/${index}`, {
    method: 'PUT',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(fields),
  });
  return parseOrThrow(res);
}

async function deletePortfolioItem(index) {
  const res = await fetch(`${BASE}/api/admin/portfolio/${index}`, { method: 'DELETE', headers: headers() });
  return parseOrThrow(res);
}

// ---- Digital Photo Book albums ----
async function listAlbums(query) {
  const qs = new URLSearchParams(query || {}).toString();
  const res = await fetch(`${BASE}/api/admin/albums${qs ? '?' + qs : ''}`, { headers: headers() });
  return parseOrThrow(res);
}

async function getAlbum(id) {
  const res = await fetch(`${BASE}/api/admin/albums/${id}`, { headers: headers() });
  return parseOrThrow(res);
}

async function createAlbum(fields) {
  const res = await fetch(`${BASE}/api/admin/albums`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(fields),
  });
  return parseOrThrow(res);
}

async function updateAlbum(id, fields) {
  const res = await fetch(`${BASE}/api/admin/albums/${id}`, {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(fields),
  });
  return parseOrThrow(res);
}

async function deleteAlbum(id) {
  const res = await fetch(`${BASE}/api/admin/albums/${id}`, { method: 'DELETE', headers: headers() });
  return parseOrThrow(res);
}

async function duplicateAlbum(id) {
  const res = await fetch(`${BASE}/api/admin/albums/${id}/duplicate`, { method: 'POST', headers: headers() });
  return parseOrThrow(res);
}

async function uploadAlbumPage(albumId, file) {
  const form = new FormData();
  const buffer = fs.readFileSync(file.path);
  form.append('file', new Blob([buffer], { type: file.mimetype }), file.originalname);
  const res = await fetch(`${BASE}/api/admin/albums/${albumId}/pages`, { method: 'POST', headers: headers(), body: form });
  return parseOrThrow(res);
}

async function reorderAlbumPages(albumId, pageIds) {
  const res = await fetch(`${BASE}/api/admin/albums/${albumId}/pages/reorder`, {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ pageIds }),
  });
  return parseOrThrow(res);
}

async function replaceAlbumPage(albumId, pageId, file) {
  const form = new FormData();
  const buffer = fs.readFileSync(file.path);
  form.append('file', new Blob([buffer], { type: file.mimetype }), file.originalname);
  const res = await fetch(`${BASE}/api/admin/albums/${albumId}/pages/${pageId}/replace`, { method: 'POST', headers: headers(), body: form });
  return parseOrThrow(res);
}

async function duplicateAlbumPage(albumId, pageId) {
  const res = await fetch(`${BASE}/api/admin/albums/${albumId}/pages/${pageId}/duplicate`, { method: 'POST', headers: headers() });
  return parseOrThrow(res);
}

async function deleteAlbumPage(albumId, pageId) {
  const res = await fetch(`${BASE}/api/admin/albums/${albumId}/pages/${pageId}`, { method: 'DELETE', headers: headers() });
  return parseOrThrow(res);
}

async function uploadAlbumCover(albumId, file, which) {
  const form = new FormData();
  const buffer = fs.readFileSync(file.path);
  form.append('file', new Blob([buffer], { type: file.mimetype }), file.originalname);
  const endpoint = which === 'back' ? 'back-cover' : 'cover';
  const res = await fetch(`${BASE}/api/admin/albums/${albumId}/${endpoint}`, { method: 'POST', headers: headers(), body: form });
  return parseOrThrow(res);
}

async function getAlbumQr(albumId, format) {
  const res = await fetch(`${BASE}/api/admin/albums/${albumId}/qr${format === 'svg' ? '?format=svg' : ''}`, { headers: headers() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `Website API request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType: res.headers.get('content-type') || (format === 'svg' ? 'image/svg+xml' : 'image/png') };
}

async function setImageCenter(albumId, imageId, centerXPct) {
  const res = await fetch(`${BASE}/api/admin/albums/${albumId}/images/${imageId}/center`, {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ centerXPct }),
  });
  return parseOrThrow(res);
}

module.exports = {
  isWebsiteConfigured,
  getPortfolio,
  uploadPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  listAlbums,
  getAlbum,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  duplicateAlbum,
  uploadAlbumPage,
  reorderAlbumPages,
  replaceAlbumPage,
  duplicateAlbumPage,
  deleteAlbumPage,
  uploadAlbumCover,
  setImageCenter,
  getAlbumQr,
};
