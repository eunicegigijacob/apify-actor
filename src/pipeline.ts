import { log } from 'apify';

import { parseOpenApiDocument } from './extract/openapi.js';
import { attachDefaultAuth, extractFromPage, mergeIntelligence } from './extract/merge.js';
import type { ApiIntelligence, CrawledPage, ResolvedInput } from './types.js';

export function buildIntelligence(
    pages: CrawledPage[],
    specBodies: Array<{ url: string; body: string }>,
    input: ResolvedInput,
    meta: { pagesVisited: number; usedBrowser: boolean; durationMs: number },
): ApiIntelligence {
    const parts: ApiIntelligence[] = [];

    for (const spec of specBodies) {
        const parsed = parseOpenApiDocument(spec.body, spec.url);
        if (parsed) {
            log.info('Detected OpenAPI specification', { url: spec.url, endpoints: parsed.endpoints.length });
            parts.push(parsed);
        } else {
            log.warning('Failed to parse OpenAPI specification', { url: spec.url });
        }
    }

    for (const page of pages) {
        parts.push(extractFromPage(page, input));
    }

    const seed = parts.length
        ? parts
        : [
              extractFromPage(
                  {
                      url: input.startUrl,
                      title: '',
                      statusCode: 0,
                      contentType: 'text/html',
                      html: '',
                      text: '',
                      discoveredAt: new Date().toISOString(),
                      renderedWithBrowser: false,
                  },
                  input,
              ),
          ];

    const merged = attachDefaultAuth(mergeIntelligence(seed));
    merged.api.documentationUrl = merged.api.documentationUrl || input.startUrl;
    merged.crawl.pagesVisited = meta.pagesVisited;
    merged.crawl.pagesProcessed = pages.length + specBodies.length;
    merged.crawl.durationMs = meta.durationMs;
    merged.crawl.usedBrowser = meta.usedBrowser;
    merged.crawl.sourceUrls = [...new Set([input.startUrl, ...merged.crawl.sourceUrls, ...pages.map((page) => page.url)])];
    if (specBodies[0]) merged.crawl.openApiSpecUrl = specBodies[0].url;
    return merged;
}
