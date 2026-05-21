---
name: langchain-agent-orchestrator
description: Compose LLM applications with LangChain 0.3+ (Python and JS). Covers LCEL (Runnable composition with the pipe operator), chat models, output parsers, retrievers and RAG, tools and agents via create_react_agent / LangGraph, LangSmith tracing, memory, and the anti-patterns that come from over-abstracting.
---

# LangChain Agent Orchestrator

LangChain 0.3+ has converged on two pillars: **LCEL** (the LangChain Expression Language — Runnables composed with `|`) for declarative pipelines, and **LangGraph** for stateful, multi-step agents. The legacy `Chain` and `AgentExecutor` classes still work but are no longer the recommended path. Use Runnables for everything pipeline-shaped, and LangGraph (with `create_react_agent`) for anything that loops, branches, or holds state.

## Use this skill when

- Composing chat-model pipelines (prompt -> model -> parser) with LCEL
- Building a RAG application: loaders -> splitters -> embeddings -> vector store -> retriever -> generation
- Wiring tools and building a ReAct-style agent with `create_react_agent` from `langgraph.prebuilt`
- Adding LangSmith tracing to debug latency, token use, or tool-call loops
- Streaming token-by-token or step-by-step output to a client
- Choosing between LCEL composition and a custom function (the answer is often the custom function)

## Do not use this skill when

- You only need one model call with structured output — call the provider SDK directly (`openai`, `anthropic`)
- The team prefers a thinner stack (LiteLLM, Instructor, or hand-rolled) and does not need LangChain's integrations
- You need deterministic, low-latency production pipelines where the overhead of `RunnableParallel`/`RunnableLambda` is hard to justify

## Core concepts

- **Runnables**: anything implementing `invoke`, `batch`, `stream` (and async variants). `ChatPromptTemplate`, `ChatOpenAI`, `StrOutputParser`, retrievers, and even plain functions (`RunnableLambda`) are Runnables. They compose with `|`.
- **LCEL**: `chain = prompt | model | parser`. Then `chain.invoke({...})`, `await chain.ainvoke(...)`, `chain.stream(...)`. Parallel branches: `RunnableParallel({"a": chain_a, "b": chain_b})`. Pass-through: `RunnablePassthrough.assign(extra=lambda x: ...)`.
- **Chat models**: `ChatOpenAI`, `ChatAnthropic`, `ChatGoogleGenerativeAI`, `ChatBedrock`, etc. All accept `temperature`, `model`, and `.bind_tools([...])` for tool calling.
- **Output parsers**: `StrOutputParser`, `JsonOutputParser`, `PydanticOutputParser`. With modern models, prefer `model.with_structured_output(Schema)` over text parsers.
- **Retrievers**: any object with `get_relevant_documents` / `invoke`. Built from a vector store via `vectorstore.as_retriever(search_kwargs={"k": 4})`. Compose multiple with `EnsembleRetriever`.
- **Tools**: defined via the `@tool` decorator. Bind to a model with `model.bind_tools([...])`. The model returns `tool_calls`; you execute them and feed results back.
- **Agents**: use `create_react_agent(model, tools)` from `langgraph.prebuilt`. The legacy `AgentExecutor` is deprecated.
- **LangSmith**: set `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY=...` and every Runnable invocation is traced automatically.

## Quick start

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

prompt = ChatPromptTemplate.from_messages([
    ("system", "You translate English to {language}."),
    ("user", "{text}"),
])
model = ChatOpenAI(model="gpt-4o-mini", temperature=0)
chain = prompt | model | StrOutputParser()

chain.invoke({"language": "French", "text": "Good morning"})
# 'Bonjour'

# Streaming
for chunk in chain.stream({"language": "Spanish", "text": "Hello"}):
    print(chunk, end="", flush=True)
```

```python
# RAG with a retriever
from langchain_core.runnables import RunnablePassthrough

retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
rag_prompt = ChatPromptTemplate.from_template(
    "Answer using only the context.\n\nContext:\n{context}\n\nQuestion: {question}"
)
rag_chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | rag_prompt | model | StrOutputParser()
)
rag_chain.invoke("What are the SLA targets?")
```

```python
# Agent with tools (LangGraph)
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

@tool
def get_weather(city: str) -> str:
    """Look up current weather for a city."""
    return f"It is 18C and sunny in {city}."

agent = create_react_agent(model, tools=[get_weather])
agent.invoke({"messages": [("user", "Weather in Seoul?")]})
```

## Key patterns

- **Prefer `with_structured_output`** for JSON: `model.with_structured_output(MyPydanticModel)` returns parsed objects directly and uses the provider's native structured-output support when available.
- **Use LangGraph for anything with loops, branches, or state.** `create_react_agent` is the right starting point; drop to a custom `StateGraph` only when control flow demands it.
- **Trace early.** Turn on LangSmith from day one. Without traces, debugging a multi-tool agent is guesswork.
- **Stream events for UIs**: `astream_events(version="v2")` emits typed events (model tokens, tool starts/ends) suitable for SSE.
- **Cache embeddings** with `CacheBackedEmbeddings` so re-indexing does not re-pay for unchanged documents.
- **Keep retrievers swappable**. Build them behind a thin interface so you can switch from Chroma -> Postgres+pgvector -> Pinecone without touching the chain.

## Common pitfalls

- **Over-abstraction**: wrapping a single `model.invoke` in a 5-Runnable LCEL chain hides what the code does and serves no purpose. If LCEL does not simplify, write a function.
- **Pinning to legacy classes**: `LLMChain`, `ConversationChain`, `AgentExecutor`, `initialize_agent` are deprecated. Migrate to LCEL + LangGraph.
- **Importing from `langchain` instead of `langchain_core` / `langchain_openai` / `langchain_community`**. The package was split in 0.1 and again refined in 0.3. Import from the most specific subpackage.
- **Silent prompt-template variable mismatches**. Calling `chain.invoke({"text": ...})` when the template expects `{question}` raises at runtime, not at definition. Use `prompt.input_variables` to verify.
- **Treating retrieval as solved**. Out-of-the-box `similarity_search` with `k=4` is a baseline, not a finished product. Evaluate retrieval with a held-out set; tune chunk size, embeddings, and reranking.
- **Memory in stateless deployments**: `ConversationBufferMemory` lives in process. Behind a load balancer, sessions land on different workers. Externalize chat history to Redis or a database, or use LangGraph's checkpointer.

## Reference

- LangChain docs: https://python.langchain.com/docs/introduction/
- LCEL guide: https://python.langchain.com/docs/concepts/lcel/
- LangGraph: https://langchain-ai.github.io/langgraph/
- LangSmith: https://docs.smith.langchain.com/
- JS/TS docs: https://js.langchain.com/docs/introduction/
- Migration to 0.3: https://python.langchain.com/docs/versions/v0_3/
