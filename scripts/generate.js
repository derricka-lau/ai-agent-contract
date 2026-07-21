#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const outIndex = args.indexOf('--out');
const outputRoot = outIndex === -1 ? null : path.resolve(args[outIndex + 1] || '');
const sensitivePolicyMarker = '<!-- GENERATED: sensitive-file-patterns -->';

if (outIndex !== -1 && !args[outIndex + 1]) {
  console.error('Usage: node scripts/generate.js --out <directory> [--check]');
  process.exit(1);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function write(relativePath, content, mode, targetRoot) {
  const target = path.join(targetRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, { mode });
}

function generatedHeader(comment = 'md') {
  const text = 'GENERATED FILE. Edit core/* and run: node scripts/generate.js --out <directory>';

  if (comment === 'toml' || comment === 'sh') {
    return `# ${text}\n`;
  }

  return `<!-- ${text} -->\n`;
}

function markdownJoin(parts) {
  return `${parts.map((part) => part.trim()).join('\n\n')}\n`;
}

function markdownCodeList(values) {
  return values.map((value) => `\`${value}\``).join(', ');
}

function sensitiveFilePolicy(guardrails) {
  const source = read('core/sensitive-files.md');
  const patternGroups = [
    `- Exact file names: ${markdownCodeList(guardrails.protectedBaseNames)}.`,
    `- Filename suffixes: ${markdownCodeList(guardrails.protectedExtensions)}.`,
    `- Path fragments: ${markdownCodeList(guardrails.protectedPathFragments)}.`,
    `- Safe example names: ${markdownCodeList(guardrails.safeExampleBaseNames)}.`,
  ].join('\n');

  if (!source.includes(sensitivePolicyMarker)) {
    throw new Error('core/sensitive-files.md is missing the sensitive-file pattern marker');
  }

  return source.replace(sensitivePolicyMarker, patternGroups);
}

function toolContract(title, guardrails) {
  return markdownJoin([
    `# ${title}`,
    generatedHeader('md'),
    read('core/global-contract.md').replace(/^# Global Contract\n+/, ''),
    read('core/decision-ledger.md'),
    sensitiveFilePolicy(guardrails),
    read('core/user-context.md'),
  ]);
}

function frontmatter(values) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---');

  return lines.join('\n');
}

function yamlHandoffs(handoffs = []) {
  if (handoffs.length === 0) {
    return '';
  }

  const lines = ['handoffs:'];
  for (const handoff of handoffs) {
    lines.push(`  - label: ${handoff.label}`);
    lines.push(`    agent: ${handoff.agent}`);
    lines.push(`    prompt: ${handoff.prompt}`);
    lines.push('    send: false');
  }

  return `${lines.join('\n')}\n`;
}

function claudeAgent(role) {
  const disallowed = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
  if (!role.claudeTools.includes('Bash')) {
    disallowed.push('Bash');
  }

  const front = [
    '---',
    `name: ${role.id}`,
    `description: ${role.description}`,
    `tools: ${role.claudeTools}`,
    `maxTurns: ${role.readOnly ? 20 : 30}`,
  ];

  if (role.readOnly) {
    front.push(`disallowedTools: ${disallowed.join(', ')}`);
  }

  front.push('---');

  return `${front.join('\n')}\n\n${generatedHeader('md')}\n${role.body.trim()}\n`;
}

function copilotAgent(role) {
  const lines = [
    '---',
    `name: ${role.id}`,
    `description: ${role.description}`,
    `tools: ${JSON.stringify(role.copilotTools)}`,
  ];

  const handoffs = yamlHandoffs(role.handoffs);
  if (handoffs) {
    lines.push(handoffs.trimEnd());
  }

  lines.push('---');

  return `${lines.join('\n')}\n\n${generatedHeader('md')}\n${role.body.trim()}\n`;
}

function tomlString(value) {
  return `"""\n${value.trim()}\n"""`;
}

function tomlLiteral(value) {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(tomlLiteral).join(', ')}]`;
  }

  throw new Error(`Unsupported TOML profile value: ${JSON.stringify(value)}`);
}

function validateRuntimeProfiles(runtimeProfiles) {
  if (!runtimeProfiles || typeof runtimeProfiles !== 'object' || Array.isArray(runtimeProfiles)) {
    throw new Error('core/runtime-profiles.json must contain an object');
  }

  const profiles = runtimeProfiles.profiles;
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) {
    throw new Error('core/runtime-profiles.json must define a profiles object');
  }

  if (!Object.hasOwn(profiles, runtimeProfiles.defaultProfile)) {
    throw new Error('core/runtime-profiles.json defaultProfile must name a defined profile');
  }

  for (const [name, settings] of Object.entries(profiles)) {
    if (!/^[A-Za-z0-9_-]+$/.test(name)) {
      throw new Error(`Invalid Codex profile name: ${name}`);
    }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw new Error(`Codex profile ${name} must contain a settings object`);
    }
  }
}

function codexProfileConfig(settings) {
  const values = Object.entries(settings)
    .map(([key, value]) => `${key} = ${tomlLiteral(value)}`)
    .join('\n');

  return `${generatedHeader('toml')}${values}\n`;
}

function codexAgent(role) {
  return [
    generatedHeader('toml').trimEnd(),
    `name = "${role.codexName}"`,
    `description = "${role.description}"`,
    `default_permissions = "${role.readOnly ? 'contract-readonly' : 'contract-workspace'}"`,
    `developer_instructions = ${tomlString(role.body)}`,
    '',
  ].join('\n');
}

function copilotInstruction(id, instruction) {
  return [
    '---',
    `applyTo: "${instruction.applyTo}"`,
    '---',
    '',
    generatedHeader('md').trimEnd(),
    '',
    `# ${instruction.title}`,
    '',
    ...instruction.body.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

function coachSection(raw, name) {
  const begin = `<!-- BEGIN ${name} -->`;
  const end = `<!-- END ${name} -->`;
  const start = raw.indexOf(begin);
  const stop = raw.indexOf(end);
  if (start === -1 || stop === -1 || stop < start) {
    throw new Error(`core/coach.md is missing the ${name} section`);
  }

  return raw.slice(start + begin.length, stop).trim();
}

function coachSkill(name, description, body) {
  const front = ['---', `name: ${name}`, `description: ${description}`, '---'].join('\n');

  return `${front}\n\n${generatedHeader('md')}\n${body.trim()}\n`;
}

function denyPatterns(guardrails) {
  const readEdit = [];
  for (const baseName of guardrails.protectedBaseNames) {
    readEdit.push(`**/${baseName}`);
  }
  for (const extension of guardrails.protectedExtensions) {
    readEdit.push(`**/*${extension}`);
  }
  readEdit.push('~/.aws/credentials', '~/.azure/**');

  return readEdit;
}

function codexWorkspaceDenyPatterns(guardrails) {
  return [
    ...guardrails.protectedBaseNames.map((baseName) => `**/${baseName}`),
    ...guardrails.protectedExtensions.map((extension) => `**/*${extension}`),
    ...guardrails.protectedPathFragments.map((fragment) => (
      `**/${fragment.replace(/\/$/, '')}`
    )),
  ];
}

function claudeSettings(guardrails) {
  const patterns = denyPatterns(guardrails);
  const bashCommands = ['cat', 'head', 'tail', 'less', 'grep', 'source'];
  const bashDeny = [];

  for (const command of bashCommands) {
    for (const pattern of guardrails.protectedBaseNames) {
      bashDeny.push(`Bash(${command} *${pattern}*)`);
    }
    for (const extension of guardrails.protectedExtensions) {
      bashDeny.push(`Bash(${command} *${extension})`);
    }
  }

  return `${JSON.stringify({
    language: 'british english',
    attribution: { commit: '', pr: '' },
    permissions: {
      allow: [
        'Bash(git diff *)',
        'Bash(git log *)',
        'Bash(git status)',
      ],
      deny: [
        'Read(~/.ssh/**)',
        ...patterns.map((pattern) => `Read(${pattern})`),
        ...patterns.map((pattern) => `Edit(${pattern})`),
        ...bashDeny,
      ],
    },
    hooks: {
      PreToolUse: [
        {
          matcher: '.*',
          hooks: [
            {
              type: 'command',
              command: '$HOME/.claude/hooks/pre-tool-guard.sh',
              timeout: 15,
            },
          ],
        },
      ],
    },
  }, null, 2)}\n`;
}

function codexConfig(guardrails, runtimeProfiles) {
  const workspaceDenyRules = codexWorkspaceDenyPatterns(guardrails)
    .map((pattern) => `${JSON.stringify(pattern)} = "deny"`)
    .join('\n');
  const defaultSettings = runtimeProfiles.profiles[runtimeProfiles.defaultProfile];
  const baseSettings = Object.entries(defaultSettings)
    .map(([key, value]) => `${key} = ${tomlLiteral(value)}`)
    .join('\n');

  return `${generatedHeader('toml')}${baseSettings}
default_permissions = "contract-workspace"
[permissions.contract-workspace.filesystem]
":minimal" = "read"
"~/.ssh" = "deny"
"~/.aws/credentials" = "deny"
"~/.azure" = "deny"
glob_scan_max_depth = 20

[permissions.contract-workspace.filesystem.":workspace_roots"]
"." = "write"
${workspaceDenyRules}

[permissions.contract-workspace.network]
enabled = false

[permissions.contract-readonly.filesystem]
":minimal" = "read"
"~/.ssh" = "deny"
"~/.aws/credentials" = "deny"
"~/.azure" = "deny"
glob_scan_max_depth = 20

[permissions.contract-readonly.filesystem.":workspace_roots"]
"." = "read"
${workspaceDenyRules}

[permissions.contract-readonly.network]
enabled = false

[features]
hooks = true
multi_agent = true
shell_snapshot = true

[tui]
notifications = true
animations = true

[history]
persistence = "save-all"

[agents]
max_threads = 4
max_depth = 1
job_max_runtime_seconds = 1800
`;
}

function hookWrapper(kind) {
  return `#!/usr/bin/env bash
${generatedHeader('sh').trimEnd()}
set -euo pipefail

node "$HOME/.local/share/ai-agent-contract/guard.js" ${kind}
`;
}

function generateFiles() {
  const guardrails = readJson('core/guardrails.json');
  const runtimeProfiles = readJson('core/runtime-profiles.json');
  const roles = readJson('core/roles.json').roles;
  const areaInstructions = readJson('core/area-instructions.json');
  validateRuntimeProfiles(runtimeProfiles);
  const contract = toolContract('Global Contract', guardrails);

  const files = new Map();

  files.set('claude/CLAUDE.md', contract);
  files.set('codex/AGENTS.md', contract);
  files.set('claude/prompts/workflow.md', read('core/workflow.md'));
  files.set('codex/prompts/workflow.md', read('core/workflow.md'));
  files.set('copilot/prompts/workflow.md', read('core/workflow.md'));
  files.set('vscode/settings.json', `${JSON.stringify(readJson('core/vscode-settings.json'), null, 2)}\n`);
  files.set('claude/settings.json', claudeSettings(guardrails));
  files.set('claude/hooks/pre-tool-guard.sh', hookWrapper('claude-pre-tool'));
  files.set('codex/config.toml', codexConfig(guardrails, runtimeProfiles));
  for (const [name, settings] of Object.entries(runtimeProfiles.profiles)) {
    files.set(`codex/${name}.config.toml`, codexProfileConfig(settings));
  }
  files.set('codex/hooks.json', `${JSON.stringify({
    hooks: {
      PreToolUse: [
        {
          matcher: '.*',
          hooks: [
            {
              type: 'command',
              command: '$HOME/.codex/hooks/pre-tool-guard.sh',
            },
          ],
        },
      ],
    },
  }, null, 2)}\n`);
  files.set('codex/hooks/pre-tool-guard.sh', hookWrapper('codex-pre-tool'));
  files.set('copilot/hooks/policy.json', `${JSON.stringify({
    version: 1,
    hooks: {
      preToolUse: [
        {
          type: 'command',
          bash: '$HOME/.copilot/hooks/pre-tool-guard.sh',
          timeoutSec: 15,
        },
      ],
    },
  }, null, 2)}\n`);
  files.set('copilot/hooks/pre-tool-guard.sh', hookWrapper('copilot-pre-tool'));
  files.set('copilot/instructions/global-contract.instructions.md', [
    '---',
    'applyTo: "**"',
    '---',
    '',
    contract.trimEnd(),
    '',
  ].join('\n'));

  for (const [id, instruction] of Object.entries(areaInstructions)) {
    files.set(`copilot/instructions/${id}.instructions.md`, copilotInstruction(id, instruction));
  }

  for (const role of roles) {
    files.set(`claude/agents/${role.id}.md`, claudeAgent(role));
    files.set(`codex/agents/${role.codexName}.toml`, codexAgent(role));
    files.set(`copilot/agents/${role.id}.agent.md`, copilotAgent(role));
  }

  const coach = read('core/coach.md');
  const shared = coachSection(coach, 'SHARED');
  const coachModes = [
    {
      slug: 'guide-mode',
      section: 'GUIDE',
      description: 'Coach me with guidance only; I write every line myself',
    },
    {
      slug: 'scaffolding-mode',
      section: 'SCAFFOLDING',
      description: 'Write the test and scaffolding for me; I write the logic',
    },
    {
      slug: 'tutor-mode',
      section: 'TUTOR',
      description: 'Teach me line by line while I write the code myself',
    },
  ];

  for (const mode of coachModes) {
    const body = markdownJoin([shared, coachSection(coach, mode.section)]);
    const skill = coachSkill(mode.slug, mode.description, body);
    files.set(`claude/skills/${mode.slug}/SKILL.md`, skill);
    files.set(`codex/skills/${mode.slug}/SKILL.md`, skill);
    files.set(`copilot/skills/${mode.slug}/SKILL.md`, skill);
  }

  return files;
}

const files = generateFiles();
const drifted = [];

if (!outputRoot) {
  if (!check) {
    console.error('Refusing to write generated runtime files into the repository.');
    console.error('Run: node scripts/generate.js --out <directory>');
    process.exit(1);
  }

  console.log(`Generator rendered ${files.size} files from core sources.`);
  process.exit(0);
}

for (const [relativePath, expected] of files.entries()) {
  const fullPath = path.join(outputRoot, relativePath);
  const current = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n') : null;

  if (check) {
    if (current !== expected) {
      drifted.push(relativePath);
    }
  } else if (current !== expected) {
    const mode = relativePath.endsWith('.sh') ? 0o755 : 0o644;
    write(relativePath, expected, mode, outputRoot);
  }
}

if (drifted.length > 0) {
  console.error('Generated files are out of sync:');
  for (const file of drifted) {
    console.error(`- ${file}`);
  }
  console.error(`Run: node scripts/generate.js --out ${outputRoot}`);
  process.exit(1);
}

console.log(check ? 'Generated files are in sync.' : `Generated files written to ${outputRoot}.`);
