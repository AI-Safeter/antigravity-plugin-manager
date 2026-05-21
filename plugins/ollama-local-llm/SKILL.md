---
name: ollama-local-llm
description: Ollama for running open-source large language models locally on Mac, Linux, and Windows. Use this skill when setting up local LLM inference, pulling models like Llama 3.1, Qwen2.5, DeepSeek-R1, or Mistral, writing Modelfiles, calling the OpenAI-compatible API at localhost:11434, choosing quantization levels (Q4_K_M, Q5_K_M, Q8_0, FP16), or integrating Ollama with LangChain, LlamaIndex, LiteLLM, or Open WebUI.
---

# Ollama Local LLM

Ollama is a self-contained runtime built on llama.cpp that pulls quantized GGUF models from a registry and serves them through a REST API and an OpenAI-compatible endpoint. It targets developers who want a single binary to run open weights locally without managing Python environments, CUDA toolchains, or model conversion scripts.

## Use this skill when
- Running Llama, Qwen, DeepSeek, Mistral, Gemma, or Phi models on a laptop or workstation
- Exposing a local OpenAI-compatible endpoint at `http://localhost:11434/v1`
- Authoring a `Modelfile` to set system prompts, temperature, or `num_ctx`
- Choosing a quantization (Q4_K_M, Q5_K_M, Q8_0, FP16) based on RAM/VRAM
- Wiring Ollama into LangChain, LlamaIndex, LiteLLM, Continue, or Open WebUI
- Debugging `OLLAMA_HOST`, GPU offload, or model storage paths

## Do not use this skill when
- You need production multi-tenant GPU serving with high throughput (use vLLM)
- You need fine-grained control over GGUF quants and sampling grammars (use llama.cpp directly)
- You want hosted inference with autoscaling (use a managed provider)

## Core concepts
Ollama runs a background server (default `127.0.0.1:11434`) and a CLI client. Models are GGUF blobs stored under `~/.ollama/models` and identified by `name:tag`. A `Modelfile` is a Dockerfile-style recipe that layers parameters and prompts on top of a base model. The same daemon answers both the native `/api/generate` and `/api/chat` endpoints and the OpenAI-shaped `/v1/chat/completions`.

## Quick start
```bash
# install (macOS/Linux)
curl -fsSL https://ollama.com/install.sh | sh

# pull and chat
ollama pull llama3.1:8b
ollama run llama3.1:8b "Summarize PagedAttention in one paragraph."

# list / inspect / remove
ollama list
ollama show llama3.1:8b --modelfile
ollama rm llama3.1:8b

# OpenAI-compatible call
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.1:8b","messages":[{"role":"user","content":"hi"}]}'
```

## Key patterns

### Picking a quantization
- `Q4_K_M` is the default sweet spot: ~4.5 bits/weight, minor quality loss, fits 8B in ~5 GB
- `Q5_K_M` for noticeable quality recovery at ~6 GB for 8B
- `Q8_0` near-lossless, ~8.5 GB for 8B, good for evaluation baselines
- `FP16` only when you have the VRAM and want the reference behavior
- Bigger model at lower quant usually beats smaller model at higher quant

### Writing a Modelfile
```
FROM llama3.1:8b
PARAMETER temperature 0.2
PARAMETER num_ctx 8192
PARAMETER num_predict 512
SYSTEM "You are a terse code reviewer. Respond in <=5 bullets."
```
Build with `ollama create reviewer -f Modelfile`, then `ollama run reviewer`.

### Server configuration via env vars
- `OLLAMA_HOST=0.0.0.0:11434` to expose on LAN
- `OLLAMA_MODELS=/data/ollama` to relocate the model store
- `OLLAMA_KEEP_ALIVE=30m` to hold weights resident between requests (`0` unloads immediately, `-1` keeps forever)
- `OLLAMA_NUM_PARALLEL=4` for concurrent requests per model
- `OLLAMA_MAX_LOADED_MODELS=2` to cap RAM pressure when multiple models are warm
- `OLLAMA_FLASH_ATTENTION=1` for supported GPUs

### Integration glue
- LangChain: `from langchain_ollama import ChatOllama; ChatOllama(model="llama3.1:8b")`
- LlamaIndex: `from llama_index.llms.ollama import Ollama; Ollama(model="qwen2.5:14b")`
- LiteLLM: `litellm.completion(model="ollama/llama3.1:8b", api_base="http://localhost:11434")`
- Any OpenAI SDK: point `base_url` to `http://localhost:11434/v1` and use any string for `api_key`

### Embeddings and structured output
- `ollama pull nomic-embed-text` then POST to `/api/embeddings` with `{"model":"nomic-embed-text","prompt":"..."}`
- JSON mode: pass `"format":"json"` on `/api/chat` or use a `format` JSON schema (Ollama 0.5+) for constrained decoding

## Common pitfalls
- Pulling without a tag (`ollama pull llama3.1`) silently grabs `:latest`, which can change; always pin a tag like `llama3.1:8b-instruct-q4_K_M`
- Context window defaults to 2048 tokens regardless of model max; raise with `PARAMETER num_ctx` or `options.num_ctx`
- The OpenAI endpoint ignores `max_tokens` if it conflicts with `num_predict`; set both consistently
- Apple Silicon ignores `CUDA_VISIBLE_DEVICES`; use Metal automatically but check `ollama ps` for `100% GPU`
- `~/.ollama/models` can fill a small root disk fast; move with `OLLAMA_MODELS` before pulling large models
- Closing the terminal does not stop the daemon on macOS/Linux service installs; use `systemctl stop ollama` or quit the menubar app

## Reference
- Official docs: https://github.com/ollama/ollama/tree/main/docs
- Model library: https://ollama.com/library
- OpenAI compatibility: https://github.com/ollama/ollama/blob/main/docs/openai.md
- Related: [[llama-cpp-inference]], [[vllm-serving]]
