const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('uninstall preserves unrelated files when no ownership ledger exists', (t) => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

  const home = path.join(testRoot, 'home');
  const sentinel = path.join(home, '.codex', 'user-owned.toml');
  const globalGit = path.join(testRoot, 'global.gitconfig');

  fs.mkdirSync(path.dirname(sentinel), { recursive: true });
  fs.writeFileSync(sentinel, 'user-owned\n');

  execFileSync('bash', [path.join(root, 'uninstall.sh')], {
    cwd: root,
    env: {
      ...process.env,
      HOME: home,
      GIT_CONFIG_GLOBAL: globalGit,
      XDG_CONFIG_HOME: path.join(home, '.config'),
    },
    stdio: 'pipe',
  });

  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'user-owned\n');
  assert.equal(fs.existsSync(path.join(home, '.local')), false);
});
