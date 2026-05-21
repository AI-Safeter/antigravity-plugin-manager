---
name: gitlab-ci-pipelines
description: Design GitLab CI/CD pipelines with stages, rules, caching, artifacts, includes/extends, parent-child pipelines, environments, and monorepo patterns. Use when authoring or refactoring .gitlab-ci.yml, debugging rules vs only/except, tuning cache hit rates, or splitting a large pipeline into reusable components.
---

# GitLab CI Pipelines

A GitLab pipeline is a directed graph of jobs grouped into stages, defined in `.gitlab-ci.yml` at the repo root (or pulled in via `include:`). Jobs run on runners, share state through `cache:` and `artifacts:`, and gate on `rules:` expressions evaluated against pipeline variables. The mental model: stages are sequential by default, jobs in a stage are parallel, and `needs:` turns the whole thing into a DAG.

## Use this skill when
- Authoring a new `.gitlab-ci.yml` or refactoring an unwieldy one
- Replacing `only:`/`except:` with modern `rules:` expressions
- Speeding up pipelines with cache keys, dependency proxies, and `needs:` DAGs
- Splitting a monorepo pipeline into parent/child or component pipelines
- Wiring environments, manual approvals, and deployment gates
- Pulling shared CI templates with `include:` and `extends:`

## Do not use this skill when
- The host is GitHub Actions, Bitbucket Pipelines, or CircleCI (different syntax)
- You need ChatOps or PR-comment-driven workflows tied to GitHub
- The task is runner administration, not pipeline authoring

## Core concepts

- **Stages and jobs**: `stages: [build, test, deploy]` lists groups; each job declares a `stage:`. Jobs in earlier stages must succeed before later stages start, unless `needs:` overrides the default ordering.
- **`needs:`**: turns the pipeline into a DAG. A job with `needs: [build]` starts as soon as `build` is done, regardless of stage order.
- **`rules:`**: list of conditions; first match wins. Each rule can set `when:` (`always`, `manual`, `never`, `on_success`) and `allow_failure:`. Replaces `only:/except:`, which is now legacy.
- **`cache:` vs `artifacts:`**: cache is best-effort and shared between pipelines by key (dependencies). Artifacts are first-class outputs of a job, pulled by downstream jobs and retained per configuration.
- **`include:` and `extends:`**: `include:` pulls YAML from another file (local, project, remote, or template). `extends:` merges keys from a named job (or hidden `.template`) into the current one.
- **Parent-child and multi-project**: a job can `trigger:` a child pipeline (same repo) or a downstream project pipeline; both can be `strategy: depend` to inherit pass/fail.

## Quick start

```yaml
# .gitlab-ci.yml
stages: [build, test, deploy]

default:
  image: node:20-alpine
  cache:
    key:
      files: [package-lock.json]
    paths: [.npm/]

build:
  stage: build
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build
  artifacts:
    paths: [dist/]
    expire_in: 1 week

test:
  stage: test
  needs: [build]
  script:
    - npm test -- --ci --coverage
  coverage: '/All files\s*\|\s*([\d.]+)/'
  artifacts:
    reports:
      junit: junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

deploy:prod:
  stage: deploy
  needs: [test]
  environment:
    name: production
    url: https://app.example.com
  rules:
    - if: '$CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/'
      when: manual
    - when: never
  script:
    - ./scripts/deploy.sh
```

## Key patterns

- **Modern `rules:`**: replace `only: [main]` with `rules: - if: '$CI_COMMIT_BRANCH == "main"'`. Use `changes:` for path-based triggers and `exists:` for files-based ones. Always end with a default rule (`when: never`) to make intent explicit.
- **Reusable templates**: hide jobs with a leading dot (`.node-base:`) and pull them in with `extends: .node-base`. Combine with `include:` from a central CI project to share across repos.
- **Monorepo selectivity**: `rules: - changes: ['services/api/**/*']` runs a job only when that path changed. For deeper splits, use parent-child pipelines: a top-level `detect` job emits a child YAML, then `trigger: include:` runs it.
- **Cache keys that hit**: key on lockfile content (`key: { files: [package-lock.json] }`). Avoid keying on `$CI_COMMIT_SHA` (per-commit cache, zero hits).
- **Manual deploys with environments**: `environment: { name: staging, url: ... }` plus `when: manual` produces a clickable button in the UI and tracks the deployed ref per environment.
- **DAG with `needs:`**: combine with `parallel: matrix:` to fan out unit tests across language versions and converge on a single `report` job.

## Common pitfalls

- **`rules:` and `only:` together**: defining both on a job is an error since GitLab 14. Pick one (rules) and migrate the rest.
- **Cache pulled but not pushed**: `policy: pull` means a job reads but does not update cache. The first job in the pipeline should use the default `pull-push` (or `push` only) to populate it.
- **Artifacts auto-fetched by every later job**: by default, downstream jobs download all upstream artifacts. Use `dependencies: []` or `needs: { job: x, artifacts: false }` to suppress when not needed.
- **Variable expansion in `rules:if`**: only string comparisons; you cannot call functions. Compose complex logic in a script and exit with a known status instead.
- **Child pipeline `strategy:`**: without `strategy: depend`, the parent passes even if the child failed. Almost always set it.
- **`include:` cycles**: an included file that includes the includer fails with a cryptic error. Keep templates one-directional.
- **Runner tag mismatch**: jobs requiring a specific runner (`tags: [docker]`) hang forever if no runner with that tag is online. Check the project's runner list before adding new tags.

## Reference
- https://docs.gitlab.com/ee/ci/yaml/
- https://docs.gitlab.com/ee/ci/yaml/rules.html
- https://docs.gitlab.com/ee/ci/caching/
- https://docs.gitlab.com/ee/ci/pipelines/parent_child_pipelines.html
- https://docs.gitlab.com/ee/ci/environments/
