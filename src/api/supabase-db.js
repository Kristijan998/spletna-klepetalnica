const storageBucket = import.meta.env.VITE_SUPABASE_BUCKET || "uploads";

function nowIso() {
  return new Date().toISOString();
}

function generateUploadPath(file) {
  const safeName = String(file?.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safeName}`;
}

function parseOrderBy(orderBy) {
  const raw = String(orderBy || "");
  const isDesc = raw.startsWith("-");
  const field = isDesc ? raw.slice(1) : raw;
  return { field: field || "created_date", ascending: !isDesc };
}

function applyCriteria(query, criteria) {
  if (!criteria) return query;
  for (const [key, value] of Object.entries(criteria)) {
    if (value === undefined) continue;
    query = query.eq(key, value);
  }
  return query;
}

function getMissingColumnFromError(error) {
  const msg = String(error?.message || "");
  const schemaCacheMatch = msg.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const postgresMatch = msg.match(/column ["']?([a-zA-Z0-9_]+)["']? does not exist/i);
  if (postgresMatch?.[1]) return postgresMatch[1];

  return null;
}

function createEntityRepo(supabase, tableName) {
  const list = async (orderBy = "-created_date", limit = 50) => {
    const { field, ascending } = parseOrderBy(orderBy);
    let query = supabase.from(tableName).select("*").order(field, { ascending });
    if (typeof limit === "number") query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  };

  const filter = async (criteria = {}, orderBy = "-created_date", limit = 50) => {
    const { field, ascending } = parseOrderBy(orderBy);
    let query = supabase.from(tableName).select("*");
    query = applyCriteria(query, criteria);
    query = query.order(field, { ascending });
    if (typeof limit === "number") query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  };

  const create = async (data = {}) => {
    let payload = { ...data };

    // Compatibility fallback: if schema is missing a column (e.g. read_by/read_at),
    // retry once per missing key after removing it from payload.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: created, error } = await supabase.from(tableName).insert(payload).select("*").single();
      if (!error) return created;

      const missingColumn = getMissingColumnFromError(error);
      if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
        const { [missingColumn]: _ignored, ...rest } = payload;
        payload = rest;
        continue;
      }

      throw new Error(error.message);
    }

    throw new Error("Create failed after schema compatibility retries.");
  };

  const update = async (id, patch = {}) => {
    let payload = { ...patch, updated_date: nowIso() };

    // Compatibility fallback: if schema is missing a column (e.g. read_by/read_at),
    // retry once per missing key after removing it from payload.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: updated, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (!error) return updated;

      const missingColumn = getMissingColumnFromError(error);
      if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
        const { [missingColumn]: _ignored, ...rest } = payload;
        payload = rest;
        continue;
      }

      throw new Error(error.message);
    }

    throw new Error("Update failed after schema compatibility retries.");
  };

  const remove = async (id) => {
    const { error } = await supabase.from(tableName).delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  };

  return {
    list,
    filter,
    create,
    update,
    delete: remove,
  };
}

export function createSupabaseDbClient(supabase) {
  if (!supabase) throw new Error("Supabase client is not configured");

  const entities = {
    ChatProfile: createEntityRepo(supabase, "chat_profiles"),
    ChatRoom: createEntityRepo(supabase, "chat_rooms"),
    ChatMessage: createEntityRepo(supabase, "chat_messages"),
    ChatGroup: createEntityRepo(supabase, "chat_groups"),
    GroupMessage: createEntityRepo(supabase, "group_messages"),
    SupportMessage: createEntityRepo(supabase, "support_messages"),
    LoginEvent: createEntityRepo(supabase, "login_events"),
  };

  const integrations = {
    Core: {
      UploadFile: async ({ file }) => {
        if (!file) throw new Error("Manjka datoteka");

        // Try Supabase storage first
        try {
          const path = generateUploadPath(file);
          const { error: uploadError } = await supabase.storage.from(storageBucket).upload(path, file, {
            upsert: false,
            cacheControl: "3600",
          });
          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from(storageBucket).getPublicUrl(path);
          const file_url = data?.publicUrl;
          if (!file_url) throw new Error("Upload succeeded but URL is missing");
          return { file_url };
        } catch (err) {
          // If Supabase upload failed (e.g. bucket not found or permissions), fall back to local server upload
          const msg = String(err?.message || err || "").toLowerCase();
          if (msg.includes("bucket not found") || msg.includes("new row violates") || msg.includes("permission") || msg.includes("not found")) {
            // Read file as base64 and POST to local server /upload
            try {
              const readAsBase64 = (file) =>
                new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onerror = () => reject(new Error("Failed to read file"));
                  reader.onload = () => {
                    const result = reader.result;
                    // result is something like data:<mime>;base64,ABC
                    const parts = String(result).split(",");
                    resolve({ base64: parts[1], prefix: parts[0] });
                  };
                  reader.readAsDataURL(file);
                });

              const { base64 } = await readAsBase64(file);
              const filename = file.name || `upload-${Date.now()}`;
              const resp = await fetch("/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename, base64, contentType: file.type }),
              });
              if (!resp.ok) {
                const body = await resp.text();
                throw new Error(`Local upload failed: ${body}`);
              }
              const body = await resp.json();
              if (!body.file_url) throw new Error("Local upload did not return file_url");
              return { file_url: body.file_url };
            } catch (localErr) {
              throw new Error(`Upload failed (supabase + local fallback): ${localErr?.message || localErr}`);
            }
          }

          // Other errors bubble up
          throw new Error(err?.message || err);
        }
      },
    },
  };

  return { entities, integrations, supabase };
}
