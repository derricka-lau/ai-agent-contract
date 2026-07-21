const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  acquireOperationLock,
  releaseOperationLock,
  unlockStaleOperationLock,
} = require('../scripts/managed-files');

function createStateRoot(t) {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));
  return path.join(testRoot, 'state');
}

function findMissingPid() {
  for (let pid = Math.max(process.pid + 10000, 100000); pid < 4194304; pid += 7919) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === 'ESRCH') {
        return pid;
      }
      if (error.code !== 'EPERM') {
        throw error;
      }
    }
  }
  throw new Error('Unable to find an unused process ID for the test');
}

test('operation lock rejects concurrent acquisition and releases by token', (t) => {
  const stateRoot = createStateRoot(t);
  const lock = acquireOperationLock(stateRoot, 'install');

  assert.equal(lock.owner.schemaVersion, 1);
  assert.equal(lock.owner.pid, process.pid);
  assert.equal(lock.owner.operation, 'install');
  assert.match(lock.owner.startedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(lock.owner.token, /^[0-9a-f-]{36}$/);
  assert.throws(
    () => acquireOperationLock(stateRoot, 'update'),
    /operation is already active/i,
  );

  releaseOperationLock(lock);
  assert.equal(fs.existsSync(lock.path), false);

  const nextLock = acquireOperationLock(stateRoot, 'update');
  releaseOperationLock(nextLock);
});

test('operation lock refuses release with a different token', (t) => {
  const stateRoot = createStateRoot(t);
  const lock = acquireOperationLock(stateRoot, 'install');

  assert.throws(
    () => releaseOperationLock({ ...lock, token: 'different-token' }),
    /token mismatch/i,
  );
  assert.equal(fs.existsSync(lock.path), true);

  releaseOperationLock(lock);
});

test('explicit unlock refuses an active process', (t) => {
  const stateRoot = createStateRoot(t);
  const lock = acquireOperationLock(stateRoot, 'install');

  assert.throws(
    () => unlockStaleOperationLock(stateRoot),
    /process is still active/i,
  );
  assert.equal(fs.existsSync(lock.path), true);

  releaseOperationLock(lock);
});

test('explicit unlock removes a verified stale lock', (t) => {
  const stateRoot = createStateRoot(t);
  const lockRoot = path.join(stateRoot, 'operation.lock');
  fs.mkdirSync(lockRoot, { recursive: true });
  fs.writeFileSync(
    path.join(lockRoot, 'owner.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      pid: findMissingPid(),
      operation: 'install',
      startedAt: new Date(0).toISOString(),
      token: '11111111-1111-4111-8111-111111111111',
    }, null, 2)}\n`,
    { mode: 0o600 },
  );

  const owner = unlockStaleOperationLock(stateRoot);

  assert.equal(owner.operation, 'install');
  assert.equal(fs.existsSync(lockRoot), false);
});
