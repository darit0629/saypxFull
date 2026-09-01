const path = require('path');
const crypto = require('crypto');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Centralized object-storage access, built against the S3-compatible API
// rather than a Cloudflare-R2-specific SDK - swapping providers later is an
// env-var change (endpoint + credentials), not a rewrite of call sites.
// Not wired into any upload/serving route yet; this is pure scaffolding for
// the migration work, so nothing about how media is currently served or
// stored on the VPS filesystem changes by this file existing.

function isConfigured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

let cachedClient = null;
function getClient() {
  if (!isConfigured()) {
    throw new Error('Object storage is not configured (missing R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME)');
  }
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return cachedClient;
}

function bucket() {
  return process.env.R2_BUCKET_NAME;
}

// Mirrors this project's existing upload-naming convention (see
// server/routes/uploads.js: timestamp + random, never the original
// filename) so an object key is never guessable and never leaks what the
// uploader called the file. `prefix` is a "directory" path, e.g.
// "albums/42/pages" or "portfolio".
function generateKey(prefix, originalFilename) {
  const ext = (originalFilename && path.extname(originalFilename)) || '';
  const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const clean = String(prefix || '').replace(/^\/+|\/+$/g, '').replace(/\/+$/g, '');
  return clean ? `${clean}/${unique}${ext}` : `${unique}${ext}`;
}

// body: Buffer | Readable | string
async function upload(key, body, options = {}) {
  await getClient().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: options.contentType,
    Metadata: options.metadata,
  }));
  return { key };
}

// Lets the browser upload directly to storage without the file passing
// through the VPS at all - the server only ever hands out this URL.
async function getPresignedUploadUrl(key, options = {}) {
  const cmd = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: options.contentType,
  });
  return getSignedUrl(getClient(), cmd, { expiresIn: options.expiresIn || 900 });
}

// Time-limited read access for private objects (originals, anything not
// meant to be permanently public) without exposing the bucket itself.
async function getPresignedDownloadUrl(key, options = {}) {
  const cmd = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(getClient(), cmd, { expiresIn: options.expiresIn || 3600 });
}

// Returns the raw SDK response body (a Readable in Node) - caller decides
// how to consume it (stream to an HTTP response, buffer it, etc.).
async function download(key) {
  const res = await getClient().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return res.Body;
}

async function exists(key) {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch (e) {
    if (e.name === 'NotFound' || (e.$metadata && e.$metadata.httpStatusCode === 404)) return false;
    throw e;
  }
}

async function getMetadata(key) {
  const res = await getClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
  return {
    size: res.ContentLength,
    contentType: res.ContentType,
    lastModified: res.LastModified,
    etag: res.ETag,
    metadata: res.Metadata || {},
  };
}

async function deleteObject(key) {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

async function copy(sourceKey, destKey) {
  await getClient().send(new CopyObjectCommand({
    Bucket: bucket(),
    CopySource: `${bucket()}/${encodeURIComponent(sourceKey)}`,
    Key: destKey,
  }));
}

async function move(sourceKey, destKey) {
  await copy(sourceKey, destKey);
  await deleteObject(sourceKey);
}

module.exports = {
  isConfigured,
  generateKey,
  upload,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  download,
  exists,
  getMetadata,
  delete: deleteObject,
  copy,
  move,
};
