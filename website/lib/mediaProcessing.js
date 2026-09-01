const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');
const sharp = require('sharp');

// Resolution order: explicit override -> the bundled Windows build used for
// local dev on this machine -> plain "ffmpeg" resolved from PATH, which is
// what production (Linux, apt-installed) actually uses.
const WINDOWS_DEV_FFMPEG = path.join(__dirname, '..', '..', 'tools', 'ffmpeg-8.1.2-essentials_build', 'bin', 'ffmpeg.exe');
const FFMPEG = process.env.FFMPEG_PATH || (fs.existsSync(WINDOWS_DEV_FFMPEG) ? WINDOWS_DEV_FFMPEG : 'ffmpeg');

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'item';
}

function uniqueSlug(baseSlug, existingSlugs) {
  let slug = baseSlug;
  let counter = 2;
  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  existingSlugs.add(slug);
  return slug;
}

async function processImage(srcPath, destPath) {
  const meta = await sharp(srcPath).metadata();
  await sharp(srcPath)
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(destPath);
  return { orientation: meta.width >= meta.height ? 'landscape' : 'portrait' };
}

function probeVideo(srcPath) {
  try {
    execFileSync(FFMPEG, ['-i', srcPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return e.stderr.toString();
  }
  return '';
}

function processVideo(srcPath, destVideoPath, destPosterPath) {
  const info = probeVideo(srcPath);
  const dimMatch = info.match(/(\d{2,5})x(\d{2,5})/);
  const width = dimMatch ? parseInt(dimMatch[1], 10) : 1920;
  const height = dimMatch ? parseInt(dimMatch[2], 10) : 1080;
  const isPortrait = height > width;
  const scaleFilter = isPortrait ? 'scale=480:-2' : 'scale=-2:480';

  execFileSync(FFMPEG, [
    '-y', '-i', srcPath,
    '-vf', scaleFilter,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '24',
    '-c:a', 'aac', '-b:a', '96k',
    '-movflags', '+faststart',
    destVideoPath
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  execFileSync(FFMPEG, [
    '-y', '-i', destVideoPath,
    '-ss', '00:00:01',
    '-vframes', '1',
    '-q:v', '3',
    destPosterPath
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  return { orientation: isPortrait ? 'portrait' : 'landscape' };
}

module.exports = { slugify, uniqueSlug, processImage, processVideo };
