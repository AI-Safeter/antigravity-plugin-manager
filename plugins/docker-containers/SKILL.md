---
name: docker-containers
description: Author production-grade Dockerfiles and Compose files. Covers multi-stage builds, BuildKit, image layering, .dockerignore, healthchecks, non-root users, multi-arch images, and image size optimization. Use when writing or reviewing Dockerfile, docker-compose.yml, building container images, debugging large or slow builds, or hardening containers for production.
---

# Docker Containers

Practical guide for writing Dockerfiles and Compose files that build fast, stay small, and run safely. Focuses on BuildKit-era patterns: cache mounts, multi-stage, multi-arch, and least-privilege runtime.

## Use this skill when
- Writing a new `Dockerfile` for a service or CLI
- Shrinking an oversized image or speeding up a slow build
- Adding healthchecks, non-root users, or read-only filesystems
- Setting up `docker compose` for local dev or integration tests
- Producing multi-arch images (linux/amd64 + linux/arm64) for CI
- Auditing an existing image for security and layer bloat

## Do not use this skill when
- The target runtime is a serverless platform that does not accept OCI images
- You need full Kubernetes manifests (use the `kubernetes` skill)
- You only need to install packages on a host machine (no container)

## Core concepts
A Docker image is an ordered stack of read-only layers; each `RUN`, `COPY`, and `ADD` creates a layer. Build cache reuses a layer if its instruction and inputs are unchanged, so order instructions from least-to-most-changing. Multi-stage builds let you compile in a fat image and copy only the artifacts into a minimal runtime image.

## Quick start
```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs20-debian12 AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
USER nonroot
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD ["node","dist/healthcheck.js"]
CMD ["dist/server.js"]
```

## Key patterns

### Multi-stage builds
Separate `build` and `runtime` stages. Compile/transpile in a stage with toolchains (gcc, jdk, node-with-devdeps), then `COPY --from=build` only the binary/artifact into a slim runtime base (`distroless`, `alpine`, `gcr.io/distroless/static`). Cuts image size by 5-50x for compiled languages.

### Layer ordering for cache
Copy dependency manifests first, install, then copy source. Editing `src/main.go` should not re-run `go mod download`.
```dockerfile
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /out/app ./cmd/app
```

### BuildKit cache mounts
Persist package-manager caches across builds without baking them into the image.
```dockerfile
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update && apt-get install -y --no-install-recommends curl
```

### Non-root user
```dockerfile
RUN addgroup -S app && adduser -S -G app app
USER app
```
Or use a distroless `:nonroot` tag which ships with UID 65532.

### Healthcheck
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz || exit 1
```
Compose and Swarm respect this; Kubernetes ignores it (use `livenessProbe` instead).

### Multi-arch with buildx
```bash
docker buildx create --use --name multi
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/org/app:1.2.3 --push .
```

### .dockerignore
Mirror `.gitignore` plus build outputs. Without this, `COPY . .` ships your `.git`, `node_modules`, secrets, and IDE files into the build context.
```
.git
node_modules
dist
*.env
**/__pycache__
```

### Compose for local dev
```yaml
services:
  api:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgres://app:app@db:5432/app
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
```

## Common pitfalls
- **Running as root**: default `USER` is root. Anything that escapes the container runs as host root if `--privileged`. Always set a non-root `USER`.
- **`apt-get install` without cleanup**: leaves `/var/lib/apt/lists` in the layer. Use `--no-install-recommends`, combine into one `RUN`, and `rm -rf /var/lib/apt/lists/*` (or use cache mounts).
- **`COPY . .` before installing deps**: invalidates dependency cache on every source change. Copy manifests first.
- **Using `latest` tag in FROM**: builds are not reproducible. Pin to a specific digest or version, e.g. `node:20.11-alpine@sha256:...`.
- **`ADD` for local files**: `ADD` also handles URLs and auto-extracts tarballs. Use `COPY` unless you need those behaviors.
- **Secrets in build args or ENV**: anything in the image is visible via `docker history`. Use `--mount=type=secret` (BuildKit) for build-time secrets.
- **Setting `WORKDIR` with `RUN cd ...`**: `cd` does not persist between layers. Use `WORKDIR /app`.
- **Missing `EXPOSE` and signal handling**: a Node/Python process started via shell form (`CMD node app.js` as a string) gets PID 1 with no signal forwarding. Use exec form `CMD ["node","app.js"]` or `tini`.

## Reference
- Official docs: https://docs.docker.com/build/
- Dockerfile reference: https://docs.docker.com/reference/dockerfile/
- BuildKit: https://docs.docker.com/build/buildkit/
