<h1 align="center">antigravity-cli Plugin Manager (`ag-plugin`)</h1>
<p align="center">
  <b>Install and manage custom skills for your AI agent.</b>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-emerald.svg" alt="License: MIT"></a>
  <a href="https://antigravity.google"><img src="https://img.shields.io/badge/Antigravity-2.0-blueviolet" alt="Antigravity"></a>
  <a href="#"><img src="https://img.shields.io/badge/Validation-Passing-success" alt="Validation"></a>
  <a href="https://www.npmjs.com/package/antigravity-plugin-manager"><img src="https://img.shields.io/badge/npm-v2.0.0-blue.svg" alt="npm version"></a>
</p>

The `ag-plugin` CLI is a package manager for the `antigravity-cli` tool. It provides a terminal interface to discover, validate, and install over 150 agent skills into your workspace.

## Before and After

Standard AI agents often write repetitive boilerplate and guess at code changes. Installing custom skills changes how your agent behaves:

| Feature | Standard Agent | With Custom Skills Installed |
| :--- | :--- | :--- |
| **Workflow** | Guesses and runs code immediately, causing syntax errors. | Enforces a 7-phase software engineering lifecycle (Research -> Plan -> Execute -> Verify). |
| **Writing Style** | Uses filler words and robotic responses ("Certainly! Let me write that for you..."). | Writes directly and clearly, skipping the boilerplate. |
| **Debugging** | Modifies production files directly to test hypotheses. | Tests isolated variables in temporary scratch environments first. |

## Quick Start

You can run the interactive dashboard directly without cloning the repository.

```bash
# Run without installing
npx ag-plugin

# Or install globally
npm install -g antigravity-plugin-manager
ag-plugin
```

## CLI Usage and Examples

The `ag-plugin` command launches a keypress-driven terminal interface. It does not accept command-line arguments. All navigation happens within the dashboard.

When you run the command, you will see a main menu:

```text
antigravity-cli Ecosystem
=========================

> Select an action:
❯ 📦 Browse & Install Selected (Explore all 151 plugins)
  🔍 Search & Install Selected (Find plugins by keyword)
  ✅ Installed Plugins (Manage currently installed plugins)
  🚪 Exit
```

### Searching and Installing

If you select "Search & Install Selected", the CLI opens a fuzzy-search prompt. Type a keyword to find relevant skills.

```text
> Search plugins: debug

[x] systematic-debugging (systematic-debugging)
    Use when encountering any bug, test failure, or unexpected behavior...
[ ] code-reviewer (code-reviewer)
    Review pull requests and suggest architectural improvements...

(Use space to select, enter to install)
```

After selecting skills, you can choose where to install them:

1. User Scope (Global): Installs to `~/.gemini/antigravity-cli/skills`. The skill is active across all your projects.
2. Project Scope (Local): Installs to `./.agents/skills`. The skill is only active when running the agent inside the current directory.

When you start an `antigravity-cli` agent, it automatically scans these two directories. If it finds a `SKILL.md` file, it loads the instructions into the agent's context.

### Managing Installed Plugins

Select "Installed Plugins" from the main menu to view what is currently active.

```text
> Installed Plugins (Select a plugin to manage):
❯ 🗑️ Uninstall Selected Plugins
  👤 [Global] Avoid AI Writing (avoid-ai-writing)
  📂 [Local] Systematic Debugging (systematic-debugging)
  ⬅️ Go back to main dashboard
```

You can select an individual plugin to remove it, or use the batch uninstall option to remove several at once.

## Security Architecture

The CLI includes a `safeResolve` boundary layer that blocks malicious file operations and prevents directory traversal (`../`) outside the intended project directories.

A built-in validator checks every skill before installation to ensure the metadata formats correctly and the instructions are written in English.


## Developer Guide

You can contribute new skills to the repository. Follow these steps to create and test a new skill:

1. Create a folder inside `plugins/` with a lowercase kebab-case name.
```bash
mkdir plugins/my-new-skill
```

2. Create a file named `SKILL.md` inside that folder. Add the required YAML frontmatter block.
```markdown
---
name: My New Skill
description: A short summary of what the skill does.
---

# My New Skill Title

Detailed markdown instructions explaining how the agent should act when using this skill.
```

3. Update the central database that indexes your new plugin.
```bash
npm run registry
```

4. Run the automated check to verify your folder naming, frontmatter, and file structure.
```bash
npm run validate
```

5. Run the unit tests to ensure path boundaries remain intact.
```bash
npm run test
```

## Contribution Guidelines

Read [CONTRIBUTING.md](CONTRIBUTING.md) for details on submitting pull requests, style rules, and validation checks.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
