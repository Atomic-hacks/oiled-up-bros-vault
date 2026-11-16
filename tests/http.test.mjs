import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// A deliberately non-routable database URL: these guards must not query data.
process.env.VERCEL = '1';
process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
const { default: handler } = await import('../api/index.mjs');

test('Vercel rewrite routes reach API authorization and preserve same-origin protection', async () => {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const session = await fetch(base + '/api/index?vaultPath=session');
    assert.equal(session.status, 200);
    assert.deepEqual(await session.json(), { user: null });
    for (const path of ['admin', 'member', 'receipts/another-members-file']) {
      const response = await fetch(base + '/api/index?vaultPath=' + path);
      assert.equal(response.status, 401);
    }
    const blocked = await fetch(base + '/api/index?vaultPath=auth/recover', {
      method: 'POST', headers: { Origin: 'https://untrusted.example' },
    });
    assert.equal(blocked.status, 403);
    const allowed = await fetch(base + '/api/index?vaultPath=auth/recover', {
      method: 'POST', headers: { Origin: base },
    });
    assert.equal(allowed.status, 200);
    assert.match(allowed.headers.get('cache-control'), /no-store/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
