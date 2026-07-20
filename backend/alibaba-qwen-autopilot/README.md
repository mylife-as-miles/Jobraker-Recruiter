# Jobraker Qwen Autopilot Backend

This backend is the Alibaba Cloud deployment proof for the Jobraker Recruiter hackathon project.
It exposes a recruiter autopilot endpoint that calls Alibaba Cloud Qwen through the DashScope
OpenAI-compatible chat completions API.

## Endpoints

- `GET /health` verifies the deployed service is alive and configured for Qwen.
- `POST /api/autopilot/recruiter` accepts recruiter workflow context and returns a Qwen-generated
  recommendation for candidate stage, score, summary, next action, and human approval.

## Environment

```bash
DASHSCOPE_API_KEY=<your-qwen-cloud-api-key>
DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen3.7-plus
PORT=8080
```

## Local Run

```bash
npm start
curl http://localhost:8080/health
```

## Alibaba Cloud Deploy

This folder includes `s.yaml` for Alibaba Cloud Function Compute through Serverless Devs.
Configure Alibaba Cloud access locally, then deploy from this folder:

```bash
s config add
s deploy -y
```

The deployed code demonstrates direct use of Alibaba Cloud Qwen APIs in
`backend/alibaba-qwen-autopilot/server.mjs`.
