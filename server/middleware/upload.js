import multer from 'multer';
import config from '../config/environment.js';
import { AppError } from '../utils/AppError.js';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Multipart parsing into memory with strict limits. The upload service then
 * verifies the real file signature (magic bytes) before anything is written to disk.
 */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 20, fields: 20, parts: 40 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new AppError(415, `Unsupported file type for "${file.originalname}". Use JPEG, PNG or WebP.`, 'UNSUPPORTED_MEDIA_TYPE'));
    }
    return cb(null, true);
  },
});

export const uploadImages = (field = 'images', max = 20) => imageUpload.array(field, max);
export const uploadSingleImage = (field = 'image') => imageUpload.single(field);
