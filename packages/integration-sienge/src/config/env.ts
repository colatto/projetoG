import { z } from 'zod';

export const siengeConfigSchema = z.object({
  SIENGE_BASE_URL: z.string().url("Sienge Base URL is missing or invalid"),
  SIENGE_API_KEY: z.string().min(1, "Sienge API Key (user) is missing"),
  SIENGE_API_SECRET: z.string().min(1, "Sienge API Secret (password) is missing"),
});

export type SiengeConfig = z.infer<typeof siengeConfigSchema>;
