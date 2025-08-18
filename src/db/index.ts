import { createClient } from "@libsql/client";
import { getConfig } from "@/config.ts";

const config = getConfig();

const turso = createClient({
  url: config.tursoDatabaseUrl!,
  authToken: config.tursoAuthToken,
});

export const db = turso;
