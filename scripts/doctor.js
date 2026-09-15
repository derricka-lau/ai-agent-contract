#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const generatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-generated-'));
const guardrails = JSON.parse(fs.readFileSync(path.join(root, 'core/guardrails.json'), 'utf8'));
let failures = 0;

process.on('exit', () => fs.rmSync(generatedRoot, { recursive: true, force: true }));

function check(label, condition) {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${label}`);
  }
}

function generated(relativePath) {
  return path.join(generatedRoot, relativePath);
}

function json(relativePath) {
  return JSON.parse(fs.readFileSync(generated(relativePath), 'utf8'));
}

function run(script, args, input) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
    input,
    env: {
      ...process.env,
      AI_AGENT_CONTRACT_GUARDRAILS: path.join(root, 'core/guardrails.json'),
    },
  });
}

for (const args of [
  ['--profile', 'hardened', '--out', generatedRoot],
  ['--profile', 'hardened', '--out', generatedRoot, '--check'],
]) {
  const result = run('scripts/generate.js', args);
  check(`generator ${args.includes('--check') ? 'matches' : 'renders'} canonical sources`, result.status === 0);
  if (result.status !== 0) {
    console.error(result.stderr.trim());
    process.exit(1);
  }
}

for (const file of [
  'claude/CLAUDE.md',
  'claude/hooks/pre-tool-guard.sh',
  'codex/AGENTS.md',
  'codex/hooks/pre-tool-guard.sh',
  'copilot/instructions/global-contract.instructions.md',
  'copilot/hooks/pre-tool-guard.sh',
]) {
  check(`${file} is generated`, fs.readFileSync(generated(file), 'utf8').includes('GENERATED FILE'));
}

for (const file of [
  'codex/config.toml',
  'codex/quick.config.toml',
  'codex/agents/explorer.toml',
  'claude/agents/architect.md',
  'copilot/agents/architect.agent.md',
  'vscode/settings.json',
]) {
  check(`${file} is not generated`, !fs.existsSync(generated(file)));
}

const claude = json('claude/settings.json');
const codex = json('codex/hooks.json');
const copilot = json('copilot/hooks/policy.json');
check('Claude settings contain only protected-path denials and the guard hook',
  Object.keys(claude).sort().join(',') === 'hooks,permissions'
    && Object.keys(claude.permissions).join(',') === 'deny'
    && Array.isArray(claude.permissions.deny)
    && claude.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command === '$HOME/.claude/hooks/pre-tool-guard.sh');
check('Codex uses a standalone all-tool guard hook',
  Object.keys(codex).join(',') === 'hooks'
    && codex.hooks?.PreToolUse?.[0]?.matcher === '.*'
    && codex.hooks.PreToolUse[0].hooks?.[0]?.command === '$HOME/.codex/hooks/pre-tool-guard.sh');
check('Copilot uses only the current sensitive-file hook policy',
  Object.keys(copilot).sort().join(',') === 'hooks,version'
    && copilot.hooks?.preToolUse?.[0]?.bash === '$HOME/.copilot/hooks/pre-tool-guard.sh');

const policySource = fs.readFileSync(path.join(root, 'core/sensitive-files.md'), 'utf8');
check('sensitive-file pattern list is generated from guardrails',
  policySource.includes('<!-- GENERATED: sensitive-file-patterns -->'));
const sensitivePatterns = [
  ...guardrails.protectedBaseNames,
  ...guardrails.protectedExtensions,
  ...guardrails.protectedPathFragments,
  ...guardrails.safeExampleBaseNames,
];
for (const file of [
  'claude/CLAUDE.md',
  'codex/AGENTS.md',
  'copilot/instructions/global-contract.instructions.md',
]) {
  const contract = fs.readFileSync(generated(file), 'utf8');
  check(`${file} documents every protected path and safe example`,
    sensitivePatterns.every((pattern) => contract.includes(`\`${pattern}\``)));
}

const blocked = guardrails.protectedBaseNames.find((name) => name.includes('local'));
const example = guardrails.safeExampleBaseNames[0];
const cases = [
  ['Copilot blocks protected paths', 'copilot-pre-tool', { tool_name: 'readFile', tool_input: { path: blocked } }, (result) => result.stdout.includes('"permissionDecision":"deny"')],
  ['Codex blocks protected paths', 'codex-pre-tool', { tool_input: { command: `cat ${blocked}` } }, (result) => result.status === 2],
  ['Claude blocks protected paths', 'claude-pre-tool', { tool_name: 'Read', tool_input: { file_path: blocked } }, (result) => result.status === 2],
  ['safe example remains readable', 'copilot-pre-tool', { tool_name: 'readFile', tool_input: { path: example } }, (result) => result.status === 0 && result.stdout === ''],
];
for (const [label, mode, payload, passes] of cases) {
  check(label, passes(run('scripts/guard.js', [mode], JSON.stringify(payload))));
}

if (failures > 0) {
  console.error(`\nDoctor failed with ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nDoctor passed.');
