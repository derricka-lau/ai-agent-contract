const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function outputFiles(outputRoot, relativePath = '') {
  const files = [];
  for (const entry of fs.readdirSync(path.join(outputRoot, relativePath), { withFileTypes: true })) {
    const name = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...outputFiles(outputRoot, name));
    } else {
      files.push(name.split(path.sep).join('/'));
    }
  }
  return files.sort();
}

test('default generation is prompt-only across all supported tools', (t) => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(outputRoot, { recursive: true, force: true }));

  execFileSync(process.execPath, ['scripts/generate.js', '--out', outputRoot], {
    cwd: root,
    stdio: 'pipe',
  });

  for (const file of [
    'agents/skills/coach-mode/SKILL.md',
    'antigravity/plugin.json',
    'antigravity/rules/AGENTS.md',
    'claude/CLAUDE.md',
    'claude/prompts/workflow.md',
    'claude/skills/coach-mode/SKILL.md',
    'codex/AGENTS.md',
    'codex/prompts/workflow.md',
    'codex/skills/coach-mode/SKILL.md',
    'copilot/instructions/global-contract.instructions.md',
    'copilot/instructions/frontend.instructions.md',
    'copilot/prompts/workflow.md',
    'copilot/skills/coach-mode/SKILL.md',
  ]) {
    assert.ok(fs.existsSync(path.join(outputRoot, file)), `missing prompt file: ${file}`);
  }

  for (const file of [
    'antigravity/hooks.json',
    'antigravity/hooks/pre-tool-guard.sh',
    'antigravity/skills/coach-mode/SKILL.md',
    'claude/settings.json',
    'claude/hooks/pre-tool-guard.sh',
    'codex/config.toml',
    'codex/hooks.json',
    'copilot/hooks/policy.json',
  ]) {
    assert.equal(fs.existsSync(path.join(outputRoot, file)), false, `unexpected runtime file: ${file}`);
  }

  const coachSkill = fs.readFileSync(path.join(outputRoot, 'agents/skills/coach-mode/SKILL.md'), 'utf8');
  assert.match(coachSkill, /Depth: `guide`/);
  assert.match(coachSkill, /Depth: `scaffolding`/);
  assert.match(coachSkill, /Depth: `tutor`/);
  assert.match(coachSkill, /TODO\(human\)/);
});

test('hardened generation adds sensitive-file controls without other runtime settings', (t) => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  const promptRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(outputRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(promptRoot, { recursive: true, force: true }));

  execFileSync(process.execPath, [
    'scripts/generate.js', '--profile', 'hardened', '--out', outputRoot,
  ], { cwd: root, stdio: 'pipe' });
  execFileSync(process.execPath, ['scripts/generate.js', '--out', promptRoot], {
    cwd: root,
    stdio: 'pipe',
  });

  const promptFiles = outputFiles(promptRoot);
  const hardenedFiles = outputFiles(outputRoot);
  for (const file of promptFiles) {
    assert.ok(hardenedFiles.includes(file), `missing prompt file in hardened output: ${file}`);
  }
  assert.deepEqual(hardenedFiles.filter((file) => !promptFiles.includes(file)), [
    'antigravity/hooks.json',
    'antigravity/hooks/pre-tool-guard.sh',
    'claude/hooks/pre-tool-guard.sh',
    'claude/settings.json',
    'codex/hooks.json',
    'codex/hooks/pre-tool-guard.sh',
    'copilot/hooks/policy.json',
    'copilot/hooks/pre-tool-guard.sh',
  ]);

  const claudeSettings = JSON.parse(fs.readFileSync(path.join(outputRoot, 'claude/settings.json'), 'utf8'));
  assert.deepEqual(Object.keys(claudeSettings).sort(), ['hooks', 'permissions']);
  assert.deepEqual(Object.keys(claudeSettings.permissions), ['deny']);

  const codexHooks = JSON.parse(fs.readFileSync(path.join(outputRoot, 'codex/hooks.json'), 'utf8'));
  assert.deepEqual(Object.keys(codexHooks), ['hooks']);

  const copilotHooks = JSON.parse(fs.readFileSync(path.join(outputRoot, 'copilot/hooks/policy.json'), 'utf8'));
  assert.deepEqual(Object.keys(copilotHooks).sort(), ['hooks', 'version']);

  const antigravityHooks = JSON.parse(fs.readFileSync(path.join(outputRoot, 'antigravity/hooks.json'), 'utf8'));
  assert.equal(antigravityHooks['ai-agent-contract-guard'].PreToolUse[0].matcher, '*');
  assert.equal(
    antigravityHooks['ai-agent-contract-guard'].PreToolUse[0].hooks[0].command,
    './hooks/pre-tool-guard.sh',
  );
});

test('generated contracts include concise governance, approval modes, commit rules, and single-agent policy', (t) => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(outputRoot, { recursive: true, force: true }));

  execFileSync(process.execPath, ['scripts/generate.js', '--out', outputRoot], {
    cwd: root,
    stdio: 'pipe',
  });

  const contract = fs.readFileSync(path.join(outputRoot, 'codex', 'AGENTS.md'), 'utf8');
  const antigravityContract = fs.readFileSync(path.join(outputRoot, 'antigravity', 'rules', 'AGENTS.md'), 'utf8');
  assert.equal(antigravityContract, contract);

  assert.match(contract, /total engineering and operating cost/i);
  assert.match(contract, /Do not ship coding workarounds/i);
  assert.match(contract, /one authoritative source/i);
  assert.match(contract, /latest applicable, explicitly approved decision/i);
  assert.match(contract, /Tests are not append-only/i);
  assert.match(contract, /Superseded tests and fixtures are removed/i);
  assert.match(contract, /Preserve the existing regression baseline/i);
  assert.match(contract, /replacement behaviour passes/i);
  assert.match(contract, /external or version-sensitive assumptions/i);
  assert.match(contract, /small, independently reviewable commits/i);
  assert.match(contract, /Conventional Commits/i);
  assert.match(contract, /Co-authored-by:/);
  assert.match(contract, /Apply the active review mode \(`D1`, `D2`, or `D3`\)/);
  assert.match(contract, /`D3` \(\*\*default\*\*/);
  assert.match(contract, /remains approved within its agreed scope/i);
  assert.match(contract, /Load the `decision-ledger` skill/i);
  assert.match(contract, /Wait for the user's choice before continuing\./);
  assert.match(contract, /Compatible Antigravity installations/);

  const wordCount = contract.trim().split(/\s+/).length;
  assert.ok(wordCount < 1500, `baseline contract should stay concise (got ${wordCount} words)`);

  const workflow = fs.readFileSync(path.join(outputRoot, 'codex', 'prompts', 'workflow.md'), 'utf8');
  assert.match(workflow, /Execution And Delegation Policy/);
  assert.match(workflow, /one main agent loop/i);
  assert.match(workflow, /independent parallel work/i);
});

test('test instructions apply to the common test file naming conventions', { skip: typeof path.matchesGlob !== 'function' && 'path.matchesGlob is unavailable' }, () => {
  const { applyTo } = JSON.parse(fs.readFileSync(path.join(root, 'core', 'area-instructions.json'), 'utf8')).tests;
  for (const file of ['src/foo.test.ts', 'src/foo.spec.tsx', 'web/foo.test.js', 'tests/test_foo.py', 'tests/foo_test.py', 'pkg/foo_test.go', 'tests/FooTest.php', 'src/FooSpec.ts']) {
    assert.ok(path.matchesGlob(file, applyTo), `${file} should match ${applyTo}`);
  }
  for (const file of ['src/foo.ts', 'README.md', 'src/testing.py']) {
    assert.equal(path.matchesGlob(file, applyTo), false, `${file} should not match ${applyTo}`);
  }
});
