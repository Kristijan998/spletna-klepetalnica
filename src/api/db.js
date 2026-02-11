import { createLocalDbClient } from "@/api/local-db";
import { supabase, isSupabaseConfigured } from "@/api/supabase";
import { createSupabaseDbClient } from "@/api/supabase-db";

export const db = isSupabaseConfigured ? createSupabaseDbClient(supabase) : createLocalDbClient();
export const isLocalDb = !isSupabaseConfigured;
export const isSupabaseDb = isSupabaseConfigured;
