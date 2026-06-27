import { z } from "zod";
import { JobrakerRecruiterApiConfig } from "@x/shared/dist/jobraker-recruiter-account.js";
import { API_URL } from "./env.js";

let cached: z.infer<typeof JobrakerRecruiterApiConfig> | null = null;

export async function getJobrakerRecruiterConfig(): Promise<z.infer<typeof JobrakerRecruiterApiConfig>> {
  if (cached) {
    return cached;
  }
  const response = await fetch(`${API_URL}/v1/config`);
  const data = JobrakerRecruiterApiConfig.parse(await response.json());
  cached = data;
  return data;
}