import type {
    ApiIntelligence,
    Authentication,
    CrawledPage,
    Endpoint,
    ResolvedInput,
} from '../types.js';
import { extractAuthenticationFromHtml } from './html/auth.js';
import { extractEndpointsFromHtml } from './html/endpoints.js';
import { extractErrorsFromHtml } from './html/errors.js';
import { extractMetadataFromHtml, extractCodeExamplesFromHtml, extractRateLimitsFromHtml, extractSdksFromHtml } from './html/extras.js';
import { extractParametersFromHtml, extractRequestBodyFromHtml, extractResponsesFromHtml } from './html/parameters.js';
import { extractWebhooksFromHtml } from './html/webhooks.js';
import { compatibleEndpointKey } from './path.js';

export function emptyIntelligence(documentationUrl: string): ApiIntelligence {
    return {
        api: {
            name: '',
            description: '',
            version: '',
            baseUrls: [],
            documentationUrl,
        },
        authentication: [],
        endpoints: [],
        webhooks: [],
        errors: [],
        rateLimits: null,
        sdks: [],
        codeExamples: [],
        crawl: {
            pagesVisited: 0,
            pagesProcessed: 0,
            durationMs: 0,
            sourceUrls: [],
            openApiSpecUrl: null,
            usedBrowser: false,
        },
    };
}

export function extractFromPage(page: CrawledPage, input: ResolvedInput): ApiIntelligence {
    const endpoints = extractEndpointsFromHtml(page.html, page.url);
    const pageParams = extractParametersFromHtml(page.html, page.url);
    const body = extractRequestBodyFromHtml(page.html, page.url);
    const responses = extractResponsesFromHtml(page.html, page.url);

    const enriched = endpoints.map((endpoint) => {
        const extraParams = pageParams.filter((param) => param.location !== 'path' || !endpoint.path.includes(`{${param.name}}`));
        return {
            ...endpoint,
            parameters: dedupeParams([...(endpoint.parameters ?? []), ...extraParams]),
            requestBody: endpoint.requestBody ?? body,
            responses: Object.keys(endpoint.responses ?? {}).length ? endpoint.responses : responses,
        };
    });

    const meta = extractMetadataFromHtml(page.html, page.url);

    return {
        api: {
            name: meta.name ?? '',
            description: meta.description ?? '',
            version: meta.version ?? '',
            baseUrls: meta.baseUrls ?? [],
            documentationUrl: page.url,
        },
        authentication: extractAuthenticationFromHtml(page.html, page.url),
        endpoints: enriched,
        webhooks: input.includeWebhooks ? extractWebhooksFromHtml(page.html, page.url) : [],
        errors: input.includeErrors ? extractErrorsFromHtml(page.html, page.url) : [],
        rateLimits: extractRateLimitsFromHtml(page.html, page.url),
        sdks: extractSdksFromHtml(page.html, page.url),
        codeExamples: input.includeCodeExamples ? extractCodeExamplesFromHtml(page.html, page.url) : [],
        crawl: {
            pagesVisited: 1,
            pagesProcessed: 1,
            durationMs: 0,
            sourceUrls: [page.url],
            usedBrowser: page.renderedWithBrowser,
        },
    };
}

function dedupeParams(params: Endpoint['parameters'] = []): Endpoint['parameters'] {
    const map = new Map<string, NonNullable<Endpoint['parameters']>[number]>();
    for (const param of params) {
        map.set(`${param.location}:${param.name}`, param);
    }
    return [...map.values()];
}

function preferString(a: string, b: string): string {
    return a?.trim() ? a : b;
}

function mergeAuth(target: Authentication[], extra: Authentication[]): Authentication[] {
    const map = new Map(target.map((item) => [item.type, item]));
    for (const item of extra) {
        if (!map.has(item.type)) map.set(item.type, item);
    }
    return [...map.values()];
}

export function mergeIntelligence(parts: ApiIntelligence[]): ApiIntelligence {
    const merged = emptyIntelligence(parts[0]?.api.documentationUrl ?? '');
    const endpoints = new Map<string, Endpoint>();

    for (const part of parts) {
        merged.api.name = preferString(merged.api.name, part.api.name);
        merged.api.description = preferString(merged.api.description, part.api.description);
        merged.api.version = preferString(merged.api.version, part.api.version);
        merged.api.documentationUrl = preferString(merged.api.documentationUrl, part.api.documentationUrl);
        merged.api.baseUrls = [...new Set([...merged.api.baseUrls, ...part.api.baseUrls])];
        merged.authentication = mergeAuth(merged.authentication, part.authentication);
        merged.webhooks.push(...part.webhooks);
        merged.errors.push(...part.errors);
        merged.sdks.push(...part.sdks);
        merged.codeExamples.push(...part.codeExamples);
        if (part.rateLimits?.length) {
            merged.rateLimits = [...(merged.rateLimits ?? []), ...part.rateLimits];
        }
        merged.crawl.pagesVisited += part.crawl.pagesVisited;
        merged.crawl.pagesProcessed += part.crawl.pagesProcessed;
        merged.crawl.sourceUrls.push(...part.crawl.sourceUrls);
        merged.crawl.usedBrowser = merged.crawl.usedBrowser || part.crawl.usedBrowser;
        if (part.crawl.openApiSpecUrl) merged.crawl.openApiSpecUrl = part.crawl.openApiSpecUrl;

        for (const endpoint of part.endpoints) {
            const candidates = compatibleEndpointKey(endpoint.method, endpoint.path, endpoint.apiVersion);
            const existingKey = candidates.find((key) => endpoints.has(key)) ?? [...endpoints.keys()].find((key) => candidates.some((candidate) => key === candidate || key.startsWith(`${candidate} `)));
            const key = existingKey ?? candidates[0];
            const existing = endpoints.get(key);
            if (!existing) {
                endpoints.set(key, endpoint);
                continue;
            }
            const preferIncoming = (endpoint.confidence ?? 0) >= (existing.confidence ?? 0);
            const primary = preferIncoming ? endpoint : existing;
            const secondary = preferIncoming ? existing : endpoint;
            endpoints.delete(key);
            endpoints.set(candidates[0], {
                ...primary,
                name: preferString(primary.name ?? '', secondary.name ?? '') || primary.name,
                description: preferString(primary.description ?? '', secondary.description ?? '') || primary.description,
                parameters: dedupeParams([...(primary.parameters ?? []), ...(secondary.parameters ?? [])]),
                requestBody: primary.requestBody ?? secondary.requestBody,
                responses: { ...secondary.responses, ...primary.responses },
                confidence: Math.max(existing.confidence ?? 0, endpoint.confidence ?? 0),
                apiVersion: primary.apiVersion || secondary.apiVersion,
            });
        }
    }

    const webhookMap = new Map(merged.webhooks.map((item) => [item.event, item]));
    const errorMap = new Map(merged.errors.map((item) => [`${item.status}|${item.code}|${item.message}`, item]));
    const sdkMap = new Map(merged.sdks.map((item) => [`${item.language}|${item.package}`, item]));

    merged.endpoints = [...endpoints.values()];
    merged.webhooks = [...webhookMap.values()];
    merged.errors = [...errorMap.values()];
    merged.sdks = [...sdkMap.values()];
    merged.crawl.sourceUrls = [...new Set(merged.crawl.sourceUrls)];
    if (!merged.rateLimits?.length) merged.rateLimits = null;

    return merged;
}

export function attachDefaultAuth(intelligence: ApiIntelligence): ApiIntelligence {
    const primary = intelligence.authentication[0];
    if (!primary) return intelligence;
    return {
        ...intelligence,
        endpoints: intelligence.endpoints.map((endpoint) => ({
            ...endpoint,
            authentication: endpoint.authentication ?? { type: primary.type },
        })),
    };
}
