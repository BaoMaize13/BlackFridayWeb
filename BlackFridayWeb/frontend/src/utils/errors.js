export class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "AppError";
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.details = options.details ?? null;
  }
}

export function mapErrorToMessage(error, fallback = "Something went wrong while talking to the backend.") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error.name === "AbortError") return "The request timed out before the backend responded.";
  if (error.message) return error.message;
  return fallback;
}

export function isEndpointUnavailable(error) {
  return [404, 405, 501].includes(error?.status);
}
