import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CrawledPage, ResolvedInput } from '../../src/types.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function fixture(name: string): string {
    return readFileSync(join(ROOT, name), 'utf8');
}

export function page(name: string, url = 'https://docs.example.com/api'): CrawledPage {
    const html = fixture(name);
    return {
        url,
        title: '',
        statusCode: 200,
        contentType: 'text/html',
        html,
        text: html.replace(/<[^>]+>/g, ' '),
        discoveredAt: new Date().toISOString(),
        renderedWithBrowser: false,
    };
}

export const defaultInput: ResolvedInput = {
    startUrl: 'https://docs.example.com/api',
    maxPages: 20,
    includeCodeExamples: true,
    includeWebhooks: true,
    includeErrors: true,
};
