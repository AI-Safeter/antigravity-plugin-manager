const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

async function generateRegistry() {
  const pluginsDir = path.join(__dirname, '../plugins');
  const registryPath = path.join(__dirname, '../registry.json');
  
  if (!(await fs.pathExists(pluginsDir))) {
    throw new Error(`Plugins directory not found at ${pluginsDir}`);
  }

  let pkgRepo = 'https://github.com/sickn33/ag_plugin';
  try {
    const pkg = await fs.readJson(path.join(__dirname, '../package.json'));
    if (pkg && pkg.repository && pkg.repository.url) {
      pkgRepo = pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
    }
  } catch (e) {
    // Fallback to default
  }

  const folders = await fs.readdir(pluginsDir);
  const registry = [];

  for (const folder of folders) {
    const skillPath = path.join(pluginsDir, folder, 'SKILL.md');
    if (await fs.pathExists(skillPath)) {
      let content;
      try {
        content = await fs.readFile(skillPath, 'utf8');
      } catch (err) {
        console.error(`Error reading ${skillPath}:`, err.message);
        continue;
      }
      
      const match = content.match(/^---([\s\S]*?)---/);
      
      let meta = {
        id: folder,
        name: folder,
        description: 'No description available',
        repository: pkgRepo
      };

      if (match) {
        try {
          const parsed = yaml.load(match[1]);
          if (parsed && typeof parsed === 'object') {
            meta.name = parsed.name || meta.name;
            meta.description = parsed.description || meta.description;
          }
        } catch (e) {
          console.error(`Error parsing YAML in ${folder}:`, e.message);
        }
      }
      
      registry.push({
        ...meta,
        type: 'skill'
      });
    }
  }

  try {
    await fs.writeJson(registryPath, registry, { spaces: 2 });
    console.log(`Successfully generated registry with ${registry.length} skills.`);
  } catch (err) {
    throw new Error(`Failed to write registry.json: ${err.message}`);
  }
}

module.exports = { generateRegistry };

if (require.main === module) {
  generateRegistry().catch(err => {
    console.error('Critical error generating registry:', err.message);
    process.exit(1);
  });
}

