<h1 align="center">antigravity-cli Plugin Manager (ag-plugin)</h1>

<p align="center">
  <b>Discover and install 300+ agent skills from popular open-source repositories.</b>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-emerald.svg" alt="License: MIT"></a>
  <a href="https://antigravity.google"><img src="https://img.shields.io/badge/Antigravity-2.0-blueviolet" alt="Antigravity"></a>
  <a href="https://www.npmjs.com/package/@beidawuli/antigravity-plugin-manager"><img src="https://img.shields.io/badge/npm-v3.2.0-blue.svg" alt="npm version"></a>
</p>

`ag-plugin` is an interactive CLI plugin manager for the `antigravity-cli` ecosystem. It aggregates **309 agent skills across 16 categories** from **13 popular open-source repositories** — Anthropic's official skills, the K-Dense scientific suite, Matt Pocock's TypeScript skills, the Superpowers methodology pack, PatrickJS's awesome-cursorrules, addyosmani's agent-skills, and more. All content is human-authored and lives upstream; this tool just provides discovery, search, and one-command install.

## Prerequisites

[npm](https://nodejs.org/en/download/) (Node.js 18+). Network access at first run so the tool can clone the upstream skill repositories into a local cache.

## Quick Start

```bash
# Run without installing
npx @beidawuli/antigravity-plugin-manager

# Or install globally
npm install -g @beidawuli/antigravity-plugin-manager
ag-plugin
```

On first run, the tool clones each enabled source repo into `~/.antigravity/cache/sources/` and writes a unified registry to `~/.antigravity/registry.json`.

## Interface

The CLI is a fast interactive terminal menu:

![Main Menu](images/main_menu.png)

**Browse by category** lets you scope to one of 16 categories before picking — or grab the whole category in one keystroke via the "Install all N plugins" choice:

![Browse Plugins](images/browse_plugins.png)

**Search** fuzzy-matches across name, description, and skill ID:

![Search Plugins](images/search_plugins.png)

**Installed plugins** lists everything in your user-global (`~/.antigravity/plugins/`) and project-local (`./.antigravity/plugins/`) scopes:

![Installed Plugins](images/installed_plugins.png)

## What's inside (v3.2.0)

| Category | Count | | Category | Count |
|---|---:|---|---|---:|
| Workflow & Process | 99 | | Architecture & Patterns | 13 |
| Mobile, Desktop & Game | 29 | | Backend & APIs | 12 |
| Testing & Quality | 25 | | Databases & Storage | 12 |
| Frontend & UI | 18 | | Data Engineering | 10 |
| Scientific Computing | 17 | | Documents & Creative | 10 |
| Languages | 15 | | AI, ML & Agents | 9 |
| DevOps & Infrastructure | 15 | | Vendor Integrations | 9 |
| | | | Security & Compliance | 8 |
| | | | Build & Tooling | 8 |
| | | | **Total** | **309** |

## Upstream sources

All skills are sourced from these public repositories — no in-tree authoring, no AI-generated bodies. Each retains its original license; this manager is a routing layer.

| Source | Skills | URL |
|---|---:|---|
| PatrickJS / awesome-cursorrules | 46 | https://github.com/PatrickJS/awesome-cursorrules |
| TerminalSkills / skills | 43 | https://github.com/TerminalSkills/skills |
| Local (this repo) | 37 | — |
| EveryInc / compound-engineering-plugin | 34 | https://github.com/EveryInc/compound-engineering-plugin |
| mattpocock / skills | 28 | https://github.com/mattpocock/skills |
| quodsoler / unreal-engine-skills | 27 | https://github.com/quodsoler/unreal-engine-skills |
| addyosmani / agent-skills | 23 | https://github.com/addyosmani/agent-skills |
| wshobson / agents | 19 | https://github.com/wshobson/agents |
| K-Dense-AI / scientific-agent-skills | 18 | https://github.com/K-Dense-AI/scientific-agent-skills |
| anthropics / skills | 15 | https://github.com/anthropics/skills |
| obra / superpowers | 14 | https://github.com/obra/superpowers |
| anthropics / claude-plugins-official | 4 | https://github.com/anthropics/claude-plugins-official |
| alirezarezvani / claude-skills | 1 | https://github.com/alirezarezvani/claude-skills |

PatrickJS/awesome-cursorrules ships single-file `.mdc` Cursor rules; the manager wraps each into a SKILL.md folder at install time. All other sources use the SKILL.md convention natively.

## Managing sources

Use **⚙️ Manage Skill Sources** from the main menu to enable/disable a source, add a new custom Git repository, or sync (pull latest + rebuild registry). Custom sources you add are stored in `~/.antigravity/sources.json` and persist across upgrades.

## How it works

1. `sources.json` lists upstream repos and their format (`SKILL.md` folders or `.mdc` single-files).
2. The registry generator clones each enabled source into `~/.antigravity/cache/sources/`, recursively finds skills, and emits `registry.json` with metadata only.
3. `categories.json` is the source of truth for which skills ship and what category each belongs to — a skill not assigned in `categories.json` is filtered out at registry-build time.
4. Install copies the upstream skill folder (or single .mdc file) into your user-global or project-local `plugins/` directory. The upstream content is never modified.

## Contributing

You can contribute by:
- **Suggesting a new upstream source**: open an issue with the repo URL and what it adds.
- **Adding a category assignment**: edit `categories.json` to surface skills already in cached upstream repos.
- **Authoring a local skill**: see [CONTRIBUTING.md](CONTRIBUTING.md) for the SKILL.md format.

Run `npm run validate` to verify any changes pass the static checks before opening a PR.

## License

This project's tooling is MIT-licensed (see [LICENSE](LICENSE)). Skills themselves remain under their respective upstream licenses, which are preserved at install time.
