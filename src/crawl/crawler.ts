import { CheerioCrawler } from '@crawlee/cheerio';
import { log } from 'apify';
import { load } from 'cheerio';

import { hasUsefulApiContent, isLikelyJsRendered } from './js-rendered.js';
import { isRelevantDocumentationLink } from './relevance.js';
import { isSameDocumentationHost, looksLikeOpenApiUrl, normalizeUrl, shouldSkipUrl } from './url.js';
import type { CrawledPage } from '../types.js';
import { discoverSpecUrlsFromHtml, looksLikeOpenApiDocument, specProbeUrls } from '../extract/openapi-discovery.js';

const MAX_HTML_CHARS = 500_000;

export interface CrawlResult {
    pages: CrawledPage[];
    specCandidates: string[];
    specBodies: Array<{ url: string; body: string }>;
    usedBrowser: boolean;
    pagesVisited: number;
}

function toPage(url: string, html: string, statusCode: number, contentType: string, renderedWithBrowser: boolean): CrawledPage {
    const $ = load(html);
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    return {
        url,
        title: $('title').first().text().trim(),
        statusCode,
        contentType,
        html: html.slice(0, MAX_HTML_CHARS),
        text: text.slice(0, MAX_HTML_CHARS),
        discoveredAt: new Date().toISOString(),
        renderedWithBrowser,
    };
}

function collectLinks(html: string, pageUrl: string, startUrl: string): string[] {
    const $ = load(html);
    const links: string[] = [];
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        const normalized = normalizeUrl(href, pageUrl);
        if (!normalized) return;
        if (shouldSkipUrl(normalized, { allowSpec: looksLikeOpenApiUrl(normalized) })) return;
        const allowExternalSpec = looksLikeOpenApiUrl(normalized);
        if (!allowExternalSpec && !isSameDocumentationHost(normalized, startUrl)) return;
        const text = $(el).text();
        if (!allowExternalSpec && !isRelevantDocumentationLink(normalized, text, startUrl)) return;
        links.push(normalized);
    });
    return links;
}

async function maybePlaywrightFetch(url: string): Promise<string | null> {
    try {
        const { chromium } = await import('playwright');
        const browser = await chromium.launch({
            args: ['--disable-gpu'],
            headless: true,
        });
        try {
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
            return await page.content();
        } finally {
            await browser.close();
        }
    } catch (error) {
        log.warning('Playwright fallback unavailable', { url, error: String(error) });
        return null;
    }
}

export async function crawlDocumentation(startUrl: string, maxPages: number): Promise<CrawlResult> {
    const pages: CrawledPage[] = [];
    const specCandidates = new Set<string>(specProbeUrls(startUrl));
    const specBodies: Array<{ url: string; body: string }> = [];
    let usedBrowser = false;
    let pagesVisited = 0;

    const crawler = new CheerioCrawler({
        maxRequestsPerCrawl: maxPages,
        maxConcurrency: 12,
        ignoreSslErrors: true,
        additionalMimeTypes: ['application/json', 'application/yaml', 'text/yaml', 'application/x-yaml'],
        async failedRequestHandler({ request }, error) {
            log.warning('Failed to parse page', { url: request.url, error: String(error) });
        },
        async requestHandler(context) {
            const { request, body, contentType, enqueueLinks, response } = context;
            pagesVisited += 1;
            const raw = typeof body === 'string' ? body : Buffer.isBuffer(body) ? body.toString('utf8') : String(body ?? '');
            const type = contentType?.type ?? response?.headers['content-type'] ?? '';
            const loadedUrl = normalizeUrl(request.loadedUrl ?? request.url) ?? request.url;

            log.info('Processing documentation page', { url: loadedUrl });

            if (looksLikeOpenApiDocument(raw, type) || looksLikeOpenApiUrl(loadedUrl)) {
                if (looksLikeOpenApiDocument(raw, type)) {
                    log.info('Detected OpenAPI specification', { url: loadedUrl });
                    specBodies.push({ url: loadedUrl, body: raw });
                    specCandidates.add(loadedUrl);
                    return;
                }
            }

            let html = raw;
            let renderedWithBrowser = false;
            if (isLikelyJsRendered(html) && !hasUsefulApiContent(html)) {
                log.info('HTML missing useful documentation; retrying with browser', { url: loadedUrl });
                const rendered = await maybePlaywrightFetch(loadedUrl);
                if (rendered) {
                    html = rendered;
                    renderedWithBrowser = true;
                    usedBrowser = true;
                }
            }

            pages.push(toPage(loadedUrl, html, response?.statusCode ?? 200, type, renderedWithBrowser));

            for (const specUrl of discoverSpecUrlsFromHtml(html, loadedUrl)) {
                specCandidates.add(specUrl);
            }

            const allowed = collectLinks(html, loadedUrl, startUrl);
            if (!allowed.length) return;
            await enqueueLinks({ urls: allowed });
        },
    });

    log.info('Starting API Documentation Extractor');
    await crawler.run([startUrl]);

    for (const specUrl of specCandidates) {
        if (specBodies.some((item) => item.url === specUrl)) continue;
        try {
            const response = await fetch(specUrl, { redirect: 'follow' });
            if (!response.ok) continue;
            const body = await response.text();
            if (looksLikeOpenApiDocument(body, response.headers.get('content-type') ?? '')) {
                log.info('Detected OpenAPI specification', { url: specUrl });
                specBodies.push({ url: specUrl, body });
            }
        } catch {
            log.debug('OpenAPI probe failed', { url: specUrl });
        }
    }

    return {
        pages,
        specCandidates: [...specCandidates],
        specBodies,
        usedBrowser,
        pagesVisited,
    };
}
