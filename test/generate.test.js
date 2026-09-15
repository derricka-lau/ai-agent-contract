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

test('default generation is prompt-only', (t) => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(outputRoot, { recursive: true, force: true }));

  execFileSync(process.execPath, ['scripts/generate.js', '--out', outputRoot], {
    cwd: root,
    stdio: 'pipe',
  });

  for (const file of [
    'claude/CLAUDE.md',
    'claude/prompts/workflow.md',
    'claude/skills/guide-mode/SKILL.md',
    'codex/AGENTS.md',
    'codex/prompts/workflow.md',
    'codex/skills/guide-mode/SKILL.md',
    'copilot/instructions/global-contract.instructions.md',
    'copilot/instructions/frontend.instructions.md',
    'copilot/prompts/workflow.md',
    'copilot/skills/guide-mode/SKILL.md',
  ]) {
    assert.ok(fs.existsSync(path.join(outputRoot, file)), `missing prompt file: ${file}`);
  }

  for (const file of [
    'claude/settings.json',
    'claude/hooks/pre-tool-guard.sh',
    'codex/config.toml',
    'codex/hooks.json',
    'copilot/hooks/policy.json',
  ]) {
    assert.equal(fs.existsSync(path.join(outputRoot, file)), false, `unexpected runtime file: ${file}`);
  }
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
    'claude/hooks/pre-tool-guard.sh',
    'claude/settings.json',
    'codex/hooks.json',
    'codex/hooks/pre-tool-guard.sh',
    'copilot/hooks/policy.json',
    'copilot/hooks/pre-tool-guard.sh',
  ]);

  for (const file of [
    'claude/CLAUDE.md',
    'claude/settings.json',
    'claude/hooks/pre-tool-guard.sh',
    'codex/AGENTS.md',
    'codex/hooks.json',
    'codex/hooks/pre-tool-guard.sh',
    'copilot/instructions/global-contract.instructions.md',
    'copilot/hooks/policy.json',
    'copilot/hooks/pre-tool-guard.sh',
  ]) {
    assert.ok(fs.existsSync(path.join(outputRoot, file)), `missing prompt or guard: ${file}`);
  }

  const claudeSettings = JSON.parse(fs.readFileSync(path.join(outputRoot, 'claude/settings.json'), 'utf8'));
  assert.deepEqual(Object.keys(claudeSettings).sort(), ['hooks', 'permissions']);
  assert.deepEqual(Object.keys(claudeSettings.permissions), ['deny']);

  const codexHooks = JSON.parse(fs.readFileSync(path.join(outputRoot, 'codex/hooks.json'), 'utf8'));
  assert.deepEqual(Object.keys(codexHooks), ['hooks']);

  const copilotHooks = JSON.parse(fs.readFileSync(path.join(outputRoot, 'copilot/hooks/policy.json'), 'utf8'));
  assert.deepEqual(Object.keys(copilotHooks).sort(), ['hooks', 'version']);
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
  assert.match(contract, /Tests are not append-only/i);
  assert.match(contract, /Superseded tests and fixtures are removed/i);
  assert.match(contract, /Preserve the existing regression baseline/i);
  assert.match(contract, /replacement behaviour passes/i);
  assert.match(contract, /external or version-sensitive assumptions/i);
  assert.match(contract, /small, independently reviewable commits/i);
  assert.match(contract, /Wait for the user's choice before continuing\./);
  assert.doesNotMatch(contract, /Delegated Decision Mode/);
});
