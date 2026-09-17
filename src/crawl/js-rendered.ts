const SPA_ROOTS = ['#__next', '#app', '#root', '#__nuxt', '[data-reactroot]', 'mintlify', 'readme-custom'];

export function isLikelyJsRendered(html: string): boolean {
    const withoutScripts = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

    const text = withoutScripts.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const hasSpaShell = SPA_ROOTS.some((token) => html.toLowerCase().includes(token.replace(/[\[\]]/g, '')));
    const thinText = text.length < 400;
    const hasEnableJs = /enable javascript|you need to enable javascript/i.test(html);

    return (thinText && (hasSpaShell || html.includes('id="__next"') || html.includes("id='__next'"))) || hasEnableJs;
}

export function hasUsefulApiContent(html: string, text = ''): boolean {
    const haystack = `${html} ${text}`.slice(0, 200_000);
    if (/\b(GET|POST|PUT|PATCH|DELETE)\s+\//.test(haystack)) return true;
    if (/openapi|swagger/i.test(haystack) && /paths/i.test(haystack)) return true;
    if (/\b(bearer|api[_-]?key|oauth)\b/i.test(haystack) && /\b(endpoint|request|authorization)\b/i.test(haystack)) {
        return true;
    }
    return false;
}
