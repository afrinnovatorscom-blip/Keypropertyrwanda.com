import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import config from '../config/environment.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const PUBLIC_FOLDERS = new Set(['properties', 'advertisements', 'promotions', 'hero']);

/** Detect the real image type from the file signature (never trust the client MIME type). */
export function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

/** Resolve a stored relative path to an absolute path, refusing anything outside the upload root. */
export function resolveUploadPath(relativePath) {
  const absolute = path.resolve(config.uploadRoot, relativePath);
  const root = path.resolve(config.uploadRoot) + path.sep;
  if (!absolute.startsWith(root)) throw AppError.badRequest('Invalid file path');
  return absolute;
}

/**
 * Validate and persist an uploaded image buffer under uploads/<folder>/YYYY/MM/.
 * Files get random names so user-supplied names never reach the file system.
 */
export async function saveImage(file, folder) {
  if (!PUBLIC_FOLDERS.has(folder)) throw AppError.badRequest('Invalid upload folder');
  if (!file?.buffer?.length) throw AppError.badRequest('Empty file');
  if (file.buffer.length > config.maxUploadBytes) {
    throw new AppError(413, `File is too large. Maximum size is ${config.MAX_UPLOAD_SIZE_MB} MB.`, 'PAYLOAD_TOO_LARGE');
  }
  const type = detectImageType(file.buffer);
  if (!type) {
    throw new AppError(415, `"${file.originalname}" is not a valid JPEG, PNG or WebP image.`, 'UNSUPPORTED_MEDIA_TYPE');
  }
  const now = new Date();
  const dir = `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const name = `${crypto.randomBytes(16).toString('hex')}.${type.ext}`;
  const relativePath = `${dir}/${name}`;
  const absolute = resolveUploadPath(relativePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, file.buffer, { flag: 'wx' });
  return {
    filePath: relativePath,
    url: `/uploads/${relativePath}`,
    mimeType: type.mime,
    sizeBytes: file.buffer.length,
    originalName: String(file.originalname ?? '').slice(0, 255),
  };
}

export async function deleteUpload(relativePath) {
  if (!relativePath || /^https?:\/\//i.test(relativePath) || relativePath.startsWith('/')) return;
  try {
    await fs.unlink(resolveUploadPath(relativePath));
  } catch (error) {
    if (error.code !== 'ENOENT') logger.warn(`Could not delete upload ${relativePath}`, error.message);
  }
}
