import { executeTool, listTools } from "../mcp/mcp.js";
import { getElasticApiKey, getElasticBaseUrl, getElasticConnectorConfig, getElasticIndices } from "./connector.js";

export type ElasticRetrievalTarget = "workspaces" | "knowledge" | "bases" | "graph" | "candidates" | "all";

export interface ElasticEvidence {
    title: string;
    preview: string;
    path?: string;
    score?: number;
    source?: string;
    metadata?: Record<string, unknown>;
}

export interface ElasticRetrievalResult {
    success: boolean;
    provider: "elastic";
    serverName: string;
    toolName?: string;
    target: ElasticRetrievalTarget;
    query: string;
    results: ElasticEvidence[];
    raw?: unknown;
    error?: string;
}

const TARGET_INDEX_HINTS: Record<ElasticRetrievalTarget, string[]> = {
    workspaces: ["jobraker-workspaces"],
    knowledge: ["jobraker-knowledge"],
    bases: ["jobraker-bases"],
    graph: ["jobraker-graph"],
    candidates: ["jobraker-candidates", "jobraker-recruiting-*"],
    all: getElasticIndices(),
};

function configuredServerName(): string {
    return getElasticConnectorConfig().serverName || "elastic";
}

function indicesForTarget(target: ElasticRetrievalTarget): string[] {
    return TARGET_INDEX_HINTS[target] || getElasticIndices();
}

function collectText(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(collectText).filter(Boolean).join("\n");
    }
    if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        if (typeof obj.text === "string") return obj.text;
        if (typeof obj.content === "string") return obj.content;
        if (typeof obj.markdown === "string") return obj.markdown;
        if (typeof obj.preview === "string") return obj.preview;
    }
    return "";
}

function normalizeHit(hit: unknown, index: number): ElasticEvidence {
    if (!hit || typeof hit !== "object") {
        const text = String(hit ?? "");
        return { title: `Elastic result ${index + 1}`, preview: text.slice(0, 240) };
    }

    const obj = hit as Record<string, unknown>;
    const source = (obj._source && typeof obj._source === "object" ? obj._source : obj) as Record<string, unknown>;
    const title = String(source.title || source.name || source.path || obj._id || `Elastic result ${index + 1}`);
    const preview = collectText(source.preview || source.summary || source.content || source.text || source.body || obj.highlight || obj);
    const score = typeof obj._score === "number" ? obj._score : typeof source.score === "number" ? source.score : undefined;

    return {
        title,
        preview: preview.slice(0, 500),
        path: typeof source.path === "string" ? source.path : typeof source.file === "string" ? source.file : undefined,
        score,
        source: typeof obj._index === "string" ? obj._index : undefined,
        metadata: source,
    };
}

function extractHits(raw: unknown): ElasticEvidence[] {
    const candidates: unknown[] = [];
    const visit = (value: unknown) => {
        if (!value || typeof value !== "object") {
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value) visit(item);
            return;
        }

        const obj = value as Record<string, unknown>;
        if (Array.isArray(obj.hits)) {
            candidates.push(...obj.hits);
        }
        if (obj.hits && typeof obj.hits === "object" && Array.isArray((obj.hits as Record<string, unknown>).hits)) {
            candidates.push(...((obj.hits as Record<string, unknown>).hits as unknown[]));
        }
        if (Array.isArray(obj.results)) {
            candidates.push(...obj.results);
        }
        if (Array.isArray(obj.rows)) {
            candidates.push(...obj.rows);
        }
        if (Array.isArray(obj.documents)) {
            candidates.push(...obj.documents);
        }
        if (Array.isArray(obj.content)) {
            for (const part of obj.content) {
                const text = collectText(part);
                if (!text) continue;
                try {
                    visit(JSON.parse(text));
                } catch {
                    candidates.push({ title: "Elastic MCP response", preview: text });
                }
            }
        }
    };

    visit(raw);
    return candidates.map(normalizeHit).filter(hit => hit.preview || hit.title);
}

async function directElasticsearchSearch(
    query: string,
    target: ElasticRetrievalTarget,
    limit: number,
    filters?: Record<string, unknown>,
): Promise<{ results: ElasticEvidence[]; raw: unknown } | null> {
    const baseUrl = getElasticBaseUrl();
    const apiKey = getElasticApiKey();
    if (!baseUrl || !apiKey) {
        return null;
    }

    const indices = indicesForTarget(target);
    const indexPath = indices.map(encodeURIComponent).join(",");
    const filterClauses = Object.entries(filters || {}).map(([field, value]) => ({
        term: { [field]: value },
    }));

    const body = {
        size: limit,
        query: {
            bool: {
                must: [
                    {
                        multi_match: {
                            query,
                            fields: [
                                "name^4",
                                "title^3",
                                "skills^3",
                                "location^2",
                                "summary^2",
                                "content",
                                "text",
                                "body",
                                "note",
                                "highlights",
                                "aiInsight",
                            ],
                            fuzziness: "AUTO",
                        },
                    },
                ],
                ...(filterClauses.length ? { filter: filterClauses } : {}),
            },
        },
        highlight: {
            fields: {
                content: {},
                text: {},
                body: {},
                note: {},
                highlights: {},
                aiInsight: {},
            },
        },
    };

    const response = await fetch(`${baseUrl}/${indexPath}/_search`, {
        method: "POST",
        headers: {
            Authorization: `ApiKey ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = raw && typeof raw === "object" && "error" in raw
            ? JSON.stringify((raw as Record<string, unknown>).error)
            : response.statusText;
        throw new Error(`Elasticsearch _search failed (${response.status}): ${message}`);
    }

    return {
        results: extractHits(raw).slice(0, limit),
        raw,
    };
}

function pickSearchTool(tools: { name: string; description?: string; inputSchema?: unknown }[]): { name: string; inputSchema?: unknown } | null {
    const preferred = tools.find(tool => /index.*search|search.*index|semantic.*search|search/i.test(tool.name));
    if (preferred) {
        return preferred;
    }
    return tools.find(tool => /esql|query/i.test(tool.name)) || null;
}

function buildInput(tool: { inputSchema?: unknown }, query: string, target: ElasticRetrievalTarget, limit: number, filters?: Record<string, unknown>): Record<string, unknown> {
    const indices = indicesForTarget(target);
    const props = tool.inputSchema && typeof tool.inputSchema === "object"
        ? ((tool.inputSchema as Record<string, unknown>).properties as Record<string, unknown> | undefined)
        : undefined;

    if (!props) {
        return { query, indices, index: indices.join(","), limit, size: limit, filters };
    }

    const input: Record<string, unknown> = {};
    if ("query" in props) input.query = query;
    if ("q" in props) input.q = query;
    if ("question" in props) input.question = query;
    if ("search" in props) input.search = query;
    if ("index" in props) input.index = indices.join(",");
    if ("indices" in props) input.indices = indices;
    if ("index_pattern" in props) input.index_pattern = indices.join(",");
    if ("size" in props) input.size = limit;
    if ("limit" in props) input.limit = limit;
    if ("filters" in props && filters) input.filters = filters;
    if ("filter" in props && filters) input.filter = filters;

    return Object.keys(input).length > 0
        ? input
        : { query, indices, index: indices.join(","), limit, size: limit, filters };
}

export async function elasticRetrieve(
    query: string,
    options: {
        target?: ElasticRetrievalTarget;
        limit?: number;
        filters?: Record<string, unknown>;
    } = {},
): Promise<ElasticRetrievalResult> {
    const serverName = configuredServerName();
    const target = options.target || "all";
    const limit = Math.max(1, Math.min(options.limit || 10, 50));

    try {
        const directOnly = !getElasticConnectorConfig().mcpUrl && getElasticBaseUrl() && getElasticApiKey();
        if (directOnly) {
            const direct = await directElasticsearchSearch(query, target, limit, options.filters);
            if (direct) {
                return {
                    success: true,
                    provider: "elastic",
                    serverName,
                    toolName: "elasticsearch._search",
                    target,
                    query,
                    results: direct.results,
                    raw: direct.raw,
                };
            }
        }

        const { tools } = await listTools(serverName);
        const tool = pickSearchTool(tools);
        if (!tool) {
            return {
                success: false,
                provider: "elastic",
                serverName,
                target,
                query,
                results: [],
                error: "Elastic MCP server connected, but no search/query tool was exposed.",
            };
        }

        const raw = await executeTool(serverName, tool.name, buildInput(tool, query, target, limit, options.filters));
        return {
            success: true,
            provider: "elastic",
            serverName,
            toolName: tool.name,
            target,
            query,
            results: extractHits(raw).slice(0, limit),
            raw,
        };
    } catch (error) {
        try {
            const direct = await directElasticsearchSearch(query, target, limit, options.filters);
            if (direct) {
                return {
                    success: true,
                    provider: "elastic",
                    serverName,
                    toolName: "elasticsearch._search",
                    target,
                    query,
                    results: direct.results,
                    raw: direct.raw,
                };
            }
        } catch (fallbackError) {
            return {
                success: false,
                provider: "elastic",
                serverName,
                target,
                query,
                results: [],
                error: fallbackError instanceof Error ? fallbackError.message : "Elastic direct retrieval failed.",
            };
        }

        return {
            success: false,
            provider: "elastic",
            serverName,
            target,
            query,
            results: [],
            error: error instanceof Error ? error.message : "Elastic retrieval failed.",
        };
    }
}
