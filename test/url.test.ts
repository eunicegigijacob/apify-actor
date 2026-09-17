import { describe, expect, it } from 'vitest';

import { isSameDocumentationHost, normalizeUrl, shouldSkipUrl } from '../src/crawl/url.js';

describe('URL normalization', () => {
    it('strips hashes, trailing slashes, and tracking params', () => {
        expect(normalizeUrl('https://docs.example.com/api/?utm_source=x#intro')).toBe('https://docs.example.com/api');
        expect(normalizeUrl('https://docs.example.com/api/?fbclid=1')).toBe('https://docs.example.com/api');
        expect(normalizeUrl('/reference/users', 'https://docs.example.com/api')).toBe(
            'https://docs.example.com/reference/users',
        );
    });

    it('skips logout, binary, and login links', () => {
        expect(shouldSkipUrl('https://example.com/logout')).toBe(true);
        expect(shouldSkipUrl('https://example.com/logo.png')).toBe(true);
        expect(shouldSkipUrl('https://example.com/docs/api')).toBe(false);
        expect(shouldSkipUrl('https://example.com/openapi.json', { allowSpec: true })).toBe(false);
    });

    it('allows docs subdomains of the same registrable domain', () => {
        expect(isSameDocumentationHost('https://docs.pay.example/api', 'https://pay.example/docs')).toBe(true);
        expect(isSameDocumentationHost('https://unrelated.com/api', 'https://pay.example/docs')).toBe(false);
    });
});
