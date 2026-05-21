---
name: pydantic-v2
description: Pydantic v2 for Python data validation and settings management using type hints. Use this skill when defining BaseModel classes, field validators (@field_validator, @model_validator), model_config (ConfigDict), computed_field, discriminated unions via Field(discriminator=...), TypeAdapter for arbitrary types, RootModel, integrating with FastAPI, or migrating from Pydantic v1 to v2. Triggers on BaseModel, Field, field_validator, model_validator, model_config, model_dump, model_validate, TypeAdapter, or any Python validation task.
---

# Pydantic v2

Pydantic v2 is the Python data-validation library powered by a Rust core (pydantic-core), used by FastAPI, LangChain, and most modern Python services. v2 is a near-complete rewrite of v1 with substantially faster validation, stricter typing, and renamed APIs -- many v1 idioms (`.dict()`, `@validator`, `Config` inner class) are deprecated.

## Use this skill when

- Defining typed request/response models for FastAPI, Litestar, or Django Ninja
- Validating configuration from env vars / .env files (with `pydantic-settings`)
- Parsing untrusted JSON or YAML into typed Python objects
- Modeling discriminated unions / tagged variants of payloads
- Migrating a v1 codebase to v2 (renames, behavior changes)
- Generating JSON Schema from Python types for OpenAPI / LLM tool definitions

## Do not use this skill when

- You need pure dataclasses with no validation (use `@dataclass` or `attrs`)
- You only need runtime type checks without coercion (use `beartype` or `typeguard`)
- You're on Python <3.8 (Pydantic v2 requires 3.8+; v1 may be needed for ancient runtimes)

## Core concepts

A `BaseModel` subclass declares fields with type hints; instantiation validates input and coerces types according to the field. Validators run during validation, not after. Configuration is set via `model_config: ConfigDict = ConfigDict(...)` at class level (not a nested `Config` class as in v1). Methods like `model_dump()`, `model_dump_json()`, `model_validate()`, and `model_validate_json()` replace v1's `.dict()`, `.json()`, `parse_obj()`, `parse_raw()`.

## Quick start

```python
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict

class User(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    id: int
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)
    role: Literal["admin", "member", "guest"] = "member"
    created_at: datetime

    @field_validator("name")
    @classmethod
    def title_case(cls, v: str) -> str:
        return v.title()

u = User.model_validate({"id": 1, "email": "a@b.co", "name": "ada", "created_at": "2025-01-01T00:00:00Z"})
print(u.model_dump())          # dict
print(u.model_dump_json())     # JSON string
```

## Key patterns

### field_validator vs model_validator
- `@field_validator("field", mode="before"|"after")` runs per field. `before` sees raw input, `after` sees the parsed value.
- `@model_validator(mode="before"|"after")` runs on the whole model. Use `after` for cross-field invariants:
```python
@model_validator(mode="after")
def check_passwords(self) -> "Self":
    if self.password != self.confirm:
        raise ValueError("Passwords differ")
    return self
```

### Discriminated unions
Faster, with cleaner errors than untagged unions:
```python
from typing import Annotated, Literal, Union
from pydantic import Field

class Cat(BaseModel):
    kind: Literal["cat"]
    meow_db: int

class Dog(BaseModel):
    kind: Literal["dog"]
    bark_db: int

Pet = Annotated[Union[Cat, Dog], Field(discriminator="kind")]
```

### computed_field
Exposes a derived value as a serialized field:
```python
from pydantic import computed_field

class Box(BaseModel):
    w: float; h: float; d: float
    @computed_field
    @property
    def volume(self) -> float:
        return self.w * self.h * self.d
```

### model_config (ConfigDict)
Common settings:
- `extra="forbid"` -- reject unknown keys (v1 default was "ignore")
- `frozen=True` -- immutable model (hashable)
- `populate_by_name=True` -- allow population by field name when aliases are set (v1 `allow_population_by_field_name`)
- `str_strip_whitespace=True`, `str_to_lower=True`
- `arbitrary_types_allowed=True` -- needed for custom non-Pydantic types

### TypeAdapter for non-BaseModel types
Validate arbitrary types (lists, TypedDicts, dataclasses) without wrapping in a model:
```python
from pydantic import TypeAdapter
ints = TypeAdapter(list[int]).validate_python(["1", "2", "3"])  # [1, 2, 3]
```

### Settings management
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_")
    database_url: str
    debug: bool = False
```

## v1 -> v2 migration cheatsheet

| v1 | v2 |
|---|---|
| `.dict()` | `.model_dump()` |
| `.json()` | `.model_dump_json()` |
| `.parse_obj(d)` | `.model_validate(d)` |
| `.parse_raw(s)` | `.model_validate_json(s)` |
| `class Config:` | `model_config = ConfigDict(...)` |
| `@validator("x")` | `@field_validator("x")` (must be `@classmethod`) |
| `@root_validator` | `@model_validator(mode="before"\|"after")` |
| `Config.allow_population_by_field_name` | `populate_by_name=True` |
| `Field(..., regex=...)` | `Field(..., pattern=...)` |
| `__fields__` | `model_fields` |
| `Config.orm_mode = True` | `model_config = ConfigDict(from_attributes=True)` |

Use `bump-pydantic` for an automated codemod pass; expect manual fixes for custom validators.

## Common pitfalls

- **Forgetting `@classmethod` on `@field_validator`**: v2 requires it explicitly; v1 added it implicitly.
- **`Optional[X]` does not imply default `None`**: write `x: Optional[str] = None` or `x: str | None = None`. Without the default, the field is required.
- **`extra="allow"` and unknown attributes**: extra fields exist but aren't typed -- accessing them yields no IDE help and may break refactors.
- **Mutating a frozen model**: silently raises `ValidationError` only on construction; mutation raises `pydantic.ValidationError` at assignment. Don't rely on copy-on-write semantics.
- **`model_dump(mode="json")` vs `model_dump_json()`**: the former returns a JSON-compatible dict (datetimes as strings); the latter returns a JSON string. They are not the same.
- **Strict vs lax mode**: v2 has both. `Field(strict=True)` or `model_config=ConfigDict(strict=True)` disables coercion (`"1"` won't become `1`).
- **Custom types**: in v2, write a `__get_pydantic_core_schema__` classmethod or use `Annotated` with `BeforeValidator`/`AfterValidator`, not v1's `__get_validators__`.

## Reference

- Official docs: https://docs.pydantic.dev
- Migration guide: https://docs.pydantic.dev/latest/migration/
- pydantic-settings: https://docs.pydantic.dev/latest/concepts/pydantic_settings/
- Related: [[zod-validation]] (the TypeScript analogue)
