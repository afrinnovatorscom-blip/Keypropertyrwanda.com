import multer from 'multer';
import { ZodError } from 'zod';
import config from '../config/environment.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { formatZodIssues } from './validate.js';

export function apiNotFound(req, _res, next) {
  next(AppError.notFound(`No API route for ${req.method} ${req.originalUrl.split('?')[0]}`));
}

/** Translate known error types into safe, consistent JSON responses. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let error = err;

  if (err instanceof ZodError) {
    error = AppError.validation(formatZodIssues(err));
  } else if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Maximum size is ${config.MAX_UPLOAD_SIZE_MB} MB.`
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Too many files, or unexpected file field.'
          : 'Upload failed.';
    error = new AppError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, message, err.code);
  } else if (err?.type === 'entity.too.large') {
    error = new AppError(413, 'Request body is too large.', 'PAYLOAD_TOO_LARGE');
  } else if (err?.type === 'entity.parse.failed') {
    error = AppError.badRequest('Malformed JSON body.');
  } else if (err?.code === 'ER_DUP_ENTRY') {
    error = AppError.conflict('A record with the same unique value already exists.');
  } else if (err?.code === 'ER_ROW_IS_REFERENCED_2' || err?.code === 'ER_ROW_IS_REFERENCED') {
    error = AppError.conflict('This record is referenced by other records and cannot be deleted.');
  }

  if (!(error instanceof AppError)) {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
    error = new AppError(500, 'An unexpected error occurred. Please try again later.', 'INTERNAL_ERROR');
  } else if (error.status >= 500) {
    logger.error(`Server error on ${req.method} ${req.originalUrl}`, err);
  }

  const body = { success: false, error: { code: error.code, message: error.message } };
  if (error.details) body.error.details = error.details;
  if (!config.isProduction && error.status >= 500 && err?.stack && !(err instanceof AppError)) {
    body.error.debug = String(err.message);
  }
  res.status(error.status).json(body);
}
