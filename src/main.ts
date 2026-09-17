import { Actor, log } from 'apify';

import { crawlDocumentation } from './crawl/crawler.js';
import { InvalidInputError, resolveInput } from './input.js';
import { buildIntelligence } from './pipeline.js';
import type { ActorInput } from './types.js';

await Actor.init();

Actor.on('aborting', async () => {
    await new Promise((resolve) => {
        setTimeout(resolve, 1000);
    });
    await Actor.exit();
});

try {
    log.info('Starting API Documentation Extractor');
    const input = resolveInput((await Actor.getInput<ActorInput>()) ?? undefined);
    const started = Date.now();
    const crawl = await crawlDocumentation(input.startUrl, input.maxPages);
    const intelligence = buildIntelligence(crawl.pages, crawl.specBodies, input, {
        pagesVisited: crawl.pagesVisited,
        usedBrowser: crawl.usedBrowser,
        durationMs: Date.now() - started,
    });

    log.info('Extraction complete', {
        endpoints: intelligence.endpoints.length,
        webhooks: intelligence.webhooks.length,
        authentication: intelligence.authentication.map((item) => item.type),
        openApi: intelligence.crawl.openApiSpecUrl,
        usedBrowser: intelligence.crawl.usedBrowser,
    });

    await Actor.pushData(intelligence);
    await Actor.setValue('OUTPUT', intelligence);
} catch (error) {
    if (error instanceof InvalidInputError) {
        log.error(error.message);
        await Actor.exit({ exitCode: 1, statusMessage: error.message });
    }
    throw error;
}

await Actor.exit();
