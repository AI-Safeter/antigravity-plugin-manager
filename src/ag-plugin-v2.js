#!/usr/bin/env node

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spinner, note, confirm, isCancel } = require('@clack/prompts');
const { checkbox, select, input } = require('@inquirer/prompts');
const { generateRegistry } = require('../scripts/update-registry');

const REGISTRY_PATH = path.join(__dirname, '../registry.json');

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
  CLACK_THEME
} = require('./utils/installer');

const { interactiveSearchCheckbox } = require('./ui/search-prompt');

const V2_CYAN = chalk.hex('#22D3EE');
const V2_VIOLET = chalk.hex('#8B5CF6');

async function getRegistry() {
  try {
    if (!(await fs.pathExists(REGISTRY_PATH))) {
      await generateRegistry();
    }
    const registry = await fs.readJson(REGISTRY_PATH);
    if (!Array.isArray(registry)) {
      throw new Error('Registry format is invalid (not an array).');
    }
    return registry;
  } catch (err) {
    console.warn(chalk.yellow(`\nRegistry is missing or corrupt: ${err.message}. Attempting to rebuild registry...`));
    try {
      await generateRegistry();
      const registry = await fs.readJson(REGISTRY_PATH);
      if (!Array.isArray(registry)) {
        throw new Error('Rebuilt registry is invalid.');
      }
      return registry;
    } catch (rebuildErr) {
      throw new Error(`Unable to load registry: ${rebuildErr.message}`);
    }
  }
}

function showHeader() {
  console.clear();
  const title = ` ${V2_VIOLET.bold('ANTIGRAVITY-CLI')} ${V2_CYAN.bold('PLUGIN MANAGER')} `;
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
  let selectedIds;
  try {
    selectedIds = await runWithEscape(checkbox, {
      message: `Select plugins (Space: toggle, Enter: install, Esc: go back):`,
      choices: registry.map(p => ({
        name: `${p.name} (${p.id})`,
        value: p.id,
        description: p.description.substring(0, 80)
      })),
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
    if (isInquirerCancel(err)) {
      return; // Return silently to main dashboard
    }
    throw err;
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

async function mainDashboard() {
  // Ensure target directories are ready
  try {
    await fs.ensureDir(GLOBAL_PLUGIN_DIR);
    await fs.ensureDir(GLOBAL_SKILLS_DIR);
    await fs.ensureDir(LOCAL_PLUGIN_DIR);
    await fs.ensureDir(LOCAL_SKILLS_DIR);

    // Migrate previously installed global skills if they exist
    const oldGlobalSkillsDir = path.join(os.homedir(), '.gemini/antigravity/skills');
    if (await fs.pathExists(oldGlobalSkillsDir)) {
      const skills = await fs.readdir(oldGlobalSkillsDir);
      for (const skill of skills) {
        const oldPath = path.join(oldGlobalSkillsDir, skill);
        const newPath = path.join(GLOBAL_SKILLS_DIR, skill);
        if (!(await fs.pathExists(newPath))) {
          await fs.copy(oldPath, newPath);
        }
      }
    }
  } catch (err) {
    console.warn(chalk.yellow(`\nWarning: Cannot access target directories or migrate old skills.\nGlobal: ${GLOBAL_PLUGIN_DIR}\nLocal: ${LOCAL_PLUGIN_DIR}\nReason: ${err.message}\n`));
  }

  const registry = await getRegistry();

  while (true) {
    try {
      showHeader();
      
      const choice = await runWithEscape(select, {
        message: 'antigravity-cli Ecosystem',
        choices: [
          { name: '📦 Browse & Install Selected', value: 'browse', description: `Explore all ${registry.length} plugins` },
          { name: '🔍 Search & Install Selected', value: 'search', description: 'Find plugins by keyword' },
          { name: '✅ Installed Plugins', value: 'status', description: 'Manage currently installed plugins' },
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
