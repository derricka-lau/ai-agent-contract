#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const mode = process.argv[2] || '';
const guardrailsPath = process.env.AI_AGENT_CONTRACT_GUARDRAILS
  || path.join(__dirname, 'guardrails.json');

function loadGuardrails() {
  const value = JSON.parse(fs.readFileSync(guardrailsPath, 'utf8'));
  for (const key of [
    'protectedBaseNames',
    'protectedExtensions',
    'protectedPathFragments',
    'safeExampleBaseNames',
    'dangerousCommandPatterns',
  ]) {
    if (!Array.isArray(value[key]) || !value[key].every((item) => typeof item === 'string')) {
      throw new Error(`guardrails field ${key} must be an array of strings`);
    }
  }
  for (const pattern of value.dangerousCommandPatterns) {
    new RegExp(pattern, 'i');
  }
  return value;
}

function collectStrings(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output);
    }
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectStrings(item, output);
    }
  }
  return output;
}

function readStdin() {
  return fs.readFileSync(0, 'utf8');
}

function parsePayload(input) {
  const payload = JSON.parse(input || '{}');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('hook payload must be a JSON object');
  }
  return payload;
}

function toolArguments(payload) {
  return payload.tool_input
    || payload.toolInput
    || payload.tool_args
    || payload.toolArgs
    || {};
}

function commandFromPayload(payload) {
  const args = toolArguments(payload);
  if (args && typeof args === 'object' && !Array.isArray(args)) {
    if (typeof args.command === 'string') {
      return args.command;
    }
    if (Array.isArray(args.commands)) {
      return args.commands.join(' && ');
    }
    if (typeof args.commands === 'string') {
      return args.commands;
    }
    return '';
  }
  if (typeof args === 'string' && args.length > 0) {
    try {
      return commandFromPayload({ toolArgs: JSON.parse(args) });
    } catch {
      return args;
    }
  }
  return '';
}

function haystackFromPayload(payload) {
  const toolName = payload.tool_name || payload.toolName || '';
  return `${toolName} ${collectStrings(toolArguments(payload)).join(' ')}`;
}

function normaliseToken(token) {
  return token.replace(/\\/g, '/');
}

function isSensitiveToken(token, guardrails) {
  const normalised = normaliseToken(token);
  const parts = normalised.split('/').filter(Boolean);
  const baseName = parts[parts.length - 1] || normalised;

  if (guardrails.safeExampleBaseNames.includes(baseName)) {
    return false;
  }

  return guardrails.protectedBaseNames.includes(baseName)
    || guardrails.protectedExtensions.some((extension) => baseName.endsWith(extension))
    || guardrails.protectedPathFragments.some((fragment) => normalised.includes(fragment));
}

function pathTokens(input) {
  return normaliseToken(input)
    .split(/[^A-Za-z0-9_.\\/~:-]+/)
    .filter(Boolean);
}

function evaluatePayload(payload, guardrails) {
  const hasSensitiveFile = pathTokens(haystackFromPayload(payload))
    .some((token) => isSensitiveToken(token, guardrails));
  if (hasSensitiveFile) {
    return {
      blocked: true,
      reason: 'Blocked sensitive file access by local policy hook',
    };
  }

  const command = commandFromPayload(payload);
  const hasDangerousCommand = guardrails.dangerousCommandPatterns
    .map((pattern) => new RegExp(pattern, 'i'))
    .some((pattern) => pattern.test(command));
  if (hasDangerousCommand) {
    return {
      blocked: true,
      reason: 'Blocked dangerous command by local policy hook',
    };
  }

  return { blocked: false, reason: '' };
}

function evaluateInput(input) {
  try {
    return evaluatePayload(parsePayload(input), loadGuardrails());
  } catch {
    return {
      blocked: true,
      reason: 'Blocked invalid local policy hook input',
    };
  }
}

function writeCopilotDecision(reason) {
  process.stdout.write(JSON.stringify({
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  }));
}

function runCopilotPreTool() {
  const result = evaluateInput(readStdin());
  if (result.blocked) {
    writeCopilotDecision(result.reason);
  }
}

function runBlockingPreTool() {
  const result = evaluateInput(readStdin());
  if (result.blocked) {
    console.error(result.reason);
    process.exit(2);
  }
}

if (mode === 'copilot-pre-tool') {
  runCopilotPreTool();
} else if (mode === 'codex-pre-tool' || mode === 'codex-pre-command' || mode === 'claude-pre-tool') {
  runBlockingPreTool();
} else {
  console.error('Usage: guard.js <copilot-pre-tool|codex-pre-tool|claude-pre-tool>');
  process.exit(64);
}
