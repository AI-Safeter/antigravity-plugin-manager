---
name: langfuse-observability
description: Langfuse LLM observability for traces, generations, scoring, prompt versioning, datasets, and eval pipelines. Use this skill when instrumenting LLM apps with traces and spans, capturing token usage and latency, managing prompts as versioned assets, running offline evals against datasets, or integrating with LangChain, LlamaIndex, OpenAI SDK, or Vercel AI SDK.
---

# Langfuse LLM Observability

Langfuse is open-source LLM observability -- traces and spans purpose-built for LLM apps, with token/cost accounting, prompt management, scoring (human, LLM-as-judge, programmatic), datasets, and eval pipelines. The mental model is OpenTelemetry-flavored: a `trace` is a user interaction, `generations` are LLM calls, `spans` are everything else (retrieval, tool calls, business logic). Self-hostable or use Langfuse Cloud.

## Use this skill when

- Instrumenting an LLM app to see per-request traces, token use, and cost
- Versioning prompts and rolling out safely (`prompt.compile({...})`)
- Running offline evals against a dataset of test cases
- Scoring outputs (manual review, LLM-as-judge, automatic checks)
- Wiring LangChain, LlamaIndex, OpenAI, Anthropic, or the Vercel AI SDK into Langfuse
- Comparing latency/cost across model versions before a switchover

## Do not use this skill when

- You only need generic application APM (use Sentry / OpenTelemetry)
- You're not building with LLMs
- You need fully on-prem with no Cloud signup option and self-hosting is out of scope (self-host IS supported, so this is rare)

## Core concepts

A `Trace` represents one end-user interaction (one chat turn, one agent run). It contains nested `Observations`: `Spans` (generic operations), `Generations` (LLM calls with model + token usage), and `Events` (point-in-time markers). `Sessions` group multiple traces (a conversation). `Scores` attach quality signals (0-1, categorical, boolean) to traces or observations. `Prompts` are versioned templates fetched at runtime. `Datasets` are collections of inputs/expected outputs for evals.

## Quick start

```bash
npm install langfuse
# Python: pip install langfuse
```

```typescript
// Manual instrumentation
import { Langfuse } from 'langfuse';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com',
});

const trace = langfuse.trace({ name: 'chat-turn', userId: 'user_123', sessionId: 'sess_abc' });

const generation = trace.generation({
  name: 'openai-gpt-4o',
  model: 'gpt-4o-2024-08-06',
  input: messages,
  modelParameters: { temperature: 0.2 },
});
const completion = await openai.chat.completions.create({ model: 'gpt-4o', messages });
generation.end({
  output: completion.choices[0].message,
  usage: {
    input: completion.usage?.prompt_tokens,
    output: completion.usage?.completion_tokens,
  },
});

await langfuse.flushAsync(); // important in serverless
```

```python
# Python decorator-style -- zero-code for OpenAI
from langfuse.decorators import observe
from langfuse.openai import openai  # drop-in replacement

@observe()
def chat(question: str) -> str:
    resp = openai.chat.completions.create(model="gpt-4o", messages=[{"role": "user", "content": question}])
    return resp.choices[0].message.content
```

## Key patterns

### Integrations
- **OpenAI**: `from langfuse.openai import openai` (Python) -- auto-captures every call.
- **LangChain**: `CallbackHandler` from `langfuse.callback`, pass via `config={'callbacks': [handler]}`.
- **LlamaIndex**: `LlamaIndexInstrumentor().start()`.
- **Vercel AI SDK**: use the `LangfuseExporter` with OpenTelemetry, set `experimental_telemetry: { isEnabled: true }` on `streamText`/`generateText`.

### Prompt management
```typescript
const prompt = await langfuse.getPrompt('summarize', undefined, { label: 'production' });
const compiled = prompt.compile({ topic: 'climate' });
const generation = trace.generation({ prompt, model: 'gpt-4o', input: compiled });
```
Linking the prompt to the generation enables per-version analytics (latency, cost, quality by version).

### Scoring
- **Manual**: from the Langfuse UI.
- **Programmatic**: `trace.score({ name: 'has_citation', value: 1, comment: '...' })`.
- **LLM-as-judge**: configure an evaluator in the UI; runs async on new traces.

### Datasets and evals
```typescript
const dataset = await langfuse.getDataset('regression_v1');
for (const item of dataset.items) {
  const trace = langfuse.trace({ name: 'eval-run' });
  const output = await yourPipeline(item.input);
  await item.link(trace, 'run-2025-05-21');
  trace.score({ name: 'exact_match', value: output === item.expectedOutput ? 1 : 0 });
}
await langfuse.flushAsync();
```

### Sessions
Pass `sessionId` to group traces from the same conversation: `langfuse.trace({ sessionId: conversationId, ... })`. Langfuse aggregates session-level metrics.

### Self-host
`docker compose up` from the Langfuse repo runs Postgres + Clickhouse + app. Required for on-prem.

## Common pitfalls

- **Missing `flushAsync()` in serverless**: Langfuse batches events. Lambda/Vercel functions exit before the batch flushes -- explicitly `await langfuse.flushAsync()` at the end of the handler.
- **Generation without `usage`**: cost rollups show $0. Always pass `usage.input` and `usage.output` token counts.
- **Wrong `baseUrl`**: EU users on `cloud.langfuse.com` vs US on `us.cloud.langfuse.com`. Mismatched region = data goes to the wrong account.
- **Public key in server, secret key in client**: backwards. Public key can be exposed (used by browser SDK for trace ingestion); secret key is server-only.
- **High-cardinality trace names**: name traces semantically (`'chat-turn'`, `'agent-step'`), not `'user_12345_turn_42'`. Use `userId`, `sessionId`, `metadata` for cardinality.
- **PII in inputs/outputs**: Langfuse stores them verbatim. Scrub or hash sensitive fields before logging.
- **Scoring after the trace is finalized in serverless**: must happen before flush. Score the generation inside the trace lifetime or use the async scoring API.

## Security considerations

- **API keys**: `LANGFUSE_SECRET_KEY` (`sk-lf-...`) is server-only; `LANGFUSE_PUBLIC_KEY` (`pk-lf-...`) can be used in browser-side SDKs but consider whether you want browser ingestion at all. Use env vars, never commit.
- **PII**: inputs and outputs often contain user messages and possibly PII. Configure a redaction step before sending, or use Langfuse's masking config to drop fields by regex.
- **Self-hosted DB**: traces are stored in Postgres + Clickhouse. Secure the DB instances; back up regularly.
- **Multi-tenant SaaS**: use one Langfuse project per tenant or tag traces with a tenant ID. Don't mix tenants without filters -- RBAC is at project level.
- **Eval prompts**: if using LLM-as-judge, the judge LLM sees your traces. Choose the judge model with privacy in mind (self-hosted vs OpenAI API).

## Reference

- Official docs: https://langfuse.com/docs
- SDKs: https://langfuse.com/docs/sdk
- Integrations: https://langfuse.com/docs/integrations
- Prompts: https://langfuse.com/docs/prompts/get-started
- Self-host: https://langfuse.com/self-hosting
- Related: [[promptfoo-evals]], [[opentelemetry-instrumentation]], [[sentry-error-tracking]]
