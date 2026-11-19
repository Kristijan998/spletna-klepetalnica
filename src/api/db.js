const isConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

export const isSupabaseDb = isConfigured;
export const isLocalDb = !isConfigured;

let clientPromise = null;
let supabaseClientPromise = null;

function getSupabaseClient() {
  if (!isConfigured) throw new Error("Supabase is not configured");
  return supabaseClientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.sessionStorage,
      },
    })
  );
}

async function getDbClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      if (isConfigured) {
        const [supabase, { createSupabaseDbClient }] = await Promise.all([
          getSupabaseClient(),
          import("@/api/supabase-db"),
        ]);

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          const result = await supabase.auth.signInAnonymously();
          if (result.error) throw result.error;
        }
        return createSupabaseDbClient(supabase);
      }

      const { createLocalDbClient } = await import("@/api/local-db");
      return createLocalDbClient();
    })().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }

  return clientPromise;
}

export async function getDatabaseIdentity() {
  if (!isConfigured) return null;
  await getDbClient();
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return { userId: data.user.id, isAdmin: isAdminUser(data.user) };
}

function isAdminUser(user) {
  return user?.is_anonymous !== true && user?.app_metadata?.chattko_admin === true;
}

export async function signInDatabaseAdmin(email, password) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  clientPromise = null;
  if (!isAdminUser(data.user)) {
    await signOutDatabaseAdmin();
    throw new Error("The account does not have administrator access");
  }
  return data.user.id;
}

export async function signOutDatabaseAdmin() {
  if (!isConfigured) return;
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
  clientPromise = null;
}

export async function prepareGuestDatabaseSession() {
  if (!isConfigured) return;
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session && !data.session.user.is_anonymous) await signOutDatabaseAdmin();
}

function createEntityProxy(entityName) {
  return {
    list: async (...args) => (await getDbClient()).entities[entityName].list(...args),
    filter: async (...args) => (await getDbClient()).entities[entityName].filter(...args),
    create: async (...args) => (await getDbClient()).entities[entityName].create(...args),
    update: async (...args) => (await getDbClient()).entities[entityName].update(...args),
    delete: async (...args) => (await getDbClient()).entities[entityName].delete(...args),
  };
}

export const db = {
  entities: {
    ChatProfile: createEntityProxy("ChatProfile"),
    ChatRoom: createEntityProxy("ChatRoom"),
    ChatMessage: createEntityProxy("ChatMessage"),
    ChatGroup: createEntityProxy("ChatGroup"),
    GroupMessage: createEntityProxy("GroupMessage"),
    SupportMessage: createEntityProxy("SupportMessage"),
    LoginEvent: createEntityProxy("LoginEvent"),
  },
  integrations: {
    Core: {
      UploadFile: async (...args) => (await getDbClient()).integrations.Core.UploadFile(...args),
    },
  },
};
