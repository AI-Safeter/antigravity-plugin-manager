---
name: jupyter-notebooks
description: 'Jupyter notebook patterns and discipline. Use this skill when authoring or refactoring .ipynb files, debugging hidden-state and out-of-order execution bugs, extracting cells into Python modules, parameterizing notebooks with papermill, version-controlling notebooks via jupytext, or using cell/line magics. Triggers: jupyter, ipynb, notebook, kernel, magic, papermill, jupytext, nbconvert, ipykernel.'
---

# Jupyter Notebooks

Notebooks are great for exploration and bad for reproducibility unless you actively fight their failure modes. The two biggest are hidden kernel state and out-of-order cell execution. The discipline below treats notebooks as throwaway scratchpads or as parameterized scripts, never as long-lived business logic.

## Use this skill when
- Starting a new analysis and you want a kernel-hygiene checklist
- Refactoring a long notebook into reusable Python modules
- Debugging "it worked yesterday" issues caused by stale variables
- Putting notebooks into version control without 200-line JSON diffs
- Running a notebook on a schedule with parameters (papermill)
- Picking between `%`, `%%`, `!`, and `??` magics

## Do not use this skill when
- You are shipping production services -- write a `.py` module and import it
- The workload is a multi-step pipeline best expressed in Airflow/Prefect/Dagster
- Outputs must be unit-tested rigorously (move logic into modules)

## Core concepts
A notebook is a JSON document of cells plus a persistent kernel process. The kernel keeps every variable you've ever defined, in execution order -- not source order. Cell `[7]` may shadow `[2]`, and deleting cell `[2]`'s source does not unset the variable. Restart-and-run-all is the only reliable check that a notebook reproduces.

## Quick start
```python
# Cell 1: imports + autoreload (development convenience)
%load_ext autoreload
%autoreload 2

import numpy as np
import pandas as pd
from pathlib import Path

# Cell 2: parameters tagged for papermill
# (Add tag "parameters" via View > Cell Toolbar > Tags)
input_path = "data/raw.csv"
threshold = 0.5

# Cell 3: business
df = pd.read_csv(input_path)
df = df[df["score"] >= threshold]
df.shape
```

Then run headless:
```bash
papermill notebook.ipynb out/notebook_2025-05-21.ipynb \
  -p input_path data/raw.csv -p threshold 0.7
```

## Key patterns

### Kernel state hygiene
- Restart the kernel and "Run All" before every commit. If it does not run top-to-bottom, it is broken.
- Avoid relying on names defined in deleted cells -- restart catches this.
- Use `del var` and `%reset -f` when intentionally clearing large objects from memory.
- Keep cells short and side-effect-light; heavy mutation across many cells is where order bugs live.

### Magics that pay rent
- `%timeit expr` (line) and `%%timeit` (cell): microbenchmarks with statistical repetition.
- `%%time`: one-shot wall+CPU timing for a cell.
- `%load_ext autoreload` + `%autoreload 2`: reload imported modules on every cell run; essential when editing a parallel `.py`.
- `%debug`: drop into pdb on the last exception.
- `??func` shows source; `?func` shows signature/docstring.
- `!cmd` shells out; `var = !ls` captures stdout into a list. Prefer `subprocess.run` for non-trivial commands.
- `%%writefile path.py` writes the cell to a file; useful for emitting a module mid-notebook.

### Refactor cells into modules
- When a function exceeds ~25 lines or you copy it across notebooks, move it to `src/yourpkg/`.
- Install your project editable: `pip install -e .` so notebooks can `from yourpkg import foo`.
- With `%autoreload 2`, edits to `yourpkg/foo.py` take effect without restarting the kernel.
- Keep notebooks as thin orchestration: load data, call functions, plot results.

### Parameterization with papermill
- Tag a cell `parameters` to mark its variables as overridable.
- `papermill in.ipynb out.ipynb -p key value -p other 42` runs headlessly and writes an executed copy with outputs.
- Combine with cron, Airflow, or GitHub Actions for scheduled runs; the executed notebook is its own log.
- Pass complex params via `-y '{"x": [1,2,3]}'` (YAML/JSON).

### Version control with jupytext
- `jupytext --set-formats ipynb,py:percent notebook.ipynb` pairs an `.ipynb` with a `.py` file in percent format.
- Commit the `.py`; review diffs in code review like normal Python. The `.ipynb` is regenerated on demand.
- Pre-commit hook: `jupytext --sync` keeps the pair in lockstep.
- Alternative: `nbstripout` removes outputs from `.ipynb` on commit so JSON diffs are at least source-only.

### Plotting and outputs
- `%matplotlib inline` is the default in JupyterLab; use `%matplotlib widget` for interactive plots.
- For large notebooks, suppress cell output with a trailing `;` or `_ = expr` to keep the file small.
- `display(df)` or `df.head()` for rich rendering; `print(df)` strips formatting.

### Notebook -> script
- `jupyter nbconvert --to script notebook.ipynb` for a `.py` dump.
- `--to html` / `--to pdf` for reports. Combine with `--execute` to run-and-export in CI.

## Common pitfalls
- Out-of-order execution: cell labels `[3], [7], [4]` are a red flag. Restart and re-run.
- Mutating a DataFrame in cell 5 and then re-running cell 3 (which created it) leaves cell 5 stale -- but a later cell 10 may still hold the mutated reference. Restart-and-run-all.
- `%autoreload 2` does not reload `from x import y` if you bound `y` locally before the edit; re-import or restart.
- Long-running cells without checkpointing -- save intermediates to disk (`df.to_parquet`) so a kernel crash doesn't cost hours.
- Notebooks holding huge objects in memory: kernel RAM is not freed until you `del` and `gc.collect()` or restart.
- `pip install` inside a notebook installs into the running kernel only if `%pip install` is used; bare `!pip install` may target a different interpreter.
- Committing `.ipynb` with outputs: binary blobs, base64 PNGs, and execution counts make diffs unreviewable. Use jupytext or nbstripout.

## Reference
- Official docs: https://jupyter.org/documentation
- Papermill: https://papermill.readthedocs.io/
- Jupytext: https://jupytext.readthedocs.io/
- Related: [[pandas-numpy]], [[python-typing-mastery]]
