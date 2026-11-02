import { HttpErrorResponse } from '@angular/common/http';

/** Error returned by the backend, normalised so components never deal with HttpErrorResponse. */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly errorCode: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromHttpError(error: HttpErrorResponse): ApiError {
    const body: unknown = error.error;
    if (body && typeof body === 'object' && 'message' in body) {
      const { message, errorCode } = body as { message?: unknown; errorCode?: unknown };
      return new ApiError(
        error.status,
        typeof errorCode === 'string' ? errorCode : null,
        typeof message === 'string' ? message : error.message,
      );
    }
    return new ApiError(error.status, null, error.message);
  }
}
