import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

let prisma;

export function getDb() {
  if (prisma) return prisma;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Add the Supabase pooled connection string to .env.');
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  prisma = new PrismaClient({ adapter });
  return prisma;
}

export async function disconnectDb() {
  if (prisma) await prisma.$disconnect();
}
