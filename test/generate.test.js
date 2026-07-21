const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('Codex profiles render as separate config layers', (t) => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(outputRoot, { recursive: true, force: true }));

  execFileSync(process.execPath, ['scripts/generate.js', '--out', outputRoot], {
    cwd: root,
    stdio: 'pipe',
  });

  const codexRoot = path.join(outputRoot, 'codex');
  const baseConfig = fs.readFileSync(path.join(codexRoot, 'config.toml'), 'utf8');
  assert.doesNotMatch(
    baseConfig,
    /^\[profiles\./m,
    'base config must not use legacy inline Codex profiles',
  );
  assert.match(baseConfig, /default_permissions = "contract-workspace"/);
  assert.match(baseConfig, /^model = "gpt-5\.6"$/m);
  assert.match(baseConfig, /^model_reasoning_effort = "medium"$/m);
  assert.match(baseConfig, /\[permissions\.contract-workspace\.filesystem\]/);
  assert.match(baseConfig, /"\*\*\/\.env" = "deny"/);
  assert.doesNotMatch(baseConfig, /^sandbox_mode =/m);
  assert.doesNotMatch(baseConfig, /^service_tier =/m);
  assert.match(baseConfig, /^max_threads = 4$/m);

  for (const profile of ['secure-global', 'deep', 'quick', 'verify']) {
    assert.ok(
      fs.existsSync(path.join(codexRoot, `${profile}.config.toml`)),
      `missing generated Codex profile: ${profile}.config.toml`,
    );
  }

  const quickProfile = fs.readFileSync(path.join(codexRoot, 'quick.config.toml'), 'utf8');
  assert.match(quickProfile, /^model = "gpt-5\.6-terra"$/m);
  assert.match(quickProfile, /^model_reasoning_effort = "low"$/m);
  assert.doesNotMatch(quickProfile, /^service_tier =/m);

  const deepProfile = fs.readFileSync(path.join(codexRoot, 'deep.config.toml'), 'utf8');
  assert.match(deepProfile, /^approval_policy = "on-request"$/m);

  const agentConfig = fs.readFileSync(path.join(codexRoot, 'agents', 'explorer.toml'), 'utf8');
  assert.doesNotMatch(agentConfig, /^sandbox_mode =/m);
  assert.match(agentConfig, /default_permissions = "contract-readonly"/);

  const hooks = JSON.parse(fs.readFileSync(path.join(codexRoot, 'hooks.json'), 'utf8'));
  assert.equal(hooks.hooks.PreToolUse[0].matcher, '.*');

  const copilotHooks = JSON.parse(fs.readFileSync(
    path.join(outputRoot, 'copilot', 'hooks', 'policy.json'),
    'utf8',
  ));
  assert.equal(copilotHooks.hooks.preToolUse[0].type, 'command');
  assert.equal(
    copilotHooks.hooks.preToolUse[0].bash,
    '$HOME/.copilot/hooks/pre-tool-guard.sh',
  );
  assert.equal(copilotHooks.hooks.preToolUse[0].timeoutSec, 15);
  assert.equal(copilotHooks.hooks.PreToolUse, undefined);

  const claudeSettings = JSON.parse(fs.readFileSync(
    path.join(outputRoot, 'claude', 'settings.json'),
    'utf8',
  ));
  assert.equal(claudeSettings.hooks.PreToolUse[0].matcher, '.*');
  assert.equal(
    claudeSettings.hooks.PreToolUse[0].hooks[0].command,
    '$HOME/.claude/hooks/pre-tool-guard.sh',
  );
  assert.equal(claudeSettings.hooks.Notification, undefined);
  assert.equal(claudeSettings.alwaysThinkingEnabled, undefined);
  assert.equal(claudeSettings.effortLevel, undefined);
  assert.equal(fs.existsSync(path.join(outputRoot, 'claude', 'managed-settings.json')), false);
  assert.doesNotMatch(baseConfig, /^notify =/m);

  const claudeAgent = fs.readFileSync(
    path.join(outputRoot, 'claude', 'agents', 'architect.md'),
    'utf8',
  );
  assert.doesNotMatch(claudeAgent, /^model:/m);
  assert.doesNotMatch(claudeAgent, /^effort:/m);
});

test('generated contracts include quality, cost, precedence, and ownership rules', (t) => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(outputRoot, { recursive: true, force: true }));

  execFileSync(process.execPath, ['scripts/generate.js', '--out', outputRoot], {
    cwd: root,
    stdio: 'pipe',
  });

  const contract = fs.readFileSync(path.join(outputRoot, 'codex', 'AGENTS.md'), 'utf8');
  assert.match(contract, /total engineering and operating cost/i);
  assert.match(contract, /Do not ship coding workarounds/i);
  assert.match(contract, /one authoritative source/i);
  assert.match(contract, /latest applicable, explicitly approved decision/i);
  assert.match(contract, /Wait for the user's choice before continuing\./);
  assert.doesNotMatch(contract, /Delegated Decision Mode/);
});
