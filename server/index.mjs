import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { getDb, disconnectDb } from './db.mjs';
import { toKobo } from './finance.mjs';
import { reviewDeposit, recordWithdrawal } from './ledger.mjs';
import {
  hash,
  hashPassword,
  id,
  passwordMatches,
  roleForEmail,
  setupCodeMatches,
} from './security.mjs';
import {
  deleteReceipt,
  downloadReceipt,
  ensureReceiptBucket,
  uploadReceipt,
} from './storage.mjs';

const serverless = process.env.VERCEL === '1';
const production = process.env.NODE_ENV === 'production' || serverless;
const ownerEmail = String(process.env.OWNER_EMAIL || '').trim().toLowerCase();
const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const db = getDb();

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function asMoney(value) {
  return Number(value) / 100;
}

function asDate(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function json(res, value, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? item.toString() : item)));
}

async function body(req) {
  // Vercel may already have parsed JSON before invoking the Node handler.
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4_300_000) fail('Receipt is too large. Maximum file size is 3 MB.', 413);
  }
  try {
    return JSON.parse(raw || '{}');
  } catch {
    fail('Invalid request body.');
  }
}

function safeUser(user) {
  const hasGoal = user.goalModel && user.goalStorage && user.goalPriceKobo && user.goalDeadline;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.toLowerCase(),
    goal: hasGoal
      ? {
          model: user.goalModel,
          storage: user.goalStorage,
          price: asMoney(user.goalPriceKobo),
          deadline: user.goalDeadline.toISOString().slice(0, 10),
          frequency: user.goalFrequency,
        }
      : null,
    preferences: user.preferences || {},
  };
}

async function currentUser(req) {
  const token = (req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('vault_session='))
    ?.slice(14);
  if (!token) return null;
  const session = await db.session.findFirst({
    where: { tokenHash: hash(token), expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  return session?.user || null;
}

async function member(req) {
  const user = await currentUser(req);
  if (!user) fail('Please sign in to continue.', 401);
  return user;
}

async function administrator(req) {
  const user = await member(req);
  if (!['ADMIN', 'OWNER'].includes(user.role)) fail('Administrator access required.', 403);
  return user;
}

async function setSession(res, userId) {
  const token = id();
  await db.session.create({
    data: {
      tokenHash: hash(token),
      userId,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
  });
  res.setHeader(
    'Set-Cookie',
    `vault_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${production ? '; Secure' : ''}`,
  );
}

async function balanceKobo(userId, client = db) {
  const result = await client.ledgerEntry.aggregate({
    where: { userId },
    _sum: { amountKobo: true },
  });
  return result._sum.amountKobo || 0n;
}

async function audit(client, actorId, action, entity, details = {}) {
  await client.auditLog.create({ data: { actorId, action, entity, details } });
}

function validGoal(goal) {
  if (
    !goal ||
    typeof goal.model !== 'string' ||
    !goal.model.trim() ||
    goal.model.length > 100 ||
    !['128 GB', '256 GB', '512 GB', '1 TB'].includes(goal.storage) ||
    !['Daily', 'Weekly', 'Monthly', 'Flexible'].includes(goal.frequency)
  ) {
    fail('Complete all goal fields.');
  }
  const priceKobo = BigInt(toKobo(goal.price));
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(goal.deadline) ||
    !Number.isFinite(new Date(`${goal.deadline}T00:00:00Z`).getTime()) ||
    goal.deadline < new Date().toISOString().slice(0, 10)
  ) {
    fail('Choose a valid future deadline.');
  }
  return {
    model: goal.model.trim(),
    storage: goal.storage,
    priceKobo,
    deadline: new Date(`${goal.deadline}T00:00:00Z`),
    frequency: goal.frequency,
  };
}

function parseReceipt(dataUrl) {
  const match = String(dataUrl || '').match(
    /^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) fail('A PNG, JPEG, WEBP or PDF receipt is required.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 3 * 1024 * 1024 || bytes.length < 12) {
    fail('Upload a valid receipt smaller than 3 MB.');
  }
  const mime = match[1];
  const valid =
    (mime === 'application/pdf' && bytes.subarray(0, 5).toString() === '%PDF-') ||
    (mime === 'image/png' &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216) ||
    (mime === 'image/webp' &&
      bytes.subarray(0, 4).toString() === 'RIFF' &&
      bytes.subarray(8, 12).toString() === 'WEBP');
  if (!valid) fail('The receipt does not match its declared file type.');
  return { bytes, mime };
}

const limits = new Map();
function rate(req) {
  const key = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const slot = limits.get(key);
  if (slot && slot.expires > now) {
    slot.count += 1;
    if (slot.count > 40) fail('Too many requests. Try again in a few minutes.', 429);
  } else {
    limits.set(key, { count: 1, expires: now + 300_000 });
  }
}

let vite;
if (!production) {
  const { createServer } = await import('vite');
  vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
}

export async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  const path = new URL(req.url, 'http://localhost').pathname;

  try {
    if (!path.startsWith('/api/')) {
      if (vite) return vite.middlewares(req, res, () => { res.statusCode = 404; res.end(); });
      const root = resolve('dist');
      const requested = resolve(root, `.${decodeURIComponent(path)}`);
      const selected = requested.startsWith(`${root}/`) && existsSync(requested) && extname(requested)
        ? requested
        : resolve(root, 'index.html');
      res.setHeader(
        'Content-Type',
        ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' })[extname(selected)] || 'application/octet-stream',
      );
      res.end(readFileSync(selected));
      return;
    }

    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.headers.origin;
      if (!origin || new URL(origin).host !== req.headers.host) fail('Request origin is not allowed.', 403);
    }

    if (path === '/api/health' && req.method === 'GET') {
      await db.$queryRaw`SELECT 1`;
      return json(res, { ok: true });
    }

    if (path === '/api/session' && req.method === 'GET') {
      const user = await currentUser(req);
      return json(res, { user: user ? safeUser(user) : null });
    }

    if (path === '/api/auth/login' && req.method === 'POST') {
      rate(req);
      const input = await body(req);
      if (typeof input.password !== 'string' || input.password.length > 256) {
        fail('Email or password is incorrect.', 401);
      }
      const user = await db.user.findUnique({ where: { email: String(input.email).trim().toLowerCase() } });
      if (!user || !passwordMatches(input.password, user.passwordHash)) {
        fail('Email or password is incorrect.', 401);
      }
      await setSession(res, user.id);
      await audit(db, user.id, 'login', user.id);
      return json(res, { user: safeUser(user) });
    }

    if (path === '/api/auth/register' && req.method === 'POST') {
      rate(req);
      const input = await body(req);
      const email = String(input.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email address.');
      if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 256) {
        fail('Use a password between 12 and 256 characters.');
      }
      if (!String(input.name || '').trim() || String(input.name).length > 60) fail('Enter your name.');
      const role = roleForEmail(email, ownerEmail, adminEmail);
      const privilegedSetup = role !== 'MEMBER';

      const user = await db.$transaction(async (tx) => {
        if (await tx.user.findUnique({ where: { email } })) fail('An account already exists for this email.', 409);
        let invitation;
        if (privilegedSetup) {
          if (!String(process.env.BOOTSTRAP_CODE || '').trim()) {
            fail('Owner/admin setup is disabled. Set BOOTSTRAP_CODE in .env and restart the server.', 403);
          }
          if (!String(input.invitation || '').trim()) {
            fail('This email belongs to the owner or administrator. Enter the BOOTSTRAP_CODE value from .env in the setup code field.', 403);
          }
          if (!setupCodeMatches(input.invitation, process.env.BOOTSTRAP_CODE)) {
            fail('The setup code does not match. Copy the existing BOOTSTRAP_CODE value from .env into the setup code field. Your account password goes in the separate password field.', 403);
          }
        } else if (String(input.invitation || '').trim()) {
          invitation = await tx.invitation.findFirst({
            where: {
              tokenHash: hash(String(input.invitation).trim()),
              email,
              usedAt: null,
              expiresAt: { gt: new Date() },
            },
          });
        }

        const created = await tx.user.create({
          data: {
            email,
            name: String(input.name).trim(),
            passwordHash: hashPassword(input.password),
            role,
          },
        });
        if (invitation) await tx.invitation.update({ where: { id: invitation.id }, data: { usedAt: new Date() } });
        await audit(tx, created.id, 'account.created', created.id, { role });
        return created;
      });
      await setSession(res, user.id);
      return json(res, { user: safeUser(user) }, 201);
    }

    if (path === '/api/auth/logout' && req.method === 'POST') {
      const token = (req.headers.cookie || '').match(/vault_session=([^;]+)/)?.[1];
      if (token) await db.session.deleteMany({ where: { tokenHash: hash(token) } });
      res.setHeader('Set-Cookie', 'vault_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
      return json(res, { ok: true });
    }

    if (path === '/api/auth/recover' && req.method === 'POST') {
      rate(req);
      return json(res, { ok: true, message: 'Ask the owner or administrator for a one-time reset code.' });
    }

    if (path === '/api/auth/reset' && req.method === 'POST') {
      rate(req);
      const input = await body(req);
      const email = String(input.email || '').trim().toLowerCase();
      if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 256) {
        fail('Use a password between 12 and 256 characters.');
      }
      await db.$transaction(async (tx) => {
        const reset = await tx.passwordResetCode.findFirst({
          where: {
            tokenHash: hash(String(input.token || '')),
            usedAt: null,
            expiresAt: { gt: new Date() },
            user: { email },
          },
        });
        if (!reset) fail('This reset code is invalid or expired.');
        await tx.user.update({ where: { id: reset.userId }, data: { passwordHash: hashPassword(input.password) } });
        await tx.passwordResetCode.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
        await tx.session.deleteMany({ where: { userId: reset.userId } });
        await audit(tx, reset.userId, 'password.reset', reset.userId);
      });
      return json(res, { ok: true });
    }

    if (path === '/api/member' && req.method === 'GET') {
      const user = await member(req);
      const [deposits, balance, withdrawals, notifications] = await Promise.all([
        db.deposit.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
        balanceKobo(user.id),
        db.ledgerEntry.findMany({ where: { userId: user.id, kind: 'WITHDRAWAL' }, orderBy: { createdAt: 'desc' } }),
        db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
      ]);
      return json(res, {
        user: safeUser(user),
        balance: asMoney(balance),
        deposits: deposits.map((deposit) => ({
          id: deposit.id,
          amount: asMoney(deposit.amountKobo),
          date: deposit.date.toISOString().slice(0, 10),
          status: deposit.status.toLowerCase(),
          reference: deposit.reference || '',
          note: deposit.note || '',
          fileName: deposit.fileName,
          reason: deposit.reason,
          created: asDate(deposit.createdAt),
          receipt: `/api/receipts/${deposit.id}`,
        })),
        withdrawals: withdrawals.map((entry) => ({ id: entry.id, amount: asMoney(entry.amountKobo), created: asDate(entry.createdAt) })),
        notifications: notifications.map((item) => ({ id: item.id.toString(), title: item.title, body: item.body, created: asDate(item.createdAt) })),
      });
    }

    if (path === '/api/goal' && req.method === 'PUT') {
      const user = await member(req);
      const goal = validGoal(await body(req));
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            goalModel: goal.model,
            goalStorage: goal.storage,
            goalPriceKobo: goal.priceKobo,
            goalDeadline: goal.deadline,
            goalFrequency: goal.frequency,
          },
        });
        await audit(tx, user.id, 'goal.updated', user.id);
      });
      return json(res, {
        goal: {
          model: goal.model,
          storage: goal.storage,
          price: asMoney(goal.priceKobo),
          deadline: goal.deadline.toISOString().slice(0, 10),
          frequency: goal.frequency,
        },
      });
    }

    if (path === '/api/profile' && req.method === 'PUT') {
      const user = await member(req);
      const input = await body(req);
      if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 60) {
        fail('Enter a name between 1 and 60 characters.');
      }
      await db.user.update({
        where: { id: user.id },
        data: { name: input.name.trim(), preferences: { reminders: Boolean(input.reminders), dark: Boolean(input.dark) } },
      });
      return json(res, { ok: true });
    }

    if (path === '/api/deposits' && req.method === 'POST') {
      const user = await member(req);
      const input = await body(req);
      const amountKobo = BigInt(toKobo(input.amount));
      if (input.requestKey && !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestKey)) fail('Invalid submission key.');
      if (input.requestKey) {
        const existing = await db.deposit.findFirst({ where: { userId: user.id, requestKey: input.requestKey } });
        if (existing) return json(res, { ok: true, id: existing.id, status: existing.status.toLowerCase() });
      }
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
        !Number.isFinite(new Date(`${input.date}T00:00:00Z`).getTime()) ||
        input.date > new Date().toISOString().slice(0, 10)
      ) fail('Choose a valid transaction date up to today.');
      if (String(input.reference || '').length > 100 || String(input.note || '').length > 500) fail('Reference or note is too long.');
      if (input.reference && (await db.deposit.findFirst({ where: { userId: user.id, reference: input.reference } }))) {
        fail('This reference has already been submitted.', 409);
      }
      const { bytes, mime } = parseReceipt(input.receipt);
      const depositId = id();
      const extension = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1];
      const receiptPath = `${user.id}/${depositId}.${extension}`;
      await uploadReceipt(receiptPath, bytes, mime);
      try {
        await db.$transaction(async (tx) => {
          await tx.deposit.create({
            data: {
              id: depositId,
              userId: user.id,
              amountKobo,
              date: new Date(`${input.date}T00:00:00Z`),
              reference: input.reference || null,
              note: input.note || null,
              receiptPath,
              receiptMime: mime,
              fileName: String(input.fileName || 'receipt').slice(0, 150),
              requestKey: input.requestKey || null,
            },
          });
          await audit(tx, user.id, 'deposit.submitted', depositId, { amountKobo: amountKobo.toString() });
        });
      } catch (error) {
        await deleteReceipt(receiptPath).catch(() => {});
        throw error;
      }
      return json(res, { ok: true, id: depositId, status: 'pending' }, 201);
    }

    if (path.startsWith('/api/receipts/') && req.method === 'GET') {
      const user = await member(req);
      const deposit = await db.deposit.findUnique({ where: { id: path.split('/').at(-1) } });
      if (!deposit || (deposit.userId !== user.id && !['ADMIN', 'OWNER'].includes(user.role))) fail('Receipt not found.', 404);
      const receipt = await downloadReceipt(deposit.receiptPath);
      res.writeHead(200, {
        'Content-Type': deposit.receiptMime,
        'X-Frame-Options': 'SAMEORIGIN',
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Content-Disposition': `inline; filename="${deposit.fileName.replace(/[\r\n"]/g, '')}"`,
      });
      res.end(receipt);
      return;
    }

    if (path === '/api/admin' && req.method === 'GET') {
      await administrator(req);
      const [users, deposits, prices, auditRows, reconciliations, pool, withdrawals] = await Promise.all([
        db.user.findMany({ orderBy: { createdAt: 'asc' } }),
        db.deposit.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } }),
        db.devicePrice.findMany(),
        db.auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
        db.reconciliation.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
        db.ledgerEntry.aggregate({ _sum: { amountKobo: true } }),
        db.ledgerEntry.findMany({ where: { kind: 'WITHDRAWAL' }, include: { user: true }, orderBy: { createdAt: 'desc' } }),
      ]);
      const members = await Promise.all(users.map(async (user) => ({ ...safeUser(user), balance: asMoney(await balanceKobo(user.id)) })));
      return json(res, {
        members,
        deposits: deposits.map((deposit) => ({
          id: deposit.id,
          user_id: deposit.userId,
          name: deposit.user.name,
          amount: asMoney(deposit.amountKobo),
          date: deposit.date.toISOString().slice(0, 10),
          reference: deposit.reference || '',
          note: deposit.note || '',
          status: deposit.status.toLowerCase(),
          reason: deposit.reason,
          created: asDate(deposit.createdAt),
          fileName: deposit.fileName,
          receipt: `/api/receipts/${deposit.id}`,
        })),
        prices: prices.map((price) => ({
          user_id: price.userId,
          model: price.model,
          storage: price.storage,
          amount: asMoney(price.amountKobo),
          source: price.source,
          updated: asDate(price.updatedAt),
        })),
        audit: auditRows.map((row) => ({
          id: row.id.toString(),
          name: row.actor.name,
          action: row.action,
          details: JSON.stringify(row.details),
          created: asDate(row.createdAt),
        })),
        reconciliations: reconciliations.map((row) => ({
          id: row.id.toString(),
          bank: asMoney(row.bankKobo),
          tracked: asMoney(row.trackedKobo),
          note: row.note,
          created: asDate(row.createdAt),
        })),
        pool: asMoney(pool._sum.amountKobo || 0n),
        withdrawals: withdrawals.map((entry) => ({ id: entry.id, name: entry.user.name, amount: asMoney(entry.amountKobo), created: asDate(entry.createdAt) })),
      });
    }

    if (/^\/api\/admin\/deposits\/[^/]+$/.test(path) && req.method === 'POST') {
      const actor = await administrator(req);
      const input = await body(req);
      const depositId = path.split('/').at(-1);
      if (!['verify', 'reject'].includes(input.action)) fail('Choose verify or reject.');
      if (input.action === 'reject' && (!String(input.reason || '').trim() || String(input.reason).length > 500)) {
        fail('A rejection reason is required.');
      }
      await db.$transaction((tx) => reviewDeposit(tx, actor.id, depositId, input.action, input.reason), { isolationLevel: 'Serializable' });
      return json(res, { ok: true });
    }

    if (path === '/api/admin/invitations' && req.method === 'POST') {
      const actor = await administrator(req);
      const input = await body(req);
      const email = String(input.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email address.');
      const token = id();
      await db.$transaction(async (tx) => {
        await tx.invitation.create({
          data: { tokenHash: hash(token), email, expiresAt: new Date(Date.now() + 7 * 86_400_000), createdById: actor.id },
        });
        await audit(tx, actor.id, 'invitation.created', email);
      });
      return json(res, { invitation: token, email, expiresInDays: 7 });
    }

    if (path === '/api/admin/password-resets' && req.method === 'POST') {
      const actor = await administrator(req);
      const input = await body(req);
      const target = await db.user.findUnique({ where: { id: String(input.userId || '') } });
      if (!target) fail('Member not found.', 404);
      const token = id();
      await db.$transaction(async (tx) => {
        await tx.passwordResetCode.create({
          data: { tokenHash: hash(token), userId: target.id, createdById: actor.id, expiresAt: new Date(Date.now() + 30 * 60_000) },
        });
        await audit(tx, actor.id, 'password.reset-code.created', target.id);
      });
      return json(res, { resetCode: token, email: target.email, expiresInMinutes: 30 });
    }

    if (path === '/api/admin/prices' && req.method === 'PUT') {
      const actor = await administrator(req);
      const input = await body(req);
      const amountKobo = BigInt(toKobo(input.amount));
      if (!(await db.user.findUnique({ where: { id: String(input.userId) } }))) fail('Member not found.', 404);
      await db.$transaction(async (tx) => {
        const data = {
          model: String(input.model || '').slice(0, 100),
          storage: String(input.storage || '').slice(0, 30),
          amountKobo,
          source: String(input.source || '').slice(0, 500) || null,
        };
        await tx.devicePrice.upsert({ where: { userId: String(input.userId) }, update: data, create: { userId: String(input.userId), ...data } });
        await audit(tx, actor.id, 'price.updated', String(input.userId), { amountKobo: amountKobo.toString() });
      });
      return json(res, { ok: true });
    }

    if (path === '/api/admin/withdrawals' && req.method === 'POST') {
      const actor = await administrator(req);
      const input = await body(req);
      const amountKobo = BigInt(toKobo(input.amount));
      if (!String(input.note || '').trim()) fail('A disbursement reason is required.');
      await db.$transaction((tx) => recordWithdrawal(tx, actor.id, String(input.userId), amountKobo, input.note), { isolationLevel: 'Serializable' });
      return json(res, { ok: true }, 201);
    }

    if (path === '/api/admin/reconciliation' && req.method === 'POST') {
      const actor = await administrator(req);
      const input = await body(req);
      const bankKobo = input.amount === '0' ? 0n : BigInt(toKobo(input.amount));
      const tracked = await db.ledgerEntry.aggregate({ _sum: { amountKobo: true } });
      const trackedKobo = tracked._sum.amountKobo || 0n;
      await db.$transaction(async (tx) => {
        const row = await tx.reconciliation.create({
          data: { bankKobo, trackedKobo, note: String(input.note || '').slice(0, 500) || null, actorId: actor.id },
        });
        await audit(tx, actor.id, 'pool.reconciled', row.id.toString(), {
          bankKobo: bankKobo.toString(),
          trackedKobo: trackedKobo.toString(),
        });
      });
      return json(res, { ok: true, discrepancy: asMoney(bankKobo - trackedKobo) });
    }

    fail('Endpoint not found.', 404);
  } catch (error) {
    const status = error.status || (error.code === 'P2002' ? 409 : 500);
    if (status === 500) console.error(error);
    json(res, { error: status === 500 ? 'Something went wrong. Please try again.' : error.message }, status);
  }
}

const server = http.createServer(handler);

const port = Number(process.env.PORT || 5173);

async function start() {
  await ensureReceiptBucket();
  await db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  server.listen(port, '0.0.0.0', () => console.log(`VAULT is running at http://localhost:${port}`));
}

async function shutdown() {
  server.close();
  await disconnectDb();
  process.exit(0);
}

if (!serverless) {
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  start().catch(async (error) => {
    console.error(`VAULT failed to start: ${error.message}`);
    await disconnectDb();
    process.exit(1);
  });
}
