# Contributing to the `antigravity-cli` Plugin Ecosystem

Thank you for your interest in contributing to the `antigravity-cli` Plugin Ecosystem. Contributions from the community help make this marketplace a reliable and powerful resource for developers using `antigravity-cli`.

This guide will walk you through the process of creating and contributing a new skill.

---

## Step-by-Step Guide: Adding a New Skill

Adding a new skill involves creating a folder, writing a structured markdown instruction file, and updating the central registry.

### Step 1: Fork and Clone
1. Fork this repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ag_plugin.git
   cd ag_plugin
   ```

### Step 2: Scaffold a New Skill Automatically
Instead of manually creating folders, writing YAML headers, or editing the central registry, we provide a supercharged interactive CLI scaffolder that handles everything for you. Simply run:
```bash
npm run new-skill
```

This interactive tool will prompt you for:
1. **Skill ID**: The lowercase kebab-case identifier (e.g., `redis-caching` or `django-auth`).
2. **Display Name**: The clean, human-readable name of your skill.
3. **Description**: A single-sentence summary (under 200 characters) describing the capability.

The tool will automatically:
- Create the target folder under `plugins/<id>/`.
- Generate a beautifully structured `SKILL.md` template with best-practice headers.
- Recompile the central `registry.json` automatically so your skill is registered instantly.

*(Note: If you prefer a non-interactive scaffold via arguments, you can alternatively run `node scripts/new-skill.js my-custom-skill`)*

### Step 3: Customize your `SKILL.md` Instructions
Open the newly created `plugins/<id>/SKILL.md` file. Write a highly specific, clean, and comprehensive instruction set that guides the AI agent. A high-quality skill details:
- **Exact Guidelines**: Precise rules explaining what files or folders the agent should target.
- **Recommended Tools/Libraries**: What specific packages or CLI commands are standard.
- **Code Patterns**: Clean templates or structural rules (e.g. error boundary handling).

### Step 4: Validate your skill compliance
Run our strict validator tool to verify that your new skill is perfectly formatted and that your local copy is in 100% sync with the central registry:
```bash
npm run validate
```
Ensure that the validator runs successfully. If there are any compliance issues, the validator will tell you exactly what needs adjustment.

### Step 5: Test the CLI Local Dashboard
Start the local dashboard to make sure your skill displays correctly in the browse and search menus:
```bash
node src/ag-plugin-v2.js
```
Search for your skill to verify the title, description, and formatting render properly.

### Step 6: Submit a Pull Request
1. Commit your changes:
   ```bash
   git checkout -b feature/add-custom-skill
   git add plugins/custom-skill registry.json
   git commit -m "feat: add custom-skill"
   ```
2. Push to your fork:
   ```bash
   git push origin feature/add-custom-skill
   ```
3. Open a Pull Request (PR) on GitHub.

---

## Guidelines for High-Quality Skills

To ensure your skill is merged quickly, please follow these quality criteria:

* **No Placeholders**: Do not include generic TODOs or half-written sections. Ensure the instructions are fully written out and ready for agents to consume.
* **English Only**: The entire skill instruction, including frontmatter and descriptions, must be in English to maintain a consistent global developer experience.
* **Actionable and Specific**: Good skills don't just explain concepts; they tell the AI agent *exactly* what files to look for, what terminal commands to execute, and what code patterns to enforce (e.g., specific error handling rules, testing commands, or directory hierarchies).
* **Valid Frontmatter**: Ensure the YAML frontmatter uses standard formatting with exactly `name` and `description` keys. Do not add arbitrary fields.
