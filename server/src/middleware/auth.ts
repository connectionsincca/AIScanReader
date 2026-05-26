import { Request, Response, NextFunction } from 'express';
import { isValidSession } from '../services/sessionStore';

/**
 * Express middleware that requires a valid x-session-token header.
 * Applied to all document-processing and submission routes.
 * The session route itself is intentionally excluded.
 */
export function requireSession(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-session-token'] as string | undefined;

  if (!token || !isValidSession(token)) {
    res.status(401).json({
      error: 'Session expired or invalid. Please refresh the page and start again.',
    });
    return;
  }

  next();
}
