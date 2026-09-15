const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('devcontainer contract installation does not depend on Bubblewrap', (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-devcontainer-'));
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

  const bin = path.join(fixtureRoot, 'bin');
  const installMarker = path.join(fixtureRoot, 'contract-installed');
  fs.mkdirSync(bin);
  fs.copyFileSync(path.join(root, 'install-devcontainer.sh'), path.join(fixtureRoot, 'install-devcontainer.sh'));
  fs.writeFileSync(path.join(fixtureRoot, 'install.sh'), '#!/bin/bash\ntouch "$INSTALL_MARKER"\n', { mode: 0o755 });
  fs.writeFileSync(
    path.join(bin, 'bwrap'),
    '#!/bin/bash\necho "No permissions to create a new namespace" >&2\nexit 1\n',
    { mode: 0o755 },
  );

  const result = spawnSync('bash', [
    path.join(fixtureRoot, 'install-devcontainer.sh'),
    '--profile', 'hardened',
  ], {
    encoding: 'utf8',
    env: { ...process.env, INSTALL_MARKER: installMarker, PATH: `${bin}:${process.env.PATH}` },
  });

  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(installMarker), true);
});
