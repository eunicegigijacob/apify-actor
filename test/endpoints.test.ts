import { describe, expect, it } from 'vitest';

import { extractEndpointsFromHtml } from '../src/extract/html/endpoints.js';
import { normalizePath } from '../src/extract/path.js';
import { fixture } from './helpers.js';

describe('endpoint extraction', () => {
    it('normalizes :id and trailing slashes', () => {
        expect(normalizePath('/users/:id/')).toBe('/users/{id}');
        expect(normalizePath('/users/{id}')).toBe('/users/{id}');
    });

    it('extracts GET POST GET-id DELETE shapes from static HTML', () => {
        const endpoints = extractEndpointsFromHtml(fixture('static-users.html'), 'https://docs.example.com/users');
        const keys = endpoints.map((item) => `${item.method} ${item.path}`).sort();
        expect(keys).toEqual(['DELETE /users/{id}', 'GET /users', 'GET /users/{id}', 'POST /users']);
        expect(endpoints.every((item) => item.sourceUrl.includes('docs.example.com'))).toBe(true);
        const getById = endpoints.find((item) => item.method === 'GET' && item.path === '/users/{id}');
        expect(getById?.parameters?.some((param) => param.name === 'id' && param.location === 'path')).toBe(true);
    });

    it('does not invent endpoints from malformed documentation', () => {
        const endpoints = extractEndpointsFromHtml(fixture('malformed.html'), 'https://docs.example.com/bad');
        expect(endpoints).toEqual([]);
    });
});
