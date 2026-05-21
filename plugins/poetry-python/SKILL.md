---
name: poetry-python
description: 'Poetry for Python dependency management, virtualenvs, builds, and publishing using a pyproject.toml-based workflow. Use this skill when initializing a Python project with poetry init, authoring [tool.poetry] tables, adding/locking deps with poetry add/lock/install, managing groups (dev/test), configuring poetry.lock, publishing wheels to PyPI, or migrating to/from pip/uv. Triggers: poetry, poetry add, poetry install, poetry lock, poetry shell, poetry run, poetry publish, poetry build, pyproject.toml poetry, poetry.lock, poetry groups, poetry.toml, python project manager poetry.'
---

# Poetry

Poetry is a Python dependency manager and packaging tool that consolidates virtualenv management, dependency resolution, lockfile generation, build, and publish into one CLI. It uses `pyproject.toml` as the single source of truth (with a Poetry-specific `[tool.poetry]` table, plus the PEP 621 `[project]` table since Poetry 2.0). Poetry is the mature, stable choice; uv is the faster newer alternative. Pick based on team familiarity and whether speed matters more than ecosystem maturity.

## Use this skill when

- Starting a new Python project with `poetry new` or `poetry init`
- Authoring or editing `pyproject.toml` for a Poetry-managed project
- Adding or upgrading deps (`poetry add`, `poetry add --group dev`, `poetry update`)
- Managing virtualenvs (`poetry shell`, `poetry env use 3.12`)
- Building and publishing packages (`poetry build`, `poetry publish`)
- Diagnosing solver errors, lockfile drift, or `poetry install` failures
- Configuring private indexes or repositories (`poetry config repositories.foo`)

## Do not use this skill when

- Speed is critical and the team is open to migrating — see [[uv-python-packaging]]
- The project already uses pip + `requirements.txt` and there's no payoff in adopting Poetry
- You need a polyglot build tool (Poetry is Python-only)

## Core concepts

Poetry resolves dependencies into a lockfile (`poetry.lock`) using a SAT-style solver and creates an isolated virtualenv per project (by default in `~/.cache/pypoetry/virtualenvs`, or in-project with `poetry config virtualenvs.in-project true`). It implements PEP 517/518 as a build backend (`poetry-core`) so any PEP 517-compatible tool (including pip and uv) can build a Poetry project. Poetry 2.0+ supports the standardized `[project]` table; older docs and projects use `[tool.poetry]` exclusively.

## Quick start

```bash
# Install (official)
curl -sSL https://install.python-poetry.org | python3 -

# New project
poetry new my-app           # scaffolds package layout
cd my-app
poetry add requests "fastapi>=0.115"
poetry add --group dev pytest ruff mypy
poetry install              # creates venv + installs
poetry run pytest           # runs inside the venv
poetry shell                # spawn a shell in the venv
```

Minimal `pyproject.toml` (Poetry 1.x style — still the most common in the wild):

```toml
[tool.poetry]
name = "my-app"
version = "0.1.0"
description = ""
authors = ["You <you@example.com>"]
readme = "README.md"
packages = [{ include = "my_app", from = "src" }]

[tool.poetry.dependencies]
python = "^3.11"
requests = "^2.32"
fastapi = "^0.115"

[tool.poetry.group.dev.dependencies]
pytest = "^8.3"
ruff = "^0.6"

[build-system]
requires = ["poetry-core>=1.9.0"]
build-backend = "poetry.core.masonry.api"
```

## Key patterns

### Dependency groups
Groups replace the old `dev-dependencies` section. Install/skip groups:
```bash
poetry install                        # main + default groups
poetry install --with docs            # add an optional group
poetry install --without dev          # exclude
poetry install --only main            # production-only
```
Mark a group optional: `[tool.poetry.group.docs] optional = true`.

### Version constraints
Poetry uses caret `^` and tilde `~` shorthand:
- `^1.2.3` → `>=1.2.3, <2.0.0` (compatible with major)
- `~1.2.3` → `>=1.2.3, <1.3.0` (compatible with minor)
- `1.2.*` → wildcard equivalent
- Exact: `==1.2.3`
- Git/path/url:
```toml
my-lib = { git = "https://github.com/me/my-lib", tag = "v1.0" }
shared = { path = "../shared", develop = true }
```

### Virtualenv location
By default Poetry stores venvs centrally. Many teams prefer in-project venvs so IDEs detect them:
```bash
poetry config virtualenvs.in-project true     # creates .venv/ in project root
poetry config virtualenvs.in-project --unset  # revert
```
Use `poetry env info --path` to find the active venv path.

### Multiple Python versions
```bash
poetry env use 3.12               # use a specific interpreter
poetry env use /path/to/python    # explicit path
poetry env list                   # list envs created for this project
poetry env remove 3.11            # delete an env
```

### Publishing
```bash
poetry build                                          # dist/*.whl, dist/*.tar.gz
poetry config pypi-token.pypi <token>                 # store API token
poetry publish                                        # to PyPI
# TestPyPI
poetry config repositories.testpypi https://test.pypi.org/legacy/
poetry publish -r testpypi
```

### Lockfile workflow
- `poetry lock` — regenerate lock from `pyproject.toml` without installing.
- `poetry lock --no-update` — refresh lock metadata without changing versions (Poetry <2.0).
- `poetry install --sync` — make venv exactly match lock (remove extras).
- Commit `poetry.lock` for applications. Libraries traditionally don't commit it; Poetry 2.0 docs now recommend committing for reproducible dev.

### Private indexes
```toml
[[tool.poetry.source]]
name = "internal"
url = "https://pypi.internal.example.com/simple"
priority = "supplemental"   # or "primary", "explicit", "default"
```
Then `poetry config http-basic.internal <user> <pass>` to store credentials.

## Common pitfalls

- **`poetry shell` removed in 2.0** — Poetry 2.0 removed the bundled `shell` subcommand; install `poetry-plugin-shell` or use `poetry env activate` / `source $(poetry env info --path)/bin/activate`.
- **Slow resolver on first run** — Poetry's solver downloads many wheels to compute dependencies. Mitigations: keep `python` version constraint tight, set `installer.parallel = true` (default), and use a fast index.
- **`^0.x.y` is restrictive** — `^0.2.3` means `>=0.2.3, <0.3.0` because pre-1.0 is treated as unstable. Switch to `>=0.2.3,<0.5` explicitly if you want broader range.
- **In-project `.venv` and Docker** — copying source into a container also copies `.venv`, which is wrong-arch. Add `.venv` to `.dockerignore`.
- **`poetry add` rewrites pyproject formatting** — Poetry preserves comments since 1.5 but can reorder keys. Run formatters consistently.
- **System-managed Python conflicts** — on macOS Homebrew Python or Linux system Python, `poetry env use python3` may pick the wrong interpreter on PATH. Pass the full path or use pyenv/uv-managed Python.
- **Two metadata sources** — Poetry 2.0 allows `[project]` (PEP 621) alongside `[tool.poetry]`. Don't duplicate the same key in both; let one own each field. Mixing causes confusing errors.
- **`develop = true` for local paths** — without it, a path dependency is installed once and cached; edits to the source don't reflect. Always set `develop = true` for in-progress local packages.

## Reference

- Official docs: https://python-poetry.org/docs/
- CLI reference: https://python-poetry.org/docs/cli/
- Dependency specification: https://python-poetry.org/docs/dependency-specification/
- Related: [[uv-python-packaging]] (faster modern alternative)
