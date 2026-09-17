import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { describe, expect, it } from 'vitest';

import { crawlDocumentation } from '../src/crawl/crawler.js';
import { buildIntelligence } from '../src/pipeline.js';
import { defaultInput, fixture } from './helpers.js';

async function withServer(handler: (url: string) => Promise<void>) {
    const spec = fixture('openapi-users.json');
    const docs = `<html><body><h1>Docs</h1><a href="/openapi.json">OpenAPI</a><p>See the specification.</p></body></html>`;
    const server = createServer((req, res) => {
        if (req.url === '/openapi.json') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(spec);
            return;
        }
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(docs);
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    try {
        await handler(`http://127.0.0.1:${port}/docs`);
    } finally {
        await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
}

describe('local crawl integration', () => {
    it('discovers an OpenAPI spec from documentation and extracts endpoints from it', async () => {
        await withServer(async (startUrl) => {
            const crawl = await crawlDocumentation(startUrl, 10);
            expect(crawl.specBodies.length).toBeGreaterThan(0);
            const intel = buildIntelligence(crawl.pages, crawl.specBodies, { ...defaultInput, startUrl }, {
                pagesVisited: crawl.pagesVisited,
                usedBrowser: crawl.usedBrowser,
                durationMs: 1,
            });
            expect(intel.endpoints.some((item) => item.method === 'POST' && item.path === '/users')).toBe(true);
            expect(intel.crawl.openApiSpecUrl).toMatch(/openapi\.json/);
            expect(intel.crawl.usedBrowser).toBe(false);
        });
    });
});
