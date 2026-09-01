export class ApiClientError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);

    this.name = 'ApiClientError';
    this.statusCode = statusCode;
  }
}
