---
name: dspy-prompt-optimization
description: DSPy from Stanford NLP for programmatic prompting and automatic prompt/weight optimization. Use this skill when defining LM pipelines with Signatures and Modules (Predict, ChainOfThought, ReAct, ProgramOfThought), compiling them with optimizers (BootstrapFewShot, BootstrapFewShotWithRandomSearch, MIPROv2, COPRO, BootstrapFinetune), measuring quality with `dspy.Evaluate` and metrics, or migrating from hand-tuned prompt strings to declarative LM programs.
---

# DSPy Prompt Optimization

DSPy is a framework for building language model programs as composable modules with typed input/output signatures, then compiling those programs against a metric to automatically generate few-shot demonstrations and instructions. It replaces brittle prompt-string tuning with a workflow that resembles training a model: define the program, define a metric, run an optimizer.

## Use this skill when
- Replacing hand-written prompts with declarative `dspy.Signature` definitions
- Composing pipelines from `dspy.Predict`, `dspy.ChainOfThought`, `dspy.ReAct`, or `dspy.ProgramOfThought`
- Compiling a program with `BootstrapFewShot`, `BootstrapFewShotWithRandomSearch`, `MIPROv2`, or `COPRO`
- Building a RAG pipeline with a retriever module and a generator module
- Evaluating with `dspy.Evaluate` and a custom metric function
- Distilling a compiled program into a smaller model with `BootstrapFinetune`

## Do not use this skill when
- You just need a single prompt with no examples or metric
- You need stateful multi-turn agents with rich tool ecosystems (consider PydanticAI or LangGraph)
- You want a UI-driven prompt editor

## Core concepts
A `Signature` declares the input and output fields of a single LM call in natural language. A `Module` is a composable callable whose `forward` method runs one or more LM calls. A `Metric` is a function `(example, prediction, trace) -> float|bool`. An `Optimizer` (called a "teleprompter" historically) takes a program, a trainset, and a metric, and returns a compiled program with better demonstrations or instructions baked in.

## Quick start
```python
import dspy

dspy.configure(lm=dspy.LM("openai/gpt-4o-mini", api_key="..."))

class QA(dspy.Signature):
    """Answer a question with a short factual response."""
    question: str = dspy.InputField()
    answer: str = dspy.OutputField(desc="one to five words")

qa = dspy.ChainOfThought(QA)
pred = qa(question="What is the capital of France?")
print(pred.reasoning, pred.answer)
```

## Key patterns

### Signatures
- Inline: `dspy.Predict("question -> answer")` for quick experiments
- Class form: subclass `dspy.Signature`, add `InputField`/`OutputField` with `desc=` hints
- Typed fields: annotate with `list[str]`, `bool`, Pydantic models for structured output
- Multiple outputs: declare several `OutputField`s; ChainOfThought adds a `reasoning` field automatically

### Built-in modules
- `dspy.Predict(sig)`: single LM call
- `dspy.ChainOfThought(sig)`: prepends a `reasoning` field
- `dspy.ProgramOfThought(sig)`: generates and executes Python to answer
- `dspy.ReAct(sig, tools=[...])`: tool-using agent loop
- `dspy.MultiChainComparison`: samples N CoT traces and picks the best

### Composing programs
```python
class RAG(dspy.Module):
    def __init__(self, k=5):
        self.retrieve = dspy.Retrieve(k=k)
        self.generate = dspy.ChainOfThought("context, question -> answer")
    def forward(self, question):
        ctx = self.retrieve(question).passages
        return self.generate(context=ctx, question=question)
```

### Optimizers
- `BootstrapFewShot(metric=m, max_bootstrapped_demos=4)`: generates demos by running the teacher on the trainset and keeping ones that pass the metric
- `BootstrapFewShotWithRandomSearch`: searches over demo subsets
- `MIPROv2(metric=m, auto="light"|"medium"|"heavy")`: jointly optimizes instructions and demos via Bayesian search (the strong default in 2024-2025)
- `COPRO`: rewrites instructions only, no demos
- `BootstrapFinetune`: distills the compiled program into a smaller fine-tuned LM

```python
from dspy.teleprompt import MIPROv2
optimizer = MIPROv2(metric=my_metric, auto="medium")
compiled = optimizer.compile(RAG(), trainset=trainset, valset=valset)
compiled.save("rag.json")
```

### Evaluation
```python
from dspy.evaluate import Evaluate
evaluator = Evaluate(devset=devset, metric=my_metric, num_threads=8, display_progress=True)
score = evaluator(compiled)
```

### LM configuration
- `dspy.LM("openai/gpt-4o-mini")`, `dspy.LM("anthropic/claude-sonnet-4-5")`, `dspy.LM("ollama_chat/llama3.1:8b", api_base="http://localhost:11434")`
- `dspy.configure(lm=lm, rm=retriever)` sets process-wide defaults
- `with dspy.context(lm=other_lm): ...` scopes a different model

## Common pitfalls
- Metrics must return a number or bool; returning `None` silently drops examples from optimizer scoring
- `BootstrapFewShot` needs enough trainset diversity to find passing traces; start with 50-200 examples
- MIPROv2 makes many API calls during compilation (budget hundreds to thousands); use `auto="light"` first to sanity-check
- Forgetting to `dspy.configure(lm=...)` produces confusing `No LM is loaded` errors
- Compiled programs are JSON of demos + instructions, not weights; reload with `program.load("path.json")` against the same class
- Output field descriptions are part of the prompt; vague descs hurt quality even after optimization

## Reference
- Official docs: https://dspy.ai
- GitHub: https://github.com/stanfordnlp/dspy
- MIPROv2 paper: https://arxiv.org/abs/2406.11695
- Related: [[pydantic-ai-agents]], [[crewai-agents]], [[ollama-local-llm]]
