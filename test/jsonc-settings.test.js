const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyJsoncSettings,
  restoreJsoncSettings,
} = require('../scripts/managed-files');

test('JSONC settings preserve comments and restore only managed keys', () => {
  const original = [
    '{',
    '  // Keep this user comment.',
    '  "editor.fontSize": 15,',
    '  "chat.useClaudeMdFile": true,',
    '}',
    '',
  ].join('\n');

  const applied = applyJsoncSettings(original, {
    'chat.useClaudeMdFile': false,
  });

  assert.match(applied.content, /\/\/ Keep this user comment\./);
  assert.match(applied.content, /"chat\.useClaudeMdFile": false/);
  assert.deepEqual(applied.changes, [
    {
      key: 'chat.useClaudeMdFile',
      installedValue: false,
      previous: { exists: true, value: true },
    },
  ]);

  const userEdited = applied.content.replace(
    '"editor.fontSize": 15',
    '"editor.fontSize": 16',
  );
  const restored = restoreJsoncSettings(userEdited, applied.changes);

  assert.match(restored.content, /\/\/ Keep this user comment\./);
  assert.match(restored.content, /"editor\.fontSize": 16/);
  assert.match(restored.content, /"chat\.useClaudeMdFile": true/);
  assert.deepEqual(restored.preservedKeys, []);
});

test('nested JSONC settings preserve sibling and top-level user keys and clean up created parents', () => {
  const original = `${JSON.stringify({
    autoMode: true,
    model: 'claude-opus-5-5',
    enabledPlugins: { example: true },
    theme: 'dark',
    permissions: {
      allow: ['Bash(git status)'],
    },
  }, null, 2)}\n`;

  const applied = applyJsoncSettings(original, [
    { path: ['permissions', 'deny'], value: ['Read(**/.env.local)'] },
    { path: ['hooks', 'PreToolUse'], value: [{ matcher: '.*', hooks: [] }] },
  ]);

  const merged = JSON.parse(applied.content);
  assert.equal(merged.autoMode, true);
  assert.equal(merged.model, 'claude-opus-5-5');
  assert.deepEqual(merged.enabledPlugins, { example: true });
  assert.equal(merged.theme, 'dark');
  assert.deepEqual(merged.permissions.allow, ['Bash(git status)']);
  assert.deepEqual(merged.permissions.deny, ['Read(**/.env.local)']);
  assert.deepEqual(merged.hooks.PreToolUse, [{ matcher: '.*', hooks: [] }]);

  const edited = JSON.parse(applied.content);
  edited.theme = 'light';
  const restored = restoreJsoncSettings(`${JSON.stringify(edited, null, 2)}\n`, applied.changes);
  const afterRestore = JSON.parse(restored.content);

  assert.equal(afterRestore.theme, 'light');
  assert.deepEqual(afterRestore.permissions, { allow: ['Bash(git status)'] });
  assert.equal(Object.hasOwn(afterRestore, 'hooks'), false);
  assert.deepEqual(restored.preservedKeys, []);
});
