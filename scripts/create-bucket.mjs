import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (val.startsWith("\"") && val.endsWith("\"")) val = val.slice(1, -1);
    env[key] = val;
  }
  return env;
}

async function main() {
  const repoRoot = path.resolve(".");
  const envPath = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(".env.local not found in project root");
    process.exit(2);
  }

  const env = parseEnvFile(envPath);
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE;
  const bucket = env.VITE_SUPABASE_BUCKET || "uploads";

  if (!url) {
    console.error("Missing VITE_SUPABASE_URL in .env.local");
    process.exit(2);
  }

  console.log("Creating bucket:", bucket, "on", url);
  const useKey = serviceKey || anonKey;
  if (!useKey) {
    console.error("Missing any Supabase key (anon or service role) in .env.local");
    process.exit(2);
  }
  if (serviceKey) console.log("Using service role key for bucket creation (safer)");
  const supabase = createClient(url, useKey);

  try {
    const { data, error } = await supabase.storage.createBucket(bucket, { public: true });
    if (error) {
      // If already exists, treat as OK
      const msg = String(error.message || error);
      if (msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("bucket already exists")) {
        console.log("Bucket already exists");
        process.exit(0);
      }
      console.error("createBucket error:", msg);
      process.exit(3);
    }

    console.log("Bucket created:", data);
  } catch (err) {
    console.error("Unexpected error:", err.message || err);
    process.exit(4);
  }
}

main();
