import { load } from 'cheerio';

import { looksLikeOpenApiUrl, normalizeUrl } from '../crawl/url.js';

const PATH_CANDIDATES = [
    '/openapi.json',
    '/openapi.yaml',
    '/openapi.yml',
    '/swagger.json',
    '/swagger.yaml',
    '/swagger.yml',
    '/api-docs',
    '/api-docs.json',
    '/v1/openapi.json',
    '/v2/swagger.json',
    '/v3/api-docs',
    '/swagger/v1/swagger.json',
    '/.well-known/openapi.json',
];

export function specProbeUrls(startUrl: string): string[] {
    const origin = new URL(startUrl).origin;
    const start = new URL(startUrl);
    const basePath = start.pathname.replace(/\/+$/, '');
    const urls = new Set<string>();

    for (const path of PATH_CANDIDATES) {
        const absolute = normalizeUrl(new URL(path, origin).toString());
        if (absolute) urls.add(absolute);
        if (basePath) {
            const nested = normalizeUrl(new URL(`${basePath}${path}`, origin).toString());
            if (nested) urls.add(nested);
        }
    }

    return [...urls];
}

export function discoverSpecUrlsFromHtml(html: string, pageUrl: string): string[] {
    const $ = load(html);
    const found = new Set<string>();

    $('a[href], link[href], script[src]').each((_, el) => {
        const href = $(el).attr('href') || $(el).attr('src') || '';
        const text = `${$(el).text()} ${$(el).attr('title') ?? ''} ${href}`;
        if (!looksLikeOpenApiUrl(href) && !/openapi|swagger/i.test(text)) return;
        const normalized = normalizeUrl(href, pageUrl);
        if (normalized) found.add(normalized);
    });

    const jsonMatch = html.match(/https?:\/\/[^"' \s]+(?:openapi|swagger)[^"' \s]*/gi) ?? [];
    for (const url of jsonMatch) {
        const normalized = normalizeUrl(url);
        if (normalized) found.add(normalized);
    }

    return [...found];
}

export function looksLikeOpenApiDocument(body: string, contentType = ''): boolean {
    const trimmed = body.trim();
    if (!trimmed) return false;

    if (/json|yaml|yml/i.test(contentType) || trimmed.startsWith('{') || /^(openapi|swagger)\s*:/m.test(trimmed)) {
        try {
            const parsed = trimmed.startsWith('{') ? JSON.parse(trimmed) : null;
            if (parsed && (parsed.openapi || parsed.swagger) && (parsed.paths || parsed.webhooks)) return true;
        } catch {
            // YAML handled below
        }
        return /^(openapi|swagger)\s*:/m.test(trimmed) && /\npaths\s*:/m.test(trimmed);
    }

    return false;
}
