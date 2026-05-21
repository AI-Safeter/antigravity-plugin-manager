---
name: llama-cpp-inference
description: llama.cpp for portable LLM inference across CPU, Apple Metal, CUDA, ROCm, and Vulkan using GGUF model files. Use this skill when running models with `llama-cli` or `llama-server`, choosing GGUF quantizations (Q4_K_M, Q5_K_M, Q6_K, Q8_0, IQ-quants), tuning `-ngl`/`-c`/`-t`, applying grammar-constrained sampling (GBNF), or using the Python binding `llama-cpp-python` and its OpenAI-compatible server.
---

# llama.cpp Inference

llama.cpp is a C/C++ inference engine for transformer LLMs that runs the same GGUF weights across CPU, Apple Metal, NVIDIA CUDA, AMD ROCm, and Vulkan. It is the upstream of Ollama and LM Studio and the reference implementation for the GGUF format. Use it directly when you need fine control over quantization, sampling, grammar-constrained decoding, or hardware offload that higher-level wrappers do not expose.

## Use this skill when
- Running a GGUF model on CPU, Metal, CUDA, or ROCm with `llama-cli` or `llama-server`
- Selecting a quantization (Q4_K_M, Q5_K_M, Q6_K, Q8_0, IQ4_XS, IQ2_XXS) for a given RAM/VRAM budget
- Hosting an OpenAI-compatible endpoint with `llama-server`
- Constraining output with GBNF grammars (`--grammar` or `--json-schema`)
- Converting Hugging Face checkpoints to GGUF with `convert_hf_to_gguf.py`
- Using `llama-cpp-python` to embed inference in a Python app

## Do not use this skill when
- You need maximum GPU throughput for many concurrent users (use vLLM)
- You want a single click install with a model registry (use Ollama)
- You are training or fine-tuning (use PyTorch + TRL/Axolotl)

## Core concepts
GGUF is a single-file format containing weights, tokenizer, and metadata, designed for memory-mapped loading. llama.cpp loads the file via `mmap` and offloads up to `-ngl` (number of GPU layers) onto an accelerator while keeping the rest on CPU. The `-c` context size determines KV cache allocation; `-t` controls CPU threads. Quantizations come in K-quants (Q*_K_*) and newer importance-matrix quants (IQ*) which trade compute for size.

## Quick start
```bash
# build with CUDA
git clone https://github.com/ggml-org/llama.cpp && cd llama.cpp
cmake -B build -DGGML_CUDA=ON && cmake --build build -j --config Release

# download a GGUF and chat
huggingface-cli download bartowski/Meta-Llama-3.1-8B-Instruct-GGUF \
  Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf --local-dir ./models

./build/bin/llama-cli -m ./models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf \
  -ngl 99 -c 8192 -p "Explain GGUF in one paragraph."

# OpenAI-compatible server
./build/bin/llama-server -m ./models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf \
  -ngl 99 -c 8192 --host 0.0.0.0 --port 8080
```

## Key patterns

### Picking a GGUF quant
- `Q4_K_M`: best general default, ~4.8 bpw, low quality loss
- `Q5_K_M` / `Q6_K`: closer to FP16 at ~5.7 / 6.6 bpw
- `Q8_0`: essentially lossless reference for evaluation
- `IQ4_XS`, `IQ3_M`, `IQ2_XXS`: importance-matrix quants that beat K-quants at the same size but require more compute and an imatrix file
- Rule of thumb: prefer a bigger model at Q4_K_M over a smaller model at Q8_0

### Layer offload and context
- `-ngl 99` puts all layers on GPU; set lower if VRAM is tight
- `-c N` sets context window; KV cache size scales with `N x num_layers x hidden_dim`
- `--no-mmap` to fully load into RAM (lower latency on cold start, higher initial RSS)
- `--flash-attn` enables FlashAttention on CUDA and Metal
- `-ctk q8_0 -ctv q8_0` quantizes the KV cache to save memory

### llama-server endpoints
- `/completion` for native streaming completion
- `/v1/chat/completions` for OpenAI-compatible chat
- `/v1/embeddings` when started with `--embeddings`
- Built-in web UI at `http://localhost:8080`
- `--parallel N` enables N concurrent slots; `--cont-batching` interleaves them

### Grammar-constrained sampling
```bash
# JSON-only output via JSON schema
./build/bin/llama-cli -m model.gguf -p "List 3 cities as JSON" \
  --json-schema '{"type":"array","items":{"type":"string"},"minItems":3,"maxItems":3}'

# arbitrary GBNF grammar
./build/bin/llama-cli -m model.gguf --grammar 'root ::= "yes" | "no"' -p "Is the sky blue?"
```

### llama-cpp-python
```python
from llama_cpp import Llama
llm = Llama(
    model_path="./models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    n_gpu_layers=-1, n_ctx=8192, flash_attn=True,
)
out = llm("Q: 2+2?\nA:", max_tokens=32, stop=["\n"])
print(out["choices"][0]["text"])
# OpenAI-compatible server
# python -m llama_cpp.server --model ... --n_gpu_layers -1
```

## Common pitfalls
- Mixing `-ngl` higher than the actual number of layers wastes no memory but masks errors when the model has fewer layers than expected; check `llm_load_print_meta` output
- KV cache OOM at long contexts is silent on CPU; watch RSS or use `-ctk q8_0 -ctv q8_0`
- Chat templates differ per model; pass `--chat-template llama3` or rely on the embedded template in the GGUF
- `convert_hf_to_gguf.py` requires the original tokenizer files; do not delete them after download
- `IQ*` quants need an imatrix file generated from a calibration corpus; do not quantize blindly with `llama-quantize` without one for IQ formats
- The `make` build is deprecated; use the `cmake` build for all platforms

## Reference
- Official repo: https://github.com/ggml-org/llama.cpp
- GGUF spec: https://github.com/ggml-org/ggml/blob/master/docs/gguf.md
- Server docs: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- Related: [[ollama-local-llm]], [[vllm-serving]]
