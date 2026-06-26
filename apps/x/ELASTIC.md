# Elastic connector

Jobraker Recruiter can use Elastic as the default retrieval connector for:

- Workspaces
- Knowledge
- Bases
- Graph
- Candidate matching and recruiting evidence

The connector is exposed to the app as the default MCP server named `elastic`. The agent also gets an `elastic-retrieval` tool for semantic search, filtering, observability-style retrieval, and evidence-backed matching.

## Hosted Elastic Agent Builder MCP

Create `~/.jobraker-recruiter/config/elastic.json`:

```json
{
  "enabled": true,
  "kibanaUrl": "https://your-deployment.kb.your-region.elastic-cloud.com",
  "apiKey": "your-elastic-api-key",
  "space": "default",
  "indices": [
    "jobraker-workspaces",
    "jobraker-knowledge",
    "jobraker-bases",
    "jobraker-graph",
    "jobraker-candidates",
    "jobraker-recruiting-*"
  ]
}
```

You can also provide a direct MCP endpoint:

```json
{
  "enabled": true,
  "mcpUrl": "https://your-deployment.kb.your-region.elastic-cloud.com/api/agent_builder/mcp",
  "authHeader": "ApiKey your-elastic-api-key"
}
```

## Local Elasticsearch MCP fallback

If you are using the Docker Elasticsearch MCP server, provide:

```json
{
  "enabled": true,
  "elasticsearchUrl": "https://your-elasticsearch-endpoint:9200",
  "elasticsearchApiKey": "your-elasticsearch-api-key"
}
```

This auto-registers a stdio MCP server using `docker.elastic.co/mcp/elasticsearch`.

## Environment variables

The same settings can be supplied with environment variables:

```bash
ELASTIC_MCP_URL=
ELASTIC_KIBANA_URL=
ELASTIC_API_KEY=
ELASTIC_AUTH_HEADER=
ELASTIC_SPACE=
ELASTICSEARCH_URL=
ELASTICSEARCH_API_KEY=
ELASTIC_MCP_DOCKER_IMAGE=
```

Do not commit real Elastic API keys.
