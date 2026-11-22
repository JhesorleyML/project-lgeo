import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(__dirname, "../../../../.env");
const serverEnvPath = path.resolve(__dirname, "../../.env");

dotenv.config({ path: rootEnvPath });
dotenv.config({ path: serverEnvPath });
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z
    .string()
    .default("postgresql://cbms_user:cbms_password@localhost:5432/cbms_gis_db"),
  DB_POOL_MAX: z.coerce.number().default(20),
  JWT_SECRET: z.string().default("dev-cbms-secret-key-change-in-production"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  AI_PROVIDER: z
    .enum(["builtin", "gemini", "openai", "ollama"])
    .default("builtin"),
  AI_API_KEY: z.string().optional().default(""),
  GEMINI_API_KEY: z.string().optional().default(""),
  AI_BASE_URL: z.string().optional().default("http://localhost:11434"),
  AI_MODEL: z.string().optional().default("gemini-3.8-flash"),
});

export const env = EnvSchema.parse(process.env);

/**
 * Reloads .env dynamically and resolves the effective AI provider & API key.
 * If the user pasted a Gemini key into AI_API_KEY or GEMINI_API_KEY while leaving
 * AI_PROVIDER at the default "builtin", automatically upgrades to "gemini".
 */
export function getEffectiveAiConfig(): {
  provider: "builtin" | "gemini" | "openai" | "ollama";
  apiKey: string;
  baseUrl: string;
  model: string;
} {
  dotenv.config({ path: rootEnvPath, override: true });
  dotenv.config({ path: serverEnvPath, override: true });

  const rawProvider = (process.env.AI_PROVIDER ?? env.AI_PROVIDER ?? "builtin")
    .trim()
    .toLowerCase();
  const rawApiKey = (
    process.env.AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    env.AI_API_KEY ||
    env.GEMINI_API_KEY ||
    ""
  ).trim();
  const baseUrl = (
    process.env.AI_BASE_URL ||
    env.AI_BASE_URL ||
    "http://localhost:11434"
  ).trim();
  const rawModel = (
    process.env.AI_MODEL ||
    env.AI_MODEL ||
    "gemini-3.8-flash"
  ).trim();
  const normalizedModel =
    rawModel === "gemini-2.5-flash" ||
    rawModel === "gemini-2.0-flash" ||
    rawModel === "gemini-1.5-flash" ||
    rawModel === "cbms-deterministic-nl-engine"
      ? "gemini-3.8-flash"
      : rawModel;

  const explicitEnvProvider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();

  let provider: "builtin" | "gemini" | "openai" | "ollama" =
    rawProvider === "gemini" ||
    rawProvider === "openai" ||
    rawProvider === "ollama" ||
    rawProvider === "builtin"
      ? rawProvider
      : "builtin";

  // Only auto-detect provider from API key when AI_PROVIDER was omitted/blank in .env.
  // If the user explicitly set AI_PROVIDER=builtin in .env, strictly respect "builtin".
  if (!explicitEnvProvider && rawApiKey.length > 5) {
    if (rawApiKey.startsWith("sk-") && !rawApiKey.startsWith("AIza")) {
      provider = "openai";
    } else {
      provider = "gemini";
    }
  }

  return {
    provider,
    apiKey: rawApiKey,
    baseUrl,
    model:
      provider === "builtin"
        ? "cbms-deterministic-nl-engine"
        : normalizedModel,
  };
}
