const STORAGE_PREFIX = "local_db_entity_";

const MAX_UPLOAD_BYTES = 2_000_000; // ~2MB (localStorage ima omejitve)

function nowIso() {
  return new Date().toISOString();
}

function generateId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function safeParseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Napaka pri branju datoteke"));
    reader.readAsDataURL(file);
  });
}

function getSortComparator(orderBy) {
  if (!orderBy) return null;
  const isDesc = orderBy.startsWith("-");
  const field = isDesc ? orderBy.slice(1) : orderBy;

  return (a, b) => {
    const av = a?.[field];
    const bv = b?.[field];

    if (av == null && bv == null) return 0;
    if (av == null) return isDesc ? 1 : -1;
    if (bv == null) return isDesc ? -1 : 1;

    if (av === bv) return 0;

    // ISO datumi se primerjajo leksikografsko
    if (av > bv) return isDesc ? -1 : 1;
    return isDesc ? 1 : -1;
  };
}

function matchesCriteria(record, criteria) {
  if (!criteria) return true;
  for (const [key, value] of Object.entries(criteria)) {
    if (value === undefined) continue;
    if (record?.[key] !== value) return false;
  }
  return true;
}

function createEntityRepo(entityName) {
  const storageKey = `${STORAGE_PREFIX}${entityName}`;

  const readAll = () => {
    const raw = localStorage.getItem(storageKey);
    const records = safeParseJson(raw, []);
    return Array.isArray(records) ? records : [];
  };

  const writeAll = (records) => {
    localStorage.setItem(storageKey, JSON.stringify(records));
  };

  const list = async (orderBy = "-created_date", limit = 50) => {
    const records = readAll();
    const cmp = getSortComparator(orderBy);
    const sorted = cmp ? [...records].sort(cmp) : [...records];
    const sliced = typeof limit === "number" ? sorted.slice(0, limit) : sorted;
    return clone(sliced);
  };

  const filter = async (criteria = {}, orderBy = "-created_date", limit = 50) => {
    const records = readAll().filter((r) => matchesCriteria(r, criteria));
    const cmp = getSortComparator(orderBy);
    const sorted = cmp ? [...records].sort(cmp) : [...records];
    const sliced = typeof limit === "number" ? sorted.slice(0, limit) : sorted;
    return clone(sliced);
  };

  const create = async (data = {}) => {
    const records = readAll();
    const record = {
      id: generateId(entityName.toLowerCase()),
      created_date: nowIso(),
      updated_date: nowIso(),
      ...data,
    };
    records.push(record);
    writeAll(records);
    
    // Notify other tabs via BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('local_db_updates');
        channel.postMessage({ entity: entityName, action: 'create', id: record.id });
        channel.close();
      } catch (e) { /* ignore */ }
    }
    
    return clone(record);
  };

  const update = async (id, patch = {}) => {
    const records = readAll();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) {
      throw new Error(`${entityName}: zapis z id '${id}' ne obstaja`);
    }
    const updated = {
      ...records[idx],
      ...patch,
      updated_date: nowIso(),
    };
    records[idx] = updated;
    writeAll(records);
    
    // Notify other tabs via BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('local_db_updates');
        channel.postMessage({ entity: entityName, action: 'update', id });
        channel.close();
      } catch (e) { /* ignore */ }
    }
    
    return clone(updated);
  };

  const remove = async (id) => {
    const records = readAll();
    const next = records.filter((r) => r.id !== id);
    writeAll(next);
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

export function createLocalDbClient() {
  const entities = {
    ChatProfile: createEntityRepo("ChatProfile"),
    ChatRoom: createEntityRepo("ChatRoom"),
    ChatMessage: createEntityRepo("ChatMessage"),
    ChatGroup: createEntityRepo("ChatGroup"),
    GroupMessage: createEntityRepo("GroupMessage"),
    SupportMessage: createEntityRepo("SupportMessage"),
    LoginEvent: createEntityRepo("LoginEvent"),
  };

  const integrations = {
    Core: {
      UploadFile: async ({ file }) => {
        if (!file) {
          throw new Error("Manjka datoteka");
        }
        if (typeof file.size === "number" && file.size > MAX_UPLOAD_BYTES) {
          throw new Error("Datoteka je prevelika za lokalni način (max ~2MB)");
        }
        const file_url = await fileToDataUrl(file);
        return { file_url };
      },
    },
  };

  return { entities, integrations };
}
