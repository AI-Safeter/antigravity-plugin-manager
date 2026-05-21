const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const os = require('os');
const { spawnSync } = require('child_process');

// Local minimal runGit so this script stays free of the CLI's UI deps.
function runGit(args, opts = {}) {
  const result = spawnSync('git', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...opts
  });
  if (result.error) throw new Error(`git ${args[0]} failed to launch: ${result.error.message}`);
  if (result.status !== 0) {
    const stderr = (result.stderr || '').toString().trim();
    throw new Error(`git ${args[0]} exited with code ${result.status}${stderr ? `: ${stderr}` : ''}`);
  }
  return result;
}

// Bump this when changing the registry.json shape so old user-side registries
// at ~/.antigravity/registry.json get rebuilt automatically on next launch.
const REGISTRY_SCHEMA_VERSION = 1;

const DEFAULT_SOURCES = [
  { id: 'local', name: 'Local Core Plugins', url: 'local', enabled: true, builtin: true }
];

function loadCuratedSkills() {
  const curatedPath = path.join(__dirname, '../curated-skills.json');
  try {
    return fs.readJsonSync(curatedPath);
  } catch (err) {
    console.warn(`Warning: could not load curated-skills.json (${err.message}). Continuing without curation overrides.`);
    return {};
  }
}

async function findSkills(dir) {
  const results = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.gemini') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const skillFile = path.join(fullPath, 'SKILL.md');
        if (await fs.pathExists(skillFile)) {
          results.push(skillFile);
        } else {
          const subResults = await findSkills(fullPath);
          results.push(...subResults);
        }
      }
    }
  } catch (err) {
    // Ignore traversal errors so a single bad dir can't sink the whole sync
  }
  return results;
}

// Forward-fix for users whose ~/.antigravity/sources.json predates the "builtin"
// flag: stamp builtin=true onto entries whose id matches a shipped default.
// Without this, the "Remove Source" flow would treat all built-in registries
// as removable for upgrading users.
function mergeBuiltinFlags(userSources, shippedSources) {
  if (!Array.isArray(userSources)) return userSources;
  const builtinIds = new Set(
    (shippedSources || [])
      .filter(s => s && s.builtin)
      .map(s => s.id)
  );
  return userSources.map(s => {
    if (s && !s.builtin && builtinIds.has(s.id)) {
      return { ...s, builtin: true };
    }
    return s;
  });
}

async function loadSources(explicit) {
  if (explicit) return explicit;

  const userSourcesPath = path.join(os.homedir(), '.antigravity/sources.json');
  const defaultSourcesPath = path.join(__dirname, '../sources.json');

  let shipped = null;
  if (await fs.pathExists(defaultSourcesPath)) {
    try { shipped = await fs.readJson(defaultSourcesPath); } catch (err) { /* ignore */ }
  }

  if (await fs.pathExists(userSourcesPath)) {
    try {
      const userSources = await fs.readJson(userSourcesPath);
      if (Array.isArray(userSources) && userSources.length > 0) {
        return mergeBuiltinFlags(userSources, shipped);
      }
    } catch (err) {
      // fall through to shipped
    }
  }

  if (Array.isArray(shipped) && shipped.length > 0) return shipped;
  return DEFAULT_SOURCES;
}

async function isCachePopulated(cacheDir) {
  // A bare-existing directory isn't enough: an interrupted clone leaves an
  // empty folder that would silently produce zero entries. Require a .git
  // subdir to consider the cache usable.
  if (!(await fs.pathExists(cacheDir))) return false;
  if (!(await fs.pathExists(path.join(cacheDir, '.git')))) return false;
  return true;
}

async function syncMissingRemoteCaches(sources, { onProgress } = {}) {
  const log = onProgress || ((msg) => console.log(msg));
  for (const src of sources) {
    if (!src.enabled || src.id === 'local') continue;
    const cacheDir = path.join(os.homedir(), '.antigravity/cache/sources', src.id);
    if (await isCachePopulated(cacheDir)) continue;
    log(`Cloning ${src.name} (${src.url}) ...`);
    // If a stale empty/partial directory exists, remove it before cloning.
    if (await fs.pathExists(cacheDir)) await fs.remove(cacheDir);
    await fs.ensureDir(path.dirname(cacheDir));
    try {
      runGit(['clone', '--depth', '1', '--', src.url, cacheDir]);
    } catch (err) {
      throw new Error(
        `Failed to clone source '${src.id}' from ${src.url}: ${err.message}. ` +
        `Check your network, or clone the source manually into ${cacheDir} and re-run.`
      );
    }
  }
}

async function generateRegistry(options = {}) {
  const defaultRegistryPath = path.join(__dirname, '../registry.json');
  const registryPath = options.registryPath || defaultRegistryPath;
  const isShippedRegistry = path.resolve(registryPath) === path.resolve(defaultRegistryPath);

  let pkgRepo = 'https://github.com/AI-Safeter/antigravity-plugin-manager';
  try {
    const pkg = await fs.readJson(path.join(__dirname, '../package.json'));
    if (pkg && pkg.repository && pkg.repository.url) {
      pkgRepo = pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
    }
  } catch (e) {
    // Fallback
  }

  const sources = await loadSources(options.sources);
  const curated = loadCuratedSkills();

  // Optionally clone any missing remote source caches up-front. This is what
  // `npm run registry` does so a first-time contributor doesn't need to know
  // about the in-CLI Sync flow before regenerating.
  if (options.autoSync) {
    await syncMissingRemoteCaches(sources);
  }

  // Guard contributors from accidentally clobbering the shipped registry by running
  // `npm run registry` without first populating the remote source cache. The CLI
  // (which writes to USER_REGISTRY_PATH) bypasses this on purpose.
  if (isShippedRegistry && !options.allowEmptyCache) {
    const missing = [];
    for (const src of sources) {
      if (!src.enabled || src.id === 'local') continue;
      const cacheDir = path.join(os.homedir(), '.antigravity/cache/sources', src.id);
      if (!(await isCachePopulated(cacheDir))) missing.push(src.id);
    }
    if (missing.length > 0) {
      throw new Error(
        `Refusing to write shipped registry.json: missing or empty remote source cache for [${missing.join(', ')}]. ` +
        `Re-run with autoSync (default for "npm run registry"), or remove the empty cache directories and retry.`
      );
    }
  }

  const plugins = [];
  let localCount = 0;
  let remoteCount = 0;

  for (const source of sources) {
    if (!source.enabled) continue;

    if (source.id === 'local') {
      const pluginsDir = path.join(__dirname, '../plugins');
      if (!(await fs.pathExists(pluginsDir))) continue;

      const folders = await fs.readdir(pluginsDir);
      for (const folder of folders) {
        const skillPath = path.join(pluginsDir, folder, 'SKILL.md');
        if (!(await fs.pathExists(skillPath))) continue;

        let content;
        try {
          content = await fs.readFile(skillPath, 'utf8');
        } catch (err) {
          console.error(`Error reading ${skillPath}: ${err.message}`);
          continue;
        }

        const meta = {
          id: folder,
          name: folder,
          description: 'No description available',
          repository: pkgRepo,
          type: 'skill',
          source: 'local'
        };

        const match = content.match(/^---([\s\S]*?)---/);
        if (match) {
          try {
            const parsed = yaml.load(match[1]);
            if (parsed && typeof parsed === 'object') {
              meta.name = parsed.name || meta.name;
              meta.description = parsed.description || meta.description;
            }
          } catch (e) {
            console.error(`Error parsing YAML in local plugin ${folder}: ${e.message}`);
          }
        }
        plugins.push(meta);
        localCount++;
      }
    } else {
      const cacheDir = path.join(os.homedir(), '.antigravity/cache/sources', source.id);
      if (!(await fs.pathExists(cacheDir))) continue;

      const skillFiles = await findSkills(cacheDir);
      for (const skillFile of skillFiles) {
        const relativeSkillDir = path.relative(cacheDir, path.dirname(skillFile));
        const idSafeRelative = relativeSkillDir.replace(/[\\/]/g, '--').toLowerCase();
        const skillId = `${source.id}--${idSafeRelative}`;

        const includeAllFromSource = source.id === 'claude-skills-official' || source.id === 'claude-scientific-skills';
        const isCurated = !!curated[skillId];

        if (!includeAllFromSource && !isCurated) continue;

        let content;
        try {
          content = await fs.readFile(skillFile, 'utf8');
        } catch (err) {
          continue;
        }

        const folderName = path.basename(path.dirname(skillFile));
        const meta = {
          id: skillId,
          name: folderName,
          description: 'No description available',
          repository: source.url,
          type: 'skill',
          source: source.id,
          relativeSkillDir
        };

        if (isCurated) {
          meta.name = curated[skillId].name;
          meta.description = curated[skillId].description;
        } else {
          const match = content.match(/^---([\s\S]*?)---/);
          if (match) {
            try {
              const parsed = yaml.load(match[1]);
              if (parsed && typeof parsed === 'object') {
                meta.name = parsed.name || meta.name;
                meta.description = parsed.description || meta.description;
              }
            } catch (e) {
              // ignore
            }
          }
        }

        plugins.push(meta);
        remoteCount++;
      }
    }
  }

  // generatedAt is intentionally omitted to keep the committed registry.json
  // diff-stable across regenerations. Schema mismatches drive rebuilds, not age.
  const registry = {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    plugins
  };

  try {
    await fs.ensureDir(path.dirname(registryPath));
    await fs.writeJson(registryPath, registry, { spaces: 2 });
    console.log(`Generated registry with ${plugins.length} skills (${localCount} local, ${remoteCount} remote).`);
    return registry;
  } catch (err) {
    throw new Error(`Failed to write registry.json: ${err.message}`);
  }
}

module.exports = {
  generateRegistry,
  REGISTRY_SCHEMA_VERSION,
  mergeBuiltinFlags,
  syncMissingRemoteCaches
};

if (require.main === module) {
  generateRegistry({ autoSync: true }).catch(err => {
    console.error('Critical error generating registry:', err.message);
    process.exit(1);
  });
}
