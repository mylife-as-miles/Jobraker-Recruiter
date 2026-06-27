import fs from "fs";
import path from "path";
import { WorkDir } from "../config/config.js";
import z from "zod";
import { McpServerDefinition } from "@x/shared/dist/mcp.js";

export const ELASTIC_MCP_SERVER_NAME = "elastic";

const CONFIG_PATH = path.join(WorkDir, "config", "elastic.json");

type ElasticConnectorConfig = {
    enabled?: boolean;
    serverName?: string;
    mcpUrl?: string;
    kibanaUrl?: string;
    apiKey?: string;
    authHeader?: string;
    space?: string;
    elasticsearchUrl?: string;
    elasticsearchApiKey?: string;
    dockerImage?: string;
    indices?: string[];
};

type McpServerDefinitionType = z.infer<typeof McpServerDefinition>;

const DEFAULT_INDICES = [
    "jobraker-workspaces",
    "jobraker-knowledge",
    "jobraker-bases",
    "jobraker-graph",
    "jobraker-candidates",
    "jobraker-recruiting-*",
];

function readConfigFile(): ElasticConnectorConfig {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            return {};
        }
        return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as ElasticConnectorConfig;
    } catch (error) {
        console.warn("[elastic] Failed to read config/elastic.json:", error);
        return {};
    }
}

function cleanUrl(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) {
        return undefined;
    }
    return trimmed.replace(/\/+$/, "");
}

export function buildAgentBuilderMcpUrl(kibanaUrl: string, space?: string): string {
    const base = cleanUrl(kibanaUrl)!;
    const spacePath = space?.trim() ? `/s/${encodeURIComponent(space.trim())}` : "";
    return `${base}${spacePath}/api/agent_builder/mcp`;
}

export function getElasticBaseUrl(): string | undefined {
    return cleanUrl(getElasticConnectorConfig().elasticsearchUrl);
}

export function getElasticApiKey(): string | undefined {
    return getElasticConnectorConfig().elasticsearchApiKey?.trim() || getElasticConnectorConfig().apiKey?.trim();
}

export function getElasticConnectorConfig(): ElasticConnectorConfig {
    const fileConfig = readConfigFile();
    return {
        enabled: fileConfig.enabled,
        serverName: fileConfig.serverName || process.env.ELASTIC_MCP_SERVER_NAME || ELASTIC_MCP_SERVER_NAME,
        mcpUrl: fileConfig.mcpUrl || process.env.ELASTIC_MCP_URL,
        kibanaUrl: fileConfig.kibanaUrl || process.env.ELASTIC_KIBANA_URL,
        apiKey: fileConfig.apiKey || process.env.ELASTIC_API_KEY,
        authHeader: fileConfig.authHeader || process.env.ELASTIC_AUTH_HEADER,
        space: fileConfig.space || process.env.ELASTIC_SPACE,
        elasticsearchUrl: fileConfig.elasticsearchUrl || process.env.ELASTICSEARCH_URL || process.env.ES_URL,
        elasticsearchApiKey: fileConfig.elasticsearchApiKey || process.env.ELASTICSEARCH_API_KEY || process.env.ES_API_KEY,
        dockerImage: fileConfig.dockerImage || process.env.ELASTIC_MCP_DOCKER_IMAGE,
        indices: fileConfig.indices?.length ? fileConfig.indices : DEFAULT_INDICES,
    };
}

export function getElasticIndices(): string[] {
    return getElasticConnectorConfig().indices || DEFAULT_INDICES;
}

export function getDefaultElasticMcpServer(): { name: string; config: McpServerDefinitionType } | null {
    const config = getElasticConnectorConfig();
    if (config.enabled === false) {
        return null;
    }

    const mcpUrl = cleanUrl(config.mcpUrl);

    if (mcpUrl) {
        const authHeader = config.authHeader || (config.apiKey ? `ApiKey ${config.apiKey}` : undefined);
        return {
            name: config.serverName || ELASTIC_MCP_SERVER_NAME,
            config: {
                type: "http",
                url: mcpUrl,
                ...(authHeader ? { headers: { Authorization: authHeader } } : {}),
            },
        };
    }

    if (config.elasticsearchUrl && config.elasticsearchApiKey) {
        return {
            name: config.serverName || ELASTIC_MCP_SERVER_NAME,
            config: {
                type: "stdio",
                command: "docker",
                args: [
                    "run",
                    "-i",
                    "--rm",
                    "-e",
                    "ES_URL",
                    "-e",
                    "ES_API_KEY",
                    config.dockerImage || "docker.elastic.co/mcp/elasticsearch",
                    "stdio",
                ],
                env: {
                    ES_URL: config.elasticsearchUrl,
                    ES_API_KEY: config.elasticsearchApiKey,
                },
            },
        };
    }

    return null;
}

export function getDefaultMcpServers(): Record<string, McpServerDefinitionType> {
    const elastic = getDefaultElasticMcpServer();
    return elastic ? { [elastic.name]: elastic.config } : {};
}
