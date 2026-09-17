import { describe, expect, it } from 'vitest';

import { extractErrorsFromHtml } from '../src/extract/html/errors.js';
import { extractWebhooksFromHtml } from '../src/extract/html/webhooks.js';
import { fixture } from './helpers.js';

describe('webhooks and errors', () => {
    it('extracts webhook events, payload, and HMAC signature from payment docs A', () => {
        const webhooks = extractWebhooksFromHtml(fixture('payments-a.html'), 'https://docs.payments.test/webhooks');
        expect(webhooks.some((item) => item.event === 'charge.success')).toBe(true);
        expect(webhooks.some((item) => item.event === 'transfer.success')).toBe(true);
        expect(webhooks[0].signature?.header).toBe('X-Signature');
        expect(webhooks[0].signature?.method).toBe('HMAC');
        expect(webhooks[0].sourceUrl).toContain('webhooks');
    });

    it('extracts webhook events from a differently structured payment docs B', () => {
        const webhooks = extractWebhooksFromHtml(fixture('payments-b.html'), 'https://docs.checkout.test/webhooks');
        expect(webhooks.some((item) => item.event === 'charge.completed')).toBe(true);
        expect(webhooks.some((item) => item.event === 'transfer.completed')).toBe(true);
        expect(webhooks[0].signature?.header).toBe('verif-hash');
    });

    it('extracts documented errors', () => {
        const errors = extractErrorsFromHtml(fixture('payments-a.html'), 'https://docs.payments.test/errors');
        expect(errors.some((item) => item.status === 400 && item.code === 'invalid_request')).toBe(true);
        expect(errors.some((item) => item.status === 401)).toBe(true);
    });

    it('does not invent webhook events on unrelated pages', () => {
        expect(extractWebhooksFromHtml(fixture('malformed.html'), 'https://docs.example.com')).toEqual([]);
    });
});
