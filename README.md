## What does API Documentation Extractor — Structured API Intelligence do?

This Actor turns **API documentation** into **structured, machine-readable API intelligence**. Give it a documentation URL. It prefers an OpenAPI or Swagger specification when one exists, otherwise it extracts endpoints from HTML. It does **not** return scraped page text or raw HTML as the product.

Use it when you need a normalized JSON model of an API for developers, AI agents, integration platforms, or API research.

## Why use it?

- Discover OpenAPI/Swagger specs automatically and treat them as the source of truth
- Extract HTTP endpoints, authentication, parameters, request bodies, and responses from HTML when no spec is published
- Capture webhooks, errors, rate limits, SDKs, and documented code examples when they appear in the docs
- Keep a `sourceUrl` on extracted entities so you can audit and debug results
- Run on Apify with scheduling, monitoring, and API/CLI access

This is an extractor, not a generic web scraper.

## What data can it extract?

| Field | Description |
| --- | --- |
| `api` | Name, description, version, base URLs, documentation URL |
| `authentication` | Bearer, API key, OAuth, Basic, HMAC, JWT when documented |
| `endpoints` | Method, path, parameters, request body, responses, source URL |
| `webhooks` | Event name, payload, signature verification when documented |
| `errors` | HTTP status, error code, message |
| `rateLimits` | Documented limits, or `null` if none are stated |
| `sdks` | Client libraries mentioned in the docs |
| `codeExamples` | Copy-only examples from the documentation |
| `crawl` | Pages visited, OpenAPI URL, whether a browser was used |

## How to extract API intelligence

1. Open the Actor in Apify Console.
2. Paste a documentation URL into **Documentation URL** (for example `https://paystack.com/docs/api/`).
3. Optionally lower **Max pages** for a cheaper run.
4. Click **Start**.
5. Download the dataset as JSON, or fetch `OUTPUT` from the default key-value store.

## How much will it cost?

Compute cost scales with pages crawled. HTTP/Cheerio is the default and is inexpensive. A browser is used only when a page looks JavaScript-rendered and the initial HTML has no useful API content. Start with a smaller `maxPages` on large sites such as Stripe or GitHub.

## Input

See the input tab for the full form.

- `startUrl` (required) — documentation URL
- `maxPages` — default `100`
- `includeCodeExamples` — default `true`
- `includeWebhooks` — default `true`
- `includeErrors` — default `true`

## Output

You can download the dataset as JSON, HTML, CSV, or Excel. The Actor writes **one** JSON object describing the API, and the same object to key-value store record `OUTPUT`.

```json
{
  "api": {
    "name": "Payments API",
    "version": "1",
    "baseUrls": ["https://api.payments.test/v1"],
    "documentationUrl": "https://docs.payments.test/api"
  },
  "authentication": [{ "type": "bearer", "headers": ["Authorization"] }],
  "endpoints": [
    {
      "method": "POST",
      "path": "/transaction/initialize",
      "name": "Initialize Transaction",
      "authentication": { "type": "bearer" },
      "requestBody": {
        "email": { "type": "string", "required": true },
        "amount": { "type": "integer", "required": true }
      },
      "responses": { "200": { "description": "Successful response" } },
      "sourceUrl": "https://docs.payments.test/api"
    }
  ],
  "webhooks": [],
  "errors": [],
  "rateLimits": null,
  "sdks": [],
  "codeExamples": [],
  "crawl": { "pagesVisited": 1, "pagesProcessed": 1, "durationMs": 1200, "sourceUrls": [] }
}
```

## Supported documentation types

- OpenAPI 3 and Swagger 2 (`openapi.json`, `swagger.yaml`, `/api-docs`, and links from the docs)
- Static HTML API reference pages
- JavaScript-rendered docs, via a Playwright retry for pages whose initial HTML has no useful content

## Limitations

- The Actor does not invent endpoints, webhooks, or auth schemes. Missing documentation stays missing (`unknown` or empty arrays / `null`).
- It does not generate client code. Examples are copied only when the docs include them.
- Selectors are provider-agnostic. Unusual one-off doc layouts may yield fewer fields.
- Change detection, API comparison, and historical versions are out of scope.

## API usage example

```bash
apify call api-documentation-extractor --input '{
  "startUrl": "https://paystack.com/docs/api/",
  "maxPages": 40,
  "includeWebhooks": true,
  "includeErrors": true
}'
```

Use the Apify API to read dataset items after the run, or the `OUTPUT` record in the default key-value store.

## FAQ

Our Actors extract publicly documented API information. Do not use this Actor to bypass authentication, scrape private user data, or violate a site's terms of service. If your results could contain personal data, GDPR and similar laws may apply.

Open issues on the Issues tab. Programmatic runs are documented on the API tab.
