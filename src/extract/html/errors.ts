import { load } from 'cheerio';

import type { ApiError } from '../../types.js';

export function extractErrorsFromHtml(html: string, sourceUrl: string): ApiError[] {
    const $ = load(html);
    const errors: ApiError[] = [];
    const seen = new Set<string>();

    $('table').each((_, table) => {
        const headers = $(table)
            .find('th')
            .map((__, th) => $(th).text().trim().toLowerCase())
            .get();
        const statusIdx = headers.findIndex((h) => /status|http|code/.test(h) && !/error code/.test(h));
        const codeIdx = headers.findIndex((h) => /error code|code|name/.test(h));
        const msgIdx = headers.findIndex((h) => /message|desc|reason/.test(h));
        if (statusIdx < 0 && codeIdx < 0) return;
        const context = `${$(table).prev().text()} ${headers.join(' ')}`.toLowerCase();
        if (!/error|status/.test(context) && !headers.some((h) => /error/.test(h))) return;

        $(table)
            .find('tr')
            .each((__, row) => {
                const cells = $(row)
                    .find('td')
                    .map((___, td) => $(td).text().trim())
                    .get();
                const statusRaw = statusIdx >= 0 ? cells[statusIdx] : '';
                const status = Number.parseInt(statusRaw, 10);
                const code = codeIdx >= 0 ? cells[codeIdx] : undefined;
                const message = msgIdx >= 0 ? cells[msgIdx] : undefined;
                const key = `${status}|${code}|${message}`;
                if (seen.has(key)) return;
                if (!status && !code) return;
                seen.add(key);
                errors.push({
                    status: Number.isFinite(status) ? status : undefined,
                    code,
                    message,
                    sourceUrl,
                    confidence: 0.8,
                });
            });
    });

    const text = $('body').text() || $.root().text();
    const inline = text.matchAll(/\b(4\d\d|5\d\d)\b[:\s-]+([a-z0-9_.-]+)?[:\s-]*([^\n.]{4,120})/gi);
    for (const match of inline) {
        const status = Number(match[1]);
        const code = match[2];
        const message = match[3]?.trim();
        const key = `${status}|${code}|${message}`;
        if (seen.has(key)) continue;
        if (!/error|invalid|unauthorized|forbidden|not found|fail|malformed|missing/i.test(`${code ?? ''} ${message ?? ''}`)) {
            continue;
        }
        seen.add(key);
        errors.push({
            status,
            code,
            message: message?.replace(/\s+/g, ' ').slice(0, 200),
            sourceUrl,
            confidence: 0.65,
        });
    }

    return errors;
}
