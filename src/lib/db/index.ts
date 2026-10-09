import { IHouseRepository } from "./types";
import { LocalHouseRepository } from "./local";
import { SupabaseHouseRepository } from "./supabase";

let repoInstance: IHouseRepository | null = null;

export function getRepository(): IHouseRepository {
  if (repoInstance) {
    return repoInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    repoInstance = new SupabaseHouseRepository(supabaseUrl, serviceRoleKey);
    return repoInstance;
  }

  // Fallback a database locale consentito ESCLUSIVAMENTE in ambiente di test esplicito o con flag USE_LOCAL_DB
  const isExplicitLocalMode =
    process.env.NODE_ENV === "test" || process.env.USE_LOCAL_DB === "true";

  if (isExplicitLocalMode) {
    repoInstance = new LocalHouseRepository();
    return repoInstance;
  }

  // In produzione o su Vercel, non consentire alcun fallback silenzioso effimero
  throw new Error(
    "Configurazione database mancante: in produzione è richiesto Supabase. " +
      "Imposta le variabili d'ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
  );
}

export function setTestRepository(repo: IHouseRepository | null): void {
  repoInstance = repo;
}
