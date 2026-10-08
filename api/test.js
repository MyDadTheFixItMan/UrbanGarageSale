// Simple test endpoint
import { applyCors, getTrustedOrigin } from './_shared/security.js';

export default (req, res) => {
  applyCors(res, getTrustedOrigin(req.headers.origin, process.env.FRONTEND_URL || 'http://localhost:5174'), 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  return res.status(200).json({
    status: "ok",
    message: "Urban Pay test endpoint - Vercel API routing working!",
    timestamp: new Date().toISOString(),
    endpoint: "/api/test",
  });
};
