import { createClient } from '@supabase/supabase-js';

const bucket = process.env.SUPABASE_RECEIPTS_BUCKET || 'vault-receipts';
let client;
let ready;

function getStorageClient() {
  if (client) return client;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required for receipt storage.');
  }
  client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export async function ensureReceiptBucket() {
  const supabase = getStorageClient();
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (data) {
    if (data.public) throw new Error('The receipt bucket must be private. Disable public access in Supabase Storage.');
    return;
  }
  if (error && !String(error.message).toLowerCase().includes('not found')) throw error;
  const created = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 3 * 1024 * 1024,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
  });
  if (created.error && !String(created.error.message).toLowerCase().includes('already')) {
    throw created.error;
  }
}

export async function uploadReceipt(path, bytes, mime) {
  // Functions do not run the persistent server's startup hook.
  if (!ready) ready = ensureReceiptBucket().catch((error) => { ready = undefined; throw error; });
  await ready;
  const supabase = getStorageClient();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw error;
}

export async function downloadReceipt(path) {
  const supabase = getStorageClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw error || new Error('Receipt not found.');
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteReceipt(path) {
  const supabase = getStorageClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
