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
