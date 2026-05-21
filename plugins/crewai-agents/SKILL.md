---
name: crewai-agents
description: CrewAI multi-agent orchestration framework for role-based agents collaborating on tasks. Use this skill when defining `Agent`s with role/goal/backstory, decomposing work into `Task`s with expected outputs, assembling them in a `Crew` with `Process.sequential` or `Process.hierarchical`, attaching tools (Serper, browser, file IO, custom `BaseTool`), enabling short/long-term memory, or running flows with `CrewAI Flow` for deterministic control flow.
---

# CrewAI Agents

CrewAI is a Python framework for orchestrating multiple LLM-driven agents that each have a role, a goal, and a backstory, and that collaborate on tasks. It targets the "team of specialists" mental model: a researcher gathers information, a writer drafts, an editor polishes. CrewAI sits between low-level frameworks (PydanticAI, raw SDKs) and full graph-based systems (LangGraph), trading flexibility for opinionated structure.

## Use this skill when
- Modeling a workflow as a small team of specialized agents (researcher, planner, writer, reviewer)
- Composing `Agent` + `Task` + `Crew` with `Process.sequential` or `Process.hierarchical`
- Attaching tools like `SerperDevTool`, `WebsiteSearchTool`, `FileReadTool`, or a custom `BaseTool`
- Adding short-term, long-term, or entity memory to a crew
- Using `Flow` for deterministic, event-driven control between crews
- Wiring a manager LLM to delegate among worker agents in hierarchical mode

## Do not use this skill when
- A single agent with tools is enough (use PydanticAI or call the SDK directly)
- You need fine-grained graph control with custom routing logic (consider LangGraph)
- You need automatic prompt optimization (use DSPy)

## Core concepts
An `Agent` is an LLM persona with a `role`, `goal`, and `backstory` that shape its system prompt, plus a list of `tools` it can call. A `Task` is a unit of work with a natural-language `description`, an `expected_output`, and an `agent` assigned to it. A `Crew` bundles agents and tasks under a `Process`: `sequential` runs tasks in order with each output feeding context to the next; `hierarchical` adds a manager agent that delegates to workers.

## Quick start
```python
from crewai import Agent, Task, Crew, Process
from crewai_tools import SerperDevTool

researcher = Agent(
    role="Senior Research Analyst",
    goal="Find the three most recent advances in {topic}",
    backstory="You are a careful analyst who cites sources.",
    tools=[SerperDevTool()],
    verbose=True,
)
writer = Agent(
    role="Tech Writer",
    goal="Turn research into a 300-word brief",
    backstory="You write clear, jargon-free prose.",
    verbose=True,
)

research_task = Task(
    description="Research {topic} and list 3 sourced findings.",
    expected_output="A bulleted list of 3 findings with URLs.",
    agent=researcher,
)
write_task = Task(
    description="Write a 300-word brief from the research.",
    expected_output="A markdown brief under 300 words.",
    agent=writer,
    context=[research_task],
)

crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, write_task],
    process=Process.sequential,
)
result = crew.kickoff(inputs={"topic": "PagedAttention"})
print(result.raw)
```

## Key patterns

### Process modes
- `Process.sequential`: tasks run in declared order; each task sees prior outputs via `context=[...]`
- `Process.hierarchical`: requires `manager_llm=` or `manager_agent=`; the manager decides which worker handles each task and can replan
- Hierarchical needs explicit `allow_delegation=True` on workers if cross-agent help is wanted

### Tools
- Built-ins from `crewai_tools`: `SerperDevTool`, `WebsiteSearchTool`, `ScrapeWebsiteTool`, `FileReadTool`, `DirectoryReadTool`, `CodeInterpreterTool`, `PDFSearchTool`
- Custom tool: subclass `crewai.tools.BaseTool`, set `name`, `description`, define `_run(self, **kwargs)`; args can be typed via a Pydantic `args_schema`
- Decorator form: `@tool("name")` over a function with type hints

### Memory
```python
crew = Crew(
    agents=[...], tasks=[...],
    memory=True,                 # enables short-term + entity + long-term
    embedder={"provider":"openai","config":{"model":"text-embedding-3-small"}},
)
```
- Short-term: RAG over current run
- Long-term: SQLite-backed across runs
- Entity: tracks named entities seen across tasks

### LLM configuration
- Per agent: `Agent(..., llm=ChatOpenAI(model="gpt-4o"))` or `llm="gpt-4o-mini"` (LiteLLM string)
- Use any LiteLLM-supported provider: `"anthropic/claude-sonnet-4-5"`, `"ollama/llama3.1:8b"`, `"gemini/gemini-2.5-pro"`
- Set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. as env vars

### Structured outputs
- `Task(..., output_pydantic=MyModel)` validates the final output against a Pydantic model
- `output_json=MySchema` for raw JSON-schema validation
- `output_file="report.md"` writes the result to disk

### CrewAI Flow
```python
from crewai.flow.flow import Flow, listen, start

class ContentFlow(Flow):
    @start()
    def begin(self): return crew_a.kickoff()
    @listen(begin)
    def then(self, prev): return crew_b.kickoff(inputs={"prev": prev.raw})

ContentFlow().kickoff()
```
Use Flows when you need deterministic branching, retries, or persistence between crews.

### Project scaffolding
- `crewai create crew my_project` produces a typed project with `agents.yaml` and `tasks.yaml`
- `crewai run` executes; `crewai train -n 5` runs N iterations with feedback for self-improvement

## Common pitfalls
- Missing `context=[prior_task]` means later tasks do not see earlier outputs in sequential mode
- Hierarchical mode without a `manager_llm` silently falls back to the agent LLM and behaves unexpectedly
- `verbose=True` on every agent floods logs; keep it on during development only
- Tools with unclear `description`s confuse the LLM; describe inputs and when to call
- Memory persists in `./db` by default; delete it between unrelated runs
- Long task descriptions become the prompt verbatim; keep them imperative and specific to avoid prompt bloat

## Reference
- Official docs: https://docs.crewai.com
- GitHub: https://github.com/crewAIInc/crewAI
- Tools repo: https://github.com/crewAIInc/crewAI-tools
- Related: [[pydantic-ai-agents]], [[dspy-prompt-optimization]]
