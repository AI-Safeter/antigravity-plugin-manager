const fs = require('fs-extra');
const path = require('path');

const skillName = process.argv[2];

if (!skillName) {
  console.error('\n❌ Error: Please specify a skill name (in lowercase kebab-case).');
  console.log('Example: npm run new-skill my-awesome-plugin\n');
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(skillName)) {
  console.error('\n❌ Error: Skill name must be lowercase kebab-case (e.g. my-awesome-plugin).\n');
  process.exit(1);
}

const targetDir = path.join(__dirname, '../plugins', skillName);
const skillFilePath = path.join(targetDir, 'SKILL.md');

async function createScaffold() {
  if (await fs.pathExists(targetDir)) {
    console.error(`\n❌ Error: Folder 'plugins/${skillName}' already exists.\n`);
    process.exit(1);
  }

  // Convert kebab-case to Title Case for default display name
  const displayName = skillName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const content = `---
name: ${displayName}
description: A short, single-sentence summary of this skill's capabilities.
---

# ${displayName}

Provide detailed, actionable instructions explaining how the agent should act when using this skill.

## 📋 Recommended Guidelines & Focus Area
- **Actionable & Specific**: Give precise rules on what commands, folders, or files to target.
- **No Placeholders**: Ensure all code blocks and lists are complete.
- **English Only**: Maintain consistent global developer experience.
`;

  try {
    await fs.ensureDir(targetDir);
    await fs.writeFile(skillFilePath, content, 'utf8');
    
    console.log(`\n🎉 Success! Scaffolded new skill folder at: plugins/${skillName}`);
    console.log(`👉 Edit the instructions inside: plugins/${skillName}/SKILL.md`);
    console.log('\nOnce ready, run:');
    console.log('  1. npm run registry   - to register the plugin');
    console.log('  2. npm run validate   - to verify compliance');
    console.log('  3. npm run test       - to run unit tests\n');
  } catch (err) {
    console.error('\n❌ Critical Error scaffolding skill:', err.message);
    process.exit(1);
  }
}

createScaffold();
