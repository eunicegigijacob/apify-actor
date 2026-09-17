import { describe, expect, it } from 'vitest';

import { parseOpenApiDocument } from '../src/extract/openapi.js';
import { fixture } from './helpers.js';

describe('OpenAPI extraction', () => {
    it('maps info, servers, security, paths, parameters, bodies, responses, and webhooks', () => {
        const intel = parseOpenApiDocument(fixture('openapi-users.json'), 'https://api.example.com/openapi.json');
        expect(intel).not.toBeNull();
        expect(intel?.api.name).toBe('Users API');
        expect(intel?.api.version).toBe('1.2.0');
        expect(intel?.api.baseUrls).toContain('https://api.example.com/v1');
        expect(intel?.authentication.some((item) => item.type === 'bearer')).toBe(true);
        expect(intel?.endpoints).toHaveLength(4);
        expect(intel?.endpoints.map((item) => `${item.method} ${item.path}`).sort()).toEqual([
            'DELETE /users/{id}',
            'GET /users',
            'GET /users/{id}',
            'POST /users',
        ]);
        const create = intel?.endpoints.find((item) => item.method === 'POST');
        expect(create?.requestBody && 'email' in create.requestBody).toBe(true);
        expect(create?.responses?.['201']?.description).toBe('Created');
        expect(intel?.webhooks.some((item) => item.event === 'user.created')).toBe(true);
        expect(intel?.endpoints[0].confidence).toBe(1);
        expect(intel?.crawl.openApiSpecUrl).toContain('openapi.json');
    });

    it('returns null for malformed specifications', () => {
        expect(parseOpenApiDocument('{ not json', 'https://example.com/spec')).toBeNull();
        expect(parseOpenApiDocument('{"title":"no spec"}', 'https://example.com/spec')).toBeNull();
    });
});
