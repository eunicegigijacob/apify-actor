const SKIP_PATH_RE =
    /\/(logout|log-out|sign-?out|sign-?in|sign-?up|login|register|cart|checkout)(\/|$)/i;

const SKIP_EXT_RE =
    /\.(png|jpe?g|gif|svg|webp|ico|bmp|mp4|webm|mov|avi|mp3|wav|woff2?|ttf|eot|zip|gz|tgz|rar|7z|exe|dmg|apk)(\?|$)/i;

const SPEC_EXT_RE = /\.(json|ya?ml)(\?|$)/i;

export function normalizeUrl(raw: string, base?: string): string | null {
    try {
        const url = base ? new URL(raw, base) : new URL(raw);
        url.hash = '';
        url.username = '';
        url.password = '';

        const params = url.searchParams;
        for (const key of [...params.keys()]) {
            if (/^(utm_|fbclid|gclid|mc_|ref$|_ga)/i.test(key)) {
                params.delete(key);
            }
        }
        url.search = params.toString();

        let pathname = url.pathname.replace(/\/{2,}/g, '/');
        if (pathname.length > 1) {
            pathname = pathname.replace(/\/+$/, '');
        }
        url.pathname = pathname || '/';

        return url.toString();
    } catch {
        return null;
    }
}

export function registrableDomain(hostname: string): string {
    const host = hostname.replace(/^www\./i, '').toLowerCase();
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    const multi = new Set(['co.uk', 'com.au', 'co.za', 'com.ng', 'org.uk']);
    const lastTwo = parts.slice(-2).join('.');
    const lastThree = parts.slice(-3).join('.');
    if (multi.has(lastTwo)) return lastThree;
    return lastTwo;
}

export function isSameDocumentationHost(candidate: string, startUrl: string): boolean {
    let candidateHost: string;
    let startHost: string;
    try {
        candidateHost = new URL(candidate).hostname.replace(/^www\./i, '').toLowerCase();
        startHost = new URL(startUrl).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
        return false;
    }

    if (candidateHost === startHost) return true;
    if (registrableDomain(candidateHost) !== registrableDomain(startHost)) return false;

    const allowedPrefix = /^(docs|developer|developers|api|dev|help|learn|reference)\./i;
    return allowedPrefix.test(candidateHost) || allowedPrefix.test(startHost) || candidateHost.endsWith(`.${startHost}`);
}

export function shouldSkipUrl(url: string, options?: { allowSpec?: boolean }): boolean {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return true;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    if (SKIP_PATH_RE.test(parsed.pathname)) return true;

    const isSpec = /openapi|swagger|api-docs/i.test(parsed.pathname + parsed.search) || SPEC_EXT_RE.test(parsed.pathname);
    if (options?.allowSpec && isSpec) return false;

    if (SKIP_EXT_RE.test(parsed.pathname)) return true;
    if (/\.pdf(\?|$)/i.test(parsed.pathname) && !isSpec) return true;

    return false;
}

export function looksLikeOpenApiUrl(url: string): boolean {
    return /openapi|swagger|api-docs/i.test(url);
}
