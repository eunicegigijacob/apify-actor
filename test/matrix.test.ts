import { describe, expect, it } from 'vitest';

import { buildIntelligence } from '../src/pipeline.js';
import { defaultInput, fixture, page } from './helpers.js';

const LIVE = process.env.RUN_LIVE_TESTS === '1';

function extract(name: string, url: string) {
    return buildIntelligence([page(name, url)], [], { ...defaultInput, startUrl: url }, {
        pagesVisited: 1,
        usedBrowser: false,
        durationMs: 1,
    });
}

describe('expected-output matrix', () => {
    it('Paystack-like payment API', () => {
        const intel = extract('payments-a.html', 'https://docs.payments.test/api');
        expect(intel.api.name).toMatch(/payment/i);
        expect(intel.api.baseUrls.join(' ')).toMatch(/api\.payments\.test/i);
        expect(intel.authentication.some((item) => item.type === 'bearer')).toBe(true);
        expect(intel.endpoints.some((item) => item.path.includes('transaction'))).toBe(true);
        expect(intel.endpoints.some((item) => item.path.includes('customer'))).toBe(true);
        expect(intel.webhooks.some((item) => item.event.includes('charge'))).toBe(true);
        expect(intel.endpoints.some((item) => item.requestBody && 'amount' in item.requestBody)).toBe(true);
        expect(intel.errors.some((item) => item.status === 400 || item.status === 401)).toBe(true);
    });

    it('Flutterwave-like payment API', () => {
        const intel = extract('payments-b.html', 'https://docs.checkout.test');
        expect(intel.endpoints.some((item) => item.path.includes('/v3/payments'))).toBe(true);
        expect(intel.webhooks.some((item) => item.event === 'charge.completed')).toBe(true);
        expect(intel.errors.length).toBeGreaterThan(0);
        expect(intel.authentication.length).toBeGreaterThan(0);
    });

    it('Stripe-like large API', () => {
        const intel = extract('stripe-like.html', 'https://docs.stripe.test/api');
        expect(intel.endpoints.some((item) => item.path.includes('/v1/charges'))).toBe(true);
        expect(intel.endpoints.some((item) => item.path.includes('customers'))).toBe(true);
        expect(intel.authentication.some((item) => item.type === 'bearer')).toBe(true);
        expect(intel.webhooks.some((item) => item.event === 'charge.succeeded')).toBe(true);
    });

    it('GitHub-like large API', () => {
        const intel = extract('github-like.html', 'https://docs.github.test/rest');
        expect(intel.endpoints.some((item) => item.path.includes('/repos/'))).toBe(true);
        expect(intel.authentication.length).toBeGreaterThan(0);
        expect(intel.rateLimits).not.toBeNull();
    });

    it('OpenAPI structured spec', () => {
        const intel = buildIntelligence([], [{ url: 'https://api.example.com/openapi.json', body: fixture('openapi-users.json') }], defaultInput, {
            pagesVisited: 1,
            usedBrowser: false,
            durationMs: 1,
        });
        expect(intel.endpoints).toHaveLength(4);
        expect(intel.crawl.openApiSpecUrl).toContain('openapi.json');
        expect(intel.api.name).toBe('Users API');
    });

    it('small static API', () => {
        const intel = extract('static-users.html', 'https://docs.example.com/users');
        expect(intel.endpoints.map((item) => `${item.method} ${item.path}`).sort()).toEqual([
            'DELETE /users/{id}',
            'GET /users',
            'GET /users/{id}',
            'POST /users',
        ]);
    });

    it('JS-rendered shell has no invented endpoints', () => {
        const intel = extract('js-shell.html', 'https://docs.spa.test');
        expect(intel.endpoints).toEqual([]);
    });
});

describe.skipIf(!LIVE)('live documentation matrix', () => {
    it('is enabled only when RUN_LIVE_TESTS=1', () => {
        expect(LIVE).toBe(true);
    });
});
