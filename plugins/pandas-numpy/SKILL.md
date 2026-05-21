---
name: pandas-numpy
description: 'pandas and NumPy idiomatic Python data manipulation. Use this skill when loading or cleaning tabular data, writing vectorized operations instead of for-loops, choosing between .loc/.iloc/.at/.iat, performing groupby aggregations, merging or joining DataFrames, or optimizing memory usage with categorical and nullable dtypes. Triggers: pandas, numpy, DataFrame, Series, iterrows, vectorize, groupby, merge, SettingWithCopyWarning.'
---

# pandas + NumPy Idioms

Vectorized array and DataFrame programming. The mental model is: operate on whole columns at once with C-speed kernels, never row-by-row in Python. Most "slow pandas" problems are really "wrote a loop where a vector would do" problems.

## Use this skill when
- Loading CSV/Parquet/JSON into DataFrames and assigning correct dtypes up front
- Replacing for-loops or `.iterrows()` with vectorized expressions
- Picking between `.loc[]`, `.iloc[]`, `.at[]`, `.iat[]`, and boolean masks
- Writing `groupby().agg(...)` with multiple named aggregations
- Joining two tables with `merge` and getting the join keys/cardinality right
- Cutting memory by 5-10x using `category`, nullable `Int64`, and `float32`

## Do not use this skill when
- Data fits poorly in RAM and you should reach for Polars, DuckDB, or Dask instead
- The task is pure linear algebra at scale (use NumPy directly or SciPy)
- You need lazy/streaming execution semantics

## Core concepts
A `Series` is a typed 1-D array plus an Index; a `DataFrame` is an ordered dict of aligned Series. Operations align on the index, broadcast on scalars, and vectorize on dtype-native kernels. NumPy underlies numeric dtypes; pandas adds `object`, `category`, `datetime64[ns, tz]`, and nullable extension dtypes (`Int64`, `boolean`, `string`).

## Quick start
```python
import numpy as np
import pandas as pd

df = pd.read_csv(
    "sales.csv",
    dtype={"region": "category", "sku": "string"},
    parse_dates=["ordered_at"],
)

# Vectorized derived column, no loop:
df["revenue"] = df["qty"].astype("int64") * df["unit_price"].astype("float64")

# Filter + group + multi-agg in one chain:
summary = (
    df.loc[df["ordered_at"] >= "2025-01-01"]
      .groupby("region", observed=True)
      .agg(orders=("order_id", "nunique"),
           revenue=("revenue", "sum"),
           aov=("revenue", "mean"))
      .sort_values("revenue", ascending=False)
)
```

## Key patterns

### Indexing: pick the right accessor
- `.loc[row_label, col_label]` for label-based; accepts boolean masks: `df.loc[df["age"] > 18, ["name", "email"]]`.
- `.iloc[row_pos, col_pos]` for positional integer access; slices are end-exclusive (`df.iloc[0:5]` returns 5 rows).
- `.at[label, col]` / `.iat[pos, pos]` for single-cell scalar reads/writes; 10x faster than `.loc`/`.iloc` on one cell.
- Never chain: `df[df.a > 0]["b"] = 1` triggers `SettingWithCopyWarning` and may silently no-op. Use `df.loc[df.a > 0, "b"] = 1`.

### Vectorize instead of `.iterrows`
- `.iterrows()` yields `(idx, Series)` per row and is ~100-1000x slower than vector ops; avoid in hot paths.
- Prefer column arithmetic: `df["x"] + df["y"]`, `np.where(df["x"] > 0, df["a"], df["b"])`, `df["x"].clip(0, 1)`.
- For per-row conditional logic over many branches, use `np.select([cond1, cond2], [val1, val2], default=...)`.
- If you truly must loop, use `.itertuples(index=False)` (named tuples, 3-5x faster than `iterrows`).

### Method chaining
- Chain with `.pipe(fn)`, `.assign(new_col=lambda d: d.x * 2)`, and `.query("x > 0 and region == 'NA'")` for readable pipelines.
- `.assign` returns a new DataFrame; safer than in-place mutation when composing transforms.
- Use parentheses to wrap multi-line chains; one verb per line.

### groupby and agg
- `.groupby("k", observed=True)` for `category` keys; without `observed=True` you get a row per unused category in older pandas (and a `FutureWarning` in 2.x).
- Named aggregations: `.agg(total=("x", "sum"), n=("x", "size"))` produces flat column names.
- `.transform("mean")` broadcasts a per-group statistic back to original row count (useful for normalization).
- Sort keys before windowed ops: `df.sort_values(["user_id", "ts"]).groupby("user_id")["x"].cumsum()`.

### merge vs join vs concat
- `pd.merge(left, right, on="key", how="inner"|"left"|"right"|"outer", validate="one_to_one"|"many_to_one"|"one_to_many")`. Always pass `validate=` in code reviews; catches silent cardinality bugs.
- `df.join(other)` is `merge` on the index; convenient for index-aligned lookups.
- `pd.concat([a, b], axis=0, ignore_index=True)` for stacking; `axis=1` for side-by-side. Use `keys=` to create a hierarchical index.
- Use `indicator=True` on merge to see `_merge` column for QA of joins.

### Memory-efficient dtypes
- Strings with low cardinality (region, status, country): `astype("category")` can drop memory 10-50x.
- Integers with NA: use nullable `pd.Int64Dtype()` (`"Int64"`) instead of `float64`-coerced NaN.
- Booleans with NA: `"boolean"`. Avoid object dtype for True/False/None mixes.
- Downcast floats: `pd.to_numeric(s, downcast="float")` -> `float32` when range allows.
- Inspect with `df.memory_usage(deep=True)` and `df.info(memory_usage="deep")`.

### NumPy interop
- DataFrame columns are NumPy arrays under the hood; `df["x"].to_numpy()` is the zero-copy path (preferred over `.values`).
- Broadcasting rules apply: `arr_2d + arr_1d` aligns the trailing dim.
- Use `np.einsum`, `np.where`, `np.clip`, `np.isin` for vector kernels not exposed cleanly through pandas.

## Common pitfalls
- `SettingWithCopyWarning`: caused by chained indexing on assignment. Fix: combined `.loc[mask, col] = value`.
- Silent dtype inference on read: a column with one stray string becomes `object`. Pass `dtype=` to `read_csv`.
- `groupby(...).apply(fn)` is the slow path; prefer `.agg`, `.transform`, or `.aggregate` with named tuples.
- `merge` without `validate=` can quietly explode rows from a many-to-many key. Always check `len(result)` vs expected.
- Mutating a slice (`df[df.x > 0]`) and expecting the original to change: it won't reliably; assign back or use `.loc`.
- `pd.NA` vs `np.nan`: nullable dtypes use `pd.NA`; mixing them in numeric ops can yield unexpected `object` dtype.
- Datetime tz: comparing tz-aware to tz-naive raises in pandas 2.x. Use `.dt.tz_localize("UTC")` consistently.
- `df.append(...)` is removed in pandas 2.0; use `pd.concat([df, other])`.

## Reference
- Official docs: https://pandas.pydata.org/docs/ and https://numpy.org/doc/stable/
- User guide essentials: https://pandas.pydata.org/docs/user_guide/indexing.html and https://pandas.pydata.org/docs/user_guide/groupby.html
- Related: [[polars-dataframes]], [[duckdb-analytics]], [[jupyter-notebooks]]
