---
name: pytest-expert
description: Write idiomatic pytest tests with fixtures, parametrize, markers, monkeypatch, tmp_path, and key plugins (pytest-mock, pytest-asyncio, pytest-cov). Use when authoring or refactoring Python tests, structuring conftest.py, debugging fixture scope or finalizer order, or adding coverage gates in CI.
---

# Pytest Expert

Pytest favors plain functions and dependency injection via fixtures over class hierarchies. Most power comes from three primitives: fixtures (setup/teardown with scopes), parametrize (data-driven tests), and plugins (mock, async, coverage, xdist). Mastering fixture scope and `conftest.py` resolution removes most of the "why is my test failing" surprises.

## Use this skill when
- Designing a test layout for a new Python package or service
- Writing or untangling fixtures with non-trivial scope or dependencies
- Parametrising tests with `@pytest.mark.parametrize` or `pytest_generate_tests`
- Mocking with `pytest-mock`, async code with `pytest-asyncio`, or coverage with `pytest-cov`
- Using `monkeypatch`, `tmp_path`, `capsys`, or `caplog` instead of hand-rolled patches
- Splitting tests across markers and selecting subsets in CI

## Do not use this skill when
- You need browser-driven E2E tests (use Playwright or Selenium)
- The project uses `unittest.TestCase` exclusively and cannot adopt fixtures
- You want a property-based testing primer (use Hypothesis docs)

## Core concepts

- **Fixtures**: functions decorated with `@pytest.fixture` that yield setup values; teardown is the code after `yield`.
- **Scope**: `function` (default), `class`, `module`, `package`, `session`. Higher scopes share one instance across more tests; mismatched scope causes leaks between tests.
- **`conftest.py`**: fixtures defined here are auto-discovered by tests in the same directory and below. No imports needed.
- **Markers**: `@pytest.mark.slow`, `@pytest.mark.skip`, `@pytest.mark.xfail`, plus custom markers declared in `pytest.ini` or `pyproject.toml`.
- **Parametrize**: `@pytest.mark.parametrize('a,b,expected', [(1,2,3), (2,3,5)])` generates one test per row. Stack decorators to take the Cartesian product.
- **Built-in fixtures**: `tmp_path` (per-test temp dir), `monkeypatch` (env/attr patching with auto-restore), `capsys`/`capfd` (stdout/stderr), `caplog` (logging records), `request` (introspection).

## Quick start

```ini
# pyproject.toml
[tool.pytest.ini_options]
addopts = "-ra --strict-markers --cov=myapp --cov-report=term-missing"
testpaths = ["tests"]
markers = [
  "slow: marks tests as slow (deselect with '-m \"not slow\"')",
  "integration: requires external services",
]
```

```python
# tests/conftest.py
import pytest
from myapp.db import Database

@pytest.fixture(scope="session")
def db():
    d = Database(":memory:")
    d.migrate()
    yield d
    d.close()

@pytest.fixture
def user(db):
    uid = db.create_user("ada@example.com")
    yield db.get_user(uid)
    db.delete_user(uid)
```

```python
# tests/test_orders.py
import pytest
from myapp import place_order

@pytest.mark.parametrize("qty,price,total", [(1, 10, 10), (3, 7, 21)])
def test_total(user, qty, price, total):
    assert place_order(user, qty, price).total == total

def test_raises_on_zero(user):
    with pytest.raises(ValueError, match="qty must be positive"):
        place_order(user, 0, 10)
```

## Key patterns

- **Factory fixtures**: return a function from the fixture so each test can create configured instances: `@pytest.fixture def make_user(db): def _make(**kw): return db.create_user(**kw); return _make`.
- **Indirect parametrize**: pass parametrize values into a fixture via `indirect=['arg']` to let the fixture interpret each value (useful for "load from file X" cases).
- **`pytest-mock`**: prefer `mocker.patch('pkg.mod.func')` over `unittest.mock.patch` decorators; the `mocker` fixture undoes patches automatically.
- **`pytest-asyncio`**: mark tests with `@pytest.mark.asyncio` (or set `asyncio_mode = "auto"` in config) and declare async fixtures with `@pytest_asyncio.fixture`.
- **`monkeypatch` over global state**: `monkeypatch.setenv('API_KEY', 'x')`, `monkeypatch.setattr(mod, 'now', lambda: fixed_dt)`. Auto-restored at test end.
- **`tmp_path` for files**: returns a `pathlib.Path`. Each test gets a fresh dir; do not write to `cwd` or share `tmp_path` across tests (it changes every run).
- **Strict markers**: enable `--strict-markers` so a typo in a marker name fails fast instead of silently skipping selection.

## Common pitfalls

- **Fixture scope mismatch**: a `function`-scoped fixture depending on a `session`-scoped one is fine; the reverse is not. Pytest will error, but mixing scopes also makes "stale state" bugs likely.
- **Yielding vs returning**: `return` skips teardown. Use `yield` whenever you need cleanup or a finaliser.
- **`autouse=True` everywhere**: convenient but hides dependencies. Reserve for cross-cutting concerns (clock freeze, logging config).
- **Importing `conftest` directly**: `conftest.py` is discovered, not imported. Do not `from conftest import ...`; put shared helpers in a regular module.
- **`assert` rewriting only in test files**: pytest rewrites `assert` for nicer diffs only in files matching `python_files` and inside imported helpers if you register them via `pytest.register_assert_rewrite('mypkg.helpers')`.
- **`pytest.raises` without `match`**: an empty `pytest.raises(ValueError)` passes on any `ValueError`. Always add `match=` for the message you expect.
- **Parallelism surprises**: `pytest-xdist` shares no state between workers. Session-scoped fixtures run once per worker, not once globally.

## Reference
- https://docs.pytest.org/en/stable/
- https://docs.pytest.org/en/stable/how-to/fixtures.html
- https://pytest-mock.readthedocs.io/
- https://pytest-asyncio.readthedocs.io/
- https://pytest-cov.readthedocs.io/
