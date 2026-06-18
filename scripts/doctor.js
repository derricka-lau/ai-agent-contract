#!/usr/bin/env node

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const generatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-generated-'));
const guardrails = JSON.parse(fs.readFileSync(path.join(root, 'core/guardrails.json'), 'utf8'));
let failures = 0;

process.on('exit', () => {
  fs.rmSync(generatedRoot, { recursive: true, force: true });
});

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function ok(message) {
  console.log(`PASS: ${message}`);
}

function readFrom(basePath, relativePath) {
  return fs.readFileSync(path.join(basePath, relativePath), 'utf8');
}

function readGenerated(relativePath) {
  return readFrom(generatedRoot, relativePath);
}

function existsIn(basePath, relativePath) {
  return fs.existsSync(path.join(basePath, relativePath));
}

function parseJson(basePath, relativePath) {
  try {
    JSON.parse(readFrom(basePath, relativePath));
    ok(`${relativePath} parses as JSON`);
  } catch (error) {
    fail(`${relativePath} is invalid JSON: ${error.message}`);
  }
}

function parseGeneratedJson(relativePath) {
  return JSON.parse(readGenerated(relativePath));
}

function command(commandName, args, options = {}) {
  return childProcess.spawnSync(commandName, args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
  });
}

function requireGenerated(relativePath) {
  if (!existsIn(generatedRoot, relativePath)) {
    fail(`${relativePath} missing`);
    return;
  }

  const content = readGenerated(relativePath);
  if (!content.includes('GENERATED FILE')) {
    fail(`${relativePath} missing generated marker`);
  }
}

function requireAbsent(relativePath) {
  if (existsIn(generatedRoot, relativePath)) {
    fail(`${relativePath} should no longer be generated`);
  } else {
    ok(`${relativePath} is not generated`);
  }
}

function requireGeneratedContent(relativePath, needle) {
  if (!readGenerated(relativePath).includes(needle)) {
    fail(`${relativePath} missing ${needle}`);
  }
}

function forbidGeneratedContent(relativePath, needle) {
  if (readGenerated(relativePath).includes(needle)) {
    fail(`${relativePath} unexpectedly contains ${needle}`);
  }
}

function guard(payload, mode = 'copilot-pre-tool') {
  return command('node', ['scripts/guard.js', mode], {
    input: JSON.stringify(payload),
    env: {
      ...process.env,
      DOTFILES_GUARDRAILS: path.join(root, 'core/guardrails.json'),
    },
  });
}

function firstMatchingBaseName(predicate, fallbackIndex) {
  return guardrails.protectedBaseNames.find(predicate) || guardrails.protectedBaseNames[fallbackIndex];
}

const blockedEnv = firstMatchingBaseName((baseName) => baseName.startsWith('.') && baseName.includes('local'), 1);
const blockedSettingsLocal = firstMatchingBaseName((baseName) => baseName.startsWith('settings'), 8);
const blockedAppLocal = firstMatchingBaseName((baseName) => baseName.startsWith('app_') && baseName.includes('local'), 10);
const allowedExample = guardrails.safeExampleBaseNames[0];
const destructiveCommand = ['git', 'reset', '--hard', 'HEAD'].join(' ');
const codexReadCommand = ['cat', blockedEnv].join(' ');
const claudeReadPattern = ['Read(**/', blockedEnv, ')'].join('');
const claudeEditPattern = ['Edit(**/', blockedAppLocal, ')'].join('');
const codexProjectRootEnvEntry = ['"', blockedEnv, '" = "none"'].join('');
const codexProjectRootAppEntry = ['"', blockedAppLocal, '" = "none"'].join('');

const generate = command('node', ['scripts/generate.js', '--out', generatedRoot]);
if (generate.status === 0) {
  ok('generated files render to a disposable directory');
} else {
  fail(generate.stderr.trim() || generate.stdout.trim());
}

const generatedCheck = command('node', ['scripts/generate.js', '--out', generatedRoot, '--check']);
if (generatedCheck.status === 0) {
  ok('generated files match canonical sources');
} else {
  fail(generatedCheck.stderr.trim() || generatedCheck.stdout.trim());
}

for (const file of [
  'core/area-instructions.json',
  'core/guardrails.json',
  'core/roles.json',
]) {
  parseJson(root, file);
}

for (const file of [
  'claude/settings.json',
  'claude/managed-settings.json',
  'codex/hooks.json',
  'copilot/hooks/policy.json',
  'vscode/settings.json',
]) {
  parseJson(generatedRoot, file);
}

if (existsIn(generatedRoot, 'vscode/settings.json') &&
    parseGeneratedJson('vscode/settings.json')['chat.useClaudeMdFile'] === false) {
  ok('vscode/settings.json keeps Copilot on generated instructions');
} else {
  fail('vscode/settings.json missing chat.useClaudeMdFile=false for Copilot instruction isolation');
}

const codexHooks = parseGeneratedJson('codex/hooks.json');
const codexPreToolUse = codexHooks?.hooks?.PreToolUse?.[0]?.hooks?.[0];

if (codexPreToolUse?.type === 'command' && codexPreToolUse.command === '$HOME/.codex/hooks/pre-command-guard.sh') {
  ok('compatible Codex hooks use command handlers for PreToolUse');
} else {
  fail('compatible Codex hooks missing PreToolUse command handler');
}

if (codexHooks?.hooks?.Stop === undefined) {
  ok('compatible Codex hooks do not install a Stop hook');
} else {
  fail('compatible Codex hooks still install a Stop hook');
}

for (const file of [
  'claude/CLAUDE.md',
  'codex/AGENTS.md',
  'copilot/instructions/global-contract.instructions.md',
  'claude/agents/architect.md',
  'codex/agents/explorer.toml',
  'copilot/agents/architect.agent.md',
  'codex/config.toml',
]) {
  requireGenerated(file);
}

const coachFiles = [
  'claude/skills/guide-mode/SKILL.md',
  'claude/skills/scaffolding-mode/SKILL.md',
  'claude/skills/tutor-mode/SKILL.md',
  'codex/skills/guide-mode/SKILL.md',
  'codex/skills/scaffolding-mode/SKILL.md',
  'codex/skills/tutor-mode/SKILL.md',
  'copilot/skills/guide-mode/SKILL.md',
  'copilot/skills/scaffolding-mode/SKILL.md',
  'copilot/skills/tutor-mode/SKILL.md',
];

for (const file of coachFiles) {
  requireGenerated(file);
  requireGeneratedContent(file, 'never write the decision-bearing implementation');
  requireGeneratedContent(file, 'TODO(human)');
}

requireGeneratedContent('claude/skills/guide-mode/SKILL.md', 'Write nothing into files');
requireGeneratedContent('claude/skills/scaffolding-mode/SKILL.md', 'scaffolding into the files');
requireGeneratedContent('claude/skills/tutor-mode/SKILL.md', 'line by line');
forbidGeneratedContent('claude/settings.json', 'outputStyle');

requireAbsent('copilot/AGENTS.md');
requireAbsent('copilot/copilot-instructions.md');
requireAbsent('claude/MEMORY.md');
requireAbsent('codex/MEMORY.md');
requireAbsent('copilot/MEMORY.md');
requireAbsent('claude/memory/user_role.md');
requireAbsent('codex/memory/user_role.md');
requireAbsent('copilot/memory/user_role.md');
requireAbsent('codex/hooks/stop-reminder.sh');

for (const file of [
  'claude/CLAUDE.md',
  'codex/AGENTS.md',
  'copilot/instructions/global-contract.instructions.md',
]) {
  requireGeneratedContent(file, 'Decision type:');
  requireGeneratedContent(file, 'Risk check:');
  requireGeneratedContent(file, blockedEnv);
  requireGeneratedContent(file, blockedSettingsLocal);
  requireGeneratedContent(file, 'Do not add dependencies');
}

requireGeneratedContent('claude/settings.json', claudeReadPattern);
requireGeneratedContent('claude/settings.json', claudeEditPattern);

if (parseGeneratedJson('claude/settings.json').autoMemoryEnabled === undefined) {
  ok('compatible Claude settings do not enable auto-memory');
} else {
  fail('compatible Claude settings still set autoMemoryEnabled');
}
requireGeneratedContent('codex/config.toml', 'approval_policy = "on-request"');
requireGeneratedContent('codex/config.toml', 'sandbox_mode = "workspace-write"');
requireGeneratedContent('codex/config.toml', '[sandbox_workspace_write]');
requireGeneratedContent('codex/config.toml', 'network_access = false');
forbidGeneratedContent('codex/config.toml', 'default_permissions = "global_lockdown"');
forbidGeneratedContent('codex/config.toml', 'permissions_profile = "global_lockdown"');
forbidGeneratedContent('codex/config.toml', '[permissions.global_lockdown.filesystem]');
forbidGeneratedContent('codex/config.toml', '[permissions.global_lockdown.network]');

const denyEnv = guard({ tool_name: 'readFile', tool_input: { path: blockedEnv } });
if (denyEnv.stdout.includes('"permissionDecision":"deny"')) {
  ok('Copilot guard denies blocked local config');
} else {
  fail('Copilot guard did not deny blocked local config');
}

const allowExample = guard({ tool_name: 'readFile', tool_input: { path: allowedExample } });
if (allowExample.stdout === '') {
  ok('Copilot guard allows the documented example config');
} else {
  fail('Copilot guard unexpectedly blocked the documented example config');
}

const denyCommand = guard({ tool_name: 'runTerminalCommand', tool_input: { command: destructiveCommand } });
if (denyCommand.stdout.includes('"permissionDecision":"deny"')) {
  ok('Copilot guard denies a destructive git command');
} else {
  fail('Copilot guard did not deny a destructive git command');
}

const codexDeny = guard({ tool_input: { command: codexReadCommand } }, 'codex-pre-command');
if (codexDeny.status === 2) {
  ok('compatible Codex guard denies reading a blocked local config');
} else {
  fail('compatible Codex guard did not deny reading a blocked local config');
}

if (failures > 0) {
  console.error(`\nDoctor failed with ${failures} failure(s).`);
  process.exit(1);
}

console.log('\nDoctor passed.');
