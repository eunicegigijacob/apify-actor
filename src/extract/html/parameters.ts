import { load } from 'cheerio';

import type { Parameter, ParameterLocation, SchemaField } from '../../types.js';

function locationFromLabel(label: string): ParameterLocation | null {
    if (/path/i.test(label)) return 'path';
    if (/query/i.test(label)) return 'query';
    if (/header/i.test(label)) return 'header';
    if (/cookie/i.test(label)) return 'cookie';
    if (/body/i.test(label)) return 'body';
    return null;
}

export function extractParametersFromHtml(html: string, sourceUrl: string): Parameter[] {
    const $ = load(html);
    const params: Parameter[] = [];

    $('table').each((_, table) => {
        const headers = $(table)
            .find('th')
            .map((__, th) => $(th).text().trim().toLowerCase())
            .get();
        if (!headers.length) return;
        const nameIdx = headers.findIndex((h) => /name|parameter|field/.test(h));
        const locIdx = headers.findIndex((h) => /in|location|placed/.test(h));
        const typeIdx = headers.findIndex((h) => /type/.test(h));
        const reqIdx = headers.findIndex((h) => /required|mandatory/.test(h));
        const descIdx = headers.findIndex((h) => /desc/.test(h));
        if (nameIdx < 0) return;

        $(table)
            .find('tr')
            .each((__, row) => {
                const cells = $(row)
                    .find('td')
                    .map((___, td) => $(td).text().trim())
                    .get();
                if (!cells[nameIdx]) return;
                const location = locIdx >= 0 ? locationFromLabel(cells[locIdx]) : 'query';
                if (!location) return;
                const requiredText = reqIdx >= 0 ? cells[reqIdx] : '';
                params.push({
                    name: cells[nameIdx].replace(/[*]+$/, '').trim(),
                    location,
                    type: typeIdx >= 0 ? cells[typeIdx].toLowerCase() : undefined,
                    required: /yes|true|required/i.test(requiredText) || cells[nameIdx].includes('*'),
                    description: descIdx >= 0 ? cells[descIdx] : undefined,
                    sourceUrl,
                });
            });
    });

    return params;
}

export function extractRequestBodyFromHtml(html: string, sourceUrl: string): Record<string, SchemaField> | undefined {
    const $ = load(html);
    const fields: Record<string, SchemaField> = {};

    $('table').each((_, table) => {
        const headers = $(table)
            .find('th')
            .map((__, th) => $(th).text().trim().toLowerCase())
            .get();
        const nameIdx = headers.findIndex((h) => /name|field|property/.test(h));
        const typeIdx = headers.findIndex((h) => /type/.test(h));
        const reqIdx = headers.findIndex((h) => /required/.test(h));
        const descIdx = headers.findIndex((h) => /desc/.test(h));
        const caption = `${$(table).find('caption').text()} ${$(table).prev().text()}`.toLowerCase();
        if (nameIdx < 0) return;
        if (!/body|payload|request|attribute|parameter/.test(caption + headers.join(' '))) return;

        $(table)
            .find('tr')
            .each((__, row) => {
                const cells = $(row)
                    .find('td')
                    .map((___, td) => $(td).text().trim())
                    .get();
                if (!cells[nameIdx]) return;
                const name = cells[nameIdx].replace(/[*]+$/, '').trim();
                fields[name] = {
                    type: typeIdx >= 0 ? cells[typeIdx].toLowerCase() : undefined,
                    required: reqIdx >= 0 ? /yes|true|required/i.test(cells[reqIdx]) : cells[nameIdx].includes('*'),
                    description: descIdx >= 0 ? cells[descIdx] : undefined,
                };
            });
    });

    const jsonBlocks = html.match(/\{[^{}]{0,2000}\}/g) ?? [];
    for (const block of jsonBlocks.slice(0, 3)) {
        try {
            const parsed = JSON.parse(block) as Record<string, unknown>;
            if (Array.isArray(parsed) || typeof parsed !== 'object') continue;
            for (const [key, value] of Object.entries(parsed)) {
                if (fields[key]) continue;
                fields[key] = {
                    type: Array.isArray(value) ? 'array' : typeof value,
                    required: true,
                };
            }
        } catch {
            // not JSON
        }
    }

    void sourceUrl;
    return Object.keys(fields).length ? fields : undefined;
}

export function extractResponsesFromHtml(html: string, sourceUrl: string): Record<string, { description?: string }> {
    const responses: Record<string, { description?: string }> = {};
    const matches = html.matchAll(/\b(20\d|4\d\d|5\d\d)\b[^\n]{0,120}/g);
    for (const match of matches) {
        const status = match[1];
        if (responses[status]) continue;
        const description = match[0]
            .replace(status, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 180);
        if (!/success|ok|error|invalid|created|unauthorized|forbidden|not found|too many/i.test(description) && !/^[:\s-]+$/.test(description)) {
            if (description.length < 8) continue;
        }
        responses[status] = { description: description || undefined };
    }
    void sourceUrl;
    return responses;
}
