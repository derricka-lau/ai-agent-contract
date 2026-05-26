#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const outIndex = args.indexOf('--out');
const outputRoot = outIndex === -1 ? null : path.resolve(args[outIndex + 1] || '');

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

function toolContract(title) {
  return markdownJoin([
    `# ${title}`,
    generatedHeader('md'),
    read('core/global-contract.md').replace(/^# Global Contract\n+/, ''),
    read('core/decision-ledger.md'),
    read('core/sensitive-files.md'),
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
    'model: opus',
    'effort: max',
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

function codexAgent(role) {
  return [
    generatedHeader('toml').trimEnd(),
    `name = "${role.codexName}"`,
    `description = "${role.description}"`,
    'model = "gpt-5.4"',
    'model_reasoning_effort = "xhigh"',
    `sandbox_mode = "${role.codexSandbox}"`,
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

function codexProjectRootDenyPatterns(guardrails) {
  return guardrails.protectedBaseNames;
}

function codexAbsoluteDenyPatterns(guardrails) {
  return denyPatterns(guardrails).filter((pattern) => pattern.startsWith('~'));
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
    alwaysThinkingEnabled: true,
    effortLevel: 'max',
    autoMemoryEnabled: true,
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
      Notification: [
        {
          hooks: [
            {
              type: 'command',
              command: 'terminal-notifier -message "$CLAUDE_NOTIFICATION" -title "Claude Code" 2>/dev/null || notify-send "Claude Code" "$CLAUDE_NOTIFICATION" 2>/dev/null || true',
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              command: 'cmd="$CLAUDE_TOOL_INPUT"; case "$cmd" in *pytest*|*phpunit*|*"composer test"*|*"npm test"*|*"npm run test"*|*"yarn test"*|*jest*|*vitest*|*mocha*) touch /tmp/.claude-tests-ran ;; esac; exit 0',
            },
          ],
        },
      ],
      Stop: [
        {
          hooks: [
            {
              type: 'command',
              command: 'if [ -f /tmp/.claude-tests-ran ]; then rm -f /tmp/.claude-tests-ran; exit 0; else echo \'{"decision":"block","reason":"Run tests before considering this complete."}\'; fi',
            },
          ],
        },
      ],
    },
  }, null, 2)}\n`;
}

function codexConfig() {
  return `${generatedHeader('toml')}model = "gpt-5.3-codex"
model_reasoning_effort = "xhigh"
service_tier = "fast"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
web_search = "cached"
notify = ["terminal-notifier", "-message", "Codex turn complete", "-title", "Codex"]

[sandbox_workspace_write]
network_access = false

[features]
hooks = true
multi_agent = true
shell_snapshot = true

[profiles.secure-global]
model = "gpt-5.4"
model_reasoning_effort = "high"
service_tier = "fast"
approval_policy = "on-request"
web_search = "cached"

[profiles.deep]
model = "gpt-5.4"
model_reasoning_effort = "high"
service_tier = "fast"
approval_policy = "never"
web_search = "cached"

[profiles.quick]
model = "gpt-5.4-mini"
model_reasoning_effort = "medium"
service_tier = "fast"
approval_policy = "on-request"
web_search = "cached"

[profiles.verify]
model = "gpt-5.4"
model_reasoning_effort = "high"
service_tier = "fast"
approval_policy = "on-request"
web_search = "cached"

[tui]
notifications = true
animations = true

[history]
persistence = "save-all"

[agents]
max_threads = 6
max_depth = 1
job_max_runtime_seconds = 1800
`;
}

function hookWrapper(kind) {
  return `#!/usr/bin/env bash
set -euo pipefail

node "$HOME/.local/share/dotfiles/guard.js" ${kind}
`;
}

function generateFiles() {
  const guardrails = readJson('core/guardrails.json');
  const roles = readJson('core/roles.json').roles;
  const areaInstructions = readJson('core/area-instructions.json');
  const contract = toolContract('Global Contract');

  const files = new Map();

  files.set('claude/CLAUDE.md', contract);
  files.set('codex/AGENTS.md', contract);
  files.set('copilot/AGENTS.md', contract);
  files.set('copilot/copilot-instructions.md', contract);
  files.set('claude/MEMORY.md', read('core/memory.md'));
  files.set('codex/MEMORY.md', read('core/memory.md'));
  files.set('copilot/MEMORY.md', read('core/memory.md'));
  files.set('claude/memory/user_role.md', read('core/user-context.md'));
  files.set('codex/memory/user_role.md', read('core/user-context.md'));
  files.set('copilot/memory/user_role.md', read('core/user-context.md'));
  files.set('claude/prompts/workflow.md', read('core/workflow.md'));
  files.set('codex/prompts/workflow.md', read('core/workflow.md'));
  files.set('copilot/prompts/workflow.md', read('core/workflow.md'));
  files.set('claude/settings.json', claudeSettings(guardrails));
  files.set('claude/managed-settings.json', `${JSON.stringify({ permissions: { disableBypassPermissionsMode: 'disable' } }, null, 2)}\n`);
  files.set('codex/config.toml', codexConfig(guardrails));
  files.set('codex/hooks.json', `${JSON.stringify({
    hooks: {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              command: '$HOME/.codex/hooks/pre-command-guard.sh',
            },
          ],
        },
      ],
      Stop: [
        {
          hooks: [
            {
              type: 'command',
              command: '$HOME/.codex/hooks/stop-reminder.sh',
            },
          ],
        },
      ],
    },
  }, null, 2)}\n`);
  files.set('codex/hooks/pre-command-guard.sh', hookWrapper('codex-pre-command'));
  files.set('codex/hooks/stop-reminder.sh', '#!/usr/bin/env bash\nset -euo pipefail\n\necho \'{"decision":"block","reason":"Run tests before considering this complete."}\'\n');
  files.set('copilot/hooks/policy.json', `${JSON.stringify({
    version: 1,
    hooks: {
      PreToolUse: [
        {
          type: 'command',
          command: '$HOME/.copilot/hooks/pre-tool-guard.sh',
          timeout: 15,
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
