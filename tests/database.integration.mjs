import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getDb, disconnectDb } from '../server/db.mjs';
import { ledgerBalance, reviewDeposit, recordWithdrawal } from '../server/ledger.mjs';

test('Supabase financial lifecycle is atomic, isolated, and credits only once', { timeout: 60000 }, async () => {
  const db = getDb();
  const rollback = new Error('Intentional integration-test rollback');
  const suffix = randomUUID();
  let memberId;
  try {
    await assert.rejects(db.$transaction(async (tx) => {
      const create = (name, role) => tx.user.create({ data: {
        email: `rollback-${name}-${suffix}@example.invalid`, name, role, passwordHash: 'disabled-test-account',
      } });
      const actor = await create('reviewer', 'ADMIN');
      const member = await create('member', 'MEMBER');
      const other = await create('other', 'MEMBER');
      memberId = member.id;
      const deposit = await tx.deposit.create({ data: {
        userId: member.id, amountKobo: 125055n, date: new Date('2026-11-16'),
        receiptPath: 'rollback-only/no-upload.pdf', receiptMime: 'application/pdf', fileName: 'rollback-only.pdf',
      } });
      assert.equal(deposit.status, 'PENDING');
      assert.equal(await ledgerBalance(tx, member.id), 0n);
      await reviewDeposit(tx, actor.id, deposit.id, 'verify');
      assert.equal(await ledgerBalance(tx, member.id), 125055n);
      assert.equal(await ledgerBalance(tx, other.id), 0n);
      await assert.rejects(reviewDeposit(tx, actor.id, deposit.id, 'verify'), { status: 409 });
      assert.equal(await tx.ledgerEntry.count({ where: { depositId: deposit.id } }), 1);
      const rejected = await tx.deposit.create({ data: {
        userId: member.id, amountKobo: 900000n, date: new Date('2026-11-16'),
        receiptPath: 'rollback-only/rejected.pdf', receiptMime: 'application/pdf', fileName: 'rollback-only.pdf',
      } });
      await assert.rejects(reviewDeposit(tx, actor.id, rejected.id, 'reject'), { status: 400 });
      await reviewDeposit(tx, actor.id, rejected.id, 'reject', 'No matching bank transfer');
      assert.equal(await ledgerBalance(tx, member.id), 125055n);
      await assert.rejects(recordWithdrawal(tx, actor.id, member.id, 125056n, 'Too much'), { status: 400 });
      await recordWithdrawal(tx, actor.id, member.id, 25055n, 'Purchase allocation');
      assert.equal(await ledgerBalance(tx, member.id), 100000n);
      const pool = await tx.ledgerEntry.aggregate({ where: { userId: { in: [member.id, other.id] } }, _sum: { amountKobo: true } });
      assert.equal(pool._sum.amountKobo, 100000n);
      assert.equal(await tx.notification.count({ where: { userId: member.id } }), 3);
      assert.equal(await tx.auditLog.count({ where: { actorId: actor.id } }), 3);
      throw rollback;
    }, { isolationLevel: 'Serializable', timeout: 45000, maxWait: 10000 }), (error) => error === rollback);
    assert.ok(memberId);
    assert.equal(await db.user.count({ where: { id: memberId } }), 0, 'No test users may survive rollback');
    assert.equal(await db.deposit.count({ where: { userId: memberId } }), 0, 'No test deposits may survive rollback');
  } finally {
    await disconnectDb();
  }
});
