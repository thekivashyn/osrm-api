export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class OsrmError extends AppError {
  constructor(message: string, statusCode = 502) {
    super(message, statusCode);
    this.name = "OsrmError";
  }
}

export function errorResponse(message: string) {
  return { success: false as const, message };
}

export function successResponse<T>(data: T) {
  return { success: true as const, data };
}
