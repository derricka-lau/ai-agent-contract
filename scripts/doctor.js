#!/usr/bin/env node

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const generatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfiles-generated-'));
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

function command(command, args, options = {}) {
  return childProcess.spawnSync(command, args, {
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

function guard(payload, mode = 'copilot-pre-tool') {
  return command('node', ['scripts/guard.js', mode], {
    input: JSON.stringify(payload),
    env: {
      ...process.env,
      DOTFILES_GUARDRAILS: path.join(root, 'core/guardrails.json'),
    },
  });
}

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
  requireGeneratedContent(file, '.env.local');
  requireGeneratedContent(file, 'settings_local.php');
}

requireGeneratedContent('claude/settings.json', 'Read(**/.env.local)');
requireGeneratedContent('claude/settings.json', 'Edit(**/app_local.php)');
requireGeneratedContent('codex/config.toml', '"**/.env.local" = "none"');
requireGeneratedContent('codex/config.toml', '"**/app_local.php" = "none"');

const denyEnv = guard({ tool_name: 'readFile', tool_input: { path: '.env.local' } });
if (denyEnv.stdout.includes('"permissionDecision":"deny"')) {
  ok('Copilot guard denies .env.local');
} else {
  fail('Copilot guard did not deny .env.local');
}

const allowExample = guard({ tool_name: 'readFile', tool_input: { path: '.env.example' } });
if (allowExample.stdout === '') {
  ok('Copilot guard allows .env.example');
} else {
  fail('Copilot guard unexpectedly blocked .env.example');
}

const denyCommand = guard({ tool_name: 'runTerminalCommand', tool_input: { command: 'git reset --hard HEAD' } });
if (denyCommand.stdout.includes('"permissionDecision":"deny"')) {
  ok('Copilot guard denies dangerous command');
} else {
  fail('Copilot guard did not deny dangerous command');
}

const codexDeny = guard({ tool_input: { command: 'cat .env.local' } }, 'codex-pre-command');
if (codexDeny.status === 2) {
  ok('Codex guard denies sensitive command');
} else {
  fail('Codex guard did not deny sensitive command');
}

if (failures > 0) {
  console.error(`\nDoctor failed with ${failures} failure(s).`);
  process.exit(1);
}

console.log('\nDoctor passed.');
