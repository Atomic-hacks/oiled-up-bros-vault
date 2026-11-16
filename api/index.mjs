import { handler } from '../server/index.mjs';

export default async function vercelHandler(req, res) {
  // The rewrite carries the original API path explicitly so Vercel's internal
  // function pathname cannot turn /api/auth/login into /api/index.
  const url = new URL(req.url, 'http://localhost');
  const path = url.searchParams.get('vaultPath');
  if (path !== null) req.url = `/api/${path.replace(/^\/+/, '')}`;
  return handler(req, res);
}
