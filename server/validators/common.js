import { z } from 'zod';
import { isSafeExternalUrl, isSafeUrl } from '../utils/url.js';

const blankToNull = (v) => (v === '' || (typeof v === 'string' && v.trim() === '') ? null : v);
const blankToUndefined = (v) => (v === '' || v === null ? undefined : v);

export const idParam = z.object({ id: z.coerce.number().int().positive() });

export const paginationQuery = {
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

/** Trimmed required text. */
export const text = (max, min = 1) => z.string().trim().min(min, `Must be at least ${min} character(s)`).max(max);

/** Optional text; blank strings become null (clears the value). */
export const optionalText = (max) => z.preprocess(blankToNull, z.string().trim().max(max).nullable()).optional();

/** Optional query string filter; blank → undefined. */
export const queryText = (max = 100) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

export const queryNumber = (schema = z.coerce.number().min(0)) => z.preprocess(blankToUndefined, schema.optional());

export const queryEnum = (values) => z.preprocess(blankToUndefined, z.enum(values).optional());

export const queryBool = z.preprocess(
  (v) => (v === 'true' || v === '1' ? true : v === 'false' || v === '0' ? false : undefined),
  z.boolean().optional(),
);

export const dateValue = z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), 'Invalid date');

export const optionalDate = z.preprocess(blankToNull, dateValue.nullable()).optional();

export const queryDate = z.preprocess(blankToUndefined, dateValue.optional());

export const money = z.coerce
  .number({ error: 'Must be a number' })
  .finite()
  .min(0, 'Cannot be negative')
  .max(9_999_999_999_999, 'Value is too large');

export const optionalInt = (min, max) => z.preprocess(blankToNull, z.coerce.number().int().min(min).max(max).nullable()).optional();

export const optionalNumber = (min, max) => z.preprocess(blankToNull, z.coerce.number().finite().min(min).max(max).nullable()).optional();

export const optionalId = z.preprocess(blankToNull, z.coerce.number().int().positive().nullable()).optional();

/** Safe destination link: http(s) URL or site-relative path; rejects javascript:, data:, //host, etc. */
export const safeUrl = z.preprocess(
  blankToNull,
  z.string().trim().max(500).refine(isSafeUrl, 'Enter a valid http(s) URL or a site path starting with "/"').nullable(),
).optional();

export const safeExternalUrl = z.preprocess(
  blankToNull,
  z.string().trim().max(500).refine(isSafeExternalUrl, 'Enter a valid http(s) URL').nullable(),
).optional();

/** Path returned by the upload endpoint (relative to the uploads root). */
export const uploadPath = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .max(255)
    .regex(/^(properties|advertisements|promotions|hero)\/[\w/-]+\.(jpe?g|png|webp)$/i, 'Invalid uploaded image path')
    .nullable(),
).optional();

export const phone = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(30)
  .regex(/^\+?[0-9\s()-]{7,30}$/, 'Enter a valid phone number');

export const email = z.string().trim().toLowerCase().max(190).pipe(z.email('Enter a valid email address'));

export const optionalEmail = z.preprocess(blankToNull, email.nullable()).optional();

/** Ensure an end date (when given) is after the start date. */
export function refineDateRange(schema, startKey = 'startAt', endKey = 'endAt') {
  return schema.refine(
    (v) => !v[startKey] || !v[endKey] || new Date(v[endKey]) > new Date(v[startKey]),
    { message: 'End date must be after the start date', path: [endKey] },
  );
}
