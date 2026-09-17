import yaml from 'js-yaml';

import type {
    ApiIntelligence,
    Authentication,
    Endpoint,
    HttpMethod,
    Parameter,
    ParameterLocation,
    SchemaField,
    Webhook,
} from '../types.js';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function resolveRef(root: Record<string, unknown>, node: unknown, depth = 0): unknown {
    if (depth > 8) return node;
    const rec = asRecord(node);
    if (!rec) return node;
    const ref = rec.$ref;
    if (typeof ref === 'string' && ref.startsWith('#/')) {
        const parts = ref.slice(2).split('/');
        let current: unknown = root;
        for (const part of parts) {
            current = asRecord(current)?.[part];
        }
        return resolveRef(root, current, depth + 1);
    }
    return rec;
}

function schemaToFields(schema: unknown, root: Record<string, unknown>): SchemaField {
    const resolved = resolveRef(root, schema);
    const rec = asRecord(resolved) ?? {};
    const field: SchemaField = {};
    if (typeof rec.type === 'string') field.type = rec.type;
    if (typeof rec.description === 'string') field.description = rec.description;
    if (rec.default !== undefined) field.default = rec.default;
    if (Array.isArray(rec.enum)) field.enum = rec.enum;

    if (rec.properties && typeof rec.properties === 'object') {
        const required = Array.isArray(rec.required) ? rec.required.map(String) : [];
        field.properties = {};
        for (const [name, prop] of Object.entries(rec.properties as Record<string, unknown>)) {
            field.properties[name] = {
                ...schemaToFields(prop, root),
                required: required.includes(name),
            };
        }
    }

    if (rec.items) field.items = schemaToFields(rec.items, root);
    return field;
}

function mapParameter(param: unknown, root: Record<string, unknown>, sourceUrl: string): Parameter | null {
    const resolved = asRecord(resolveRef(root, param));
    if (!resolved || typeof resolved.name !== 'string') return null;
    const location = String(resolved.in ?? 'query') as ParameterLocation;
    const schema = asRecord(resolved.schema) ?? resolved;
    return {
        name: resolved.name,
        location: ['path', 'query', 'header', 'cookie'].includes(location) ? location : 'query',
        type: typeof schema.type === 'string' ? schema.type : typeof resolved.type === 'string' ? resolved.type : undefined,
        required: Boolean(resolved.required) || location === 'path',
        description: typeof resolved.description === 'string' ? resolved.description : undefined,
        default: schema.default,
        enum: Array.isArray(schema.enum) ? schema.enum : undefined,
        sourceUrl,
    };
}

function mapSecurity(root: Record<string, unknown>, sourceUrl: string): Authentication[] {
    const v3 = asRecord(asRecord(root.components)?.securitySchemes);
    const v2 = asRecord(root.securityDefinitions);
    const schemes = v3 ?? v2 ?? {};
    const result: Authentication[] = [];

    for (const scheme of Object.values(schemes)) {
        const rec = asRecord(scheme);
        if (!rec) continue;
        const typeRaw = String(rec.type ?? rec.scheme ?? 'unknown').toLowerCase();
        const schemeName = String(rec.scheme ?? '').toLowerCase();
        let type = 'unknown';
        if (typeRaw === 'http' && schemeName === 'bearer') type = 'bearer';
        else if (typeRaw === 'http' && schemeName === 'basic') type = 'basic';
        else if (typeRaw === 'apikey' || typeRaw === 'apiKey') type = 'apiKey';
        else if (typeRaw === 'oauth2') type = 'oauth2';
        else if (typeRaw === 'openIdConnect') type = 'oauth2';
        else if (typeRaw === 'basic') type = 'basic';
        else type = typeRaw || 'unknown';

        const headers: string[] = [];
        if (type === 'bearer' || type === 'basic') headers.push('Authorization');
        if (typeof rec.name === 'string' && (rec.in === 'header' || rec.in === undefined)) headers.push(rec.name);

        result.push({
            type,
            description: typeof rec.description === 'string' ? rec.description : undefined,
            headers: headers.length ? [...new Set(headers)] : undefined,
            sourceUrl,
        });
    }

    return result;
}

function mapOperation(
    path: string,
    method: HttpMethod,
    operation: Record<string, unknown>,
    pathItem: Record<string, unknown>,
    root: Record<string, unknown>,
    sourceUrl: string,
): Endpoint {
    const sharedParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
    const opParams = Array.isArray(operation.parameters) ? operation.parameters : [];
    const parameters = [...sharedParams, ...opParams]
        .map((param) => mapParameter(param, root, sourceUrl))
        .filter((param): param is Parameter => Boolean(param));

    const requestBody = asRecord(operation.requestBody);
    let bodyFields: Record<string, SchemaField> | undefined;
    if (requestBody) {
        const content = asRecord(requestBody.content);
        const json = asRecord(content?.['application/json']) ?? asRecord(Object.values(content ?? {})[0]);
        const schema = json?.schema;
        const fields = schemaToFields(schema, root);
        if (fields.properties) bodyFields = fields.properties;
    }

    const responses: Endpoint['responses'] = {};
    const responseMap = asRecord(operation.responses) ?? {};
    for (const [status, value] of Object.entries(responseMap)) {
        const rec = asRecord(resolveRef(root, value)) ?? {};
        const content = asRecord(rec.content);
        const json = asRecord(content?.['application/json']) ?? asRecord(Object.values(content ?? {})[0]);
        responses[status] = {
            description: typeof rec.description === 'string' ? rec.description : undefined,
            schema: json?.schema ? schemaToFields(json.schema, root) : undefined,
            example: json?.example ?? rec.examples,
        };
    }

    return {
        method,
        path,
        name: typeof operation.summary === 'string' ? operation.summary : undefined,
        description: typeof operation.description === 'string' ? operation.description : undefined,
        parameters,
        requestBody: bodyFields,
        responses,
        sourceUrl,
        confidence: 1,
        apiVersion: typeof asRecord(root.info)?.version === 'string' ? String(asRecord(root.info)?.version) : undefined,
    };
}

function mapWebhooks(root: Record<string, unknown>, sourceUrl: string): Webhook[] {
    const webhooks = asRecord(root.webhooks) ?? {};
    const result: Webhook[] = [];
    for (const [name, value] of Object.entries(webhooks)) {
        const item = asRecord(value) ?? {};
        const post = asRecord(item.post) ?? asRecord(item.get) ?? item;
        result.push({
            event: name,
            description: typeof post.description === 'string' ? post.description : undefined,
            method: item.post ? 'POST' : item.get ? 'GET' : undefined,
            sourceUrl,
            confidence: 1,
        });
    }
    return result;
}

function baseUrlsFromSpec(root: Record<string, unknown>): string[] {
    const servers = Array.isArray(root.servers) ? root.servers : [];
    const fromServers = servers
        .map((server) => asRecord(server)?.url)
        .filter((url): url is string => typeof url === 'string');
    if (fromServers.length) return fromServers;

    const host = typeof root.host === 'string' ? root.host : '';
    const basePath = typeof root.basePath === 'string' ? root.basePath : '';
    const schemes = Array.isArray(root.schemes) ? root.schemes.map(String) : ['https'];
    if (!host) return [];
    return schemes.map((scheme) => `${scheme}://${host}${basePath}`);
}

export function parseOpenApiDocument(raw: string, sourceUrl: string): ApiIntelligence | null {
    let root: Record<string, unknown>;
    try {
        const loaded = raw.trim().startsWith('{') ? JSON.parse(raw) : yaml.load(raw);
        const rec = asRecord(loaded);
        if (!rec || !(rec.openapi || rec.swagger)) return null;
        root = rec;
    } catch {
        return null;
    }

    const info = asRecord(root.info) ?? {};
    const paths = asRecord(root.paths) ?? {};
    const endpoints: Endpoint[] = [];

    for (const [path, pathValue] of Object.entries(paths)) {
        const pathItem = asRecord(pathValue);
        if (!pathItem) continue;
        for (const method of METHODS) {
            const operation = asRecord(pathItem[method.toLowerCase()]);
            if (!operation) continue;
            endpoints.push(mapOperation(path, method, operation, pathItem, root, sourceUrl));
        }
    }

    return {
        api: {
            name: typeof info.title === 'string' ? info.title : '',
            description: typeof info.description === 'string' ? info.description : '',
            version: typeof info.version === 'string' ? info.version : '',
            baseUrls: baseUrlsFromSpec(root),
            documentationUrl: sourceUrl,
        },
        authentication: mapSecurity(root, sourceUrl),
        endpoints,
        webhooks: mapWebhooks(root, sourceUrl),
        errors: [],
        rateLimits: null,
        sdks: [],
        codeExamples: [],
        crawl: {
            pagesVisited: 1,
            pagesProcessed: 1,
            durationMs: 0,
            sourceUrls: [sourceUrl],
            openApiSpecUrl: sourceUrl,
            usedBrowser: false,
        },
    };
}
