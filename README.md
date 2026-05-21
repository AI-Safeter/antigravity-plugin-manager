<h1 align="center">antigravity-cli Plugin Manager (ag-plugin)</h1>

<p align="center">
  <b>Install agent skills from public open-source repositories.</b>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-emerald.svg" alt="License: MIT"></a>
  <a href="https://antigravity.google"><img src="https://img.shields.io/badge/Antigravity-2.0-blueviolet" alt="Antigravity"></a>
  <a href="https://www.npmjs.com/package/@beidawuli/antigravity-plugin-manager"><img src="https://img.shields.io/badge/npm-v3.2.2-blue.svg" alt="npm version"></a>
</p>

`ag-plugin` is a CLI plugin manager for `antigravity-cli`. It indexes 309 agent skills across 16 categories from 13 public open-source repositories. The dashboard has four actions: browse by category, fuzzy-search by keyword, list and uninstall what you have, and add or sync upstream sources. Skill content stays at its upstream source; the manager indexes it and routes installs.

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

The dashboard is the entry point. The footer line shows the current catalog size.

![Main Menu](images/main_menu.png)

**Browse by category** scopes the list to one of 16 categories. Each entry shows the count of skills it contains so you can size the pick before opening it.

![Browse by Category](images/browse_categories.png)

**Search** runs a fuzzy match across name, description, and skill ID as you type. Results are ranked, with the description preview shown inline.

![Search Plugins](images/search_plugins.png)

**Installed Plugins** lists what you've installed in either scope, with `[Global]` (`~/.antigravity/plugins/`) and `[Local]` (`./.antigravity/plugins/`) labels. Pick a plugin to uninstall it.

![Installed Plugins](images/installed_plugins.png)

**Manage Skill Sources** lists every upstream repository, its enable state, and its URL. From this view you can sync (clone or pull the latest from each enabled source and rebuild the registry), toggle a source, or add a custom Git URL.

![Manage Sources](images/manage_sources.png)

## What's inside (v3.2.1)

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

Each skill comes from one of these public repositories. The manager doesn't modify upstream content; it copies the original SKILL.md (or, for awesome-cursorrules, the original `.mdc` file plus a generated wrapper) into your plugins directory at install time. Each upstream repo retains its own license.

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

## Managing sources

The **Manage Skill Sources** menu lets you enable or disable a source, add a custom Git repository, or sync (pull latest and rebuild the registry). Custom sources you add are stored in `~/.antigravity/sources.json` and persist across upgrades.

## How it works

1. `sources.json` lists upstream repos and their format (SKILL.md folders or `.mdc` single-files).
2. The registry generator clones each enabled source into `~/.antigravity/cache/sources/`, recursively finds skills, and writes `registry.json` with metadata only.
3. `categories.json` decides which skills ship and where they live in the UI. A skill not listed in `categories.json` is filtered out at registry-build time.
4. Install copies the upstream skill folder (or single `.mdc` file) into your user-global or project-local `plugins/` directory.

## Contributing

You can contribute in three ways:

1. Suggest a new upstream source by opening an issue with the repo URL and what it adds.
2. Add a category assignment in `categories.json` to surface skills already in cached upstream repos.
3. Author a local skill following the SKILL.md format described in [CONTRIBUTING.md](CONTRIBUTING.md).

Run `npm run validate` before opening a PR to verify any changes pass the static checks.

## License

The tooling is MIT-licensed (see [LICENSE](LICENSE)). Skills themselves remain under their respective upstream licenses, which are preserved at install time.
