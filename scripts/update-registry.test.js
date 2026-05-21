import { describe, it, expect } from 'vitest';
const { mergeBuiltinFlags } = require('./update-registry');

describe('mergeBuiltinFlags', () => {
  const shipped = [
    { id: 'local', builtin: true },
    { id: 'claude-skills-official', builtin: true },
    { id: 'claude-scientific-skills', builtin: true }
  ];

  it('stamps builtin onto legacy user entries that match a shipped id', () => {
    const userSources = [
      { id: 'claude-skills-official', enabled: true },
      { id: 'my-custom', enabled: true, url: 'https://example.com/repo.git' }
    ];
    const merged = mergeBuiltinFlags(userSources, shipped);
    expect(merged[0].builtin).toBe(true);
    expect(merged[1].builtin).toBeUndefined();
  });

  it('re-stamps builtin:false because false is treated as unset', () => {
    // We never write builtin:false ourselves; the only way to get one is by
    // someone hand-editing sources.json. We treat any falsy builtin value
    // as "needs migration" and re-stamp matching ids. Documented behavior.
    const userSources = [{ id: 'claude-skills-official', enabled: true, builtin: false }];
    const merged = mergeBuiltinFlags(userSources, shipped);
    expect(merged[0].builtin).toBe(true);
  });

  it('leaves custom (non-shipped) sources alone', () => {
    const userSources = [{ id: 'my-fork', enabled: true }];
    const merged = mergeBuiltinFlags(userSources, shipped);
    expect(merged[0].builtin).toBeUndefined();
  });

  it('handles missing or empty shipped sources gracefully', () => {
    expect(mergeBuiltinFlags([{ id: 'x' }], null)).toEqual([{ id: 'x' }]);
    expect(mergeBuiltinFlags([{ id: 'x' }], [])).toEqual([{ id: 'x' }]);
  });

  it('returns non-arrays unchanged', () => {
    expect(mergeBuiltinFlags(null, shipped)).toBeNull();
    expect(mergeBuiltinFlags(undefined, shipped)).toBeUndefined();
  });
});
