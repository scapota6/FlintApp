import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import type { Express, Request, Response, NextFunction } from 'express';

export function installCsrf(app: Express) {
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use((req, _res, next) => {
    // some hosts (replit) need body parser before csurf
    if (req.headers['content-type']?.includes('application/json')) {
      // if you already call express.json() globally, remove this
    }
    next();
  });

  const isProd = process.env.NODE_ENV === 'production';
  app.use(csrf({
    cookie: {
      key: 'flint_csrf',
      path: '/',
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      httpOnly: false, // client must read to echo in header
    },
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS'] // Exclude GET routes from CSRF protection
  }));

  app.get('/api/csrf-token', (req: Request, res: Response) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  // dev-only probe to see what the server receives (remove in prod)
  app.post('/api/_debug/csrf-check', (req: Request, res: Response) => {
    const header = (req.headers['x-csrf-token'] || req.headers['csrf-token'] || '') as string;
    const cookie = (req.headers.cookie || '').includes('flint_csrf=');
    res.json({ ok: true, headerPresent: !!header, cookiePresent: cookie });
  });

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err?.code === 'EBADCSRFTOKEN') {
      return res.status(403).json({ code: 'CSRF_INVALID', message: 'Invalid CSRF token' });
    }
    next(err);
  });
}