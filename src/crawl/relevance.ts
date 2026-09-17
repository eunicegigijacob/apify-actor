const POSITIVE = [
    'api',
    'endpoint',
    'endpoints',
    'authentication',
    'authorization',
    'reference',
    'methods',
    'request',
    'requests',
    'response',
    'responses',
    'webhook',
    'webhooks',
    'event',
    'events',
    'error',
    'errors',
    'rate-limit',
    'rate limit',
    'ratelimit',
    'sdk',
    'example',
    'examples',
    'getting started',
    'quickstart',
    'openapi',
    'swagger',
];

const NEGATIVE = [
    'pricing',
    'blog',
    'careers',
    'about us',
    'press',
    'privacy',
    'terms of service',
    'cookie',
    'marketing',
    'changelog of the website',
];

export function relevanceScore(url: string, linkText = ''): number {
    const haystack = `${url} ${linkText}`.toLowerCase();
    let score = 0;
    for (const token of POSITIVE) {
        if (haystack.includes(token)) score += 2;
    }
    for (const token of NEGATIVE) {
        if (haystack.includes(token)) score -= 3;
    }
    if (/\/(api|reference|docs|developers?)\b/i.test(url)) score += 3;
    return score;
}

export function isRelevantDocumentationLink(url: string, linkText = '', startUrl?: string): boolean {
    const score = relevanceScore(url, linkText);
    if (score >= 2) return true;
    if (!startUrl) return score >= 0;
    try {
        const startPath = new URL(startUrl).pathname.replace(/\/+$/, '');
        const path = new URL(url).pathname.replace(/\/+$/, '');
        if (startPath && (path === startPath || path.startsWith(`${startPath}/`))) return true;
    } catch {
        return false;
    }
    return score > 0;
}
