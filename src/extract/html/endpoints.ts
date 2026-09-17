import { load } from 'cheerio';

import type { Endpoint, HttpMethod, Parameter } from '../../types.js';
import { normalizePath } from '../path.js';

const METHOD_RE = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/;
const INLINE_RE = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[^\s`'<>"']+)/gi;
const PATH_RE = /^\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%{}-]+$/;

function isHttpMethod(value: string): value is HttpMethod {
    return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(value);
}

function nearbyText($: ReturnType<typeof load>, el: unknown, hops = 3): string {
    const parts: string[] = [];
    let current = $(el as Parameters<typeof $>[0]);
    for (let i = 0; i < hops; i++) {
        parts.push(current.text());
        const next = current.next();
        if (next.length) parts.push(next.text());
        current = current.parent();
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function pathParams(path: string, sourceUrl: string): Parameter[] {
    const names = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    return names.map((name) => ({
        name,
        location: 'path' as const,
        type: 'string',
        required: true,
        sourceUrl,
    }));
}

function descriptionNear(text: string, method: string, path: string): string | undefined {
    const idx = text.indexOf(`${method} ${path}`);
    const window = idx >= 0 ? text.slice(Math.max(0, idx), idx + 400) : text.slice(0, 400);
    const sentence = window
        .replace(new RegExp(`${method}\\s+${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '')
        .replace(/\s+/g, ' ')
        .trim();
    if (sentence.length < 12 || sentence.length > 300) return undefined;
    if (METHOD_RE.test(sentence) && /\//.test(sentence)) return undefined;
    return sentence.split(/[.!\n]/)[0]?.trim() || undefined;
}

export function extractEndpointsFromHtml(html: string, sourceUrl: string): Endpoint[] {
    const $ = load(html);
    const found = new Map<string, Endpoint>();

    const add = (methodRaw: string, pathRaw: string, extra?: Partial<Endpoint>, confidence = 0.9) => {
        const method = methodRaw.toUpperCase();
        if (!isHttpMethod(method)) return;
        const path = normalizePath(pathRaw);
        if (!path.startsWith('/')) return;
        if (path.length > 200) return;
        const key = `${method} ${path}`;
        if (found.has(key)) return;
        found.set(key, {
            method,
            path,
            description: extra?.description,
            name: extra?.name,
            parameters: [...(extra?.parameters ?? []), ...pathParams(path, sourceUrl)],
            requestBody: extra?.requestBody,
            responses: extra?.responses,
            sourceUrl,
            confidence,
        });
    };

    const text = $('body').text() || $.root().text();
    for (const match of text.matchAll(INLINE_RE)) {
        add(match[1], match[2], { description: descriptionNear(text, match[1], match[2]) }, 0.92);
    }

    $('code, pre, kbd, span, div, td, th, h1, h2, h3, h4, p, li, button').each((_, el) => {
        const value = $(el).text().trim();
        const methodMatch = value.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i);
        if (methodMatch) {
            const sibling = $(el).next().text().trim() || $(el).parent().find('code, span').eq(1).text().trim();
            const pathCandidate = sibling.split(/\s+/)[0];
            if (pathCandidate && PATH_RE.test(pathCandidate.replace(/[:].*$/, pathCandidate))) {
                add(methodMatch[1], pathCandidate, undefined, 0.85);
            }
            const parentText = nearbyText($, el, 2);
            const inline = INLINE_RE.exec(parentText);
            INLINE_RE.lastIndex = 0;
            if (inline) add(inline[1], inline[2], undefined, 0.8);
        }

        const combined = value.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[^\s]+)$/i);
        if (combined) add(combined[1], combined[2], undefined, 0.95);
    });

    $('table').each((_, table) => {
        const headers = $(table)
            .find('th')
            .map((__, th) => $(th).text().trim().toLowerCase())
            .get();
        const methodIdx = headers.findIndex((h) => /method|verb/.test(h));
        const pathIdx = headers.findIndex((h) => /path|endpoint|url/.test(h));
        const descIdx = headers.findIndex((h) => /desc|summary|name/.test(h));
        if (methodIdx < 0 || pathIdx < 0) return;
        $(table)
            .find('tr')
            .each((__, row) => {
                const cells = $(row)
                    .find('td')
                    .map((___, td) => $(td).text().trim())
                    .get();
                if (!cells[methodIdx] || !cells[pathIdx]) return;
                add(cells[methodIdx], cells[pathIdx], { description: cells[descIdx] }, 0.9);
            });
    });

    return [...found.values()];
}
