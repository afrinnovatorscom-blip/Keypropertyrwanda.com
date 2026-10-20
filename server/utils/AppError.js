/** Operational error carrying an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  constructor(status, message, code = 'ERROR', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Bad request', details) {
    return new AppError(400, message, 'BAD_REQUEST', details);
  }

  static validation(details, message = 'Validation failed') {
    return new AppError(422, message, 'VALIDATION_ERROR', details);
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(401, message, 'UNAUTHENTICATED');
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(403, message, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found') {
    return new AppError(404, message, 'NOT_FOUND');
  }

  static conflict(message = 'Conflict', details) {
    return new AppError(409, message, 'CONFLICT', details);
  }
}

export default AppError;
