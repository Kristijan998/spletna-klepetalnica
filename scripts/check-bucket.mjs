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
  const key = env.VITE_SUPABASE_ANON_KEY;
  const bucket = env.VITE_SUPABASE_BUCKET || "uploads";

  if (!url || !key) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local");
    process.exit(2);
  }

  console.log("Using Supabase:", url);
  console.log("Checking for bucket:", bucket);

  const supabase = createClient(url, key);

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error("Error listing buckets:", listError.message);
    } else {
      console.log("Buckets:", (buckets || []).map(b => b.id));
    }

    const { data: bucketInfo, error: getError } = await supabase.storage.getBucket(bucket);
    if (getError) {
      console.error("getBucket error:", getError.message);
      process.exitCode = 3;
    } else {
      console.log("Bucket found:", bucketInfo);
    }
  } catch (err) {
    console.error("Unexpected error:", err.message || err);
    process.exitCode = 4;
  }
}

main();
