import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";

async function main() {
  const env = loadEnv(process.argv[2] || "development", process.cwd(), "VITE_SUPABASE_");
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  const bucket = env.VITE_SUPABASE_BUCKET || "uploads";

  if (!url && !key) {
    console.log("Supabase storage check skipped: local demo mode uses no bucket.");
    return;
  }

  if (!url || !key) {
    console.error("Configure both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    process.exit(2);
  }

  console.log("Using Supabase:", url);
  console.log("Checking for bucket:", bucket);

  try {
    const supabase = createClient(url, key);
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
