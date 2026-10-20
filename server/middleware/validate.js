import { AppError } from '../utils/AppError.js';

export function formatZodIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Validate request parts with Zod schemas. Parsed (coerced, stripped) values
 * are exposed on `req.valid.body`, `req.valid.query` and `req.valid.params`.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = req.valid ?? {};
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) return next(AppError.validation(formatZodIssues(result.error)));
      req.valid[part] = result.data;
    }
    return next();
  };
}
