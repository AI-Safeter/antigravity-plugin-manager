---
name: cuda-gpu-programming
description: NVIDIA CUDA programming for GPU kernels in CUDA C++, PyCUDA, Numba, and CuPy. Use this skill when writing kernels with thread/block/grid indexing, using the memory hierarchy (global, shared, constant, registers, L1/L2), launching with `<<<grid,block>>>`, synchronizing with `__syncthreads()` or cooperative groups, compiling with `nvcc`, profiling with Nsight Systems/Compute, or choosing between raw CUDA, PyCUDA, Numba `@cuda.jit`, and CuPy.
---

# CUDA GPU Programming

CUDA is NVIDIA's parallel programming model and toolchain for writing kernels that execute across thousands of GPU threads. The programmer organizes threads into a 1-3D grid of blocks, where each block is a 1-3D arrangement of threads that share a fast on-chip shared memory and can synchronize. Performance comes from exploiting the memory hierarchy, keeping warps active, and avoiding divergence.

## Use this skill when
- Writing a custom CUDA C++ kernel and launching it with `kernel<<<grid, block>>>(args)`
- Indexing threads via `threadIdx`, `blockIdx`, `blockDim`, `gridDim`
- Using `__shared__` memory for tile-based algorithms (matmul, stencil, reduction)
- Synchronizing with `__syncthreads()` or cooperative groups
- Choosing between raw CUDA C++, PyCUDA, Numba `@cuda.jit`, and CuPy
- Compiling with `nvcc`, setting `-arch=sm_XX`, or building with CMake's `CUDA` language
- Profiling with `nsys` (Nsight Systems) and `ncu` (Nsight Compute)

## Do not use this skill when
- You only need high-level GPU ops (use PyTorch / CuPy / JAX directly)
- You are targeting AMD GPUs (use HIP/ROCm) or Apple Silicon (use Metal)
- You need a managed inference engine (use vLLM or llama.cpp)

## Core concepts
A kernel is launched with an execution configuration `<<<grid, block>>>`. Threads in the same block run on the same Streaming Multiprocessor (SM) and can share `__shared__` memory and synchronize. Threads execute in groups of 32 called warps; branches that diverge inside a warp serialize. The memory hierarchy from fastest to slowest is: registers (per thread), shared memory and L1 (per block, ~tens of KB), L2 (per device, MBs), global memory (GB, high latency). Coalesced global access (consecutive threads read consecutive addresses) is essential for bandwidth.

## Quick start
```cuda
// saxpy.cu : y = a*x + y
#include <cuda_runtime.h>
#include <cstdio>

__global__ void saxpy(int n, float a, const float* x, float* y) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) y[i] = a * x[i] + y[i];
}

int main() {
    int n = 1 << 20;
    float *dx, *dy;
    cudaMalloc(&dx, n*sizeof(float));
    cudaMalloc(&dy, n*sizeof(float));
    // ... fill dx, dy ...
    int block = 256;
    int grid  = (n + block - 1) / block;
    saxpy<<<grid, block>>>(n, 2.0f, dx, dy);
    cudaDeviceSynchronize();
    cudaFree(dx); cudaFree(dy);
}
```
Compile: `nvcc -O3 -arch=sm_90 saxpy.cu -o saxpy` (use `sm_80` for A100, `sm_89` for L40S, `sm_90` for H100, `sm_120` for Blackwell).

## Key patterns

### Indexing
- 1D: `int i = blockIdx.x*blockDim.x + threadIdx.x;`
- 2D: `int x = blockIdx.x*blockDim.x + threadIdx.x; int y = blockIdx.y*blockDim.y + threadIdx.y;`
- Always bounds-check; grid size is typically rounded up

### Shared memory tiling
```cuda
__global__ void matmul_tiled(const float* A, const float* B, float* C, int N) {
    __shared__ float As[16][16], Bs[16][16];
    int tx = threadIdx.x, ty = threadIdx.y;
    int row = blockIdx.y*16 + ty, col = blockIdx.x*16 + tx;
    float acc = 0.f;
    for (int t = 0; t < N/16; ++t) {
        As[ty][tx] = A[row*N + t*16 + tx];
        Bs[ty][tx] = B[(t*16 + ty)*N + col];
        __syncthreads();
        for (int k = 0; k < 16; ++k) acc += As[ty][k] * Bs[k][tx];
        __syncthreads();
    }
    C[row*N + col] = acc;
}
```

### Cooperative groups (CUDA 9+)
```cuda
#include <cooperative_groups.h>
namespace cg = cooperative_groups;
__global__ void reduce(float* x) {
    auto block = cg::this_thread_block();
    auto warp  = cg::tiled_partition<32>(block);
    float v = x[block.thread_rank()];
    v = cg::reduce(warp, v, cg::plus<float>{});
    if (warp.thread_rank() == 0) atomicAdd(&x[0], v);
}
```

### Memory transfers and streams
- `cudaMemcpy(dst, src, n, cudaMemcpyHostToDevice)` is synchronous
- `cudaMemcpyAsync(..., stream)` overlaps with kernels on the same stream
- Use `cudaMallocAsync` / `cudaFreeAsync` with a stream-ordered allocator
- Pinned host memory (`cudaMallocHost`) doubles H2D bandwidth

### Python entry points
- PyCUDA: `SourceModule("__global__ void k(...){}")` then `mod.get_function("k")(arg, block=(256,1,1), grid=(N//256,1))`
- Numba: `@cuda.jit` on a Python function, `kernel[blocks, threads](x, y)`; supports `cuda.shared.array(...)`
- CuPy: high-level ndarray with raw kernel via `cupy.RawKernel(src, "name")`; usually you reach for fused ops instead
- PyTorch: write a CUDA extension via `torch.utils.cpp_extension.load(...)` or `tcnn`/Triton for higher abstraction

### Profiling
- `nsys profile --stats=true ./app` for timeline and kernel summary
- `ncu --set full ./app` for occupancy, memory throughput, warp stalls
- `cudaEventRecord` + `cudaEventElapsedTime` for ad-hoc timing
- Target: high SM occupancy AND high memory throughput; either alone is not enough

## Common pitfalls
- Forgetting `cudaDeviceSynchronize()` before reading errors hides async failures; check `cudaGetLastError()` after each launch
- Non-coalesced global access (strided or transposed) can cut bandwidth by 8-32x; restructure or use shared memory
- `__syncthreads()` inside a divergent `if` is undefined; sync the whole block uniformly
- Atomic operations on global memory serialize; reduce in shared memory first, then one atomic per block
- Wrong `-arch=sm_XX` produces PTX that runs but skips fast instructions (e.g. Tensor Core ops); always target the deployed GPU
- Mixing host and device pointers in the same `cudaMemcpy` direction silently corrupts memory
- Register pressure spills to local memory (which lives in global); check `ncu` for `local_load`/`local_store`

## Reference
- CUDA C++ Programming Guide: https://docs.nvidia.com/cuda/cuda-c-programming-guide/
- Best Practices Guide: https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/
- Nsight Compute: https://docs.nvidia.com/nsight-compute/
- Related: [[vllm-serving]], [[llama-cpp-inference]]
