const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('canonical skill catalogue contains only focused, non-duplicated skills', () => {
  const skills = fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(skills, [
    'decision-ledger',
    'implement-mode',
    'migration-mode',
    'php-cakephp',
    'plan-mode',
    'python',
    'review-risk',
    'typescript-react',
    'web-research',
  ]);
});

test('web-research skill is strictly opt-in and tool-agnostic across frontmatter and body', () => {
  const content = fs.readFileSync(path.join(root, 'skills', 'web-research', 'SKILL.md'), 'utf8');
  const description = content.match(/^description:\s*(.+)$/m)?.[1] || '';

  assert.match(description, /explicitly invokes web-research/i);
  assert.doesNotMatch(content, /every message|no exceptions|today in history/i);
  assert.doesNotMatch(content, /antml:cite|\bweb_search\b|\bweb_fetch\b/i);
  assert.doesNotMatch(content, /March 2026/);
  assert.match(content, /Quick \(default\)/);
  assert.match(content, /Deep /);
  assert.match(content, /Official \/ primary-source priority/);
});

test('decision-ledger and review-risk skills provide concrete on-demand procedures', () => {
  const ledger = fs.readFileSync(path.join(root, 'skills', 'decision-ledger', 'SKILL.md'), 'utf8');
  assert.match(ledger, /## Required Format/);
  assert.match(ledger, /## Scope Anchors/);
  assert.match(ledger, /## Granularity/);

  const review = fs.readFileSync(path.join(root, 'skills', 'review-risk', 'SKILL.md'), 'utf8');
  assert.match(review, /## Checklist/);
  assert.match(review, /## Severity Rubric/);
  assert.match(review, /## Output Format/);
});

test('plan-mode and implement-mode define two-session commit-by-commit handoff', () => {
  const plan = fs.readFileSync(path.join(root, 'skills', 'plan-mode', 'SKILL.md'), 'utf8');
  assert.match(plan, /explicitly invokes plan-mode/i);
  assert.match(plan, /web-research/);
  assert.match(plan, /git rev-parse --git-path agent-plans\//);
  assert.match(plan, /Read-only on repository source files/i);
  assert.match(plan, /Commit-By-Commit Plan/);
  assert.match(plan, /Approved Decisions/);

  const impl = fs.readFileSync(path.join(root, 'skills', 'implement-mode', 'SKILL.md'), 'utf8');
  assert.match(impl, /explicitly invokes implement-mode/i);
  assert.match(impl, /git rev-parse --git-path agent-plans/);
  assert.match(impl, /strictly one pending .* commit at a time/i);
  assert.match(impl, /Do not run `git commit` until the user explicitly confirms sign-off/i);
  assert.match(impl, /Conventional Commit/);
  assert.match(impl, /Co-authored-by:/);
});

test('migration-mode is opt-in, gated and ships its proof scripts and references', () => {
  const skillRoot = path.join(root, 'skills', 'migration-mode');
  const content = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
  const description = content.match(/^description:\s*(.+)$/m)?.[1] || '';

  assert.match(description, /explicitly invokes migration-mode/i);
  for (const gate of ['G0 Baseline', 'G1 Inventory', 'G2 Pin first', 'G3 Like-for-like cutover', 'G4 Framework-native audit',
    'G5 Intentional changes', 'G6 Structural moves', 'G7 Dead code', 'G8 Dependencies', 'G9 Live comparison', 'G10 Finish']) {
    assert.ok(content.includes(gate), `missing gate: ${gate}`);
  }
  assert.match(content, /Raise improvements proactively/);
  assert.match(content, /Never bend a pin/);

  const scripts = fs.readdirSync(path.join(skillRoot, 'scripts')).sort();
  assert.deepEqual(scripts, ['ast_move_check.py', 'ci_in_image.sh', 'import_bindings.py', 'mutants.py', 'reachability.py', 'snapshot.sh']);
  for (const script of scripts) {
    assert.ok(content.includes(`\`${script}`), `SKILL.md does not document ${script}`);
  }
  const references = fs.readdirSync(path.join(skillRoot, 'references')).sort();
  assert.deepEqual(references, ['failure-modes.md', 'implementer-prompt.md']);
  for (const reference of references) {
    assert.ok(content.includes(`references/${reference}`), `SKILL.md does not link ${reference}`);
  }
  const prompt = fs.readFileSync(path.join(skillRoot, 'references', 'implementer-prompt.md'), 'utf8');
  assert.match(prompt, /Precondition: HEAD is/);
  assert.match(prompt, /Fail-First Pattern/);
});
