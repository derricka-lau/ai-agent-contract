const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const hook = path.join(root, 'hooks', 'commit-msg');

function runCommitMsg(t, message) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-commit-msg-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const msgPath = path.join(dir, 'COMMIT_EDITMSG');
  fs.writeFileSync(msgPath, message, 'utf8');
  return spawnSync('bash', [hook, msgPath], { encoding: 'utf8' });
}

test('commit-msg accepts valid Conventional Commits and Git-generated subjects', (t) => {
  for (const message of [
    'feat(antigravity): add native plugin target\n',
    'fix!: enforce strict guard fail-closed output\n\nExplain why the protocol changed.\n# Comment ignored\n',
    'chore(deps): bump jsonc-parser\n',
    "Merge branch 'main' into feature\n",
    'Revert "feat: old behaviour"\n',
    'fixup! fix(skills): tighten description\n',
  ]) {
    const result = runCommitMsg(t, message);
    assert.equal(result.status, 0, `expected accept for ${JSON.stringify(message)}, got: ${result.stderr}`);
  }
});

test('commit-msg rejects any Co-authored-by trailer and AI attribution footers', (t) => {
  for (const [label, message] of [
    ['human co-author', 'feat: add feature\n\nCo-authored-by: Jane Doe <jane@example.com>\n'],
    ['AI co-author', 'fix(guard): block env\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n'],
    ['co-author in merge', "Merge branch 'main'\n\nCo-authored-by: Bot <bot@example.com>\n"],
    ['generated-with footer', 'docs: update readme\n\nGenerated with Claude Code\n'],
    ['robot footer', 'chore: clean skills\n\n🤖 Generated with Antigravity\n'],
  ]) {
    const result = runCommitMsg(t, message);
    assert.equal(result.status, 1, `expected reject for ${label}`);
  }
});

test('commit-msg rejects non-Conventional, overly long, trailing-period, and empty subjects', (t) => {
  for (const [label, message] of [
    ['plain subject', 'Update README\n'],
    ['unknown type', 'update(docs): refresh readme\n'],
    ['trailing period', 'fix(guard): block env files.\n'],
    ['too long', `feat(antigravity): ${'a'.repeat(60)}\n`],
    ['empty', '\n# Only comments\n'],
  ]) {
    const result = runCommitMsg(t, message);
    assert.equal(result.status, 1, `expected reject for ${label}`);
  }
});
