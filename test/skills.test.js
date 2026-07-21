const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('web search modes are explicit opt-ins rather than conflicting global triggers', () => {
  for (const name of [
    'web-search-rag-deep',
    'web-search-rag-official-deep',
    'web-search-rag-official-quick',
    'web-search-rag-quick',
  ]) {
    const content = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const description = content.match(/^description:\s*(.+)$/m)?.[1] || '';
    assert.match(description, /explicitly invokes/i, `${name} must be opt-in`);
    assert.doesNotMatch(description, /ALL user messages|If a user message exists/i);
  }
});
