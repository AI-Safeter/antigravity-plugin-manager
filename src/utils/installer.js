const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const chalk = require('chalk');
const { spawnSync } = require('child_process');
const { spinner, note, confirm, isCancel } = require('@clack/prompts');
const { select, input } = require('@inquirer/prompts');

const GLOBAL_PLUGIN_DIR = path.join(os.homedir(), '.antigravity/plugins');
const GLOBAL_SKILLS_DIR = path.join(os.homedir(), '.gemini/antigravity-cli/skills');

const LOCAL_PLUGIN_DIR = path.join(process.cwd(), '.antigravity/plugins');
const LOCAL_SKILLS_DIR = path.join(process.cwd(), '.agents/skills');

const V2_CYAN = chalk.hex('#22D3EE');

const CLACK_THEME = {
  prefix: {
    idle: chalk.hex('#8B5CF6')('◆ '),
    done: chalk.hex('#22D3EE')('▲ '),
  },
  icon: {
    cursor: chalk.hex('#8B5CF6')('❯ '),
    checked: chalk.hex('#22D3EE')('● '),
    unchecked: chalk.gray('○ '),
  },
  style: {
    message: (text) => chalk.white.bold(text),
    description: (text) => chalk.dim(text),
    keysHelpTip: (keys) => {
      return chalk.dim(
        keys.map(([key, action]) => `${chalk.bold(key)} ${action}`).join(' • ')
      );
    }
  }
};

function runGit(args, opts = {}) {
  const result = spawnSync('git', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...opts
  });
  if (result.error) {
    throw new Error(`git ${args[0]} failed to launch: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = (result.stderr || '').toString().trim();
    throw new Error(`git ${args[0]} exited with code ${result.status}${stderr ? `: ${stderr}` : ''}`);
  }
  return result;
}

function safeResolve(baseDir, targetName) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, targetName);
  const relative = path.relative(resolvedBase, resolvedTarget);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Security Exception: Path traversal attempt blocked for '${targetName}'`);
  }
  return resolvedTarget;
}

function isInquirerCancel(err) {
  return err && (
    err.name === 'ExitPromptError' ||
    err.name === 'AbortPromptError' ||
    (err.message && (err.message.includes('force closed') || err.message.includes('aborted')))
  );
}

async function runWithEscape(promptFn, config) {
  const controller = new AbortController();
  const handleKeypress = (_, key) => {
    if (key && key.name === 'escape') {
      controller.abort();
    }
  };
  
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.on('keypress', handleKeypress);

  try {
    return await promptFn(config, { signal: controller.signal });
  } finally {
    process.stdin.off('keypress', handleKeypress);
  }
}

async function getInstalledPlugins() {
  const readDirs = async (dir) => {
    if (!(await fs.pathExists(dir))) return [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  };

  // PLUGIN_DIR is the canonical source of truth. SKILLS_DIR is a mirror
  // installPluginsCore writes for runtime path compatibility; reading it too
  // would cause stale entries to "linger" after a partial uninstall.
  const globalList = await readDirs(GLOBAL_PLUGIN_DIR);
  const localList = await readDirs(LOCAL_PLUGIN_DIR);

  const allInstalled = Array.from(new Set([...globalList, ...localList]));
  return {
    all: allInstalled,
    global: globalList,
    local: localList
  };
}

async function installPluginsCore(selectedIds, registry, scope) {
  if (selectedIds.length === 0) return { success: [], fail: [] };

  const basePluginDir = scope === 'user' ? GLOBAL_PLUGIN_DIR : LOCAL_PLUGIN_DIR;
  const baseSkillDir = scope === 'user' ? GLOBAL_SKILLS_DIR : LOCAL_SKILLS_DIR;

  const results = { success: [], fail: [] };

  for (const id of selectedIds) {
    const plugin = registry.find(p => p.id === id);
    if (!plugin) continue;

    try {
      // Two source layouts are supported:
      //   - Folder skill: source has a directory containing SKILL.md (+ assets).
      //     plugin.relativeSkillDir points to that directory.
      //   - Single-file skill: source ships a one-file rule like awesome-cursorrules'
      //     .mdc files. plugin.relativeSkillFile points to the single file; we
      //     install it as <target>/<basename> inside a fresh skill folder.
      let sourceDir = null;
      let sourceFile = null;
      if (plugin.source && plugin.source !== 'local') {
        const cacheDir = path.join(os.homedir(), '.antigravity/cache/sources', plugin.source);
        if (!(await fs.pathExists(cacheDir))) {
          await fs.ensureDir(path.dirname(cacheDir));
          try {
            runGit(['clone', '--depth', '1', '--', plugin.repository, cacheDir]);
          } catch (cloneErr) {
            throw new Error(`Failed to clone remote repository '${plugin.repository}': ${cloneErr.message}`);
          }
        }
        if (plugin.relativeSkillFile) {
          sourceFile = safeResolve(cacheDir, plugin.relativeSkillFile);
        } else {
          sourceDir = safeResolve(cacheDir, plugin.relativeSkillDir);
        }
      } else {
        sourceDir = safeResolve(path.join(__dirname, '../../plugins'), plugin.id);
      }

      const skillTarget = safeResolve(baseSkillDir, plugin.id);
      const pluginTarget = safeResolve(basePluginDir, plugin.id);

      if (sourceDir && !(await fs.pathExists(sourceDir))) {
        throw new Error(`Source plugin directory does not exist at ${sourceDir} for '${id}'`);
      }
      if (sourceFile && !(await fs.pathExists(sourceFile))) {
        throw new Error(`Source plugin file does not exist at ${sourceFile} for '${id}'`);
      }

      // Remove pre-existing directories, files, or symlinks to ensure clean & safe copying
      for (const target of [skillTarget, pluginTarget]) {
        try {
          const exists = await fs.pathExists(target);
          let isSym = false;
          try {
            const stat = await fs.lstat(target);
            isSym = stat.isSymbolicLink();
          } catch (statErr) {
            // Target does not exist or cannot be stat'd
          }
          if (exists || isSym) {
            await fs.remove(target);
          }
        } catch (cleanupErr) {
          // Ignore cleanup failures; copying will attempt or fail safely
        }
      }

      await fs.ensureDir(path.dirname(skillTarget));
      await fs.ensureDir(path.dirname(pluginTarget));

      // Untrusted remote sources: reject any symlinks before they hit the
      // user's filesystem. A skill repo with `link -> ~/.ssh/id_rsa` would
      // otherwise become a readable file in ~/.antigravity/plugins/<id>/.
      const copyOpts = {};
      if (plugin.source && plugin.source !== 'local' && sourceDir) {
        copyOpts.filter = (src) => {
          const stat = fs.lstatSync(src);
          if (stat.isSymbolicLink()) {
            throw new Error(`Refusing to copy symlink from remote source: ${path.relative(sourceDir, src) || src}`);
          }
          return true;
        };
      }

      // Single-file source path (awesome-cursorrules .mdc rules): make a
      // folder per target and drop the upstream file inside, alongside a
      // generated SKILL.md whose body verbatim mirrors the .mdc content.
      if (sourceFile) {
        const content = await fs.readFile(sourceFile, 'utf8');
        const fileBasename = path.basename(sourceFile);
        const skillMd = `---\nname: ${plugin.name}\ndescription: ${JSON.stringify(plugin.description || '').slice(1, -1)}\nupstream: ${plugin.repository}\n---\n\n${content}\n`;
        for (const target of [skillTarget, pluginTarget]) {
          await fs.ensureDir(target);
          await fs.writeFile(path.join(target, fileBasename), content);
          await fs.writeFile(path.join(target, 'SKILL.md'), skillMd);
        }
        results.success.push(plugin.name);
        continue;
      }

      // PLUGIN_DIR is the canonical "installed" marker (see getInstalledPlugins).
      // Copy SKILLS_DIR first so an interruption between the two leaves the user
      // with "not installed" rather than "half installed, can't uninstall".
      await fs.copy(sourceDir, skillTarget, copyOpts);
      await fs.copy(sourceDir, pluginTarget, copyOpts);
      results.success.push(plugin.name);
    } catch (err) {
      results.fail.push(`${plugin.name}: ${err.message}`);
    }
  }

  return results;
}

async function uninstallPlugin(id, scope) {
  const basePluginDir = scope === 'user' ? GLOBAL_PLUGIN_DIR : LOCAL_PLUGIN_DIR;
  const baseSkillDir = scope === 'user' ? GLOBAL_SKILLS_DIR : LOCAL_SKILLS_DIR;

  const skillTarget = safeResolve(baseSkillDir, id);
  const pluginTarget = safeResolve(basePluginDir, id);

  await fs.remove(skillTarget);
  await fs.remove(pluginTarget);
}

module.exports = {
  GLOBAL_PLUGIN_DIR,
  GLOBAL_SKILLS_DIR,
  LOCAL_PLUGIN_DIR,
  LOCAL_SKILLS_DIR,
  getInstalledPlugins,
  installPluginsCore,
  isInquirerCancel,
  safeResolve,
  uninstallPlugin,
  runWithEscape,
  runGit,
  CLACK_THEME
};
