export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type ParameterLocation = 'path' | 'query' | 'header' | 'cookie' | 'body';

export interface ActorInput {
    startUrl: string;
    maxPages?: number;
    includeCodeExamples?: boolean;
    includeWebhooks?: boolean;
    includeErrors?: boolean;
}

export interface ResolvedInput {
    startUrl: string;
    maxPages: number;
    includeCodeExamples: boolean;
    includeWebhooks: boolean;
    includeErrors: boolean;
}

export interface Parameter {
    name: string;
    location: ParameterLocation;
    type?: string;
    required?: boolean;
    description?: string;
    default?: unknown;
    enum?: unknown[];
    sourceUrl?: string;
}

export interface SchemaField {
    type?: string;
    required?: boolean;
    description?: string;
    default?: unknown;
    enum?: unknown[];
    properties?: Record<string, SchemaField>;
    items?: SchemaField;
}

export interface ResponseDoc {
    description?: string;
    schema?: SchemaField | Record<string, unknown>;
    example?: unknown;
}

export interface Endpoint {
    method: HttpMethod;
    path: string;
    name?: string;
    description?: string;
    parameters?: Parameter[];
    requestBody?: Record<string, SchemaField> | SchemaField;
    responses?: Record<string, ResponseDoc>;
    authentication?: { type: string };
    sourceUrl: string;
    confidence?: number;
    apiVersion?: string;
}

export interface Authentication {
    type: string;
    description?: string;
    headers?: string[];
    sourceUrl?: string;
    confidence?: number;
}

export interface Webhook {
    event: string;
    description?: string;
    payload?: unknown;
    method?: string;
    signature?: {
        header?: string;
        method?: string;
        description?: string;
    };
    examplePayload?: unknown;
    sourceUrl: string;
    confidence?: number;
}

export interface ApiError {
    status?: number;
    code?: string;
    message?: string;
    description?: string;
    sourceUrl: string;
    confidence?: number;
}

export interface RateLimit {
    requests?: number;
    window?: string;
    headers?: string[];
    notes?: string;
    sourceUrl: string;
}

export interface Sdk {
    language: string;
    package?: string;
    repository?: string;
    documentationUrl?: string;
    sourceUrl: string;
}

export interface CodeExample {
    language: string;
    code: string;
    sourceUrl: string;
    endpoint?: { method: HttpMethod; path: string };
}

export interface ApiMetadata {
    name: string;
    description: string;
    version: string;
    baseUrls: string[];
    documentationUrl: string;
}

export interface CrawlStats {
    pagesVisited: number;
    pagesProcessed: number;
    durationMs: number;
    sourceUrls: string[];
    openApiSpecUrl?: string | null;
    usedBrowser: boolean;
}

export interface ApiIntelligence {
    api: ApiMetadata;
    authentication: Authentication[];
    endpoints: Endpoint[];
    webhooks: Webhook[];
    errors: ApiError[];
    rateLimits: RateLimit[] | null;
    sdks: Sdk[];
    codeExamples: CodeExample[];
    crawl: CrawlStats;
}

export interface CrawledPage {
    url: string;
    title: string;
    statusCode: number;
    contentType: string;
    html: string;
    text: string;
    discoveredAt: string;
    renderedWithBrowser: boolean;
}
