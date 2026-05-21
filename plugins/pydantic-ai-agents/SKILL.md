---
name: pydantic-ai-agents
description: PydanticAI typed agent framework from the Pydantic team for building production LLM agents with structured outputs and dependency injection. Use this skill when defining an `Agent` with a system prompt and typed `result_type`, registering tools via `@agent.tool`, wiring runtime dependencies through `RunContext[Deps]`, streaming responses with `agent.run_stream`, or switching providers (OpenAI, Anthropic, Gemini, Groq, Mistral, Ollama) without changing agent code.
---

# PydanticAI Agents

PydanticAI is a Python agent framework from the Pydantic maintainers that treats agents as typed functions: you declare the result schema with a Pydantic model and PydanticAI handles tool calling, validation, retries on validation errors, and provider abstraction. It is intentionally smaller than LangChain or LangGraph and biased toward FastAPI-style ergonomics.

## Use this skill when
- Building an agent whose output must conform to a Pydantic model
- Registering tools as plain Python functions with typed parameters
- Injecting runtime context (DB pool, API client, user info) via `RunContext[Deps]`
- Switching between OpenAI, Anthropic, Gemini, Groq, Mistral, Cohere, Ollama, or vLLM without changing agent logic
- Streaming partial structured output with `agent.run_stream`
- Adding usage limits, retries, and validation feedback loops

## Do not use this skill when
- You need a graph of many cooperating agents with shared state (consider LangGraph or CrewAI)
- You only need a single unstructured chat completion (call the SDK directly)
- You need a no-code or low-code agent builder

## Core concepts
An `Agent` is parameterized by two generics: the dependency type `Deps` (passed at run time) and the result type `ResultT` (a Pydantic model or scalar). Tools are functions decorated with `@agent.tool` (gets `RunContext[Deps]` as first arg) or `@agent.tool_plain` (no context). When the LLM returns a malformed result, PydanticAI feeds the Pydantic `ValidationError` back to the model and lets it retry up to `retries` times.

## Quick start
```python
from pydantic import BaseModel
from pydantic_ai import Agent, RunContext

class Weather(BaseModel):
    city: str
    temp_c: float
    summary: str

agent = Agent(
    "openai:gpt-4o-mini",
    result_type=Weather,
    system_prompt="You are a weather assistant. Use the get_temp tool.",
)

@agent.tool_plain
def get_temp(city: str) -> float:
    return {"Paris": 18.0, "Tokyo": 24.0}.get(city, 15.0)

result = agent.run_sync("How is the weather in Tokyo?")
print(result.output)  # Weather(city='Tokyo', temp_c=24.0, summary='...')
```

## Key patterns

### Dependency injection
```python
from dataclasses import dataclass
from httpx import AsyncClient

@dataclass
class Deps:
    http: AsyncClient
    api_key: str

agent = Agent("anthropic:claude-sonnet-4-5", deps_type=Deps, result_type=str)

@agent.tool
async def fetch(ctx: RunContext[Deps], url: str) -> str:
    r = await ctx.deps.http.get(url, headers={"X-Key": ctx.deps.api_key})
    return r.text

async with AsyncClient() as http:
    out = await agent.run("Fetch example.com", deps=Deps(http=http, api_key="..."))
```

### Provider switching
- `"openai:gpt-4o"`, `"openai:gpt-4o-mini"`
- `"anthropic:claude-sonnet-4-5"`, `"anthropic:claude-opus-4-5"`
- `"google-gla:gemini-2.5-pro"` (Generative Language API) or `"google-vertex:gemini-2.5-pro"`
- `"groq:llama-3.3-70b-versatile"`, `"mistral:mistral-large-latest"`, `"cohere:command-r-plus"`
- OpenAI-compatible: `OpenAIModel("llama3.1:8b", provider=OpenAIProvider(base_url="http://localhost:11434/v1"))` for Ollama or vLLM

### Tool patterns
- `@agent.tool` for context-aware tools, `@agent.tool_plain` when no `Deps` are needed
- Tool docstrings and type hints become the LLM-visible schema
- Raise `ModelRetry("explanation")` from inside a tool to make the model retry with feedback
- Use Pydantic models in tool signatures for nested arguments

### Streaming
```python
async with agent.run_stream("Summarize the AI Act") as stream:
    async for chunk in stream.stream_text(delta=True):
        print(chunk, end="", flush=True)
    final = await stream.get_output()
```

### Validation and retries
- `Agent(..., retries=3)` sets global retry budget across tools and result validation
- Add a `@agent.output_validator` to do custom checks beyond Pydantic
- `UsageLimits(request_limit=10, total_tokens_limit=20_000)` passed to `run()` caps spend

### Multi-step agents
- Pass `message_history=result.all_messages()` to continue a conversation
- Use `agent.run(..., model_settings={"temperature":0.0})` to override per call
- For graphs of agents use `pydantic-graph`, the companion library

## Common pitfalls
- `result_type` defaults to `str`; forgetting to set it gives unstructured output
- Tools that mutate shared state across concurrent runs are a race hazard; keep tools pure or use `RunContext.deps`
- Pydantic validation errors trigger retries which count against `retries`; very strict schemas can exhaust the budget
- `run_sync` blocks the event loop; in async code always `await agent.run`
- `Deps` is passed positionally as `deps=`; passing it as the first arg to `run` is a common typo
- Some providers (Gemini, older Mistral) have weaker tool-calling reliability; pin to recent models

## Reference
- Official docs: https://ai.pydantic.dev
- GitHub: https://github.com/pydantic/pydantic-ai
- Examples: https://ai.pydantic.dev/examples/
- Related: [[crewai-agents]], [[dspy-prompt-optimization]]
