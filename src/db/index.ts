import { createClient } from "@tursodatabase/serverless/compat";
import { getConfig } from "@/config.ts";

const config = getConfig();

console.log(config);
const turso = createClient({
  url: config.tursoDatabaseUrl!,
  authToken: config.tursoAuthToken,
});

export const db = turso;
