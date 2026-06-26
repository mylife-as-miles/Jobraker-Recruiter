import { z } from 'zod';

export const JobrakerRecruiterApiConfig = z.object({
  appUrl: z.string(),
  websocketApiUrl: z.string(),
  supabaseUrl: z.string(),
});
