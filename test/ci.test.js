const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('CI actions are immutable and have an update path', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
  const dependabot = fs.readFileSync(path.join(root, '.github', 'dependabot.yml'), 'utf8');

  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}\s+# v6\.0\.2/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}\s+# v6\.4\.0/);
  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@v\d+\s*$/m);
  assert.match(workflow, /for file in scripts\/\*\.js; do node --check "\$file"; done/);
  assert.match(dependabot, /package-ecosystem: "npm"/);
  assert.match(dependabot, /package-ecosystem: "github-actions"/);
  assert.match(dependabot, /interval: "monthly"/);
});
