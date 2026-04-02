interface AxiosLikeError {
  response?: { data?: { detail?: string } };
  message?: string;
}

/** Safely extract a human-readable error message from an unknown catch value.
 *  Handles Axios errors (response.data.detail), standard Error objects, and strings. */
export function getErrorDetail(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as AxiosLikeError;
    if (e.response?.data?.detail) return e.response.data.detail;
    if (e.message) return e.message;
  }
  return String(err);
}
