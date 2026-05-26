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
]) {
  parseJson(generatedRoot, file);
}

const codexHooks = parseGeneratedJson('codex/hooks.json');
const codexPreToolUse = codexHooks?.hooks?.PreToolUse?.[0]?.hooks?.[0];
const codexStop = codexHooks?.hooks?.Stop?.[0]?.hooks?.[0];

if (codexPreToolUse?.type === 'command' && codexPreToolUse.command === '$HOME/.codex/hooks/pre-command-guard.sh') {
  ok('codex/hooks.json uses command handlers for PreToolUse');
} else {
  fail('codex/hooks.json missing PreToolUse command handler');
}

if (codexStop?.type === 'command' && codexStop.command === '$HOME/.codex/hooks/stop-reminder.sh') {
  ok('codex/hooks.json uses command handlers for Stop');
} else {
  fail('codex/hooks.json missing Stop command handler');
}

for (const file of [
  'claude/CLAUDE.md',
  'codex/AGENTS.md',
  'copilot/AGENTS.md',
  'copilot/copilot-instructions.md',
  'copilot/instructions/global-contract.instructions.md',
  'claude/agents/architect.md',
  'codex/agents/explorer.toml',
  'copilot/agents/architect.agent.md',
  'codex/config.toml',
]) {
  requireGenerated(file);
}

for (const file of [
  'claude/CLAUDE.md',
  'codex/AGENTS.md',
  'copilot/AGENTS.md',
]) {
  requireGeneratedContent(file, 'Decision type:');
  requireGeneratedContent(file, 'Risk check:');
  requireGeneratedContent(file, blockedEnv);
  requireGeneratedContent(file, blockedSettingsLocal);
}

requireGeneratedContent('claude/settings.json', claudeReadPattern);
requireGeneratedContent('claude/settings.json', claudeEditPattern);
requireGeneratedContent('codex/config.toml', '[permissions.global_lockdown.filesystem]');
requireGeneratedContent('codex/config.toml', '":project_roots" = {');
requireGeneratedContent('codex/config.toml', codexProjectRootEnvEntry);
requireGeneratedContent('codex/config.toml', codexProjectRootAppEntry);
forbidGeneratedContent('codex/config.toml', '[permissions.global_lockdown.filesystem.":workspace_roots"]');
forbidGeneratedContent('codex/config.toml', 'glob_scan_max_depth = ');
forbidGeneratedContent('codex/config.toml', '= "deny"');
forbidGeneratedContent('codex/config.toml', '"**/');

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
  ok('Codex guard denies reading a blocked local config');
} else {
  fail('Codex guard did not deny reading a blocked local config');
}

if (failures > 0) {
  console.error(`\nDoctor failed with ${failures} failure(s).`);
  process.exit(1);
}

console.log('\nDoctor passed.');
