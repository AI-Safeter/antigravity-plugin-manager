const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

const pluginsDir = path.join(__dirname, '../plugins');

async function dedup() {
  if (!(await fs.pathExists(pluginsDir))) {
    throw new Error(`Plugins directory not found at ${pluginsDir}`);
  }

  const folders = await fs.readdir(pluginsDir);
  const nameMap = new Map();

  for (const folder of folders) {
    const folderPath = path.join(pluginsDir, folder);
    const skillPath = path.join(folderPath, 'SKILL.md');

    if (!(await fs.pathExists(skillPath))) continue;

    try {
      const content = await fs.readFile(skillPath, 'utf8');
      const match = content.match(/^---([\s\S]*?)---/);
      if (match) {
        const frontmatter = yaml.load(match[1]);
        if (!frontmatter || typeof frontmatter !== 'object') {
          console.warn(`Warning: Invalid frontmatter format in ${folder}`);
          continue;
        }
        const name = frontmatter.name || folder;

        if (nameMap.has(name)) {
          const existing = nameMap.get(name);
          console.log(`Duplicate found: '${name}' in [${existing}] and [${folder}]`);
          
          // Simple rule: keep the one with the longer folder name (usually more specific)
          if (folder.length > existing.length) {
            await fs.remove(path.join(pluginsDir, existing));
            nameMap.set(name, folder);
            console.log(`  Keeping [${folder}], removed [${existing}]`);
          } else {
            await fs.remove(folderPath);
            console.log(`  Keeping [${existing}], removed [${folder}]`);
          }
        } else {
          nameMap.set(name, folder);
        }
      }
    } catch (err) {
      console.error(`Error processing ${folder}:`, err.message);
    }
  }
}

dedup()
  .then(() => console.log('Deduplication complete.'))
  .catch(err => {
    console.error('Critical error during deduplication:', err.message);
    process.exit(1);
  });

