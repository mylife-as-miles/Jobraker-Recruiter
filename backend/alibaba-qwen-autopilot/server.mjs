import http from 'node:http';

const PORT = Number(process.env.PORT ?? 8080);
const QWEN_BASE_URL =
  process.env.DASHSCOPE_BASE_URL ??
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const QWEN_MODEL = process.env.DASHSCOPE_MODEL ?? 'qwen3.7-plus';

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

function buildAutopilotPrompt({ role, candidate, pipeline = [] }) {
  return [
    'You are Jobraker Recruiter Autopilot for a hackathon Track 4 demo.',
    'Analyze the candidate against the role and return strict JSON only.',
    'The JSON fields must be: recommendedStage, matchScore, technicalScore, communicationScore, summary, nextAction, humanApprovalRequired.',
    `Role: ${JSON.stringify(role ?? {})}`,
    `Candidate: ${JSON.stringify(candidate ?? {})}`,
    `Pipeline context: ${JSON.stringify(pipeline)}`,
  ].join('\n\n');
}

async function callQwenAutopilot(input) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY is required for Qwen Cloud requests');
  }

  const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You automate recruiter workflow decisions while keeping final hiring actions human-approved.',
        },
        { role: 'user', content: buildAutopilotPrompt(input) },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Qwen Cloud request failed: ${response.status} ${detail}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      return sendJson(res, 204, {});
    }

    if (req.method === 'GET' && req.url === '/health') {
      return sendJson(res, 200, {
        ok: true,
        provider: 'Alibaba Cloud Qwen',
        model: QWEN_MODEL,
        hasDashscopeKey: Boolean(process.env.DASHSCOPE_API_KEY),
      });
    }

    if (req.method === 'POST' && req.url === '/api/autopilot/recruiter') {
      const input = await readBody(req);
      const result = await callQwenAutopilot(input);
      return sendJson(res, 200, {
        provider: 'Alibaba Cloud Qwen',
        model: QWEN_MODEL,
        result,
      });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Unknown server error',
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Jobraker Qwen Autopilot backend listening on ${PORT}`);
});
