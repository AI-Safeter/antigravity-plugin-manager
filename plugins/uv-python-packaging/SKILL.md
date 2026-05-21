---
name: uv-python-packaging
description: 'Astral''s uv, a single high-speed Python package and project manager that replaces pip, pip-tools, pipx, poetry, pyenv, virtualenv, and twine. Use this skill when initializing a Python project, authoring pyproject.toml, managing dependencies with uv add/remove/lock/sync, pinning Python versions with uv python, running scripts with PEP 723 inline metadata, building or publishing wheels, or migrating from Poetry/pip-tools. Triggers: uv, uv add, uv sync, uv lock, uv run, uv pip, uv python install, uv tool, uv init, uv build, uv publish, PEP 723, astral, ruff sibling, Python project manager.'
---

# uv

uv is a Python package and project manager written in Rust by Astral (makers of Ruff). It is roughly 10–100x faster than pip/Poetry for installs and resolves, has a global content-addressable cache with hardlinks, manages Python interpreter installs itself, supports PEP 723 inline-script metadata, and replaces the combined functionality of pip, pip-tools, pipx, poetry, pyenv, virtualenv, twine, and venv. Since uv 0.4 it is production-ready for both library and application workflows.

## Use this skill when

- Starting a new Python project (`uv init`) or migrating from Poetry/pip-tools/Pipenv
- Authoring `pyproject.toml` (`[project]`, `[tool.uv]`, `[tool.uv.sources]`)
- Adding, removing, or upgrading dependencies (`uv add`, `uv remove`, `uv lock --upgrade`)
- Installing and pinning Python versions (`uv python install 3.12`, `.python-version` file)
- Running ad-hoc scripts with embedded deps via PEP 723 (`uv run script.py`)
- Building or publishing distributions (`uv build`, `uv publish`)
- Replacing `pipx` for global CLI tools (`uv tool install ruff`)
- Caching the uv store in CI

## Do not use this skill when

- The project must use Poetry or pip for organizational reasons (see [[poetry-python]])
- You're maintaining a system Python install where you cannot introduce a new tool

## Core concepts

uv has two layers. The **project interface** (`uv add`, `uv sync`, `uv run`, `uv lock`) is Poetry-like and operates on `pyproject.toml` + `uv.lock`. The **pip-compatible interface** (`uv pip install`, `uv pip compile`, `uv venv`) is a drop-in for pip workflows and operates on whatever venv is active. Use the project interface for new code; use the pip interface for migrations and ad-hoc tasks. A global cache at `~/.cache/uv` deduplicates wheels across all projects.

## Quick start

```bash
# Install (no Python needed first — uv can manage Python itself)
curl -LsSf https://astral.sh/uv/install.sh | sh

# New project
uv init my-app
cd my-app
uv add requests "fastapi>=0.115"
uv add --dev pytest ruff
uv run python -m my_app          # auto-creates .venv, installs, runs

# Pin Python
uv python install 3.12
uv python pin 3.12               # writes .python-version
```

Minimal `pyproject.toml` (uv-managed project):

```toml
[project]
name = "my-app"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["requests>=2.32", "fastapi>=0.115"]

[dependency-groups]
dev = ["pytest>=8", "ruff>=0.6"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

## Key patterns

### Dependency groups (PEP 735)
uv supports the standardized `[dependency-groups]` table for dev/test/docs deps. Install with `uv sync --group dev` or `uv sync --all-groups`. The legacy `[project.optional-dependencies]` (extras) still works and ships in published wheels; groups are for local-only deps.

### Lockfile
`uv lock` produces a cross-platform `uv.lock`. `uv sync` makes the venv exactly match the lock (removes extraneous packages — set `--inexact` to keep them). Commit the lockfile for applications; libraries can also commit it for reproducible dev environments while keeping `pyproject.toml` constraints loose.

### Running scripts with PEP 723
Embed deps in a single file's header:
```python
# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx", "rich"]
# ///
import httpx, rich
rich.print(httpx.get("https://example.com").status_code)
```
Run with `uv run script.py` — uv creates an ephemeral environment, caches it, and runs. No virtualenv setup needed.

### Tools (replacing pipx)
```bash
uv tool install ruff
uv tool install --python 3.12 black
uv tool run pyright src/        # one-off, no install
uv tool list
uv tool upgrade --all
```
Tools live in `~/.local/share/uv/tools/` and are exposed on PATH.

### Sources (git, path, index)
Override where a dep comes from without changing the requirement spec:
```toml
[tool.uv.sources]
my-lib = { git = "https://github.com/me/my-lib", tag = "v1.2.0" }
shared = { path = "../shared", editable = true }
torch = { index = "pytorch-cu124" }

[[tool.uv.index]]
name = "pytorch-cu124"
url = "https://download.pytorch.org/whl/cu124"
explicit = true
```

### Workspaces (monorepos)
```toml
[tool.uv.workspace]
members = ["packages/*"]
```
Each member has its own `pyproject.toml`; `uv sync` from the root installs all members editable.

### Building and publishing
```bash
uv build              # produces dist/*.whl and dist/*.tar.gz
uv publish            # uploads to PyPI (uses UV_PUBLISH_TOKEN or keyring)
uv publish --index testpypi
```

## Common pitfalls

- **Two interfaces, easy to mix** — `uv pip install foo` does NOT update `pyproject.toml` or `uv.lock`. Use `uv add foo` for project deps; reserve `uv pip` for legacy/pip-only flows.
- **Editing `pyproject.toml` by hand without `uv lock`** — the lock won't update until you run `uv lock` or `uv sync`. `uv add` does both.
- **`requires-python` too loose** — uv resolves against the lower bound. If you say `>=3.9` but use `match` statements, runtime fails on 3.9. Keep `requires-python` tight.
- **`uv run` ignores active venv** — uv always uses the project's `.venv` (or creates one). Activating another venv first does nothing. Use `uv run --no-project` to use the current env.
- **Cache vs project venv hardlinks on different filesystems** — uv falls back to copy when hardlinks aren't possible (e.g. cache on / and project on a mounted volume). Slows installs but doesn't break.
- **`UV_INDEX_URL` deprecated** — modern config uses `[[tool.uv.index]]` tables. Multiple env-style `UV_EXTRA_INDEX_URL` still works for compatibility.
- **Publishing without a `build-system`** — `uv build` needs a build backend declared (`hatchling`, `setuptools`, etc.) in `pyproject.toml`. uv does not bring its own.
- **Lockfile churn on different platforms** — `uv.lock` is cross-platform by design (resolves for all declared platforms). If churn appears across machines, check `[tool.uv] environments` constraints and that everyone uses the same uv version.

## Reference

- Official docs: https://docs.astral.sh/uv/
- Project guide: https://docs.astral.sh/uv/guides/projects/
- PEP 723 (inline script metadata): https://peps.python.org/pep-0723/
- PEP 735 (dependency groups): https://peps.python.org/pep-0735/
- Related: [[poetry-python]] (the tool uv most often replaces)
