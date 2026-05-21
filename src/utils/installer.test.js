import { describe, it, expect, vi } from 'vitest';
const { safeResolve, installPluginsCore, runGit } = require('./installer');
const path = require('path');
const os = require('os');

describe('installer.js', () => {
  describe('safeResolve', () => {
    it('should resolve a valid relative path within the base directory', () => {
      const baseDir = '/home/user/plugins';
      const targetName = 'my-plugin';
      const resolved = safeResolve(baseDir, targetName);
      expect(resolved).toBe(path.resolve(baseDir, targetName));
    });

    it('should throw an error for path traversal (..)', () => {
      const baseDir = '/home/user/plugins';
      const targetName = '../etc/passwd';
      expect(() => {
        safeResolve(baseDir, targetName);
      }).toThrow(/Security Exception: Path traversal attempt blocked/);
    });

    it('should throw an error for absolute paths', () => {
      const baseDir = '/home/user/plugins';
      const targetName = '/etc/passwd';
      expect(() => {
        safeResolve(baseDir, targetName);
      }).toThrow(/Security Exception: Path traversal attempt blocked/);
    });

    it('should block nested path traversal attempts', () => {
      const baseDir = '/home/user/plugins';
      const targetName = 'plugin/../../etc/passwd';
      expect(() => {
        safeResolve(baseDir, targetName);
      }).toThrow(/Security Exception: Path traversal attempt blocked/);
    });

    it('should throw an error for targetName resolving to base directory itself (.)', () => {
      const baseDir = '/home/user/plugins';
      const targetName = '.';
      expect(() => {
        safeResolve(baseDir, targetName);
      }).toThrow(/Security Exception: Path traversal/);
    });

    it('should throw an error for targetName being empty', () => {
      const baseDir = '/home/user/plugins';
      const targetName = '';
      expect(() => {
        safeResolve(baseDir, targetName);
      }).toThrow(/Security Exception: Path traversal/);
    });

    it('should throw an error for targetName resolving to base directory using folder name tricks', () => {
      const baseDir = '/home/user/plugins';
      const targetName = '../plugins';
      expect(() => {
        safeResolve(baseDir, targetName);
      }).toThrow(/Security Exception: Path traversal/);
    });
  });

  describe('runGit', () => {
    it('treats URL-like arguments as path values, not shell tokens', () => {
      // If runGit used a shell, this would attempt rm. Because we use spawnSync with
      // an argv array, git just sees an unknown subcommand and exits non-zero.
      const malicious = 'https://example.com; rm -rf /tmp/should-not-exist';
      expect(() => runGit(['ls-remote', '--', malicious])).toThrow(/git ls-remote/);
    });

    it('throws a helpful error when git itself fails', () => {
      expect(() => runGit(['this-subcommand-does-not-exist'])).toThrow(/git this-subcommand-does-not-exist/);
    });
  });

  describe('installPluginsCore', () => {
    it('should check for and remove pre-existing symlinks at destination paths before copying', async () => {
      const fs = require('fs-extra');

      // Mock fs.pathExists to return true
      const pathExistsSpy = vi.spyOn(fs, 'pathExists').mockImplementation(async (p) => {
        if (p.includes('plugins/my-test-id')) return true; // sourceDir exists
        return true; // target exists
      });

      // Mock fs.lstat to return a simulated symlink stat
      const lstatSpy = vi.spyOn(fs, 'lstat').mockImplementation(async (p) => {
        return {
          isSymbolicLink: () => true
        };
      });

      // Mock fs.remove to succeed
      const removeSpy = vi.spyOn(fs, 'remove').mockResolvedValue(undefined);

      // Mock fs.ensureDir and fs.copy to succeed
      const ensureDirSpy = vi.spyOn(fs, 'ensureDir').mockResolvedValue(undefined);
      const copySpy = vi.spyOn(fs, 'copy').mockResolvedValue(undefined);

      const registry = [{ id: 'my-test-id', name: 'Test Plugin' }];
      const result = await installPluginsCore(['my-test-id'], registry, 'project');

      expect(lstatSpy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
      expect(copySpy).toHaveBeenCalled();
      expect(result.success).toContain('Test Plugin');

      // Restore spies
      pathExistsSpy.mockRestore();
      lstatSpy.mockRestore();
      removeSpy.mockRestore();
      ensureDirSpy.mockRestore();
      copySpy.mockRestore();
    });
  });
});
