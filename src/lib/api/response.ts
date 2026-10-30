import { NextResponse } from 'next/server';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR'
  | 'CONFIGURATION_ERROR';

export interface ApiResponseSuccess<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiResponseError {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    details?: any;
  };
}

export function apiSuccess<T>(data: T, message: string = 'Operation completed successfully', status = 200) {
  if (status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const payload: ApiResponseSuccess<T> = {
    success: true,
    data,
    message,
  };

  return NextResponse.json(payload, { status });
}

export function apiError(
  code: ErrorCode | string,
  message: string,
  status = 400,
  details: any = null
) {
  const payload: ApiResponseError = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };

  return NextResponse.json(payload, { status });
}
