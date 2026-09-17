import { describe, expect, it } from 'vitest';

import { hasUsefulApiContent, isLikelyJsRendered } from '../src/crawl/js-rendered.js';
import { fixture } from './helpers.js';

describe('JavaScript-rendered documentation detection', () => {
    it('flags thin SPA shells and enable-javascript pages', () => {
        expect(isLikelyJsRendered(fixture('js-shell.html'))).toBe(true);
        expect(hasUsefulApiContent(fixture('js-shell.html'))).toBe(false);
    });

    it('does not flag static API docs as needing a browser', () => {
        expect(isLikelyJsRendered(fixture('static-users.html'))).toBe(false);
        expect(hasUsefulApiContent(fixture('static-users.html'))).toBe(true);
    });
});
