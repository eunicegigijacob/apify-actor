import { describe, expect, it } from 'vitest';

import { endpointKey } from '../src/extract/path.js';
import { buildIntelligence } from '../src/pipeline.js';
import { defaultInput, fixture, page } from './helpers.js';

describe('pipeline merge and expected outputs', () => {
    it('prefers OpenAPI over HTML and deduplicates endpoints', () => {
        const intel = buildIntelligence(
            [page('static-users.html')],
            [{ url: 'https://api.example.com/openapi.json', body: fixture('openapi-users.json') }],
            defaultInput,
            { pagesVisited: 2, usedBrowser: false, durationMs: 10 },
        );
        expect(intel.endpoints).toHaveLength(4);
        expect(new Set(intel.endpoints.map((item) => endpointKey(item.method, item.path))).size).toBe(4);
        expect(intel.crawl.openApiSpecUrl).toContain('openapi.json');
        expect(intel.authentication.some((item) => item.type === 'bearer')).toBe(true);
        expect(intel.endpoints[0].authentication?.type).toBe('bearer');
    });

    it('extracts a useful payments A profile', () => {
        const intel = buildIntelligence([page('payments-a.html', 'https://docs.payments.test/api')], [], defaultInput, {
            pagesVisited: 1,
            usedBrowser: false,
            durationMs: 5,
        });
        expect(intel.api.name.toLowerCase()).toContain('payment');
        expect(intel.authentication.some((item) => item.type === 'bearer')).toBe(true);
        expect(intel.endpoints.some((item) => item.method === 'POST' && item.path.includes('transaction'))).toBe(true);
        expect(intel.endpoints.some((item) => item.path.includes('customer'))).toBe(true);
        expect(intel.webhooks.some((item) => item.event === 'charge.success')).toBe(true);
        expect(intel.errors.some((item) => item.status === 400)).toBe(true);
        const init = intel.endpoints.find((item) => item.path.includes('initialize'));
        expect(init?.requestBody && 'amount' in init.requestBody).toBe(true);
        expect(init?.requestBody && 'email' in init.requestBody).toBe(true);
        expect(intel.rateLimits).not.toBeNull();
    });

    it('extracts a differently structured payments B profile without provider-specific selectors', () => {
        const intel = buildIntelligence([page('payments-b.html', 'https://docs.checkout.test')], [], defaultInput, {
            pagesVisited: 1,
            usedBrowser: false,
            durationMs: 5,
        });
        expect(intel.endpoints.some((item) => item.path.includes('/v3/payments'))).toBe(true);
        expect(intel.webhooks.some((item) => item.event === 'charge.completed')).toBe(true);
        expect(intel.errors.length).toBeGreaterThan(0);
        expect(intel.authentication.length).toBeGreaterThan(0);
    });
});
