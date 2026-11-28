const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
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

// Every protected name below is read from guardrails.json, so each listed rule is exercised without repeating it here.
const rules = JSON.parse(fs.readFileSync(guardrails, 'utf8'));
const envName = rules.protectedBaseNames[0];
const envPrefix = rules.protectedBaseNamePrefixes[0];
const claude = (toolName, input) => runGuard('claude-pre-tool', JSON.stringify({ tool_name: toolName, tool_input: input }));
const isBlocked = (result) => result.status === 2;
const isAllowed = (result) => result.status === 0;

test('guard matches protected names in any letter case', () => {
  for (const name of rules.protectedBaseNames) {
    assert.ok(isBlocked(claude('Read', { file_path: `/repo/${name.toUpperCase()}` })), name);
  }
  for (const extension of rules.protectedExtensions) {
    assert.ok(isBlocked(claude('Bash', { command: `cat key${extension.toUpperCase()}` })), extension);
  }
  const copilot = runGuard('copilot-pre-tool', JSON.stringify({ toolName: 'readFile', toolArgs: { path: envName.toUpperCase() } }));
  assert.equal(JSON.parse(copilot.stdout).permissionDecision, 'deny');
});

test('guard protects every variant of the environment file prefix', () => {
  for (const suffix of ['production.local', 'development.local', 'dev', 'prod', 'uat']) {
    assert.ok(isBlocked(claude('Read', { file_path: `${envPrefix}${suffix}` })), suffix);
  }
});

test('template copies with a safe marker stay readable, and nothing else is unlocked', () => {
  for (const marker of rules.safeExampleMarkers) {
    assert.ok(isAllowed(claude('Read', { file_path: `${envName}.${marker}` })), marker);
    assert.ok(isAllowed(claude('Read', { file_path: `${envName}.${marker}`.toUpperCase() })), marker);
    assert.ok(isAllowed(claude('Bash', { command: `cp ${envName}.${marker} /tmp/copy` })), marker);
  }
  const phpName = rules.protectedBaseNames.find((name) => name.endsWith('.php'));
  assert.ok(isBlocked(claude('Read', { file_path: phpName })));
  assert.ok(isAllowed(claude('Read', { file_path: `${phpName}.${rules.safeExampleMarkers[3]}` })));
  assert.ok(isBlocked(claude('Read', { file_path: `${envPrefix}${rules.safeExampleMarkers[0]}.local` })));
  assert.ok(isBlocked(claude('Read', { file_path: `${rules.safeExampleMarkers[0]}${rules.protectedExtensions[0]}` })));
});

test('guard resolves quoting, braces and globs the shell would expand to a protected name', () => {
  const words = [
    `${envName.slice(0, 2)}''${envName.slice(2)}`,
    `"${envName.slice(0, 2)}"${envName.slice(2)}`,
    `${envName.slice(0, 2)}\\${envName.slice(2)}`,
    `${envName.slice(0, 2)}{${envName[2]},x}${envName.slice(3)}`,
    `${envName.slice(0, -1)}*`,
    `${envName.slice(0, -1)}?`,
    `${envName.slice(0, -1)}[${envName.slice(-1)}]`,
    '.*',
    `*${rules.protectedExtensions[0]}`,
    `${envName.slice(0, -1)}[z-a]`,
  ];
  for (const word of words) {
    assert.ok(isBlocked(claude('Bash', { command: `cat ${word}` })), word);
  }
});

test('ordinary globs and commands stay usable', () => {
  for (const command of ['ls *', 'grep -n TODO src/*', 'rm -f build/*.log', 'cat README.md', 'git status', 'npm test -- --grep "*.test.js"']) {
    assert.ok(isAllowed(claude('Bash', { command })), command);
  }
});

test('file content may name protected files while the target path is still checked', () => {
  assert.ok(isAllowed(claude('Write', { file_path: '/repo/.gitignore', content: `${envName}\n${envPrefix}*\n` })));
  assert.ok(isAllowed(claude('Edit', { file_path: '/repo/README.md', old_string: 'x', new_string: `Never commit ${envName}.` })));
  assert.ok(isAllowed(claude('MultiEdit', { file_path: '/repo/docs.md', edits: [{ old_string: 'a', new_string: envName }] })));
  assert.ok(isBlocked(claude('Write', { file_path: `/repo/${envName}`, content: 'SAFE=1' })));
  assert.ok(isBlocked(claude('Edit', { file_path: `/repo/${envPrefix}local`, old_string: 'a', new_string: 'b' })));
  assert.ok(isBlocked(claude('Bash', { command: `printf 'x' > ${envName}` })));
});

test('guard protects common credential stores and key formats', () => {
  for (const fragment of rules.protectedPathFragments) {
    const target = fragment.endsWith('/') ? `~/${fragment}item` : `~/${fragment}`;
    assert.ok(isBlocked(claude('Read', { file_path: target })), target);
    if (fragment.endsWith('/')) {
      assert.ok(isBlocked(claude('Bash', { command: `ls ~/${fragment.slice(0, -1)}` })), fragment);
    }
  }
  for (const extension of rules.protectedExtensions) {
    assert.ok(isBlocked(claude('Bash', { command: `openssl x509 -in cert${extension}` })), extension);
  }
});
