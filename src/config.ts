import { z } from "zod";

const configSchema = z
  .object({
    port: z.coerce.number().default(3000),
    isDevelopment: z.boolean().default(false),
    openaiKey: z.string().nonempty(),
    embeddingModel: z.string().default("text-embedding-3-large"),
    chatModel: z.string().default("gpt-4o-mini"),
    tursoDatabaseUrl: z.url().optional(),
    tursoAuthToken: z.string().nonempty().optional(),
    basicAuth: z.object({
      username: z.string().nonempty(),
      password: z.string().nonempty(),
    }),
  })
  .refine(
    (data) => {
      if (data.isDevelopment) {
        return true;
      }
      return !!data.tursoDatabaseUrl && !!data.tursoAuthToken;
    },
    {
      message: "tursoDatabaseUrl and tursoAuthToken are required in production",
    },
  );

export type Config = z.infer<typeof configSchema>;

let cachedConfig: Config | null = null;

function parseConfigFromEnv(): Config {
  const isDevelopment = Deno.env.get("NODE_ENV") !== "production";

  return configSchema.parse({
    port: Deno.env.get("PORT"),
    openaiKey: Deno.env.get("OPENAI_API_KEY"),
    isDevelopment,
    embeddingModel: Deno.env.get("OPENAI_EMBEDDING_MODEL"),
    chatModel: Deno.env.get("OPENAI_CHAT_MODEL"),
    tursoDatabaseUrl: Deno.env.get("TURSO_DATABASE_URL"),
    tursoAuthToken: Deno.env.get("TURSO_AUTH_TOKEN"),
    basicAuth: {
      username: Deno.env.get("BASIC_AUTH_USERNAME"),
      password: Deno.env.get("BASIC_AUTH_PASSWORD"),
    },
  });
}

export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = parseConfigFromEnv();
  return cachedConfig;
}
