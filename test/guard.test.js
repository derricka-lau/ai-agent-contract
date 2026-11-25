const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const guard = path.join(root, 'scripts', 'guard.js');
const guardrails = path.join(root, 'core', 'guardrails.json');

function runGuard(mode, input) {
  return spawnSync(process.execPath, [guard, mode], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      AI_AGENT_CONTRACT_GUARDRAILS: guardrails,
    },
    input,
  });
}

test('malformed hook input fails closed for each output protocol', () => {
  const copilot = runGuard('copilot-pre-tool', '{');
  assert.equal(copilot.status, 0);
  assert.equal(JSON.parse(copilot.stdout).permissionDecision, 'deny');
  assert.match(copilot.stdout, /invalid local policy hook input/i);

  const antigravity = runGuard('antigravity-pre-tool', '{');
  assert.equal(antigravity.status, 0);
  assert.equal(JSON.parse(antigravity.stdout).decision, 'deny');
  assert.match(antigravity.stdout, /invalid local policy hook input/i);

  for (const mode of ['codex-pre-tool', 'claude-pre-tool']) {
    const result = runGuard(mode, '{');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /invalid local policy hook input/i);
  }
});

test('guard blocks protected paths without policing unrelated commands', () => {
  const protectedPath = runGuard('copilot-pre-tool', JSON.stringify({
    toolName: 'readFile',
    toolArgs: { path: '.env.local' },
  }));
  assert.equal(JSON.parse(protectedPath.stdout).permissionDecision, 'deny');

  const unrelatedCommand = runGuard('copilot-pre-tool', JSON.stringify({
    toolName: 'bash',
    toolArgs: { command: 'git reset --hard HEAD' },
  }));
  assert.equal(unrelatedCommand.stdout, '');
});

test('Antigravity guard enforces protected paths on toolCall payloads', () => {
  const blockedRead = runGuard('antigravity-pre-tool', JSON.stringify({
    toolCall: { id: '1', name: 'read_file', args: { Path: '/workspace/app/.env.local' } },
  }));
  assert.equal(blockedRead.status, 0);
  assert.equal(JSON.parse(blockedRead.stdout).decision, 'deny');

  const blockedCommand = runGuard('antigravity-pre-tool', JSON.stringify({
    toolCall: { id: '2', name: 'run_command', args: { CommandLine: 'cat .env.production' } },
  }));
  assert.equal(blockedCommand.status, 0);
  assert.equal(JSON.parse(blockedCommand.stdout).decision, 'deny');

  const allowedExample = runGuard('antigravity-pre-tool', JSON.stringify({
    toolCall: { id: '3', name: 'read_file', args: { Path: '/workspace/app/.env.example' } },
  }));
  assert.equal(allowedExample.status, 0);
  assert.deepEqual(JSON.parse(allowedExample.stdout), { decision: 'allow' });

  const allowedCommand = runGuard('antigravity-pre-tool', JSON.stringify({
    toolCall: { id: '4', name: 'run_command', args: { CommandLine: 'git reset --hard HEAD' } },
  }));
  assert.equal(allowedCommand.status, 0);
  assert.deepEqual(JSON.parse(allowedCommand.stdout), { decision: 'allow' });
});
