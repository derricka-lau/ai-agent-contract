const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  installManaged,
  validateManagedSource,
  validateManagedTarget,
} = require('../scripts/managed-files');

const root = path.resolve(__dirname, '..');
const helper = path.join(root, 'scripts', 'managed-files.js');

function snapshotTree(treeRoot) {
  const snapshot = {};

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(treeRoot, absolutePath);
      const mode = fs.lstatSync(absolutePath).mode & 0o777;

      if (entry.isDirectory()) {
        snapshot[relativePath] = { type: 'directory', mode };
        visit(absolutePath);
      } else if (entry.isFile()) {
        snapshot[relativePath] = {
          type: 'file',
          mode,
          content: fs.readFileSync(absolutePath).toString('base64'),
        };
      } else if (entry.isSymbolicLink()) {
        snapshot[relativePath] = {
          type: 'symlink',
          target: fs.readlinkSync(absolutePath),
        };
      }
    }
  }

  if (fs.existsSync(treeRoot)) {
    visit(treeRoot);
  }
  return snapshot;
}

function runManagedInstall({ generatedRoot, home, shellRc, env }) {
  return execFileSync(process.execPath, [
    helper,
    'install',
    '--repo-root', root,
    '--generated-root', generatedRoot,
    '--home', home,
    '--shell-rc', shellRc,
  ], {
    cwd: root,
    env,
    stdio: 'pipe',
  });
}

function runManagedUninstall({ home, shellRc, env }) {
  return execFileSync(process.execPath, [
    helper,
    'uninstall',
    '--home', home,
    '--shell-rc', shellRc,
  ], {
    cwd: root,
    env,
    stdio: 'pipe',
  });
}

function gitConfigValues(env) {
  try {
    return execFileSync('git', ['config', '--global', '--get-all', 'core.hooksPath'], {
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim().split('\n');
  } catch (error) {
    if (error.status === 1) {
      return [];
    }
    throw error;
  }
}

test('managed source rejects symbolic links', (t) => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

  const sourceRoot = path.join(testRoot, 'source');
  const sourceFile = path.join(sourceRoot, 'contract.md');
  const linkedSource = path.join(sourceRoot, 'linked-contract.md');
  fs.mkdirSync(sourceRoot);
  fs.writeFileSync(sourceFile, 'contract\n');
  fs.symlinkSync(sourceFile, linkedSource);

  assert.throws(
    () => validateManagedSource(linkedSource, sourceRoot),
    /symbolic link/i,
  );
});

test('managed target rejects a final symbolic link', (t) => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

  const home = path.join(testRoot, 'home');
  const targetRoot = path.join(home, '.codex');
  const actualFile = path.join(home, 'actual-config.toml');
  const linkedTarget = path.join(targetRoot, 'config.toml');
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.writeFileSync(actualFile, 'config\n');
  fs.symlinkSync(actualFile, linkedTarget);

  assert.throws(
    () => validateManagedTarget(linkedTarget, home),
    /symbolic link/i,
  );
});

test('managed target allows a parent link that resolves inside home', (t) => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

  const home = path.join(testRoot, 'home');
  const actualRoot = path.join(home, 'config-store');
  const linkedRoot = path.join(home, '.codex');
  fs.mkdirSync(actualRoot, { recursive: true });
  fs.symlinkSync(actualRoot, linkedRoot);

  assert.doesNotThrow(
    () => validateManagedTarget(path.join(linkedRoot, 'config.toml'), home),
  );
});

test('managed target rejects a parent link that resolves outside home', (t) => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

  const home = path.join(testRoot, 'home');
  const outsideRoot = path.join(testRoot, 'outside');
  const linkedRoot = path.join(home, '.codex');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(outsideRoot, { recursive: true });
  fs.symlinkSync(outsideRoot, linkedRoot);

  assert.throws(
    () => validateManagedTarget(path.join(linkedRoot, 'config.toml'), home),
    /outside the selected home/i,
  );
});

test('update aborts before mutation when a managed file was modified', (t) => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

  const generatedRoot = path.join(testRoot, 'generated');
  const home = path.join(testRoot, 'home');
  const shellRc = path.join(home, '.bashrc');
  const globalGit = path.join(testRoot, 'global.gitconfig');
  const vscodeSettings = path.join(home, '.config', 'Code', 'User', 'settings.json');
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: globalGit,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
  };

  execFileSync(process.execPath, ['scripts/generate.js', '--out', generatedRoot], {
    cwd: root,
    stdio: 'pipe',
  });
  fs.mkdirSync(path.dirname(vscodeSettings), { recursive: true });
  fs.writeFileSync(vscodeSettings, '{\n  // User setting.\n  "editor.fontSize": 15,\n}\n');
  fs.writeFileSync(shellRc, '# User shell configuration.\n');

  runManagedInstall({ generatedRoot, home, shellRc, env });

  const modifiedTarget = path.join(home, '.codex', 'config.toml');
  assert.ok(fs.existsSync(modifiedTarget), 'first install must create the managed target');
  fs.appendFileSync(modifiedTarget, '\n# User modification.\n');
  fs.appendFileSync(
    path.join(generatedRoot, 'codex', 'verify.config.toml'),
    '\n# Updated generated source.\n',
  );
  const beforeUpdate = snapshotTree(home);

  assert.throws(
    () => runManagedInstall({ generatedRoot, home, shellRc, env }),
    (error) => {
      assert.equal(error.status, 1);
      assert.match(error.stderr.toString(), /modified managed file/i);
      return true;
    },
  );

  assert.deepEqual(snapshotTree(home), beforeUpdate);
});

test('install and uninstall restore only values owned by the ledger', (t) => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

  const generatedRoot = path.join(testRoot, 'generated');
  const home = path.join(testRoot, 'home');
  const shellRc = path.join(home, '.bashrc');
  const globalGit = path.join(testRoot, 'global.gitconfig');
  const vscodeSettings = path.join(home, '.config', 'Code', 'User', 'settings.json');
  const existingConfig = path.join(home, '.codex', 'config.toml');
  const unrelated = path.join(home, '.codex', 'user-owned.toml');
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: globalGit,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
  };

  execFileSync(process.execPath, ['scripts/generate.js', '--out', generatedRoot], {
    cwd: root,
    stdio: 'pipe',
  });
  fs.mkdirSync(path.dirname(vscodeSettings), { recursive: true });
  fs.mkdirSync(path.dirname(existingConfig), { recursive: true });
  fs.writeFileSync(existingConfig, '# Original Codex config.\n');
  fs.writeFileSync(unrelated, 'user-owned\n');
  fs.writeFileSync(vscodeSettings, [
    '{',
    '  // Keep this comment.',
    '  "editor.fontSize": 15,',
    '  "chat.useClaudeMdFile": true,',
    '}',
    '',
  ].join('\n'));
  fs.writeFileSync(shellRc, '# User shell configuration.\n');
  execFileSync('git', ['config', '--global', 'core.hooksPath', '/previous/hooks'], { env });

  runManagedInstall({ generatedRoot, home, shellRc, env });

  assert.notEqual(fs.readFileSync(existingConfig, 'utf8'), '# Original Codex config.\n');
  assert.equal(fs.readFileSync(unrelated, 'utf8'), 'user-owned\n');
  assert.match(fs.readFileSync(vscodeSettings, 'utf8'), /"chat\.useClaudeMdFile": false/);
  assert.match(fs.readFileSync(shellRc, 'utf8'), /export PATH="\$HOME\/\.local\/bin:\$PATH"/);
  assert.deepEqual(gitConfigValues(env), [path.join(home, '.git-hooks')]);

  fs.writeFileSync(
    vscodeSettings,
    fs.readFileSync(vscodeSettings, 'utf8').replace('"editor.fontSize": 15', '"editor.fontSize": 16'),
  );
  runManagedUninstall({ home, shellRc, env });

  assert.equal(fs.readFileSync(existingConfig, 'utf8'), '# Original Codex config.\n');
  assert.equal(fs.readFileSync(unrelated, 'utf8'), 'user-owned\n');
  assert.match(fs.readFileSync(vscodeSettings, 'utf8'), /\/\/ Keep this comment\./);
  assert.match(fs.readFileSync(vscodeSettings, 'utf8'), /"editor\.fontSize": 16/);
  assert.match(fs.readFileSync(vscodeSettings, 'utf8'), /"chat\.useClaudeMdFile": true/);
  assert.equal(fs.readFileSync(shellRc, 'utf8'), '# User shell configuration.\n');
  assert.deepEqual(gitConfigValues(env), ['/previous/hooks']);
  assert.equal(fs.existsSync(path.join(home, '.claude', 'CLAUDE.md')), false);
  assert.equal(fs.existsSync(path.join(home, '.local', 'share', 'ai-agent-contract', 'install-state.json')), false);
  assert.equal(fs.existsSync(path.join(home, '.local', 'share', 'ai-agent-contract', 'backups')), false);
});

test('update removes a stale owned file without touching unrelated files', (t) => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

  const generatedRoot = path.join(testRoot, 'generated');
  const home = path.join(testRoot, 'home');
  const shellRc = path.join(home, '.bashrc');
  const staleSource = path.join(generatedRoot, 'codex', 'verify.config.toml');
  const staleTarget = path.join(home, '.codex', 'verify.config.toml');
  const unrelated = path.join(home, '.codex', 'user-owned.toml');
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: path.join(testRoot, 'global.gitconfig'),
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
  };

  execFileSync(process.execPath, ['scripts/generate.js', '--out', generatedRoot], {
    cwd: root,
    stdio: 'pipe',
  });
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(shellRc, '');
  runManagedInstall({ generatedRoot, home, shellRc, env });
  fs.writeFileSync(unrelated, 'user-owned\n');
  fs.unlinkSync(staleSource);

  runManagedInstall({ generatedRoot, home, shellRc, env });

  assert.equal(fs.existsSync(staleTarget), false);
  assert.equal(fs.readFileSync(unrelated, 'utf8'), 'user-owned\n');
});

test('a corrupt ledger blocks install without changing the selected home', (t) => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

  const generatedRoot = path.join(testRoot, 'generated');
  const home = path.join(testRoot, 'home');
  const shellRc = path.join(home, '.bashrc');
  const ledger = path.join(home, '.local', 'share', 'ai-agent-contract', 'install-state.json');
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: path.join(testRoot, 'global.gitconfig'),
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
  };

  execFileSync(process.execPath, ['scripts/generate.js', '--out', generatedRoot], {
    cwd: root,
    stdio: 'pipe',
  });
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
  fs.writeFileSync(ledger, '{"schemaVersion":99}\n');
  fs.writeFileSync(shellRc, '# User shell configuration.\n');
  const before = snapshotTree(home);

  assert.throws(
    () => runManagedInstall({ generatedRoot, home, shellRc, env }),
    (error) => {
      assert.equal(error.status, 1);
      assert.match(error.stderr.toString(), /invalid managed install ledger/i);
      return true;
    },
  );
  assert.deepEqual(snapshotTree(home), before);
});

test('uninstall preserves a user-modified managed file', (t) => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

  const generatedRoot = path.join(testRoot, 'generated');
  const home = path.join(testRoot, 'home');
  const shellRc = path.join(home, '.bashrc');
  const target = path.join(home, '.codex', 'config.toml');
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: path.join(testRoot, 'global.gitconfig'),
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
  };

  execFileSync(process.execPath, ['scripts/generate.js', '--out', generatedRoot], {
    cwd: root,
    stdio: 'pipe',
  });
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(shellRc, '');
  runManagedInstall({ generatedRoot, home, shellRc, env });
  fs.appendFileSync(target, '\n# User modification.\n');

  runManagedUninstall({ home, shellRc, env });

  assert.match(fs.readFileSync(target, 'utf8'), /# User modification\./);
});

test('a mid-transaction file failure rolls back earlier writes', (t) => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

  const generatedRoot = path.join(testRoot, 'generated');
  const home = path.join(testRoot, 'home');
  const shellRc = path.join(home, '.bashrc');
  const stateRoot = path.join(home, '.local', 'share', 'ai-agent-contract');
  const failureTarget = path.join(home, '.copilot', 'hooks', 'pre-tool-guard.sh');
  const originalGitConfigGlobal = process.env.GIT_CONFIG_GLOBAL;

  execFileSync(process.execPath, ['scripts/generate.js', '--out', generatedRoot], {
    cwd: root,
    stdio: 'pipe',
  });
  fs.mkdirSync(stateRoot, { recursive: true });
  fs.writeFileSync(shellRc, '# User shell configuration.\n');
  const before = snapshotTree(home);
  const originalRename = fs.renameSync;
  process.env.GIT_CONFIG_GLOBAL = path.join(testRoot, 'global.gitconfig');
  fs.renameSync = (source, target) => {
    if (target === failureTarget) {
      throw new Error('Injected file write failure');
    }
    return originalRename(source, target);
  };

  try {
    assert.throws(
      () => installManaged({ repoRoot: root, generatedRoot, home, shellRc }),
      /Injected file write failure/,
    );
  } finally {
    fs.renameSync = originalRename;
    if (originalGitConfigGlobal === undefined) {
      delete process.env.GIT_CONFIG_GLOBAL;
    } else {
      process.env.GIT_CONFIG_GLOBAL = originalGitConfigGlobal;
    }
  }

  assert.deepEqual(snapshotTree(home), before);
});
