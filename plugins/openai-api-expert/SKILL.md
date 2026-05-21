---
name: openai-api-expert
description: Build production integrations against the OpenAI API. Covers the Responses API and Chat Completions, streaming over SSE, tool/function calling, structured outputs with json_schema, embeddings, prompt caching, retries with exponential backoff, model selection across gpt-4o/o3/o4-mini, and multimodal image inputs.
---

# OpenAI API Expert

The OpenAI platform exposes two main text-generation surfaces: the older **Chat Completions API** (`/v1/chat/completions`) and the newer **Responses API** (`/v1/responses`), which is now the recommended default for new code. Both support streaming, tools, and structured outputs, but the Responses API folds in built-in tools (web search, file search, code interpreter) and stateful conversations. Master one, then learn the other.

## Use this skill when

- Calling OpenAI from a backend (Node, Python, Go) for completions, embeddings, or tool use
- Picking between `gpt-4o`, `gpt-4o-mini`, `o3`, or `o4-mini` for a given workload
- Implementing structured outputs (strict JSON schemas) for downstream code consumption
- Adding streaming (SSE) for token-by-token UI rendering
- Designing retry, backoff, and rate-limit handling against `429`/`5xx`
- Wiring function/tool calling for agents and integrations
- Reducing cost via prompt caching and shorter system prompts

## Do not use this skill when

- The project must run fully offline or on-device — use local models with `llama.cpp`, vLLM, or Transformers
- You need fine-grained control of decoding (custom logit processors, beam search) — use an open model
- You only need an embedding model and want zero vendor lock-in — consider `text-embedding-3-small` vs. open alternatives (BGE, E5)

## Core concepts

- **Responses API** (`client.responses.create`): single endpoint for text, multimodal inputs, tool calls, and conversation state via `previous_response_id`. Recommended for new projects.
- **Chat Completions** (`client.chat.completions.create`): older but still fully supported. Maps cleanly to many third-party tools.
- **Model families**: `gpt-4o` (multimodal, fast, cheap), `gpt-4o-mini` (cheapest general), `o3` / `o4-mini` (reasoning models — slower, far stronger on math, code, planning). Reasoning models accept `reasoning.effort` (`low`/`medium`/`high`).
- **Structured outputs**: pass `response_format: { type: "json_schema", json_schema: { name, schema, strict: true } }`. With `strict: true`, the model is constrained to valid JSON matching the schema.
- **Tools**: array of tool definitions with JSON schema parameters. The model returns `tool_calls`; you execute them, append results, and call the API again.
- **Streaming**: set `stream: true`. The SDK yields events (`response.output_text.delta`, `response.completed`, etc. on Responses; chunks with `delta.content` on Chat Completions).
- **Prompt caching**: automatic on prompts over ~1024 tokens. Keep the static prefix (system prompt, tool defs, few-shot examples) **first and unchanged** across requests; cached tokens are billed at ~50% of the input rate.

## Quick start

```python
from openai import OpenAI
client = OpenAI()

# Responses API with structured output
resp = client.responses.create(
    model="gpt-4o-2024-08-06",
    input=[
        {"role": "system", "content": "Extract structured data from invoices."},
        {"role": "user", "content": "Invoice #4711, total $123.45, due 2025-01-15."},
    ],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "invoice",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "number": {"type": "string"},
                    "total_usd": {"type": "number"},
                    "due_date": {"type": "string", "format": "date"},
                },
                "required": ["number", "total_usd", "due_date"],
                "additionalProperties": False,
            },
        },
    },
)
print(resp.output_text)  # already-validated JSON string
```

```python
# Streaming with the Responses API
with client.responses.stream(model="gpt-4o-mini", input="Write a haiku") as stream:
    for event in stream:
        if event.type == "response.output_text.delta":
            print(event.delta, end="", flush=True)
    final = stream.get_final_response()
```

## Key patterns

- **Default to the Responses API** for new code. It is a strict superset of Chat Completions in capability and the platform's investment target.
- **Pin model versions** (`gpt-4o-2024-08-06`, not `gpt-4o`) in production. Latest-aliases shift behavior silently.
- **Validate structured outputs**. Even with `strict: true`, parse with a real validator (Pydantic, Zod) at the boundary — protects against future schema drift and partial responses on truncation.
- **Place static content first** for caching: system prompt -> tool definitions -> few-shot examples -> dynamic user input. Reordering invalidates the cache.
- **Retry on transient errors only**: `429`, `500`, `502`, `503`, `504`, and connection errors. Use exponential backoff with jitter, capped at 5–6 attempts. The SDKs do this by default; tune `max_retries`.
- **Tool calling loop**: call API -> if `tool_calls` present, execute each tool -> append tool results -> call again. Cap iterations (e.g., 10) to prevent runaway loops.
- **Image inputs**: pass as `{"type": "input_image", "image_url": "..."}` (Responses) or content parts with `image_url` (Chat Completions). Prefer URLs over base64 when possible.

## Common pitfalls

- **Logging full prompts and completions** without redaction leaks PII and prompt content. Hash or sample before persisting.
- **Counting tokens with the wrong tokenizer**. `gpt-4o` uses `o200k_base`; older models use `cl100k_base`. Use `tiktoken.encoding_for_model(model)`.
- **Ignoring `finish_reason`**. `"length"` means truncation — your JSON will likely be invalid. Raise `max_output_tokens` or shorten the prompt.
- **Hard-coding `temperature=0` for reasoning models**. The `o3`/`o4` family does not support arbitrary sampling params; pass only what the model accepts.
- **Caching busted by a timestamp** in the system prompt (`"Current time: 2026-05-21T..."`). Move volatile data into the user message at the end.
- **Treating tool-calls as text**. The model returns a structured `tool_calls` array; do not regex it out of the response text.
- **No timeout on the HTTP client**. A wedged connection blocks a worker indefinitely. Set per-request timeouts (the SDKs accept `timeout=...`).

## Reference

- API reference: https://platform.openai.com/docs/api-reference
- Responses API guide: https://platform.openai.com/docs/guides/responses
- Structured outputs: https://platform.openai.com/docs/guides/structured-outputs
- Prompt caching: https://platform.openai.com/docs/guides/prompt-caching
- Model overview and deprecations: https://platform.openai.com/docs/models
- Python SDK: https://github.com/openai/openai-python — Node SDK: https://github.com/openai/openai-node
