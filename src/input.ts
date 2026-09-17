import type { ActorInput, ResolvedInput } from './types.js';

const DEFAULTS: Omit<ResolvedInput, 'startUrl'> = {
    maxPages: 100,
    includeCodeExamples: true,
    includeWebhooks: true,
    includeErrors: true,
};

export class InvalidInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidInputError';
    }
}

export function resolveInput(raw: ActorInput | null | undefined): ResolvedInput {
    if (!raw || typeof raw.startUrl !== 'string' || !raw.startUrl.trim()) {
        throw new InvalidInputError('startUrl is required and must be a non-empty string.');
    }

    let parsed: URL;
    try {
        parsed = new URL(raw.startUrl.trim());
    } catch {
        throw new InvalidInputError(`startUrl is not a valid URL: ${raw.startUrl}`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new InvalidInputError('startUrl must use http or https.');
    }

    const maxPages = raw.maxPages ?? DEFAULTS.maxPages;
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 1000) {
        throw new InvalidInputError('maxPages must be an integer between 1 and 1000.');
    }

    return {
        startUrl: parsed.toString(),
        maxPages,
        includeCodeExamples: raw.includeCodeExamples ?? DEFAULTS.includeCodeExamples,
        includeWebhooks: raw.includeWebhooks ?? DEFAULTS.includeWebhooks,
        includeErrors: raw.includeErrors ?? DEFAULTS.includeErrors,
    };
}
