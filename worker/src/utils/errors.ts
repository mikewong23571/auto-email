export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const isAppError = (err: unknown): err is AppError =>
  err instanceof AppError && typeof err.status === "number";
