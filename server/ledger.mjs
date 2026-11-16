function conflict(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

export async function ledgerBalance(client, userId) {
  const result = await client.ledgerEntry.aggregate({ where: { userId }, _sum: { amountKobo: true } });
  return result._sum.amountKobo || 0n;
}

// Call inside a serializable transaction. Status, ledger, notification and audit
// must commit together or all roll back.
export async function reviewDeposit(tx, actorId, depositId, action, reason = '') {
  if (!['verify', 'reject'].includes(action)) conflict('Choose verify or reject.');
  if (action === 'reject' && (!String(reason).trim() || String(reason).length > 500)) {
    conflict('A rejection reason is required.');
  }
  const result = await tx.deposit.updateMany({
    where: { id: depositId, status: 'PENDING' },
    data: { status: action === 'verify' ? 'VERIFIED' : 'REJECTED',
      reason: action === 'reject' ? String(reason).trim() : null,
      reviewedAt: new Date(), reviewedById: actorId },
  });
  if (result.count !== 1) conflict('This deposit has already been reviewed.', 409);
  const deposit = await tx.deposit.findUniqueOrThrow({ where: { id: depositId } });
  if (action === 'verify') {
    await tx.ledgerEntry.create({ data: { userId: deposit.userId, depositId, amountKobo: deposit.amountKobo, kind: 'DEPOSIT' } });
  }
  await tx.auditLog.create({ data: {
    actorId, action: `deposit.${action === 'verify' ? 'verified' : 'rejected'}`, entity: depositId,
    details: { amountKobo: deposit.amountKobo.toString(), reason: reason || null },
  } });
  await tx.notification.create({ data: {
    userId: deposit.userId, title: `Deposit ${action === 'verify' ? 'verified' : 'rejected'}`,
    body: action === 'verify' ? 'Your deposit is verified and included in your balance.' : String(reason).trim(),
  } });
}

export async function recordWithdrawal(tx, actorId, userId, amountKobo, note) {
  if (amountKobo <= 0n) conflict('Enter a positive disbursement amount.');
  if (!String(note || '').trim()) conflict('A disbursement reason is required.');
  if (amountKobo > await ledgerBalance(tx, userId)) conflict('This withdrawal exceeds the member’s verified balance.');
  const entry = await tx.ledgerEntry.create({ data: {
    userId, amountKobo: -amountKobo, kind: 'WITHDRAWAL', note: String(note).trim().slice(0, 500),
  } });
  await tx.auditLog.create({ data: {
    actorId, action: 'withdrawal.recorded', entity: entry.id,
    details: { userId, amountKobo: amountKobo.toString(), note: String(note).trim().slice(0, 500) },
  } });
  await tx.notification.create({ data: {
    userId, title: 'Disbursement recorded', body: String(note).trim().slice(0, 500),
  } });
  return entry;
}
