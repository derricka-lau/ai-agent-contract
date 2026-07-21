const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('install scripts delegate ownership to the managed transaction helper', () => {
  const install = fs.readFileSync(path.join(root, 'install.sh'), 'utf8');
  const uninstall = fs.readFileSync(path.join(root, 'uninstall.sh'), 'utf8');
  const devcontainer = fs.readFileSync(path.join(root, 'install-devcontainer.sh'), 'utf8');

  assert.match(install, /scripts\/managed-files\.js" install/);
  assert.match(uninstall, /scripts\/managed-files\.js" uninstall/);
  assert.doesNotMatch(install, /npm install -g|@latest|backup_existing|write_manifest|cp -a/);
  assert.doesNotMatch(uninstall, /rm -rf|remove_path|--unset core\.hooksPath/);
  assert.doesNotMatch(devcontainer, /ln -s|link_codex_safe/);
  assert.match(install, /default_permissions = "contract-workspace"/);
  assert.doesNotMatch(install, /sandbox_mode = "workspace-write"/);
});
