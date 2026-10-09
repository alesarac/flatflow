import { IHouseRepository } from "./types";
import { LocalHouseRepository } from "./local";
import { SupabaseHouseRepository } from "./supabase";

let repoInstance: IHouseRepository | null = null;

export function getRepository(): IHouseRepository {
  if (repoInstance) {
    return repoInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    repoInstance = new SupabaseHouseRepository(supabaseUrl, supabaseKey);
  } else {
    repoInstance = new LocalHouseRepository();
  }

  return repoInstance;
}

export function setTestRepository(repo: IHouseRepository | null): void {
  repoInstance = repo;
}
