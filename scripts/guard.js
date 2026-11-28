#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const mode = process.argv[2] || '';
const guardrailsPath = process.env.AI_AGENT_CONTRACT_GUARDRAILS
  || path.join(__dirname, 'guardrails.json');

// Keys whose value is file content written by a file tool, not a path or command. Their text is not scanned, so an
// agent can write a .gitignore or docs that name protected files; the target path in the same payload still is.
const CONTENT_KEYS = new Set(['content', 'new_string', 'old_string', 'new_str', 'old_str', 'new_source', 'file_text']);

const GLOB_CHARACTERS = /[*?[]/;

function loadGuardrails() {
  const value = JSON.parse(fs.readFileSync(guardrailsPath, 'utf8'));
  const rules = {};
  for (const key of [
    'protectedBaseNames',
    'protectedBaseNamePrefixes',
    'protectedExtensions',
    'protectedPathFragments',
    'safeExampleMarkers',
  ]) {
    if (!Array.isArray(value[key]) || !value[key].every((item) => typeof item === 'string' && item.length > 0)) {
      throw new Error(`guardrails field ${key} must be an array of non-empty strings`);
    }
    rules[key] = value[key].map((item) => item.toLowerCase());
  }
  return rules;
}

function collectStrings(value, output = [], key = '') {
  if (CONTENT_KEYS.has(key)) {
    return output;
  }
  if (typeof value === 'string') {
    output.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output, key);
    }
  } else if (value && typeof value === 'object') {
    for (const [childKey, item] of Object.entries(value)) {
      collectStrings(item, output, childKey);
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
    || payload.toolCall?.args
    || {};
}

function haystackFromPayload(payload) {
  const toolName = payload.tool_name || payload.toolName || payload.toolCall?.name || '';
  return `${toolName} ${collectStrings(toolArguments(payload)).join(' ')}`;
}

function normaliseToken(token) {
  return token.replace(/\\/g, '/').toLowerCase();
}

function baseNameOf(normalised) {
  const parts = normalised.split('/').filter(Boolean);
  return parts[parts.length - 1] || normalised;
}

// A template copy ends in a safe marker extension, for example a protected name followed by `.example`.
function isSafeExample(baseName, rules) {
  const segments = baseName.split('.');
  return segments.length > 1 && rules.safeExampleMarkers.includes(segments[segments.length - 1]);
}

function matchesFragment(normalised, fragment) {
  if (normalised.includes(fragment)) {
    return true;
  }
  if (!fragment.endsWith('/')) {
    return false;
  }
  const directory = fragment.slice(0, -1);
  return normalised === directory || normalised.endsWith(`/${directory}`);
}

function isSensitiveToken(token, rules) {
  const normalised = normaliseToken(token);
  const baseName = baseNameOf(normalised);

  if (isSafeExample(baseName, rules)) {
    return false;
  }

  return rules.protectedBaseNames.includes(baseName)
    || rules.protectedBaseNamePrefixes.some((prefix) => baseName.startsWith(prefix))
    || rules.protectedExtensions.some((extension) => baseName.endsWith(extension))
    || rules.protectedPathFragments.some((fragment) => matchesFragment(normalised, fragment));
}

function pathTokens(input) {
  return normaliseToken(input)
    .split(/[^a-z0-9_.\\/~:-]+/)
    .filter(Boolean);
}

function expandBraces(word, budget = { remaining: 64 }) {
  const match = word.match(/^(.*?)\{([^{}]*,[^{}]*)\}(.*)$/);
  if (!match || budget.remaining <= 0) {
    return [word];
  }
  return match[2].split(',').flatMap((option) => {
    budget.remaining -= 1;
    return expandBraces(`${match[1]}${option}${match[3]}`, budget);
  });
}

// Shell words after quote removal and brace expansion, so split or quoted names collapse to what the shell opens.
function shellWords(input) {
  const unquoted = input.replace(/\\(.)/g, '$1').replace(/['"]/g, '');
  return unquoted
    .split(/[\s;|&<>()`=$]+/)
    .filter(Boolean)
    .flatMap((word) => expandBraces(word));
}

function globToRegExp(glob) {
  let source = '';
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    if (character === '*') {
      source += '[^/]*';
    } else if (character === '?') {
      source += '[^/]';
    } else if (character === '[') {
      const close = glob.indexOf(']', index + 1);
      if (close === -1) {
        source += '\\[';
      } else {
        source += `[${glob.slice(index + 1, close).replace(/[\\\]]/g, '\\$&')}]`;
        index = close;
      }
    } else {
      source += character.replace(/[.+^${}()|\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

function globCandidates(rules) {
  return [
    ...rules.protectedBaseNames,
    ...rules.protectedBaseNamePrefixes.map((prefix) => `${prefix}local`),
    ...rules.protectedExtensions.map((extension) => `file${extension}`),
  ];
}

// A glob word is sensitive when the shell could expand it to a protected name. Shell globs only match dot files
// when the pattern itself starts with a dot; other candidates need two literal characters, so `*` stays usable.
function isSensitiveGlob(word, rules) {
  const baseName = baseNameOf(normaliseToken(word));
  if (!GLOB_CHARACTERS.test(baseName)) {
    return false;
  }
  let pattern;
  try {
    pattern = globToRegExp(baseName);
  } catch {
    return true;
  }
  const literalLength = baseName.replace(/\[[^\]]*\]|[*?]/g, '').length;
  return globCandidates(rules).some((name) => {
    if (name.startsWith('.')) {
      return baseName.startsWith('.') && pattern.test(name) && !isSafeExample(name, rules);
    }
    return literalLength >= 2 && pattern.test(name) && !isSafeExample(name, rules);
  });
}

function evaluatePayload(payload, rules) {
  const haystack = haystackFromPayload(payload);
  const words = shellWords(haystack);
  const hasSensitiveFile = pathTokens(haystack).some((token) => isSensitiveToken(token, rules))
    || words.some((word) => isSensitiveToken(word, rules) || isSensitiveGlob(word, rules));
  if (hasSensitiveFile) {
    return {
      blocked: true,
      reason: 'Blocked sensitive file access by local policy hook',
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

function runAntigravityPreTool() {
  const result = evaluateInput(readStdin());
  if (result.blocked) {
    process.stdout.write(JSON.stringify({
      decision: 'deny',
      reason: result.reason,
    }));
    return;
  }
  process.stdout.write(JSON.stringify({ decision: 'allow' }));
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
} else if (mode === 'antigravity-pre-tool') {
  runAntigravityPreTool();
} else if (mode === 'codex-pre-tool' || mode === 'claude-pre-tool') {
  runBlockingPreTool();
} else {
  console.error('Usage: guard.js <copilot-pre-tool|antigravity-pre-tool|codex-pre-tool|claude-pre-tool>');
  process.exit(64);
}
