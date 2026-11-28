const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const scripts = path.join(root, 'skills', 'migration-mode', 'scripts');
const python = spawnSync('python3', ['--version']).status === 0 ? 'python3' : null;
const skipWithoutPython = python ? false : 'python3 is not available';

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: 'utf8' });
}

function tempDir(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-scripts-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function write(base, relative, content) {
  const target = path.join(base, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

const noHooks = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-scripts-no-hooks-'));
process.on('exit', () => fs.rmSync(noHooks, { recursive: true, force: true }));

function git(cwd, ...args) {
  const result = run('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.invalid', '-c', `core.hooksPath=${noHooks}`, ...args], cwd);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test('every proof script is syntactically valid', { skip: skipWithoutPython }, () => {
  for (const file of fs.readdirSync(scripts)) {
    const target = path.join(scripts, file);
    const result = file.endsWith('.py')
      ? run(python, ['-c', 'import ast, sys; ast.parse(open(sys.argv[1]).read())', target], root)
      : run('bash', ['-n', target], root);
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
});

test('ast_move_check accepts a pure move and rejects a logic change', { skip: skipWithoutPython }, (t) => {
  const repo = tempDir(t);
  git(repo, 'init', '-q');
  write(repo, 'pkg/a.py', 'def f():\n    return 1\n');
  write(repo, 'pkg/use.py', 'from .a import f\n\n\ndef g():\n    return f()\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'base');
  const base = git(repo, 'rev-parse', 'HEAD');

  fs.renameSync(path.join(repo, 'pkg/a.py'), path.join(repo, 'pkg/b.py'));
  write(repo, 'pkg/use.py', 'from .b import f\n\n\ndef g():\n    return f()\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'move');
  const moved = run(python, [path.join(scripts, 'ast_move_check.py'), repo, base, 'HEAD'], repo);
  assert.equal(moved.status, 0, moved.stdout);
  assert.match(moved.stdout, /CODE IDENTICAL/);

  write(repo, 'pkg/b.py', 'def f():\n    return 2\n');
  git(repo, 'commit', '-q', '-am', 'change');
  const changed = run(python, [path.join(scripts, 'ast_move_check.py'), repo, base, 'HEAD'], repo);
  assert.equal(changed.status, 1, changed.stdout);
  assert.match(changed.stdout, /CODE DIFFERS/);
  assert.match(changed.stdout, /only in head: f/);
});

test('import_bindings detects an import that now binds a different object', { skip: skipWithoutPython }, (t) => {
  const base = tempDir(t);
  const trees = {
    old: { 'pkg/__init__.py': '', 'pkg/a.py': 'def f():\n    return 1\n', 'pkg/use.py': 'from pkg.a import f\n' },
    same: { 'pkg/__init__.py': '', 'pkg/b.py': 'def f():\n    return 1\n', 'pkg/use.py': 'from pkg.b import f\n' },
    other: { 'pkg/__init__.py': '', 'pkg/b.py': 'def f():\n    return 2\n', 'pkg/use.py': 'from pkg.b import f\n' },
  };
  for (const [name, files] of Object.entries(trees)) {
    for (const [relative, content] of Object.entries(files)) {
      write(path.join(base, name), relative, content);
    }
    const dumped = run(python, [path.join(scripts, 'import_bindings.py'), 'dump', path.join(base, name), path.join(base, `${name}.json`), '--package', 'pkg'], base);
    assert.equal(dumped.status, 0, dumped.stdout + dumped.stderr);
  }
  const same = run(python, [path.join(scripts, 'import_bindings.py'), 'compare', path.join(base, 'old.json'), path.join(base, 'same.json')], base);
  assert.equal(same.status, 0, same.stdout);
  assert.match(same.stdout, /different objects: 0/);

  const other = run(python, [path.join(scripts, 'import_bindings.py'), 'compare', path.join(base, 'old.json'), path.join(base, 'other.json')], base);
  assert.equal(other.status, 1, other.stdout);
  assert.match(other.stdout, /DIFFERENT pkg\.use: 'f'/);
});

test('reachability reports dead code and code that became dead only on the candidate', { skip: skipWithoutPython }, (t) => {
  const base = tempDir(t);
  write(path.join(base, 'baseline'), 'pkg/m.py', 'def main():\n    used()\n    helper()\n\n\ndef used():\n    return 1\n\n\ndef helper():\n    return 2\n\n\ndef unused():\n    return 3\n');
  write(path.join(base, 'candidate'), 'pkg/m.py', 'def main():\n    used()\n\n\ndef used():\n    return 1\n\n\ndef helper():\n    return 2\n\n\ndef unused():\n    return 3\n');

  const single = run(python, [path.join(scripts, 'reachability.py'), path.join(base, 'candidate'), '--package', 'pkg'], base);
  assert.equal(single.status, 0, single.stderr);
  assert.match(single.stdout, /\tunused/);
  assert.match(single.stdout, /\thelper/);
  assert.doesNotMatch(single.stdout, /\tused\b/);

  const compared = run(python, [path.join(scripts, 'reachability.py'), path.join(base, 'candidate'), '--package', 'pkg', '--baseline', path.join(base, 'baseline')], base);
  assert.equal(compared.status, 0, compared.stderr);
  const [candidateOnly, both] = compared.stdout.split(/^dead on both/m);
  assert.match(candidateOnly, /\thelper/);
  assert.match(both, /\tunused/);
});

test('mutants kills pinned rules, reports unpinned ones, and refuses git work trees', { skip: skipWithoutPython }, (t) => {
  const tree = tempDir(t);
  write(tree, 'pkg/__init__.py', '');
  write(tree, 'pkg/rules.py', 'LIMIT = 4\nLABEL = "visible"\n');
  write(tree, 'check.py', 'import sys\nsys.path.insert(0, ".")\nfrom pkg.rules import LIMIT\nassert LIMIT == 4\n');
  write(tree, 'spec.json', JSON.stringify([
    { id: 'limit-off-by-one', file: 'pkg/rules.py', old: 'LIMIT = 4', new: 'LIMIT = 5' },
    { id: 'label-changed', file: 'pkg/rules.py', old: '"visible"', new: '"hidden"' },
    { id: 'missing-anchor', file: 'pkg/rules.py', old: 'NOT PRESENT', new: 'x' },
  ]));
  const result = run(python, [path.join(scripts, 'mutants.py'), '--tree', tree, '--spec', path.join(tree, 'spec.json'), '--package', 'pkg', '--', python, 'check.py'], tree);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /KILLED\s+limit-off-by-one/);
  assert.match(result.stdout, /SURVIVED\s+label-changed/);
  assert.match(result.stdout, /ERROR\s+missing-anchor/);
  assert.equal(fs.readFileSync(path.join(tree, 'pkg/rules.py'), 'utf8'), 'LIMIT = 4\nLABEL = "visible"\n');
  assert.equal(fs.readdirSync(tree, { recursive: true }).some((entry) => String(entry).includes('__pycache__')), false);

  fs.mkdirSync(path.join(tree, '.git'));
  const refused = run(python, [path.join(scripts, 'mutants.py'), '--tree', tree, '--spec', path.join(tree, 'spec.json'), '--package', 'pkg', '--', python, 'check.py'], tree);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /contains \.git/);
});

test('snapshot records the working tree without moving HEAD, the index or files', (t) => {
  const repo = tempDir(t);
  git(repo, 'init', '-q');
  write(repo, 'file.txt', 'committed\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'base');
  const head = git(repo, 'rev-parse', 'HEAD');
  write(repo, 'file.txt', 'working tree\n');

  const result = run('bash', [path.join(scripts, 'snapshot.sh'), repo, 'file.txt'], repo);
  assert.equal(result.status, 0, result.stderr);
  const snapshot = result.stdout.trim();
  assert.equal(git(repo, 'rev-parse', 'HEAD'), head);
  assert.equal(git(repo, 'diff', '--cached', '--name-only'), '');
  assert.equal(fs.readFileSync(path.join(repo, 'file.txt'), 'utf8'), 'working tree\n');
  assert.equal(git(repo, 'show', `${snapshot}:file.txt`), 'working tree');
  assert.equal(git(repo, 'rev-parse', `${snapshot}^`), head);
});

test('mutants works for a non-Python stack when no package is given', { skip: skipWithoutPython }, (t) => {
  const tree = tempDir(t);
  write(tree, 'rules.js', 'module.exports = { LIMIT: 4 };\n');
  write(tree, 'check.js', "const assert = require('node:assert');\nassert.equal(require('./rules').LIMIT, 4);\n");
  write(tree, 'spec.json', JSON.stringify([{ id: 'limit-off-by-one', file: 'rules.js', old: 'LIMIT: 4', new: 'LIMIT: 5' }]));
  const result = run(python, [path.join(scripts, 'mutants.py'), '--tree', tree, '--spec', path.join(tree, 'spec.json'), '--', process.execPath, 'check.js'], tree);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /KILLED\s+limit-off-by-one/);
});
