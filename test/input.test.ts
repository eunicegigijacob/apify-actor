import { describe, expect, it } from 'vitest';

import { resolveInput, InvalidInputError } from '../src/input.js';
import { looksLikeOpenApiDocument } from '../src/extract/openapi-discovery.js';
import { fixture } from './helpers.js';

describe('input validation', () => {
    it('requires a valid http(s) URL', () => {
        expect(() => resolveInput({ startUrl: '' })).toThrow(InvalidInputError);
        expect(() => resolveInput({ startUrl: 'ftp://example.com' })).toThrow(InvalidInputError);
        expect(resolveInput({ startUrl: 'https://paystack.com/docs/api/' }).maxPages).toBe(100);
        expect(resolveInput({ startUrl: 'https://example.com', includeWebhooks: false }).includeWebhooks).toBe(false);
    });
});

describe('OpenAPI detection', () => {
    it('recognizes JSON specs and rejects HTML', () => {
        expect(looksLikeOpenApiDocument(fixture('openapi-users.json'), 'application/json')).toBe(true);
        expect(looksLikeOpenApiDocument(fixture('static-users.html'), 'text/html')).toBe(false);
    });
});
