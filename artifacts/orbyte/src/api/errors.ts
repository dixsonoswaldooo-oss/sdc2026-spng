/** Error from the backend (or the mock engine), with the HTTP status, e.g. 403 when a role may not do something. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
