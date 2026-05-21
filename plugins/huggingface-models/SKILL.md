---
name: huggingface-models
description: Use models, datasets, and tooling from the Hugging Face Hub with Transformers 4.40+. Covers AutoTokenizer/AutoModel/pipeline, model cards, the datasets library, the Inference API and Inference Endpoints, accelerate for multi-GPU, quantization with bitsandbytes/AWQ/GPTQ, and the modern hf CLI from huggingface_hub.
---

# Hugging Face Models and Hub

The Hugging Face ecosystem has three layers worth keeping distinct: the **Hub** (the registry of models, datasets, and Spaces), **`transformers`** (the runtime for loading and running models), and a constellation of supporting libraries (`datasets`, `accelerate`, `peft`, `bitsandbytes`, `huggingface_hub`). Transformers 4.40+ standardized on the `Auto*` classes, the `pipeline` API, and `from_pretrained(..., device_map="auto")` for transparent multi-GPU placement.

## Use this skill when

- Loading a model from the Hub for inference, fine-tuning, or evaluation
- Picking between full-precision, 8-bit, 4-bit, AWQ, or GPTQ quantization for a given GPU
- Streaming a model across multiple GPUs (or GPU + CPU offload) with `accelerate`
- Preparing or streaming a dataset with `datasets.load_dataset`
- Pushing a model, tokenizer, or dataset to the Hub with the `hf` CLI
- Calling a hosted model via the Inference API or a dedicated Inference Endpoint

## Do not use this skill when

- You only need a vendor API (OpenAI, Anthropic) — no need to involve Transformers
- You are training from scratch at scale where Megatron-LM, NeMo, or torchtitan fit better
- You need the absolute lowest-latency inference on a single model — vLLM, TGI, or TensorRT-LLM are usually faster than raw `transformers`

## Core concepts

- **Auto classes**: `AutoTokenizer.from_pretrained(repo_id)`, `AutoModelForCausalLM.from_pretrained(repo_id)`, `AutoModelForSequenceClassification`, etc. They dispatch to the right architecture based on `config.json`.
- **`pipeline`**: highest-level API. `pipe = pipeline("text-generation", model="meta-llama/Llama-3.1-8B-Instruct")` handles tokenization, generation, and decoding. Use for prototyping; drop down for control.
- **Model cards**: the `README.md` in every repo. Read it — it documents license, intended use, training data, and known limitations. License (Apache-2.0, MIT, Llama Community, Gemma) drives whether you can ship.
- **`device_map="auto"`**: `accelerate` inspects available GPUs/CPU and shards model weights to fit. Combine with `torch_dtype=torch.bfloat16` on Ampere+ GPUs.
- **Quantization**: `bitsandbytes` for on-the-fly 8-bit/4-bit (`load_in_4bit=True`, `bnb_4bit_compute_dtype=bfloat16`). Pre-quantized AWQ/GPTQ checkpoints load via `AutoModelForCausalLM.from_pretrained` when `autoawq`/`auto-gptq` is installed.
- **`datasets`**: `load_dataset("squad", split="train")` returns a memory-mapped Arrow dataset. Use `streaming=True` for datasets larger than disk.
- **`hf` CLI** (from `huggingface_hub`): replaces the older `huggingface-cli`. `hf auth login`, `hf download repo_id`, `hf upload repo_id path`, `hf repo create`.

## Quick start

```python
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import torch

model_id = "meta-llama/Llama-3.1-8B-Instruct"
tok = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    torch_dtype=torch.bfloat16,
    device_map="auto",
)

messages = [
    {"role": "system", "content": "You are concise."},
    {"role": "user", "content": "Summarize the transformer architecture in two sentences."},
]
inputs = tok.apply_chat_template(messages, return_tensors="pt", add_generation_prompt=True).to(model.device)
out = model.generate(inputs, max_new_tokens=200, do_sample=False)
print(tok.decode(out[0][inputs.shape[1]:], skip_special_tokens=True))
```

```python
# 4-bit quantization on a single 24GB GPU
from transformers import BitsAndBytesConfig
bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
)
model = AutoModelForCausalLM.from_pretrained(model_id, quantization_config=bnb, device_map="auto")
```

```python
# Dataset streaming
from datasets import load_dataset
ds = load_dataset("HuggingFaceFW/fineweb", split="train", streaming=True)
for row in ds.take(5):
    print(row["text"][:120])
```

## Key patterns

- **Pin model revisions**: `from_pretrained(repo_id, revision="<commit-sha>")`. Hub repos can be rewritten; pinning makes runs reproducible.
- **Use `bfloat16` on Ampere+ (A100, H100, RTX 30/40)** for inference and most training. Avoid `float16` on long-context generation — it underflows.
- **Apply the chat template, do not concatenate strings by hand.** `tok.apply_chat_template(messages, add_generation_prompt=True)` knows the model's special tokens.
- **Use `pipeline` only for one-offs.** For throughput, batch with `model.generate(..., num_return_sequences=...)` or move to vLLM/TGI.
- **`hf download` with `--local-dir`** to mirror a repo to a known path. Combine with `HF_HUB_OFFLINE=1` to lock down where weights come from in CI.
- **Authenticate via env var**: `HF_TOKEN=hf_...` is read by every library. Avoid putting tokens in code; rotate via `hf auth`.

## Common pitfalls

- **Loading without `device_map`** puts the entire model on CPU and silently runs at 1/100th the speed. Always specify a device.
- **Forgetting the chat template** for instruct models. Llama, Qwen, and Mistral instruct variants will produce gibberish when fed raw prompts.
- **Mixing `bitsandbytes` and `accelerate` versions** that disagree. When in doubt, install matching releases (`pip install -U transformers accelerate bitsandbytes`).
- **Treating `pipeline` as a production interface.** It re-tokenizes, re-encodes, and has no continuous batching. For production, use vLLM or Text Generation Inference (TGI).
- **Ignoring `trust_remote_code=True`**. Some repos ship custom modeling code that runs on load. Read the code first, prefer audited mirrors when possible.
- **License blind spots**: Llama 3.1, Gemma, and Qwen have model-family licenses with use restrictions. Apache-2.0 / MIT / Llama 3 Community / Gemma Terms are not interchangeable.
- **Downloading 70B-class weights to a small disk**. Use `HF_HOME` to point the cache at a large volume before the first `from_pretrained` call.

## Reference

- Transformers docs: https://huggingface.co/docs/transformers/index
- Hub: https://huggingface.co/docs/hub/index
- Datasets: https://huggingface.co/docs/datasets/index
- Accelerate: https://huggingface.co/docs/accelerate/index
- PEFT (LoRA, QLoRA): https://huggingface.co/docs/peft/index
- huggingface_hub (CLI + Python): https://huggingface.co/docs/huggingface_hub/index
- Inference Endpoints: https://huggingface.co/docs/inference-endpoints/index
