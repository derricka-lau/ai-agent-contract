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

test('nested JSONC paths merge and restore without disturbing sibling or user keys', () => {
  const original = `${JSON.stringify({
    model: 'opus',
    permissions: { allow: ['Bash(git status)'] },
    autoMode: { soft_deny: ['$defaults'] },
  }, null, 2)}\n`;

  const applied = applyJsoncSettings(
    original,
    {
      permissions: { deny: ['Read(**/.env)'] },
      hooks: { PreToolUse: [{ matcher: '.*', hooks: [] }] },
    },
    { paths: [['permissions', 'deny'], ['hooks', 'PreToolUse']] },
  );

  const parsed = JSON.parse(applied.content);
  assert.equal(parsed.model, 'opus');
  assert.deepEqual(parsed.permissions.allow, ['Bash(git status)']);
  assert.deepEqual(parsed.permissions.deny, ['Read(**/.env)']);
  assert.deepEqual(parsed.autoMode, { soft_deny: ['$defaults'] });
  assert.equal(parsed.hooks.PreToolUse[0].matcher, '.*');

  parsed.theme = 'dark';
  const restored = restoreJsoncSettings(`${JSON.stringify(parsed, null, 2)}\n`, applied.changes);
  const restoredParsed = JSON.parse(restored.content);
  assert.equal(restoredParsed.model, 'opus');
  assert.equal(restoredParsed.theme, 'dark');
  assert.deepEqual(restoredParsed.permissions, { allow: ['Bash(git status)'] });
  assert.equal(restoredParsed.hooks, undefined);
  assert.deepEqual(restored.preservedKeys, []);
});
