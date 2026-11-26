import 'dotenv/config';
import { z } from 'zod';

export const env = z
  .object({
    PORT: z.coerce.number().default(4000),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173,tauri://localhost,http://tauri.localhost,capacitor://localhost,https://localhost,http://localhost'),
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    STORAGE_BUCKET: z.string().default('studymate-storage'),
    MAX_UPLOAD_MB: z.coerce.number().default(25),
    USER_QUOTA_MB: z.coerce.number().default(500),
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().default('mailto:admin@studymate.app'),
    ENABLE_WORKER: z.enum(['true', 'false']).default('true'),
  })
  .parse(process.env);
