---
name: promptfoo-evals
description: Promptfoo CLI and library for LLM evaluations. Use this skill when writing promptfooconfig.yaml files, defining providers and assertions, running test matrices across prompts and models, comparing model outputs side-by-side, integrating evals into CI, or running red-team scans for safety regressions.
---

# Promptfoo Evals

Promptfoo is an open-source CLI and TS/JS library for LLM evaluations: you declare a matrix of `prompts`, `providers` (models), and `tests` (inputs + assertions), then `promptfoo eval` runs them all and produces a comparison view. It's the lightest-weight way to put guardrails on prompt changes, compare models, and catch regressions in CI. Plug-and-play with OpenAI, Anthropic, local models via Ollama, and 50+ other providers.

## Use this skill when

- Comparing GPT-4o vs Claude vs Gemini vs a local model on your task
- Regression-testing prompt changes before merge (catch quality drops)
- Running CI checks on every PR that touches a prompt file
- Building a graded test set with `equals`, `contains`, `llm-rubric`, `cost`, `latency` assertions
- Red-teaming for jailbreaks, PII leaks, bias (`promptfoo redteam`)
- Generating eval datasets and replaying production traces

## Do not use this skill when

- You need runtime LLM tracing in production (use Langfuse / LangSmith)
- You need a hosted eval platform with human review workflows (use Langfuse, Braintrust, or Humanloop)
- Your evals require complex multi-turn agent state that doesn't fit a matrix (still possible, but uglier)

## Core concepts

`promptfooconfig.yaml` is the heart: list `prompts` (strings, files, or functions), `providers` (model endpoints), and `tests` (each with `vars` and `assert` arrays). Promptfoo expands the cartesian product, runs every combination, and shows a grid. `Assertions` are pass/fail or graded (0-1). `llm-rubric` uses another LLM as a judge. Outputs cache by default so reruns are cheap.

## Quick start

```bash
npm install -g promptfoo
# or: npx promptfoo@latest init
promptfoo init  # creates promptfooconfig.yaml
```

```yaml
# promptfooconfig.yaml
description: Translation quality eval

prompts:
  - "Translate the following English text to {{language}}: {{text}}"
  - file://prompts/system.txt

providers:
  - openai:gpt-4o-mini
  - openai:gpt-4o
  - anthropic:claude-3-5-sonnet-20241022

tests:
  - vars: { language: French, text: "Hello, world." }
    assert:
      - type: contains-any
        value: ["Bonjour", "Salut"]
      - type: latency
        threshold: 3000  # ms
      - type: cost
        threshold: 0.01  # USD

  - vars: { language: Japanese, text: "Good morning." }
    assert:
      - type: llm-rubric
        value: "The response is a natural Japanese translation of 'Good morning.'"
        provider: openai:gpt-4o

  - vars: { language: Spanish, text: "Where is the library?" }
    assert:
      - type: javascript
        value: output.toLowerCase().includes('biblioteca')
```

```bash
promptfoo eval                # run the matrix
promptfoo view                # open the local UI
promptfoo eval --output results.json
```

## Key patterns

### Assertions
- `equals`, `contains`, `contains-any`, `contains-all`, `icontains`, `regex`
- `javascript`/`python`: arbitrary code with access to `output`, `context.vars`
- `llm-rubric`: another LLM judges against a rubric
- `factuality`, `answer-relevance`, `context-relevance`: RAG-specific
- `cost`, `latency`, `perplexity`, `similar` (cosine similarity to expected)
- `is-json`, `is-valid-openai-tools-call`

### Providers
Specify with `provider:model` syntax: `openai:gpt-4o`, `anthropic:claude-3-5-sonnet-20241022`, `bedrock:anthropic.claude-3-5-sonnet-20241022-v2:0`, `ollama:llama3.2`. Override params per-provider:
```yaml
providers:
  - id: openai:gpt-4o
    config: { temperature: 0, max_tokens: 500 }
```
Custom HTTP endpoints: `http://your-api.com/chat` with a request template.

### Test matrices
Use `defaultTest` to share assertions:
```yaml
defaultTest:
  assert:
    - type: latency
      threshold: 5000
tests:
  - vars: { ... }
```
Load `tests` from a CSV/JSON: `tests: file://tests.csv`.

### CI integration
```yaml
# .github/workflows/eval.yml
- run: npx promptfoo@latest eval -c promptfooconfig.yaml --no-cache --output out.json
- run: npx promptfoo@latest eval --assertions-only --fail-on-error
```
Use `--filter-failing` to rerun only failing tests on subsequent commits. Exit code is non-zero if any test fails -- wire into branch protection.

### Red-team scans
```bash
promptfoo redteam init       # interactive setup
promptfoo redteam generate   # generates adversarial test cases
promptfoo redteam eval       # runs them
```
Covers prompt injection, PII leakage, jailbreaks, harmful content. Useful for safety reviews pre-launch.

### Programmatic usage (Node SDK)
```typescript
import promptfoo from 'promptfoo';
const results = await promptfoo.evaluate({
  prompts: ['Summarize: {{text}}'],
  providers: ['openai:gpt-4o-mini'],
  tests: [{ vars: { text: '...' }, assert: [{ type: 'contains', value: '...' }] }],
});
```

### Caching
Outputs cached per `(prompt, provider, vars)` triple in `~/.promptfoo/cache`. Use `--no-cache` in CI for honest cost/latency numbers, or `cache: false` per provider.

## Common pitfalls

- **API keys missing**: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` must be set in the env. The error message points to the wrong var sometimes; check `~/.promptfoo` logs.
- **Caching hiding regressions**: a rerun shows green because results came from cache. Use `--no-cache` in CI or bump the cache key with `cache: false`.
- **`llm-rubric` with the same model as the generator**: grader bias. Use a different (often stronger) model as the judge.
- **Threshold assertions without baselines**: `latency: 3000` is meaningless without knowing your p95. Run a baseline first.
- **Cost explosions**: a large matrix (10 prompts x 5 providers x 100 tests = 5000 calls). Estimate with `promptfoo eval --dry-run` first.
- **Non-deterministic tests**: with `temperature > 0`, runs vary. Set `temperature: 0` for assertions or use `llm-rubric` for semantic matching.
- **Comparing apples to oranges**: different providers have different default `max_tokens`/`temperature`. Pin params explicitly in `config:`.
- **Tests from CSV with quotes**: escape commas and quotes properly. Promptfoo parses CSV strictly.

## Reference

- Official docs: https://www.promptfoo.dev/docs/
- Config reference: https://www.promptfoo.dev/docs/configuration/reference
- Assertion types: https://www.promptfoo.dev/docs/configuration/expected-outputs/
- Red-team: https://www.promptfoo.dev/docs/red-team/
- GitHub: https://github.com/promptfoo/promptfoo
- Related: [[langfuse-observability]]
