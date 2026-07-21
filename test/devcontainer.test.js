const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('devcontainer installation does not make bubblewrap setuid', () => {
  const installer = fs.readFileSync(path.join(root, 'install-devcontainer.sh'), 'utf8');
  assert.doesNotMatch(installer, /chmod\s+u\+s\s+\/usr\/bin\/bwrap/);
});
