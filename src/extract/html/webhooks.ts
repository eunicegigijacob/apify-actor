import { load } from 'cheerio';

import type { Webhook } from '../../types.js';

const EVENT_RE = /\b[a-z][a-z0-9]+(?:[._][a-z][a-z0-9]+){1,4}\b/g;

export function extractWebhooksFromHtml(html: string, sourceUrl: string): Webhook[] {
    const $ = load(html);
    const text = ($('body').text() || $.root().text()).replace(/\s+/g, ' ');
    if (!/\bwebhook/i.test(`${text} ${html}`)) return [];

    const events = new Map<string, Webhook>();
    const signatureHeader =
        html.match(/\b((?:X-)?[A-Za-z0-9-]*Signature)\b/i)?.[1] ??
        html.match(/\b(verif-hash|webhook-signature|signature-header)\b/i)?.[1];
    const hmac = /\bhmac\b/i.test(html);
    const sha = /\bsha-?256\b/i.test(html);

    const headings = $('h1, h2, h3, h4, h5, li, td, code, p').toArray();
    for (const el of headings) {
        const value = $(el).text().trim();
        const match = value.match(/\b[a-z][a-z0-9]+(?:[._][a-z][a-z0-9]+){1,4}\b/);
        const exact = value.match(/^[a-z][a-z0-9]+(?:[._][a-z][a-z0-9]+){1,4}$/);
        const eventName = exact?.[0] ?? match?.[0];
        if (!eventName) continue;
        if (/^application\/|^text\//.test(eventName)) continue;
        const nearby = `${$(el).parent().text()} ${$(el).next().text()}`.replace(/\s+/g, ' ').trim();
        const scoped = `${nearby} ${$(el).closest('section, article, body').text().slice(0, 800)}`;
        if (!/webhook|event/i.test(scoped)) continue;
        events.set(eventName, {
            event: eventName,
            description: nearby.replace(eventName, '').trim().slice(0, 280) || undefined,
            method: 'POST',
            signature:
                signatureHeader || hmac
                    ? {
                          header: signatureHeader,
                          method: hmac ? 'HMAC' : sha ? 'SHA256' : undefined,
                      }
                    : undefined,
            sourceUrl,
            confidence: exact ? 0.8 : 0.65,
        });
    }

    if (!events.size) {
        const scoped = text.toLowerCase().includes('webhook') ? text : '';
        for (const match of scoped.matchAll(EVENT_RE)) {
            if (events.size > 40) break;
            const event = match[0];
            if (/^application\/|^text\/|example.com/.test(event)) continue;
            events.set(event, {
                event,
                method: 'POST',
                signature: signatureHeader || hmac ? { header: signatureHeader, method: hmac ? 'HMAC' : undefined } : undefined,
                sourceUrl,
                confidence: 0.55,
            });
        }
    }

    const example = html.match(/\{[\s\S]{0,1500}"event"[\s\S]{0,1500}\}/);
    let payload: unknown;
    if (example) {
        try {
            payload = JSON.parse(example[0]);
        } catch {
            payload = undefined;
        }
    }

    return [...events.values()].map((webhook) => ({
        ...webhook,
        payload: webhook.payload ?? payload,
        examplePayload: payload,
    }));
}
