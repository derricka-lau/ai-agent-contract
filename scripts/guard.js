#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || '';
const guardrailsPath = process.env.AI_AGENT_CONTRACT_GUARDRAILS
  || path.join(__dirname, 'guardrails.json');
const guardrails = JSON.parse(fs.readFileSync(guardrailsPath, 'utf8'));

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
  try {
    return JSON.parse(input || '{}');
  } catch {
    return {};
  }
}

function commandFromPayload(payload) {
  const toolInput = payload.tool_input || payload.toolInput || {};
  const rawToolArgs = payload.toolArgs || '';

  if (typeof toolInput.command === 'string') {
    return toolInput.command;
  }

  if (Array.isArray(toolInput.commands)) {
    return toolInput.commands.join(' && ');
  }

  if (typeof toolInput.commands === 'string') {
    return toolInput.commands;
  }

  if (typeof rawToolArgs === 'string' && rawToolArgs.length > 0) {
    try {
      const parsedArgs = JSON.parse(rawToolArgs);
      return commandFromPayload({ tool_input: parsedArgs });
    } catch {
      return rawToolArgs;
    }
  }

  return '';
}

function haystackFromPayload(payload) {
  const toolName = payload.tool_name || payload.toolName || '';
  const toolInput = payload.tool_input || payload.toolInput || {};
  const rawToolArgs = payload.toolArgs || '';

  return `${toolName} ${commandFromPayload(payload)} ${collectStrings(toolInput).join(' ')} ${rawToolArgs}`;
}

function normaliseToken(token) {
  return token.replace(/\\/g, '/');
}

function isSensitiveToken(token) {
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

function evaluate(input) {
  const dangerousCommandPatterns = guardrails.dangerousCommandPatterns
    .map((pattern) => new RegExp(pattern, 'i'));
  const hasDangerousCommand = dangerousCommandPatterns.some((pattern) => pattern.test(input));
  const hasSensitiveFile = pathTokens(input).some(isSensitiveToken);

  if (hasSensitiveFile) {
    return {
      blocked: true,
      reason: 'Blocked sensitive file access by local policy hook',
    };
  }

  if (hasDangerousCommand) {
    return {
      blocked: true,
      reason: 'Blocked dangerous command by local policy hook',
    };
  }

  return {
    blocked: false,
    reason: '',
  };
}

function runCopilotPreTool() {
  const payload = parsePayload(readStdin());
  const result = evaluate(haystackFromPayload(payload));

  if (!result.blocked) {
    return;
  }

  process.stdout.write(JSON.stringify({
    permissionDecision: 'deny',
    permissionDecisionReason: result.reason,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: result.reason,
    },
  }));
}

function runCodexPreCommand() {
  const payload = parsePayload(readStdin());
  const result = evaluate(haystackFromPayload(payload));

  if (!result.blocked) {
    return;
  }

  console.error(result.reason);
  process.exit(2);
}

if (mode === 'copilot-pre-tool') {
  runCopilotPreTool();
} else if (mode === 'codex-pre-command') {
  runCodexPreCommand();
} else {
  console.error('Usage: guard.js <copilot-pre-tool|codex-pre-command>');
  process.exit(64);
}
