CREATE TYPE "Role" AS ENUM ('MEMBER', 'ADMIN', 'OWNER');
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "LedgerKind" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'MEMBER',
  "goalModel" TEXT,
  "goalStorage" TEXT,
  "goalPriceKobo" BIGINT,
  "goalDeadline" DATE,
  "goalFrequency" TEXT,
  "preferences" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Session" (
  "tokenHash" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Invitation" (
  "id" TEXT PRIMARY KEY,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "email" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT
);

CREATE TABLE "Deposit" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "amountKobo" BIGINT NOT NULL CHECK ("amountKobo" > 0),
  "date" DATE NOT NULL,
  "reference" TEXT,
  "note" TEXT,
  "receiptPath" TEXT NOT NULL,
  "receiptMime" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "requestKey" TEXT,
  "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "LedgerEntry" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "depositId" TEXT UNIQUE REFERENCES "Deposit"("id") ON DELETE RESTRICT,
  "amountKobo" BIGINT NOT NULL CHECK ("amountKobo" <> 0),
  "kind" "LedgerKind" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_amount_direction" CHECK (
    ("kind" = 'DEPOSIT' AND "amountKobo" > 0) OR
    ("kind" = 'WITHDRAWAL' AND "amountKobo" < 0)
  )
);

CREATE TABLE "AuditLog" (
  "id" BIGSERIAL PRIMARY KEY,
  "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "DevicePrice" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "model" TEXT NOT NULL,
  "storage" TEXT NOT NULL,
  "amountKobo" BIGINT NOT NULL CHECK ("amountKobo" > 0),
  "source" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Reconciliation" (
  "id" BIGSERIAL PRIMARY KEY,
  "bankKobo" BIGINT NOT NULL CHECK ("bankKobo" >= 0),
  "trackedKobo" BIGINT NOT NULL,
  "note" TEXT,
  "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Notification" (
  "id" BIGSERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PasswordResetCode" (
  "id" TEXT PRIMARY KEY,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "Invitation_email_expiresAt_idx" ON "Invitation"("email", "expiresAt");
CREATE INDEX "Deposit_status_createdAt_idx" ON "Deposit"("status", "createdAt");
CREATE INDEX "Deposit_userId_createdAt_idx" ON "Deposit"("userId", "createdAt");
CREATE INDEX "Deposit_reviewedById_idx" ON "Deposit"("reviewedById");
CREATE UNIQUE INDEX "Deposit_userId_reference_key" ON "Deposit"("userId", "reference");
CREATE UNIQUE INDEX "Deposit_userId_requestKey_key" ON "Deposit"("userId", "requestKey");
CREATE INDEX "LedgerEntry_userId_createdAt_idx" ON "LedgerEntry"("userId", "createdAt");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "Reconciliation_createdAt_idx" ON "Reconciliation"("createdAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "PasswordResetCode_userId_expiresAt_idx" ON "PasswordResetCode"("userId", "expiresAt");

-- Supabase's Data API cannot read these tables. VAULT accesses them through
-- the dedicated Prisma database role and performs authorization on the server.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Deposit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DevicePrice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reconciliation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetCode" ENABLE ROW LEVEL SECURITY;
