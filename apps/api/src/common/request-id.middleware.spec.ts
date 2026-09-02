import type { NextFunction, Request, Response } from 'express';
import { requestIdMiddleware } from './request-id.middleware';

describe('requestIdMiddleware', () => {
  it('preserves a valid incoming request ID', () => {
    const request = {
      headers: {
        'x-request-id': 'request-123',
      },
    } as unknown as Request;
    const response = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requestIdMiddleware(request, response, next);

    expect(request.headers['x-request-id']).toBe('request-123');
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'request-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('replaces an unsafe request ID with a generated UUID', () => {
    const request = {
      headers: {
        'x-request-id': 'invalid request id',
      },
    } as unknown as Request;
    const response = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requestIdMiddleware(request, response, next);

    expect(request.headers['x-request-id']).toEqual(
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      request.headers['x-request-id'],
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
