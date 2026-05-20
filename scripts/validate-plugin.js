const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

const pluginsDir = path.join(__dirname, '../plugins');

async function validate() {
  if (!(await fs.pathExists(pluginsDir))) {
    throw new Error(`Plugins directory not found at ${pluginsDir}`);
  }

  const registryPath = path.join(__dirname, '../registry.json');
  let registry = [];
  let registryLoadFailed = false;
  try {
    if (await fs.pathExists(registryPath)) {
      registry = await fs.readJson(registryPath);
    }
  } catch (err) {
    console.error(`❌ Error reading registry.json: ${err.message}`);
    registryLoadFailed = true;
  }

  const folders = await fs.readdir(pluginsDir);
  let errorCount = 0;
  let successCount = 0;

  const seenNames = new Map();
  const diskSkills = new Map();

  console.log('🔍 Starting validation of plugins...');

  for (const folder of folders) {
    const folderPath = path.join(pluginsDir, folder);
    const stat = await fs.stat(folderPath);

    if (!stat.isDirectory()) continue;

    // 1. Folder name check (kebab-case)
    if (!/^[a-z0-9-]+$/.test(folder)) {
      console.error(`❌ [${folder}] Invalid folder name. Must be lowercase kebab-case (e.g., my-new-skill).`);
      errorCount++;
      continue;
    }

    const skillPath = path.join(folderPath, 'SKILL.md');

    // 2. SKILL.md existence check
    if (!(await fs.pathExists(skillPath))) {
      console.error(`❌ [${folder}] Missing SKILL.md inside folder.`);
      errorCount++;
      continue;
    }

    try {
      const content = await fs.readFile(skillPath, 'utf8');

      // 3. Frontmatter presence check
      const match = content.match(/^---([\s\S]*?)---/);
      if (!match) {
        console.error(`❌ [${folder}] Missing frontmatter block. SKILL.md must start with ---.`);
        errorCount++;
        continue;
      }

      // 4. Parse YAML frontmatter
      let frontmatter;
      try {
        frontmatter = yaml.load(match[1]);
      } catch (yamlErr) {
        console.error(`❌ [${folder}] YAML parsing error in frontmatter: ${yamlErr.message}`);
        errorCount++;
        continue;
      }

      if (!frontmatter || typeof frontmatter !== 'object') {
        console.error(`❌ [${folder}] Frontmatter is not a valid YAML object.`);
        errorCount++;
        continue;
      }

      // 5. Check required fields
      if (!frontmatter.name) {
        console.error(`❌ [${folder}] Missing required 'name' field in frontmatter.`);
        errorCount++;
      } else {
        const cleanName = frontmatter.name.trim().toLowerCase();
        if (seenNames.has(cleanName)) {
          console.error(`❌ [${folder}] Duplicate human-readable name "${frontmatter.name}" found (already used by plugins/${seenNames.get(cleanName)}).`);
          errorCount++;
        } else {
          seenNames.set(cleanName, folder);
        }
      }

      if (!frontmatter.description) {
        console.error(`❌ [${folder}] Missing required 'description' field in frontmatter.`);
        errorCount++;
      }

      // Collect for registry validation
      if (frontmatter.name && frontmatter.description) {
        diskSkills.set(folder, {
          name: frontmatter.name,
          description: frontmatter.description
        });
      }

      // 6. Check for non-ASCII characters (e.g. Korean) in instruction files to guarantee English only
      const hangulRegex = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/;
      if (hangulRegex.test(content)) {
        console.warn(`⚠️  [${folder}] Contains non-ASCII (Hangul/Korean) characters. Please ensure the skill instruction is fully in English.`);
      }

      successCount++;
    } catch (err) {
      console.error(`❌ [${folder}] Error reading or parsing: ${err.message}`);
      errorCount++;
    }
  }

  // 7. Verify registry is in sync
  if (!registryLoadFailed) {
    if (registry.length === 0 && diskSkills.size > 0) {
      console.error(`❌ [registry] registry.json is empty or missing, but skills exist on disk.`);
      errorCount++;
    } else {
      const regMap = new Map(registry.map(p => [p.id, p]));

      for (const [id, diskSkill] of diskSkills.entries()) {
        if (!regMap.has(id)) {
          console.error(`❌ [registry] Missing registry entry for skill ID: "${id}". Please run "npm run registry".`);
          errorCount++;
        } else {
          const regSkill = regMap.get(id);
          if (regSkill.name !== diskSkill.name) {
            console.error(`❌ [registry] Name mismatch for ID "${id}". registry.json name: "${regSkill.name}", SKILL.md name: "${diskSkill.name}". Please run "npm run registry".`);
            errorCount++;
          }
          if (regSkill.description !== diskSkill.description) {
            console.error(`❌ [registry] Description mismatch for ID "${id}". registry.json description: "${regSkill.description}", SKILL.md description: "${diskSkill.description}". Please run "npm run registry".`);
            errorCount++;
          }
        }
      }

      for (const regSkill of registry) {
        if (!diskSkills.has(regSkill.id)) {
          console.error(`❌ [registry] Orphaned registry entry found for skill ID: "${regSkill.id}" (no corresponding folder in plugins/). Please run "npm run registry".`);
          errorCount++;
        }
      }
    }
  }

  console.log('\n📊 Validation Summary:');
  console.log(`✅ ${successCount} skills validated successfully.`);
  if (errorCount > 0) {
    console.error(`❌ ${errorCount} errors found. Please fix them before committing.`);
    process.exit(1);
  } else {
    console.log('🎉 Everything looks perfect! Ready to submit a PR.');
  }
}

validate().catch(err => {
  console.error('Critical validation error:', err.message);
  process.exit(1);
});
