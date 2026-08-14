const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('devcontainer installation does not make bubblewrap setuid', () => {
  const installer = fs.readFileSync(path.join(root, 'install-devcontainer.sh'), 'utf8');
  assert.doesNotMatch(installer, /chmod\s+u\+s\s+\/usr\/bin\/bwrap/);
});

test('devcontainer installation verifies the Codex sandbox prerequisite', (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-devcontainer-'));
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

  const bin = path.join(fixtureRoot, 'bin');
  const installMarker = path.join(fixtureRoot, 'contract-installed');
  fs.mkdirSync(bin);
  fs.copyFileSync(path.join(root, 'install-devcontainer.sh'), path.join(fixtureRoot, 'install-devcontainer.sh'));
  fs.writeFileSync(path.join(fixtureRoot, 'install.sh'), '#!/bin/bash\ntouch "$INSTALL_MARKER"\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'apt-get'), '#!/bin/bash\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(
    path.join(bin, 'bwrap'),
    '#!/bin/bash\necho "No permissions to create a new namespace" >&2\nexit 1\n',
    { mode: 0o755 },
  );

  const result = spawnSync('bash', [path.join(fixtureRoot, 'install-devcontainer.sh')], {
    encoding: 'utf8',
    env: { ...process.env, INSTALL_MARKER: installMarker, PATH: `${bin}:${process.env.PATH}` },
  });

  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(installMarker), false);
  assert.match(result.stderr, /Codex sandbox preflight failed/i);
  assert.match(result.stderr, /--security-opt=seccomp=unconfined/);
  assert.match(result.stderr, /--security-opt=apparmor=unconfined/);
  assert.match(result.stderr, /--cap-add=SYS_ADMIN/);
  assert.match(result.stderr, /rebuild the devcontainer/i);
});
