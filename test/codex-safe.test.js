const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('codex-safe resolves binaries without a compatibility fallback', () => {
  const wrapper = fs.readFileSync(path.join(root, 'codex-safe'), 'utf8');
  assert.doesNotMatch(wrapper, /readlink -f|\|\|\s+printf/);
  assert.match(wrapper, /realpathSync\.native/);
});

function createFixture(t, codexBehaviour) {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

  const home = path.join(testRoot, 'home');
  const bin = path.join(testRoot, 'bin');
  const metadataRoot = path.join(home, '.local', 'share', 'ai-agent-contract');
  const capturePath = path.join(testRoot, 'codex-args');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(metadataRoot, { recursive: true });
  fs.writeFileSync(
    path.join(metadataRoot, 'runtime-profiles.json'),
    `${JSON.stringify({ defaultProfile: 'custom', profiles: { custom: { model: 'test' } } }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(bin, 'codex'),
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      ...codexBehaviour,
      'printf \'%s\\n\' "$@" > "$CODEX_ARGS_CAPTURE"',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );

  return {
    capturePath,
    env: {
      ...process.env,
      CODEX_ARGS_CAPTURE: capturePath,
      HOME: home,
      PATH: `${bin}:${process.env.PATH}`,
    },
  };
}

function runWrapper(fixture, args = []) {
  execFileSync(path.join(root, 'codex-safe'), args, {
    env: fixture.env,
    stdio: 'pipe',
  });
}

test('codex-safe gets its default profile from installed runtime metadata', (t) => {
  const fixture = createFixture(t, [
    'if [[ "${1:-}" == "sandbox" ]]; then exit 0; fi',
  ]);
  runWrapper(fixture);

  assert.deepEqual(fs.readFileSync(fixture.capturePath, 'utf8').trim().split('\n'), [
    '--profile',
    'custom',
  ]);
});

test('codex-safe never replaces a failed sandbox with full access', (t) => {
  const fixture = createFixture(t, [
    'if [[ "${1:-}" == "sandbox" ]]; then',
    '  echo "No permissions to create a new namespace" >&2',
    '  exit 1',
    'fi',
  ]);
  runWrapper(fixture);

  assert.deepEqual(fs.readFileSync(fixture.capturePath, 'utf8').trim().split('\n'), [
    '--profile',
    'custom',
  ]);
});

test('codex-safe refuses arguments that disable deterministic policy', (t) => {
  const blockedArguments = [
    ['--dangerously-bypass-approvals-and-sandbox'],
    ['--sandbox', 'danger-full-access'],
    ['-s', 'read-only'],
    ['--config', 'default_permissions="other"'],
    ['-c', 'permissions.contract-workspace.filesystem.":workspace_roots"={"."="write"}'],
    ['--disable', 'hooks'],
  ];

  for (const args of blockedArguments) {
    const fixture = createFixture(t, []);
    assert.throws(
      () => runWrapper(fixture, args),
      (error) => {
        assert.equal(error.status, 64);
        assert.match(error.stderr.toString(), /refusing/i);
        return true;
      },
    );
    assert.equal(fs.existsSync(fixture.capturePath), false);
  }
});
