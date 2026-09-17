import { load } from 'cheerio';

import type { Authentication } from '../../types.js';

interface Pattern {
    type: string;
    test: RegExp;
    headers?: string[];
}

const PATTERNS: Pattern[] = [
    { type: 'bearer', test: /\bbearer\b|\bauthorization:\s*bearer\b/i, headers: ['Authorization'] },
    { type: 'apiKey', test: /\bapi[\s_-]?key\b|\bx-api-key\b/i, headers: ['X-API-Key'] },
    { type: 'basic', test: /\bbasic authentication\b|\bauthorization:\s*basic\b/i, headers: ['Authorization'] },
    { type: 'oauth2', test: /\boauth\s*2(?:\.0)?\b/i },
    { type: 'oauth', test: /\boauth\b/i },
    { type: 'jwt', test: /\bjson web token\b|\bjwt\b/i, headers: ['Authorization'] },
    { type: 'hmac', test: /\bhmac\b/i },
];

export function extractAuthenticationFromHtml(html: string, sourceUrl: string): Authentication[] {
    const $ = load(html);
    const text = $('body').text() || $.root().text();
    const haystack = `${text}\n${html}`;

    if (!/\b(auth|token|credential|secret|api[\s_-]?key|oauth|bearer|hmac|jwt)\b/i.test(haystack)) {
        return [];
    }

    const found: Authentication[] = [];
    const seen = new Set<string>();

    for (const pattern of PATTERNS) {
        if (!pattern.test.test(haystack)) continue;
        if (pattern.type === 'oauth' && seen.has('oauth2')) continue;
        if (seen.has(pattern.type)) continue;
        seen.add(pattern.type);

        const customHeader = haystack.match(/\b(X-[A-Za-z0-9-]*(?:Key|Token|Auth|Secret))\b/);
        const headers = [...(pattern.headers ?? [])];
        if (pattern.type === 'apiKey' && customHeader) headers.push(customHeader[1]);

        const snippet = haystack.replace(/\s+/g, ' ').slice(0, 500);
        found.push({
            type: pattern.type,
            description: snippet.length > 40 ? undefined : undefined,
            headers: headers.length ? [...new Set(headers)] : undefined,
            sourceUrl,
            confidence: 0.75,
        });
    }

    const headerOnly = haystack.match(/custom headers?[:\s]+[`'"]?([A-Za-z][A-Za-z0-9-]+)/i);
    if (headerOnly && !found.length) {
        found.push({
            type: 'apiKey',
            headers: [headerOnly[1]],
            sourceUrl,
            confidence: 0.6,
        });
    }

    return found;
}
