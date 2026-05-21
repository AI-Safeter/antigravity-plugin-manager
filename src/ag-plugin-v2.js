#!/usr/bin/env node

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spinner, note, confirm, isCancel } = require('@clack/prompts');
const { checkbox, select, input } = require('@inquirer/prompts');
const { generateRegistry, REGISTRY_SCHEMA_VERSION, mergeBuiltinFlags } = require('../scripts/update-registry');

const DEFAULT_REGISTRY_PATH = path.join(__dirname, '../registry.json');
const USER_REGISTRY_PATH = path.join(os.homedir(), '.antigravity/registry.json');
const CATEGORIES_PATH = path.join(__dirname, '../categories.json');

function loadCategoriesMeta() {
  try {
    const data = require(CATEGORIES_PATH);
    return (data && Array.isArray(data.categories)) ? data.categories : [];
  } catch (err) {
    return [];
  }
}

const {
  GLOBAL_PLUGIN_DIR,
  GLOBAL_SKILLS_DIR,
  LOCAL_PLUGIN_DIR,
  LOCAL_SKILLS_DIR,
  getInstalledPlugins,
  installPluginsCore,
  isInquirerCancel,
  uninstallPlugin,
  runWithEscape,
  runGit,
  CLACK_THEME
} = require('./utils/installer');

const { interactiveSearchCheckbox } = require('./ui/search-prompt');

const V2_CYAN = chalk.hex('#22D3EE');
const V2_VIOLET = chalk.hex('#8B5CF6');

function extractPlugins(data) {
  // Accept both new schema { schemaVersion, plugins: [...] } and legacy bare array.
  if (Array.isArray(data)) return { plugins: data, schemaVersion: 0 };
  if (data && Array.isArray(data.plugins)) {
    return { plugins: data.plugins, schemaVersion: data.schemaVersion || 0 };
  }
  throw new Error('Registry format is invalid.');
}

async function readRegistryFile(p) {
  const data = await fs.readJson(p);
  return extractPlugins(data);
}

async function getRegistry() {
  const rebuildAndRead = async () => {
    // Try a best-effort sync so users on a schema bump still get the full
    // remote catalog. If the network is unreachable, fall back to whatever
    // is already cached and warn — better than silently dropping ~170 entries.
    try {
      await generateRegistry({ registryPath: USER_REGISTRY_PATH, autoSync: true, allowEmptyCache: true });
    } catch (syncErr) {
      console.warn(chalk.yellow(`Could not refresh remote sources (${syncErr.message}). Continuing with locally-cached sources.`));
      await generateRegistry({ registryPath: USER_REGISTRY_PATH, allowEmptyCache: true });
    }
    return readRegistryFile(USER_REGISTRY_PATH);
  };

  try {
    if (await fs.pathExists(USER_REGISTRY_PATH)) {
      const { plugins, schemaVersion } = await readRegistryFile(USER_REGISTRY_PATH);
      if (schemaVersion !== REGISTRY_SCHEMA_VERSION) {
        console.warn(chalk.yellow(`\nRegistry schema is outdated (${schemaVersion} -> ${REGISTRY_SCHEMA_VERSION}). Rebuilding...`));
        return (await rebuildAndRead()).plugins;
      }
      return plugins;
    }

    if (!(await fs.pathExists(DEFAULT_REGISTRY_PATH))) {
      return (await rebuildAndRead()).plugins;
    }
    const { plugins } = await readRegistryFile(DEFAULT_REGISTRY_PATH);
    return plugins;
  } catch (err) {
    console.warn(chalk.yellow(`\nRegistry is missing or corrupt: ${err.message}. Attempting to rebuild registry...`));
    try {
      const { plugins } = await rebuildAndRead();
      return plugins;
    } catch (rebuildErr) {
      throw new Error(`Unable to load registry: ${rebuildErr.message}`);
    }
  }
}

function showHeader() {
  console.clear();
  const title = ` ${V2_VIOLET.bold('ANTIGRAVITY-CLI')} ${V2_CYAN.bold('PLUGIN')} `;
  const line = V2_VIOLET('━'.repeat(title.length));
  console.log(`\n${line}\n${title}\n${line}\n`);
}

async function handleInstall(selectedIds, registry) {
  if (selectedIds.length === 0) return;

  const confirmed = await confirm({
    message: `Install ${V2_CYAN(selectedIds.length)} plugins?`,
  });

  if (isCancel(confirmed) || !confirmed) return;

  let scope;
  try {
    scope = await runWithEscape(select, {
      message: 'Select installation scope:',
      choices: [
        { name: '👤 User Scope (Global - available across all projects)', value: 'user' },
        { name: '📂 Project Scope (Local - available in current workspace only)', value: 'project' }
      ],
      theme: CLACK_THEME
    });
  } catch (err) {
    if (isInquirerCancel(err)) return;
    throw err;
  }

  const s = spinner();
  s.start(`Installing ${selectedIds.length} plugins...`);

  const results = await installPluginsCore(selectedIds, registry, scope);

  s.stop(`Installed ${results.success.length} plugins, ${results.fail.length} failed.`);

  if (results.success.length > 0) {
    note(results.success.join(', '), 'Installed');
  }
  if (results.fail.length > 0) {
    note(results.fail.join('\n'), 'Errors');
  }

  await input({ message: 'Press Enter to return' }).catch(() => {});
}


async function browseAndInstall(registry) {
  const { all: installed } = await getInstalledPlugins();
  const installedSet = new Set(installed);
  const categoriesMeta = loadCategoriesMeta();

  // Step 1: ask which category to browse (or "All").
  let filteredRegistry = registry;
  if (categoriesMeta.length > 0) {
    // Count plugins per category so we can show "(N)" hints.
    const counts = {};
    registry.forEach(p => {
      const c = p.category || 'uncategorized';
      counts[c] = (counts[c] || 0) + 1;
    });
    const categoryChoices = [
      { name: `🌐 All Categories (${registry.length})`, value: '__all__' },
      ...categoriesMeta
        .filter(c => counts[c.id])
        .sort((a, b) => (a.order || 99) - (b.order || 99))
        .map(c => ({ name: `${c.label} (${counts[c.id]})`, value: c.id }))
    ];
    let categoryChoice;
    try {
      categoryChoice = await runWithEscape(select, {
        message: 'Browse by category:',
        choices: categoryChoices,
        pageSize: 20,
        theme: CLACK_THEME
      });
    } catch (err) {
      if (isInquirerCancel(err)) return;
      throw err;
    }
    if (categoryChoice !== '__all__') {
      filteredRegistry = registry.filter(p => p.category === categoryChoice);
    }
  }

  // Single checkbox: "Install all" sentinel sits at the top, individual
  // plugins below. Toggling the sentinel + Enter installs everything;
  // toggling specific items + Enter installs just those.
  const SELECT_ALL = '__select_all__';
  const scopeLabel = filteredRegistry === registry
    ? `all ${filteredRegistry.length} plugins`
    : `all ${filteredRegistry.length} in this category`;
  const notInstalledCount = filteredRegistry.filter(p => !installedSet.has(p.id)).length;

  let selectedIds;
  try {
    selectedIds = await runWithEscape(checkbox, {
      message: `Select plugins (Space: toggle, Enter: install, Esc: back):`,
      choices: [
        {
          name: chalk.bold.hex('#22D3EE')(`✅ Install ${scopeLabel}`),
          value: SELECT_ALL,
          description: `${notInstalledCount} not yet installed`
        },
        ...filteredRegistry.map(p => ({
          name: `${installedSet.has(p.id) ? chalk.green('● ') : '  '}${p.name} (${p.id})`,
          value: p.id,
          description: p.description.substring(0, 80)
        }))
      ],
      pageSize: 15,
      theme: {
        ...CLACK_THEME,
        style: {
          ...CLACK_THEME.style,
          keysHelpTip: (keys) => {
            const allKeys = [...keys, ['esc', 'go back']];
            return chalk.dim(
              allKeys.map(([key, action]) => `${chalk.bold(key)} ${action}`).join(' • ')
            );
          }
        }
      }
    });
  } catch (err) {
    if (isInquirerCancel(err)) return;
    throw err;
  }

  // If the sentinel was checked, expand to every plugin in the current scope.
  if (selectedIds && selectedIds.includes(SELECT_ALL)) {
    selectedIds = filteredRegistry.map(p => p.id);
  }

  if (selectedIds && selectedIds.length > 0) {
    await handleInstall(selectedIds, registry);
  }
}

async function searchAndInstall(registry) {
  const { all: installed } = await getInstalledPlugins();

  let selectedIds;
  try {
    selectedIds = await interactiveSearchCheckbox(registry, installed);
  } catch (err) {
    if (isInquirerCancel(err)) {
      return;
    }
    throw err;
  }

  if (selectedIds === null) {
    return; // Exit silently on Esc
  }

  if (selectedIds.length === 0) {
    note('No plugins selected for installation.', 'Search');
    await input({ message: 'Press Enter to return' }).catch(() => {});
    return;
  }

  await handleInstall(selectedIds, registry);
}

async function manageActivePlugins(registry) {
  while (true) {
    const { global, local } = await getInstalledPlugins();

    if (global.length === 0 && local.length === 0) {
      note('No plugins currently installed.', 'Installed Plugins');
      await input({ message: 'Press Enter to return' }).catch(() => {});
      return;
    }

    const choices = [];

    // Only show uninstall option if there's more than one plugin installed in total
    if (global.length + local.length > 1) {
      choices.push({
        name: '🗑️ Uninstall Selected Plugins',
        value: 'selected_uninstall'
      });
    }

    // Global choices
    global.forEach(id => {
      const p = registry.find(item => item.id === id);
      const displayName = p ? `${p.name} (${id})` : id;
      choices.push({
        name: `👤 [Global] ${displayName}`,
        value: `user:${id}`
      });
    });

    // Local choices
    local.forEach(id => {
      const p = registry.find(item => item.id === id);
      const displayName = p ? `${p.name} (${id})` : id;
      choices.push({
        name: `📂 [Local] ${displayName}`,
        value: `project:${id}`
      });
    });

    choices.push({
      name: '⬅️ Go back to main dashboard',
      value: 'back'
    });

    let selectedChoice;
    try {
      selectedChoice = await runWithEscape(select, {
        message: 'Installed Plugins (Select a plugin to manage):',
        choices,
        theme: CLACK_THEME
      });
    } catch (err) {
      return; // Return silently on Escape/Ctrl+C
    }

    if (selectedChoice === 'back') {
      return;
    }

    if (selectedChoice === 'selected_uninstall') {
      const selectedChoices = [];
      global.forEach(id => {
        const p = registry.find(item => item.id === id);
        const displayName = p ? `${p.name} (${id})` : id;
        selectedChoices.push({
          name: `👤 [Global] ${displayName}`,
          value: `user:${id}`
        });
      });
      local.forEach(id => {
        const p = registry.find(item => item.id === id);
        const displayName = p ? `${p.name} (${id})` : id;
        selectedChoices.push({
          name: `📂 [Local] ${displayName}`,
          value: `project:${id}`
        });
      });

      let selectedToUninstall;
      try {
        selectedToUninstall = await runWithEscape(checkbox, {
          message: 'Select plugins to uninstall (Space: toggle, Enter: uninstall, Esc: go back):',
          choices: selectedChoices,
          pageSize: 15,
          theme: {
            ...CLACK_THEME,
            style: {
              ...CLACK_THEME.style,
              keysHelpTip: (keys) => {
                const allKeys = [...keys, ['esc', 'go back']];
                return chalk.dim(
                  allKeys.map(([key, action]) => `${chalk.bold(key)} ${action}`).join(' • ')
                );
              }
            }
          }
        });
      } catch (err) {
        continue;
      }

      if (selectedToUninstall && selectedToUninstall.length > 0) {
        const confirmed = await confirm({
          message: `Uninstall the ${chalk.red(selectedToUninstall.length)} selected plugins?`
        });

        if (confirmed && !isCancel(confirmed)) {
          const s = spinner();
          s.start(`Uninstalling ${selectedToUninstall.length} plugins...`);
          const results = { success: [], fail: [] };
          for (const item of selectedToUninstall) {
            const [scope, id] = item.split(':');
            const p = registry.find(r => r.id === id);
            const displayName = p ? p.name : id;
            try {
              await uninstallPlugin(id, scope);
              results.success.push(displayName);
            } catch (err) {
              results.fail.push(`${displayName}: ${err.message}`);
            }
          }
          if (results.fail.length === 0) {
            s.stop(`Uninstalled ${results.success.length} plugins.`);
            note(results.success.join(', '), 'Uninstalled');
            await input({ message: 'Press Enter to return' }).catch(() => {});
          } else {
            s.stop(`Uninstalled ${results.success.length} plugins, ${results.fail.length} failed.`);
            if (results.success.length > 0) {
              note(results.success.join(', '), 'Uninstalled');
            }
            note(results.fail.join('\n'), 'Errors');
            await input({ message: 'Press Enter to return' }).catch(() => {});
          }
        }
      }
      continue;
    }

    const [scope, id] = selectedChoice.split(':');
    const p = registry.find(item => item.id === id);
    const displayName = p ? p.name : id;
    const scopeLabel = scope === 'user' ? 'Global' : 'Local';

    let action;
    try {
      action = await runWithEscape(select, {
        message: `${displayName} (${scopeLabel} Scope)`,
        choices: [
          { name: `🗑️ Uninstall this plugin`, value: 'uninstall' },
          { name: `⬅️ Go back`, value: 'back' }
        ],
        theme: CLACK_THEME
      });
    } catch (err) {
      continue;
    }

    if (action === 'uninstall') {
      const confirmed = await confirm({
        message: `Uninstall ${chalk.red(displayName)} (${scopeLabel})?`
      });

      if (confirmed && !isCancel(confirmed)) {
        const s = spinner();
        s.start(`Uninstalling ${displayName}...`);
        try {
          await uninstallPlugin(id, scope);
          s.stop(`Uninstalled ${displayName}.`);
        } catch (err) {
          s.stop(`Failed: ${err.message}`);
          await input({ message: 'Press Enter to return' }).catch(() => {});
        }
      }
    }
  }
}

// Graceful SIGINT handling
process.on('SIGINT', () => {
  process.stdout.write('\x1b[?25h'); // Restore cursor
  console.log(chalk.gray('\nExiting antigravity-cli Plugin Manager...'));
  process.exit(0);
});

const DEFAULT_SOURCES_PATH = path.join(__dirname, '../sources.json');
const USER_SOURCES_PATH = path.join(os.homedir(), '.antigravity/sources.json');

async function loadSources() {
  let shipped = null;
  try {
    if (await fs.pathExists(DEFAULT_SOURCES_PATH)) {
      shipped = await fs.readJson(DEFAULT_SOURCES_PATH);
    }
  } catch (err) {
    // ignore; we'll fall back below
  }

  try {
    if (await fs.pathExists(USER_SOURCES_PATH)) {
      const userSources = await fs.readJson(USER_SOURCES_PATH);
      // Stamp builtin=true onto entries an upgrading user has at the legacy shape.
      // Without this, the "Remove Source" filter would treat shipped registries as removable.
      return mergeBuiltinFlags(userSources, shipped);
    }
    if (shipped) {
      await fs.ensureDir(path.dirname(USER_SOURCES_PATH));
      await fs.writeJson(USER_SOURCES_PATH, shipped, { spaces: 2 });
      return shipped;
    }
  } catch (err) {
    // Ignore error
  }
  return [{ id: 'local', name: 'Local Core Plugins', url: 'local', enabled: true, builtin: true }];
}

async function saveSources(sources) {
  await fs.ensureDir(path.dirname(USER_SOURCES_PATH));
  await fs.writeJson(USER_SOURCES_PATH, sources, { spaces: 2 });
}

async function manageSources() {
  while (true) {
    const sources = await loadSources();
    
    showHeader();
    const titleLine = ` ${V2_CYAN.bold('⚙️  MANAGE SKILL SOURCES')} `;
    const decorationLine = V2_VIOLET('━'.repeat(titleLine.length));
    console.log(`\n${decorationLine}\n${titleLine}\n${decorationLine}\n`);

    console.log(chalk.bold('Active Sources:'));
    sources.forEach(src => {
      const status = src.enabled ? chalk.green('● Enabled') : chalk.gray('○ Disabled');
      const urlText = src.url === 'local' ? chalk.dim('(Local plugins/)') : chalk.dim(`(${src.url})`);
      console.log(` - ${chalk.cyan(src.name)} [${src.id}] : ${status} ${urlText}`);
    });
    console.log('\n');

    let action;
    try {
      action = await runWithEscape(select, {
        message: 'Manage Skill Sources Action:',
        choices: [
          { name: '🔄 Sync & Rebuild Registry', value: 'sync', description: 'Clone/pull enabled repositories and scan for skills' },
          { name: '✏️  Enable/Disable Sources', value: 'toggle', description: 'Choose which sources to index' },
          { name: '➕ Add Custom Git Source', value: 'add', description: 'Register a new external git repository' },
          { name: '🗑️  Remove Custom Git Source', value: 'remove', description: 'Delete a registered custom source' },
          { name: '⬅️  Go Back', value: 'back' }
        ],
        theme: CLACK_THEME
      });
    } catch (err) {
      return; // Return silently on Escape/Ctrl+C
    }

    if (action === 'back') {
      return;
    }

    if (action === 'sync') {
      const s = spinner();
      s.start('Syncing skill sources and rebuilding registry...');

      let successCount = 0;
      let failCount = 0;
      const fails = [];

      for (const src of sources) {
        if (!src.enabled || src.id === 'local') continue;

        const targetPath = path.join(os.homedir(), '.antigravity/cache/sources', src.id);
        s.message(`Syncing ${src.name}...`);

        try {
          await fs.ensureDir(path.dirname(targetPath));
          if (await fs.pathExists(targetPath)) {
            try {
              runGit(['fetch', '--depth', '1'], { cwd: targetPath });
              runGit(['reset', '--hard', 'origin/HEAD'], { cwd: targetPath });
            } catch (pullErr) {
              await fs.remove(targetPath);
              runGit(['clone', '--depth', '1', '--', src.url, targetPath]);
            }
          } else {
            runGit(['clone', '--depth', '1', '--', src.url, targetPath]);
          }
          successCount++;
        } catch (err) {
          failCount++;
          fails.push(`${src.name}: ${err.message}`);
        }
      }

      s.message('Compiling unified registry...');
      try {
        await generateRegistry({
          registryPath: USER_REGISTRY_PATH,
          sources,
          allowEmptyCache: true
        });
        
        s.stop(`Registry rebuilt successfully! Synced ${successCount} repos, ${failCount} failed.`);
        if (fails.length > 0) {
          note(fails.join('\n'), 'Sync Failures');
        } else {
          note('All sources synced successfully. The registry is fully updated!', 'Sync Success');
        }
      } catch (err) {
        s.stop(`Failed to rebuild registry: ${err.message}`);
      }

      await input({ message: 'Press Enter to continue' }).catch(() => {});
    }

    if (action === 'toggle') {
      let selectedIds;
      try {
        selectedIds = await runWithEscape(checkbox, {
          message: 'Select sources to enable:',
          choices: sources.map(src => ({
            name: src.name,
            value: src.id,
            checked: src.enabled
          })),
          theme: CLACK_THEME
        });
      } catch (err) {
        continue;
      }

      if (selectedIds) {
        sources.forEach(src => {
          src.enabled = selectedIds.includes(src.id);
        });
        await saveSources(sources);
        note('Source settings updated.', 'Sources');
        await input({ message: 'Press Enter to continue' }).catch(() => {});
      }
    }

    if (action === 'add') {
      let id, name, url;
      try {
        id = await runWithEscape(input, {
          message: 'Enter unique source ID (kebab-case):',
          validate: (val) => {
            if (!val) return 'ID is required.';
            if (!/^[a-z0-9-]+$/.test(val)) return 'Must be lowercase kebab-case.';
            if (sources.some(s => s.id === val)) return 'Source ID already exists.';
            return true;
          }
        });

        name = await runWithEscape(input, {
          message: 'Enter human-readable source name:',
          validate: (val) => (val ? true : 'Name is required.')
        });

        url = await runWithEscape(input, {
          message: 'Enter Git repository URL:',
          validate: (val) => {
            if (!val) return 'URL is required.';
            if (!val.startsWith('http://') && !val.startsWith('https://') && !val.startsWith('git@') && !val.startsWith('git+https://')) {
              return 'Must be a valid HTTP/HTTPS or SSH git URL.';
            }
            return true;
          }
        });
      } catch (err) {
        continue;
      }

      sources.push({ id, name, url, enabled: true });
      await saveSources(sources);
      note(`Added source "${name}". Run 'Sync & Rebuild Registry' to index it.`, 'Sources');
      await input({ message: 'Press Enter to continue' }).catch(() => {});
    }

    if (action === 'remove') {
      const customSources = sources.filter(s => !s.builtin && s.id !== 'local');
      if (customSources.length === 0) {
        note('No custom sources available to remove.', 'Sources');
        await input({ message: 'Press Enter to continue' }).catch(() => {});
        continue;
      }

      let selectedId;
      try {
        selectedId = await runWithEscape(select, {
          message: 'Select custom source to remove:',
          choices: [
            ...customSources.map(s => ({ name: s.name, value: s.id })),
            { name: '⬅️ Go back', value: 'back' }
          ],
          theme: CLACK_THEME
        });
      } catch (err) {
        continue;
      }

      if (selectedId && selectedId !== 'back') {
        const confirmed = await confirm({
          message: `Are you sure you want to remove the source "${selectedId}"? This will not delete its local cache.`
        });
        if (confirmed && !isCancel(confirmed)) {
          const updatedSources = sources.filter(s => s.id !== selectedId);
          await saveSources(updatedSources);
          note(`Removed source "${selectedId}".`, 'Sources');
          await input({ message: 'Press Enter to continue' }).catch(() => {});
        }
      }
    }
  }
}

async function mainDashboard() {
  // Ensure target directories are ready
  try {
    await fs.ensureDir(GLOBAL_PLUGIN_DIR);
    await fs.ensureDir(GLOBAL_SKILLS_DIR);
    await fs.ensureDir(LOCAL_PLUGIN_DIR);
    await fs.ensureDir(LOCAL_SKILLS_DIR);

    // One-shot migration from the pre-v2 global skills path. Mirror to both
    // GLOBAL_SKILLS_DIR (runtime path) and GLOBAL_PLUGIN_DIR (canonical
    // "installed" marker — getInstalledPlugins reads this one) so migrated
    // skills remain manageable from the UI.
    const migrationFlag = path.join(os.homedir(), '.antigravity/.legacy-skills-migrated');
    if (!(await fs.pathExists(migrationFlag))) {
      const oldGlobalSkillsDir = path.join(os.homedir(), '.gemini/antigravity/skills');
      if (await fs.pathExists(oldGlobalSkillsDir)) {
        const skills = await fs.readdir(oldGlobalSkillsDir);
        for (const skill of skills) {
          const oldPath = path.join(oldGlobalSkillsDir, skill);
          for (const dest of [GLOBAL_SKILLS_DIR, GLOBAL_PLUGIN_DIR]) {
            const newPath = path.join(dest, skill);
            if (!(await fs.pathExists(newPath))) {
              await fs.copy(oldPath, newPath);
            }
          }
        }
      }
      await fs.ensureDir(path.dirname(migrationFlag));
      await fs.writeFile(migrationFlag, new Date().toISOString());
    }
  } catch (err) {
    console.warn(chalk.yellow(`\nWarning: Cannot access target directories or migrate old skills.\nGlobal: ${GLOBAL_PLUGIN_DIR}\nLocal: ${LOCAL_PLUGIN_DIR}\nReason: ${err.message}\n`));
  }

  while (true) {
    try {
      const registry = await getRegistry();
      showHeader();
      
      const choice = await runWithEscape(select, {
        message: 'antigravity-cli Ecosystem',
        choices: [
          { name: '📦 Browse & Install Selected', value: 'browse', description: `Explore all ${registry.length} plugins` },
          { name: '🔍 Search & Install Selected', value: 'search', description: 'Find plugins by keyword' },
          { name: '✅ Installed Plugins', value: 'status', description: 'Manage currently installed plugins' },
          { name: '⚙️  Manage Skill Sources', value: 'sources', description: 'Enable, disable, or add community skill repositories' },
          { name: '🚪 Exit', value: 'exit' }
        ],
        theme: CLACK_THEME
      });

      if (choice === 'exit') {
        process.exit(0);
      }

      if (choice === 'browse') await browseAndInstall(registry);
      if (choice === 'search') await searchAndInstall(registry);
      if (choice === 'status') await manageActivePlugins(registry);
      if (choice === 'sources') await manageSources();
    } catch (err) {
      if (isInquirerCancel(err)) {
        console.log(chalk.gray('\nExiting antigravity-cli Plugin Manager...'));
        process.exit(0);
      }
      console.error(chalk.red('\nError:'), err.message);
      await input({ message: 'Press Enter to return' }).catch(() => {});
    }
  }
}

mainDashboard().catch(err => {
  console.error(chalk.red('\nFatal Error:'), err.message);
  process.exit(1);
});
