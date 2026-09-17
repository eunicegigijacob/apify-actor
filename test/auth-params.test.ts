import { describe, expect, it } from 'vitest';

import { extractAuthenticationFromHtml } from '../src/extract/html/auth.js';
import { extractParametersFromHtml, extractRequestBodyFromHtml } from '../src/extract/html/parameters.js';
import { fixture } from './helpers.js';

describe('authentication extraction', () => {
    it('detects bearer tokens', () => {
        const auth = extractAuthenticationFromHtml(fixture('static-users.html'), 'https://docs.example.com/auth');
        expect(auth.some((item) => item.type === 'bearer')).toBe(true);
        expect(auth[0].headers).toContain('Authorization');
    });

    it('detects API keys and HMAC without inventing oauth', () => {
        const html = '<p>Sign requests with HMAC. Send your API key in the X-API-Key header.</p>';
        const auth = extractAuthenticationFromHtml(html, 'https://docs.example.com/auth');
        expect(auth.map((item) => item.type).sort()).toEqual(['apiKey', 'hmac']);
        expect(extractAuthenticationFromHtml('<p>Hello world</p>', 'https://docs.example.com')).toEqual([]);
    });
});

describe('parameter extraction', () => {
    it('reads path, query, and request body fields from tables', () => {
        const html = fixture('static-users.html');
        const params = extractParametersFromHtml(html, 'https://docs.example.com');
        expect(params.some((param) => param.name === 'limit' && param.location === 'query')).toBe(true);
        const body = extractRequestBodyFromHtml(html, 'https://docs.example.com');
        expect(body?.email?.type).toBe('string');
        expect(body?.email?.required).toBe(true);
    });
});
