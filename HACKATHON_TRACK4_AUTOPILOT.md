# Hackathon Track 4: Jobraker Recruiter Autopilot

Jobraker Recruiter is entering Track 4: Autopilot Agent with a recruiter workflow agent that
screens candidates, recommends pipeline movement, drafts next actions, and keeps final hiring
decisions behind human approval.

## Qwen Cloud Integration

- Frontend autopilot action: `src/components/recruiter/candidates-page.tsx`
- Shared stage parsing helpers: `src/components/recruiter/autopilot.ts`
- Supabase AI route with Qwen fallback priority: `backend/supabase/functions/recruiter-ai/index.ts`
- Alibaba Cloud proof backend: `backend/alibaba-qwen-autopilot/server.mjs`

## Demo Flow

1. Open a candidate in the recruiter workspace.
2. Select `Run Qwen Autopilot`.
3. Jobraker sends the candidate, role, and pipeline context to Qwen Cloud.
4. The app applies Qwen's recommendation as a recruiter-reviewed pipeline update.

## Deployment Proof

The `backend/alibaba-qwen-autopilot` service is container-ready and includes `s.yaml` for Alibaba
Cloud Function Compute deployment. It uses `DASHSCOPE_API_KEY` from the runtime environment and
does not store API secrets in source control.
