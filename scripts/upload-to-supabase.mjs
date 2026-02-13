import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[key] = val;
  }
  return env;
}

async function main() {
  const repoRoot = path.resolve('.');
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found');
    process.exit(2);
  }
  const env = parseEnvFile(envPath);
  const url = env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE;
  const bucket = env.VITE_SUPABASE_BUCKET || 'uploads';

  if (!url || !serviceKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(2);
  }

  const supabase = createClient(url, serviceKey);

  const content = `Test upload from script at ${new Date().toISOString()}`;
  const buffer = Buffer.from(content, 'utf8');
  const remotePath = `test-${Date.now()}.txt`;

  console.log('Uploading to bucket', bucket, 'path', remotePath);
  const { data, error } = await supabase.storage.from(bucket).upload(remotePath, buffer, { contentType: 'text/plain', upsert: true });
  if (error) {
    console.error('Upload error:', error.message || error);
    process.exit(3);
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(remotePath);
  console.log('Public URL:', urlData?.publicUrl || '(none)');
}

main().catch((e) => {
  console.error('Unexpected:', e?.message || e);
  process.exit(1);
});
