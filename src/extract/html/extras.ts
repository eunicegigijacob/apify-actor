import { load } from 'cheerio';

import type { CodeExample, RateLimit, Sdk } from '../../types.js';

export function extractRateLimitsFromHtml(html: string, sourceUrl: string): RateLimit[] | null {
    const text = load(html)('body').text();
    if (!/rate\s*limit/i.test(`${text} ${html}`)) return null;

    const limits: RateLimit[] = [];
    const match = text.match(/(\d+)\s*(?:requests?|calls?|req)\s*(?:per|\/)\s*(second|minute|hour|day|sec|min)/i);
    if (match) {
        limits.push({
            requests: Number(match[1]),
            window: match[2].toLowerCase(),
            sourceUrl,
        });
    }

    const header = html.match(/\b(X-RateLimit-[A-Za-z-]+)\b/gi);
    if (header?.length) {
        limits.push({
            headers: [...new Set(header)],
            sourceUrl,
            notes: 'Rate-limit headers documented.',
        });
    }

    return limits.length ? limits : null;
}

const LANGUAGE_HINTS: Array<[RegExp, string]> = [
    [/\bjavascript\b|\bnode(\.js)?\b|\bnpm\b/i, 'javascript'],
    [/\btypescript\b/i, 'typescript'],
    [/\bpython\b|\bpypi\b|\bpip\b/i, 'python'],
    [/\bphp\b|\bcomposer\b/i, 'php'],
    [/\bjava\b|\bmaven\b/i, 'java'],
    [/\bgo\b|\bgolang\b/i, 'go'],
    [/\bruby\b|\bgem\b/i, 'ruby'],
    [/\bc#\b|\bdotnet\b|\.net\b/i, 'csharp'],
];

export function extractSdksFromHtml(html: string, sourceUrl: string): Sdk[] {
    const $ = load(html);
    const text = $('body').text();
    if (!/\bsdk\b|\bclient library\b|\bofficial (?:library|sdk)\b/i.test(`${text} ${html}`)) return [];

    const sdks: Sdk[] = [];
    const seen = new Set<string>();
    for (const [re, language] of LANGUAGE_HINTS) {
        if (!re.test(text)) continue;
        if (seen.has(language)) continue;
        seen.add(language);
        const pkg = text.match(new RegExp(`(?:npm i(?:nstall)?|pip install|composer require|go get)\\s+([A-Za-z0-9_@/.-]+)`));
        sdks.push({
            language,
            package: pkg?.[1],
            sourceUrl,
        });
    }
    return sdks;
}

const FENCE_RE = /```(\w+)?\n([\s\S]*?)```/g;
const LANG_MAP: Record<string, string> = {
    bash: 'curl',
    sh: 'curl',
    shell: 'curl',
    curl: 'curl',
    js: 'javascript',
    javascript: 'javascript',
    ts: 'typescript',
    typescript: 'typescript',
    py: 'python',
    python: 'python',
    php: 'php',
    java: 'java',
    go: 'go',
    ruby: 'ruby',
    rb: 'ruby',
};

export function extractCodeExamplesFromHtml(html: string, sourceUrl: string): CodeExample[] {
    const examples: CodeExample[] = [];
    const $ = load(html);

    for (const match of html.matchAll(FENCE_RE)) {
        const language = LANG_MAP[(match[1] || '').toLowerCase()] ?? match[1] ?? 'unknown';
        const code = match[2].trim();
        if (code.length < 8) continue;
        examples.push({ language, code, sourceUrl });
    }

    $('pre, code').each((_, el) => {
        const code = $(el).text().trim();
        if (code.length < 20 || code.length > 4000) return;
        const className = `${$(el).attr('class') ?? ''} ${$(el).parent().attr('class') ?? ''}`;
        let language = 'unknown';
        for (const [token, lang] of Object.entries(LANG_MAP)) {
            if (className.toLowerCase().includes(token)) language = lang;
        }
        if (/^curl\s/i.test(code)) language = 'curl';
        if (language === 'unknown' && !/^curl\s/i.test(code)) return;
        examples.push({ language, code, sourceUrl });
    });

    const unique = new Map<string, CodeExample>();
    for (const example of examples) {
        unique.set(`${example.language}:${example.code.slice(0, 80)}`, example);
    }
    return [...unique.values()];
}

export function extractMetadataFromHtml(html: string, pageUrl: string): { name?: string; description?: string; version?: string; baseUrls?: string[] } {
    const $ = load(html);
    const title = $('title').first().text().trim() || $('h1').first().text().trim();
    const description =
        $('meta[name="description"]').attr('content')?.trim() ||
        $('h1')
            .first()
            .nextAll('p')
            .first()
            .text()
            .trim();
    const version = html.match(/\b(?:api\s*)?v(?:ersion)?\s*([0-9]+(?:\.[0-9]+)*)/i)?.[1];
    const baseUrls = [...html.matchAll(/https?:\/\/[a-z0-9.-]+(?:\/[a-z0-9._~-]+)*/gi)]
        .map((match) => match[0])
        .filter((url) => /\/(api|v[0-9]+)\b/i.test(url) && !/docs|github|twitter/.test(url))
        .slice(0, 5);

    return {
        name: title.replace(/\s*[|\-–].*$/, '').trim() || undefined,
        description: description?.slice(0, 400) || undefined,
        version,
        baseUrls: [...new Set(baseUrls)],
    };
    void pageUrl;
}
