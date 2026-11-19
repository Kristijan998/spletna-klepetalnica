const isConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

export const isSupabaseDb = isConfigured;
export const isLocalDb = !isConfigured;

let clientPromise = null;

async function getDbClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      if (isConfigured) {
        const [{ createClient }, { createSupabaseDbClient }] = await Promise.all([
          import("@supabase/supabase-js"),
          import("@/api/supabase-db"),
        ]);

        const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });

        return createSupabaseDbClient(supabase);
      }

      const { createLocalDbClient } = await import("@/api/local-db");
      return createLocalDbClient();
    })();
  }

  return clientPromise;
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
