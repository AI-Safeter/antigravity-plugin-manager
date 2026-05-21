---
name: vllm-serving
description: vLLM for high-throughput production GPU serving of large language models with PagedAttention and continuous batching. Use this skill when deploying an OpenAI-compatible inference server with `vllm serve`, tuning `--tensor-parallel-size` and `--pipeline-parallel-size` across GPUs, configuring AWQ/GPTQ/FP8 quantization, enabling speculative decoding or prefix caching, or benchmarking throughput and latency for Llama, Qwen, Mixtral, or DeepSeek models.
---

# vLLM Serving

vLLM is a GPU-optimized inference engine from UC Berkeley that uses PagedAttention to manage KV cache in fixed-size blocks and continuous batching to keep the GPU saturated across requests of differing lengths. It ships an OpenAI-compatible HTTP server and a Python `LLM` class, and is the default open-source choice for serving Llama-family, Qwen, Mixtral, DeepSeek, and many other transformer LLMs at production throughput.

## Use this skill when
- Standing up an OpenAI-compatible endpoint with `vllm serve <model>`
- Splitting a model across multiple GPUs via tensor or pipeline parallelism
- Choosing between AWQ, GPTQ, GGUF, FP8, or BF16 weights for a given GPU
- Enabling prefix caching, chunked prefill, or speculative decoding
- Sizing `--max-model-len`, `--gpu-memory-utilization`, and `--max-num-seqs`
- Benchmarking throughput with `vllm bench` or `benchmarks/benchmark_serving.py`
- Debugging OOMs, KV cache exhaustion, or low GPU utilization

## Do not use this skill when
- Running on CPU or Apple Silicon (use llama.cpp or Ollama)
- Serving a single user on a laptop (Ollama is simpler)
- You need fine-tuning or training (use TRL, Axolotl, or DeepSpeed)

## Core concepts
PagedAttention partitions the KV cache into fixed blocks (default 16 tokens) so sequences of different lengths share GPU memory without fragmentation. Continuous batching swaps newly-arrived requests into the running batch at every decoding step, so a long generation does not block short ones. The scheduler tracks `max_num_seqs` (concurrent requests) and `max_num_batched_tokens` (prefill budget per step), and `gpu_memory_utilization` determines what fraction of VRAM is reserved for KV cache after weights load.

## Quick start
```bash
pip install vllm

# OpenAI-compatible server on port 8000
vllm serve meta-llama/Llama-3.1-8B-Instruct \
  --dtype bfloat16 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90

# call it
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"meta-llama/Llama-3.1-8B-Instruct","messages":[{"role":"user","content":"hi"}]}'
```

```python
# offline batch inference
from vllm import LLM, SamplingParams
llm = LLM(model="Qwen/Qwen2.5-7B-Instruct", dtype="bfloat16")
out = llm.generate(["Hello"], SamplingParams(temperature=0.2, max_tokens=128))
print(out[0].outputs[0].text)
```

## Key patterns

### Multi-GPU parallelism
- `--tensor-parallel-size N` shards each layer across N GPUs; N must divide attention heads. Use within a single node connected by NVLink/NVSwitch.
- `--pipeline-parallel-size M` splits layers across M stages; use across nodes or when TP would exceed NVLink bandwidth.
- Example: 2 nodes x 8 H100s for a 405B model: `--tensor-parallel-size 8 --pipeline-parallel-size 2`.

### Quantization
- `--quantization awq` for AWQ weight-only INT4 (e.g. `Qwen/Qwen2.5-72B-Instruct-AWQ`)
- `--quantization gptq` for GPTQ INT4/INT8 checkpoints
- `--quantization fp8` for native FP8 on Hopper/Ada (H100, L40S)
- `--kv-cache-dtype fp8` halves KV memory at a small quality cost; pair with `--calculate-kv-scales` for INT8/FP8 KV
- GGUF is supported but slower than AWQ/GPTQ on GPU; reserve for compatibility

### Throughput tuning
- Raise `--max-num-seqs` (default 256) until GPU compute saturates; lower if you see KV preemption in logs
- `--enable-prefix-caching` reuses KV across requests that share a system prompt (huge win for RAG)
- `--enable-chunked-prefill` interleaves prefill with decode to reduce TTFT under load
- `--speculative-config '{"model":"...","num_speculative_tokens":5}'` for draft-model speculative decoding

### Production endpoints
- Health: `GET /health`, metrics: `GET /metrics` (Prometheus)
- Models list: `GET /v1/models`; expose multiple with `--served-model-name alias1 alias2`
- Authentication: `--api-key sk-...` adds bearer-token auth
- `--disable-log-requests` for noisy production

### Sampling and tool use
- Standard OpenAI params: `temperature`, `top_p`, `top_k`, `frequency_penalty`, `repetition_penalty`
- Structured outputs: `--guided-decoding-backend xgrammar` (default) with `response_format={"type":"json_schema",...}`
- Tool calling: `--enable-auto-tool-choice --tool-call-parser hermes|llama3_json|mistral|granite` depending on model

## Common pitfalls
- `--max-model-len` larger than what fits in remaining VRAM after weights load causes startup failure; lower it or raise `--gpu-memory-utilization` carefully (>0.95 risks OOM during peak)
- AWQ checkpoints encode their group size; do not also pass `--quantization` if the model config already declares it
- Tensor parallel size must divide `num_attention_heads`; Mixtral 8x7B has 32 heads so TP=8 works, TP=6 does not
- Default `dtype` is `auto` which on Ampere picks FP16; force `bfloat16` for Llama/Qwen to match training
- vLLM does not hot-reload models; restart the server to change weights
- Prefix caching is correctness-safe but memory-hungry; disable it if KV preemption rate is high in `/metrics`

## Reference
- Official docs: https://docs.vllm.ai
- Supported models: https://docs.vllm.ai/en/latest/models/supported_models.html
- Performance tuning: https://docs.vllm.ai/en/latest/performance/optimization.html
- Related: [[ollama-local-llm]], [[llama-cpp-inference]], [[cuda-gpu-programming]]
