/**
 * Global error handling system
 */

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string) {
    super(
      message || `External service error: ${service}`,
      502,
      'EXTERNAL_SERVICE_ERROR',
      { service }
    );
  }
}

/**
 * Error handler middleware for API routes
 */
export function handleApiError(error: unknown): {
  message: string;
  code?: string;
  details?: any;
  statusCode: number;
} {
  // Log error for monitoring
  console.error('API Error:', error);

  // Handle known AppErrors
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details,
      statusCode: error.statusCode,
    };
  }

  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as any;

    switch (prismaError.code) {
      case 'P2002':
        return {
          message: 'A record with this information already exists',
          code: 'DUPLICATE_RECORD',
          statusCode: 409,
        };
      case 'P2025':
        return {
          message: 'Record not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        };
      case 'P2003':
        return {
          message: 'Foreign key constraint failed',
          code: 'FOREIGN_KEY_ERROR',
          statusCode: 400,
        };
      default:
        return {
          message: 'Database error occurred',
          code: 'DATABASE_ERROR',
          statusCode: 500,
        };
    }
  }

  // Handle Zod validation errors
  if (error && typeof error === 'object' && 'issues' in error) {
    return {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: (error as any).issues,
      statusCode: 400,
    };
  }

  // Default error
  return {
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
  };
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  handler: (...args: any[]) => Promise<any>
) {
  return async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      const errorResponse = handleApiError(error);
      const Response = args[0].constructor;

      return Response.json(
        {
          error: errorResponse.message,
          code: errorResponse.code,
          details: errorResponse.details,
        },
        { status: errorResponse.statusCode }
      );
    }
  };
}

/**
 * Retry wrapper with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    onRetry,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        throw error;
      }

      const delay = Math.min(
        initialDelay * Math.pow(backoffFactor, attempt),
        maxDelay
      );

      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Circuit breaker pattern
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private resetTimeout: number = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();

      if (this.state === 'HALF_OPEN') {
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      console.warn('Circuit breaker opened due to failures');
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    console.log('Circuit breaker reset to CLOSED state');
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }
}

/**
 * Rate limiter
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000
  ) {}

  async checkLimit(identifier: string): Promise<boolean> {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter(
      (time) => now - time < this.windowMs
    );

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(identifier, validRequests);

    return true;
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    const validRequests = requests.filter(
      (time) => now - time < this.windowMs
    );

    return Math.max(0, this.maxRequests - validRequests.length);
  }

  reset(identifier: string): void {
    this.requests.delete(identifier);
  }
}
