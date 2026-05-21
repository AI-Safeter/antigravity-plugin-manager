const fs = require('fs-extra');
const path = require('path');
const { input } = require('@inquirer/prompts');
const chalk = require('chalk');
const { generateRegistry } = require('./update-registry');

async function createSkill() {
  console.log(chalk.bold.hex('#8B5CF6')('\n🛸 antigravity-cli Skill Generator\n'));

  // 1. Prompt for Skill ID
  const id = await input({
    message: 'Enter skill ID (lowercase kebab-case, e.g., redis-caching):',
    validate: (val) => {
      if (!val) return 'Skill ID is required.';
      if (!/^[a-z0-9-]+$/.test(val)) {
        return 'Skill ID must be lowercase kebab-case (letters, numbers, hyphens only).';
      }
      const dir = path.join(__dirname, '../plugins', val);
      if (fs.existsSync(dir)) {
        return `A skill with ID "${val}" already exists.`;
      }
      return true;
    }
  });

  // 2. Prompt for Human-Readable Name
  const name = await input({
    message: 'Enter human-readable name (e.g., Redis Caching):',
    validate: (val) => {
      if (!val.trim()) return 'Name is required.';
      return true;
    }
  });

  // 3. Prompt for Description
  const description = await input({
    message: 'Enter a single-sentence description of the skill:',
    validate: (val) => {
      if (!val.trim()) return 'Description is required.';
      if (val.length > 200) return 'Description should be concise (under 200 characters).';
      return true;
    }
  });

  const skillDir = path.join(__dirname, '../plugins', id);
  const skillFile = path.join(skillDir, 'SKILL.md');

  const template = `---
name: ${name}
description: ${description}
---

# ${name}

Provide detailed, actionable instructions for the AI agent here.

## 📋 Capabilities & Objectives
- Summarize what the agent can achieve with this skill.
- Detail the constraints and expectations.

## ⚙️ Recommended Guidelines
- Specify exactly what files to look for.
- Guide the agent on what terminal commands to execute.
- Detail code patterns, error handling, and directory structures.

## 📝 Usage Examples
Provide clear before-and-after examples or code blocks.
`;

  try {
    await fs.ensureDir(skillDir);
    await fs.writeFile(skillFile, template, 'utf8');
    console.log(chalk.green(`\n✔ Created skill directory and template at plugins/${id}/SKILL.md`));

    console.log(chalk.gray('Recompiling central registry...'));
    await generateRegistry({ autoSync: true });

    console.log(chalk.bold.green(`\n🎉 Success! Your skill "${name}" is registered and ready.`));
    console.log(chalk.gray(`Next steps:`));
    console.log(`  1. Edit plugins/${id}/SKILL.md to write your skill instructions.`);
    console.log(`  2. Run ${chalk.cyan('npm run validate')} to ensure everything is perfect.`);
    console.log(`  3. Start the dashboard with ${chalk.cyan('node src/ag-plugin-v2.js')} to preview it.`);
  } catch (err) {
    console.error(chalk.red(`\n❌ Error creating skill: ${err.message}`));
  }
}

if (require.main === module) {
  createSkill().catch(err => {
    console.error('Critical error:', err.message);
    process.exit(1);
  });
}
