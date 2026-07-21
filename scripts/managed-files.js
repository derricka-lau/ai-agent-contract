#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const {
  applyEdits,
  modify,
  parse,
  printParseErrorCode,
} = require('jsonc-parser');

const LOCK_SCHEMA_VERSION = 1;
const LOCK_DIRECTORY = 'operation.lock';
const LOCK_OWNER_FILE = 'owner.json';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LEDGER_SCHEMA_VERSION = 1;
const LEDGER_FILE = 'install-state.json';
const BACKUP_DIRECTORY = 'backups';
const TRANSACTION_DIRECTORY = 'transaction';
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const SHELL_PATH_LINE = 'export PATH="$HOME/.local/bin:$PATH"';
const GIT_HOOKS_KEY = 'core.hooksPath';

function isWithin(root, candidate) {
  const relativePath = path.relative(root, candidate);
  return relativePath === ''
    || (
      relativePath !== '..'
      && !relativePath.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relativePath)
    );
}

function requireWithin(root, candidate, message) {
  if (!isWithin(root, candidate)) {
    throw new Error(message);
  }
}

function lstatIfPresent(target) {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function operationLockPaths(stateRoot) {
  const absoluteStateRoot = path.resolve(stateRoot);
  const lockPath = path.join(absoluteStateRoot, LOCK_DIRECTORY);
  return {
    stateRoot: absoluteStateRoot,
    lockPath,
    ownerPath: path.join(lockPath, LOCK_OWNER_FILE),
  };
}

function validateLockOwner(owner) {
  if (
    !owner
    || typeof owner !== 'object'
    || Array.isArray(owner)
    || owner.schemaVersion !== LOCK_SCHEMA_VERSION
    || !Number.isSafeInteger(owner.pid)
    || owner.pid <= 0
    || typeof owner.operation !== 'string'
    || !/^[a-z][a-z-]*$/.test(owner.operation)
    || typeof owner.startedAt !== 'string'
    || Number.isNaN(Date.parse(owner.startedAt))
    || typeof owner.token !== 'string'
    || !UUID_PATTERN.test(owner.token)
  ) {
    throw new Error('Invalid operation lock owner metadata');
  }
  return owner;
}

function readOperationLock(stateRoot) {
  const paths = operationLockPaths(stateRoot);
  const lockStatus = fs.lstatSync(paths.lockPath);
  if (lockStatus.isSymbolicLink() || !lockStatus.isDirectory()) {
    throw new Error(`Invalid operation lock path: ${paths.lockPath}`);
  }

  const ownerStatus = fs.lstatSync(paths.ownerPath);
  if (ownerStatus.isSymbolicLink() || !ownerStatus.isFile()) {
    throw new Error(`Invalid operation lock owner file: ${paths.ownerPath}`);
  }

  let owner;
  try {
    owner = JSON.parse(fs.readFileSync(paths.ownerPath, 'utf8'));
  } catch {
    throw new Error(`Invalid operation lock owner metadata: ${paths.ownerPath}`);
  }

  return { ...paths, owner: validateLockOwner(owner) };
}

function acquireOperationLock(stateRoot, operation) {
  if (typeof operation !== 'string' || !/^[a-z][a-z-]*$/.test(operation)) {
    throw new Error(`Invalid managed operation name: ${operation}`);
  }

  const paths = operationLockPaths(stateRoot);
  fs.mkdirSync(paths.stateRoot, { recursive: true, mode: 0o700 });

  try {
    fs.mkdirSync(paths.lockPath, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
    let detail = '';
    try {
      const active = readOperationLock(paths.stateRoot).owner;
      detail = ` (${active.operation}, PID ${active.pid}, since ${active.startedAt})`;
    } catch {
      detail = ' (owner metadata is unavailable or invalid)';
    }
    throw new Error(`A managed operation is already active${detail}`);
  }

  const owner = {
    schemaVersion: LOCK_SCHEMA_VERSION,
    pid: process.pid,
    operation,
    startedAt: new Date().toISOString(),
    token: randomUUID(),
  };

  try {
    fs.writeFileSync(
      paths.ownerPath,
      `${JSON.stringify(owner, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    );
  } catch (error) {
    try {
      fs.rmdirSync(paths.lockPath);
    } catch {
      // The original write failure is the actionable error.
    }
    throw error;
  }

  return {
    stateRoot: paths.stateRoot,
    path: paths.lockPath,
    ownerPath: paths.ownerPath,
    token: owner.token,
    owner,
  };
}

function releaseOperationLock(lock) {
  if (!lock || typeof lock.stateRoot !== 'string' || typeof lock.token !== 'string') {
    throw new Error('Invalid operation lock handle');
  }

  const current = readOperationLock(lock.stateRoot);
  if (current.owner.token !== lock.token) {
    throw new Error('Operation lock token mismatch; refusing to release it');
  }

  fs.unlinkSync(current.ownerPath);
  fs.rmdirSync(current.lockPath);
}

function processIsActive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') {
      return false;
    }
    if (error.code === 'EPERM') {
      return true;
    }
    throw error;
  }
}

function unlockStaleOperationLock(stateRoot) {
  const initial = readOperationLock(stateRoot);
  if (processIsActive(initial.owner.pid)) {
    throw new Error(
      `Operation lock process is still active: PID ${initial.owner.pid}`,
    );
  }

  const current = readOperationLock(stateRoot);
  if (current.owner.token !== initial.owner.token) {
    throw new Error('Operation lock changed during verification; refusing to unlock it');
  }

  fs.unlinkSync(current.ownerPath);
  fs.rmdirSync(current.lockPath);
  return initial.owner;
}

function validateManagedSource(source, sourceRoot) {
  const absoluteRoot = path.resolve(sourceRoot);
  const absoluteSource = path.resolve(source);
  requireWithin(
    absoluteRoot,
    absoluteSource,
    `Managed source is outside its source root: ${absoluteSource}`,
  );

  const rootStatus = fs.lstatSync(absoluteRoot);
  if (rootStatus.isSymbolicLink()) {
    throw new Error(`Managed source root is a symbolic link: ${absoluteRoot}`);
  }
  if (!rootStatus.isDirectory()) {
    throw new Error(`Managed source root is not a directory: ${absoluteRoot}`);
  }

  const segments = path.relative(absoluteRoot, absoluteSource).split(path.sep);
  let current = absoluteRoot;
  for (const [index, segment] of segments.entries()) {
    if (!segment) {
      continue;
    }
    current = path.join(current, segment);
    const status = fs.lstatSync(current);
    if (status.isSymbolicLink()) {
      throw new Error(`Managed source contains a symbolic link: ${current}`);
    }
    if (index < segments.length - 1 && !status.isDirectory()) {
      throw new Error(`Managed source parent is not a directory: ${current}`);
    }
  }

  const sourceStatus = fs.lstatSync(absoluteSource);
  if (!sourceStatus.isFile()) {
    throw new Error(`Managed source is not a regular file: ${absoluteSource}`);
  }
  requireWithin(
    fs.realpathSync(absoluteRoot),
    fs.realpathSync(absoluteSource),
    `Managed source resolves outside its source root: ${absoluteSource}`,
  );

  return absoluteSource;
}

function validateManagedTarget(target, home) {
  const absoluteHome = path.resolve(home);
  const absoluteTarget = path.resolve(target);
  requireWithin(
    absoluteHome,
    absoluteTarget,
    `Managed target is outside the selected home: ${absoluteTarget}`,
  );

  const realHome = fs.realpathSync(absoluteHome);
  const parent = path.dirname(absoluteTarget);
  const relativeParent = path.relative(absoluteHome, parent);
  const segments = relativeParent ? relativeParent.split(path.sep) : [];
  let logicalParent = absoluteHome;
  let resolvedParent = realHome;

  for (const [index, segment] of segments.entries()) {
    logicalParent = path.join(logicalParent, segment);
    const status = lstatIfPresent(logicalParent);

    if (!status) {
      resolvedParent = path.resolve(
        resolvedParent,
        ...segments.slice(index),
      );
      requireWithin(
        realHome,
        resolvedParent,
        `Managed target resolves outside the selected home: ${absoluteTarget}`,
      );
      break;
    }

    if (status.isSymbolicLink()) {
      try {
        resolvedParent = fs.realpathSync(logicalParent);
      } catch {
        throw new Error(`Managed target has an invalid parent symbolic link: ${logicalParent}`);
      }
      if (!fs.statSync(logicalParent).isDirectory()) {
        throw new Error(`Managed target parent link is not a directory: ${logicalParent}`);
      }
    } else {
      if (!status.isDirectory()) {
        throw new Error(`Managed target parent is not a directory: ${logicalParent}`);
      }
      resolvedParent = path.resolve(resolvedParent, segment);
    }

    requireWithin(
      realHome,
      resolvedParent,
      `Managed target resolves outside the selected home: ${absoluteTarget}`,
    );
  }

  const targetStatus = lstatIfPresent(absoluteTarget);
  if (targetStatus?.isSymbolicLink()) {
    throw new Error(`Managed target is a symbolic link: ${absoluteTarget}`);
  }
  if (targetStatus && !targetStatus.isFile()) {
    throw new Error(`Managed target is not a regular file: ${absoluteTarget}`);
  }

  return absoluteTarget;
}

function formattingOptions(content) {
  return {
    insertSpaces: true,
    tabSize: 2,
    eol: content.includes('\r\n') ? '\r\n' : '\n',
  };
}

function parseSettings(content) {
  const source = content.trim() ? content : '{}\n';
  const errors = [];
  const value = parse(source, errors, { allowTrailingComma: true });

  if (errors.length > 0) {
    const details = errors
      .map(({ error, offset }) => `${printParseErrorCode(error)} at offset ${offset}`)
      .join(', ');
    throw new Error(`Invalid VS Code settings JSONC: ${details}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid VS Code settings JSONC: root value must be an object');
  }

  return { source, value };
}

function applyJsoncSettings(content, settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new TypeError('VS Code settings fragment must be an object');
  }

  let { source, value } = parseSettings(content);
  const changes = [];

  for (const [key, installedValue] of Object.entries(settings)) {
    const exists = Object.hasOwn(value, key);
    changes.push({
      key,
      installedValue,
      previous: exists
        ? { exists: true, value: value[key] }
        : { exists: false },
    });
    source = applyEdits(
      source,
      modify(source, [key], installedValue, {
        formattingOptions: formattingOptions(source),
      }),
    );
    ({ value } = parseSettings(source));
  }

  return { content: source, changes };
}

function restoreJsoncSettings(content, changes) {
  if (!Array.isArray(changes)) {
    throw new TypeError('VS Code settings changes must be an array');
  }

  let { source, value } = parseSettings(content);
  const preservedKeys = [];

  for (const change of changes) {
    if (
      !change
      || typeof change.key !== 'string'
      || !change.previous
      || typeof change.previous.exists !== 'boolean'
    ) {
      throw new Error('Invalid VS Code settings ledger entry');
    }

    if (
      !Object.hasOwn(value, change.key)
      || !isDeepStrictEqual(value[change.key], change.installedValue)
    ) {
      preservedKeys.push(change.key);
      continue;
    }

    const restoredValue = change.previous.exists
      ? change.previous.value
      : undefined;
    source = applyEdits(
      source,
      modify(source, [change.key], restoredValue, {
        formattingOptions: formattingOptions(source),
      }),
    );
    ({ value } = parseSettings(source));
  }

  return { content: source, preservedKeys };
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function fileMode(status) {
  return status.mode & 0o777;
}

function statePaths(home) {
  const absoluteHome = path.resolve(home);
  const stateRoot = path.join(absoluteHome, '.local', 'share', 'ai-agent-contract');
  return {
    home: absoluteHome,
    stateRoot,
    ledgerPath: path.join(stateRoot, LEDGER_FILE),
    backupRoot: path.join(stateRoot, BACKUP_DIRECTORY),
    transactionRoot: path.join(stateRoot, TRANSACTION_DIRECTORY),
  };
}

function missingStateDirectories(paths) {
  const directories = [
    path.join(paths.home, '.local'),
    path.join(paths.home, '.local', 'share'),
    paths.stateRoot,
  ];
  return directories.filter((directory) => !lstatIfPresent(directory));
}

function removeCreatedStateDirectories(directories) {
  for (const directory of [...directories].reverse()) {
    const status = lstatIfPresent(directory);
    if (!status || status.isSymbolicLink() || !status.isDirectory()) {
      continue;
    }
    try {
      fs.rmdirSync(directory);
    } catch (error) {
      if (!['ENOTEMPTY', 'EEXIST'].includes(error.code)) {
        throw error;
      }
    }
  }
}

function relativeTarget(home, target) {
  const relativePath = path.relative(home, target);
  if (
    !relativePath
    || relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    throw new Error(`Invalid managed target path: ${target}`);
  }
  return relativePath.split(path.sep).join('/');
}

function resolveTarget(home, relativePath) {
  if (
    typeof relativePath !== 'string'
    || !relativePath
    || relativePath.includes('\\')
    || path.posix.isAbsolute(relativePath)
  ) {
    throw new Error(`Invalid managed ledger path: ${String(relativePath)}`);
  }
  const target = path.resolve(home, ...relativePath.split('/'));
  requireWithin(home, target, `Managed ledger path escapes the selected home: ${relativePath}`);
  if (relativeTarget(home, target) !== relativePath) {
    throw new Error(`Managed ledger path is not canonical: ${relativePath}`);
  }
  return target;
}

function validatePrevious(previous) {
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) {
    throw new Error('Invalid previous-file ledger entry');
  }
  if (previous.kind === 'absent') {
    return previous;
  }
  if (
    previous.kind !== 'file'
    || typeof previous.backup !== 'string'
    || !HASH_PATTERN.test(previous.backup)
    || !Number.isSafeInteger(previous.mode)
    || previous.mode < 0
    || previous.mode > 0o777
  ) {
    throw new Error('Invalid previous-file ledger entry');
  }
  return previous;
}

function validateLedger(raw, home) {
  if (
    !raw
    || typeof raw !== 'object'
    || Array.isArray(raw)
    || raw.schemaVersion !== LEDGER_SCHEMA_VERSION
    || typeof raw.installedAt !== 'string'
    || Number.isNaN(Date.parse(raw.installedAt))
    || !Array.isArray(raw.files)
    || !Array.isArray(raw.jsonc)
    || !Array.isArray(raw.shell)
    || !raw.git
    || typeof raw.git !== 'object'
    || Array.isArray(raw.git)
  ) {
    throw new Error('Invalid managed install ledger');
  }

  const seenTargets = new Set();
  for (const record of raw.files) {
    if (
      !record
      || typeof record !== 'object'
      || Array.isArray(record)
      || typeof record.path !== 'string'
      || typeof record.installedSha256 !== 'string'
      || !HASH_PATTERN.test(record.installedSha256)
      || !Number.isSafeInteger(record.mode)
      || record.mode < 0
      || record.mode > 0o777
    ) {
      throw new Error('Invalid managed-file ledger entry');
    }
    resolveTarget(home, record.path);
    validatePrevious(record.previous);
    if (seenTargets.has(record.path)) {
      throw new Error(`Duplicate managed-file ledger path: ${record.path}`);
    }
    seenTargets.add(record.path);
  }

  for (const record of raw.jsonc) {
    if (
      !record
      || typeof record !== 'object'
      || Array.isArray(record)
      || typeof record.path !== 'string'
      || typeof record.fileExisted !== 'boolean'
      || !Array.isArray(record.changes)
    ) {
      throw new Error('Invalid JSONC ledger entry');
    }
    resolveTarget(home, record.path);
    for (const change of record.changes) {
      if (
        !change
        || typeof change.key !== 'string'
        || !change.previous
        || typeof change.previous.exists !== 'boolean'
      ) {
        throw new Error('Invalid JSONC ledger change');
      }
    }
  }

  for (const record of raw.shell) {
    if (
      !record
      || typeof record !== 'object'
      || Array.isArray(record)
      || typeof record.path !== 'string'
      || typeof record.line !== 'string'
      || typeof record.added !== 'boolean'
      || typeof record.fileExisted !== 'boolean'
    ) {
      throw new Error('Invalid shell ledger entry');
    }
    resolveTarget(home, record.path);
  }

  if (
    raw.git.key !== GIT_HOOKS_KEY
    || !Array.isArray(raw.git.installedValues)
    || !raw.git.installedValues.every((value) => typeof value === 'string')
    || !Array.isArray(raw.git.previousValues)
    || !raw.git.previousValues.every((value) => typeof value === 'string')
  ) {
    throw new Error('Invalid Git ledger entry');
  }

  return raw;
}

function readLedger(paths) {
  const status = lstatIfPresent(paths.ledgerPath);
  if (!status) {
    return null;
  }
  if (status.isSymbolicLink() || !status.isFile()) {
    throw new Error(`Invalid managed install ledger path: ${paths.ledgerPath}`);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(paths.ledgerPath, 'utf8'));
  } catch {
    throw new Error(`Invalid managed install ledger: ${paths.ledgerPath}`);
  }
  return validateLedger(raw, paths.home);
}

function atomicWriteFile(target, content, mode, home) {
  validateManagedTarget(target, home);
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  validateManagedTarget(target, home);
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, content, { flag: 'wx', mode });
    fs.chmodSync(temporary, mode);
    validateManagedTarget(target, home);
    fs.renameSync(temporary, target);
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch {
      // Preserve the original failure.
    }
    throw error;
  }
}

function removeManagedFile(target, home) {
  validateManagedTarget(target, home);
  const status = lstatIfPresent(target);
  if (status) {
    fs.unlinkSync(target);
  }
}

function walkSourceFiles(sourceRoot) {
  const files = [];
  const absoluteRoot = path.resolve(sourceRoot);
  const rootStatus = fs.lstatSync(absoluteRoot);
  if (rootStatus.isSymbolicLink() || !rootStatus.isDirectory()) {
    throw new Error(`Managed source root is not a regular directory: ${absoluteRoot}`);
  }

  function visit(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const source = path.join(directory, entry.name);
      const status = fs.lstatSync(source);
      if (status.isSymbolicLink()) {
        throw new Error(`Managed source contains a symbolic link: ${source}`);
      }
      if (status.isDirectory()) {
        visit(source);
      } else if (status.isFile()) {
        files.push(source);
      } else {
        throw new Error(`Managed source is not a regular file: ${source}`);
      }
    }
  }

  visit(absoluteRoot);
  return files;
}

function buildDesiredFiles(repoRoot, generatedRoot, home) {
  const desired = new Map();

  function addFile(source, sourceRoot, target, forcedMode = null) {
    const absoluteSource = validateManagedSource(source, sourceRoot);
    const absoluteTarget = validateManagedTarget(target, home);
    const relativePath = relativeTarget(home, absoluteTarget);
    if (desired.has(relativePath)) {
      throw new Error(`Duplicate managed target: ${relativePath}`);
    }
    const sourceStatus = fs.lstatSync(absoluteSource);
    const content = fs.readFileSync(absoluteSource);
    desired.set(relativePath, {
      content,
      installedSha256: sha256(content),
      mode: forcedMode ?? fileMode(sourceStatus),
      path: relativePath,
      source: absoluteSource,
      target: absoluteTarget,
    });
  }

  function addTree(sourceRoot, targetRoot) {
    for (const source of walkSourceFiles(sourceRoot)) {
      addFile(
        source,
        sourceRoot,
        path.join(targetRoot, path.relative(sourceRoot, source)),
      );
    }
  }

  for (const runtime of ['claude', 'codex', 'copilot']) {
    addTree(path.join(generatedRoot, runtime), path.join(home, `.${runtime}`));
  }

  const skillsRoot = path.join(repoRoot, 'skills');
  for (const source of walkSourceFiles(skillsRoot)) {
    if (path.basename(source) !== 'SKILL.md') {
      throw new Error(`Unexpected shared skill file: ${source}`);
    }
    const relativePath = path.relative(skillsRoot, source);
    for (const runtimeRoot of ['.claude', '.codex', '.copilot', '.agents']) {
      addFile(source, skillsRoot, path.join(home, runtimeRoot, 'skills', relativePath));
    }
  }

  const stateRoot = statePaths(home).stateRoot;
  addFile(path.join(repoRoot, 'scripts', 'guard.js'), repoRoot, path.join(stateRoot, 'guard.js'), 0o755);
  addFile(path.join(repoRoot, 'core', 'guardrails.json'), repoRoot, path.join(stateRoot, 'guardrails.json'));
  addFile(path.join(repoRoot, 'core', 'runtime-profiles.json'), repoRoot, path.join(stateRoot, 'runtime-profiles.json'));
  addFile(path.join(repoRoot, 'codex-safe'), repoRoot, path.join(home, '.local', 'bin', 'codex-safe'), 0o755);
  addFile(path.join(repoRoot, 'copilot-safe'), repoRoot, path.join(home, '.local', 'bin', 'copilot-safe'), 0o755);
  addFile(path.join(repoRoot, 'hooks', 'pre-commit'), repoRoot, path.join(home, '.git-hooks', 'pre-commit'), 0o755);
  addFile(path.join(repoRoot, 'hooks', 'pre-push'), repoRoot, path.join(home, '.git-hooks', 'pre-push'), 0o755);

  return desired;
}

function currentFileHash(target) {
  const status = lstatIfPresent(target);
  if (!status || status.isSymbolicLink() || !status.isFile()) {
    return null;
  }
  return sha256(fs.readFileSync(target));
}

function backupPath(paths, hash) {
  if (!HASH_PATTERN.test(hash)) {
    throw new Error(`Invalid managed backup identifier: ${hash}`);
  }
  return path.join(paths.backupRoot, hash);
}

function managedBackupFiles(paths) {
  const rootStatus = lstatIfPresent(paths.backupRoot);
  if (!rootStatus) {
    return [];
  }
  if (rootStatus.isSymbolicLink() || !rootStatus.isDirectory()) {
    throw new Error(`Invalid managed backup directory: ${paths.backupRoot}`);
  }

  return fs.readdirSync(paths.backupRoot)
    .sort()
    .map((name) => {
      if (!HASH_PATTERN.test(name)) {
        throw new Error(`Unexpected file in managed backup directory: ${name}`);
      }
      const target = backupPath(paths, name);
      const status = fs.lstatSync(target);
      if (status.isSymbolicLink() || !status.isFile() || currentFileHash(target) !== name) {
        throw new Error(`Invalid managed backup file: ${target}`);
      }
      return target;
    });
}

function pruneManagedBackups(paths, keepHashes) {
  for (const target of managedBackupFiles(paths)) {
    if (!keepHashes.has(path.basename(target))) {
      fs.unlinkSync(target);
    }
  }
  const remaining = lstatIfPresent(paths.backupRoot);
  if (remaining && fs.readdirSync(paths.backupRoot).length === 0) {
    fs.rmdirSync(paths.backupRoot);
  }
}

function capturePrevious(target, paths) {
  const status = lstatIfPresent(target);
  if (!status) {
    return { kind: 'absent' };
  }
  validateManagedTarget(target, paths.home);
  const content = fs.readFileSync(target);
  const backup = sha256(content);
  const targetBackup = backupPath(paths, backup);
  const backupStatus = lstatIfPresent(targetBackup);
  if (backupStatus) {
    if (backupStatus.isSymbolicLink() || !backupStatus.isFile()) {
      throw new Error(`Invalid managed backup path: ${targetBackup}`);
    }
    if (currentFileHash(targetBackup) !== backup) {
      throw new Error(`Managed backup checksum mismatch: ${targetBackup}`);
    }
  } else {
    atomicWriteFile(targetBackup, content, 0o600, paths.home);
  }
  return { kind: 'file', backup, mode: fileMode(status) };
}

function previousContent(previous, paths) {
  validatePrevious(previous);
  if (previous.kind === 'absent') {
    return null;
  }
  const source = backupPath(paths, previous.backup);
  const status = lstatIfPresent(source);
  if (!status || status.isSymbolicLink() || !status.isFile()) {
    throw new Error(`Managed backup is missing: ${source}`);
  }
  const content = fs.readFileSync(source);
  if (sha256(content) !== previous.backup) {
    throw new Error(`Managed backup checksum mismatch: ${source}`);
  }
  return content;
}

function restorePrevious(target, previous, paths) {
  const content = previousContent(previous, paths);
  if (content === null) {
    removeManagedFile(target, paths.home);
  } else {
    atomicWriteFile(target, content, previous.mode, paths.home);
  }
}

function gitConfigValues(home) {
  const result = spawnSync('git', ['config', '--global', '--get-all', GIT_HOOKS_KEY], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  });
  if (result.status === 1) {
    return [];
  }
  if (result.status !== 0) {
    throw new Error(`Unable to read global ${GIT_HOOKS_KEY}: ${(result.stderr || '').trim()}`);
  }
  return result.stdout.replace(/\n$/, '').split('\n');
}

function setGitConfigValues(home, values) {
  const env = { ...process.env, HOME: home };
  const unset = spawnSync('git', ['config', '--global', '--unset-all', GIT_HOOKS_KEY], {
    encoding: 'utf8',
    env,
  });
  if (![0, 5].includes(unset.status)) {
    throw new Error(`Unable to unset global ${GIT_HOOKS_KEY}: ${(unset.stderr || '').trim()}`);
  }
  for (const [index, value] of values.entries()) {
    const action = index === 0 ? '--replace-all' : '--add';
    const result = spawnSync('git', ['config', '--global', action, GIT_HOOKS_KEY, value], {
      encoding: 'utf8',
      env,
    });
    if (result.status !== 0) {
      throw new Error(`Unable to set global ${GIT_HOOKS_KEY}: ${(result.stderr || '').trim()}`);
    }
  }
}

function linesContain(content, line) {
  return content.split(/\r?\n/).includes(line);
}

function appendLine(content, line) {
  if (linesContain(content, line)) {
    return content;
  }
  const separator = content && !content.endsWith('\n') ? '\n' : '';
  return `${content}${separator}${line}\n`;
}

function removeLine(content, line) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const hadFinalEol = content.endsWith(eol);
  const lines = content.split(/\r?\n/);
  if (hadFinalEol) {
    lines.pop();
  }
  const index = lines.indexOf(line);
  if (index === -1) {
    return content;
  }
  lines.splice(index, 1);
  if (lines.length === 0) {
    return '';
  }
  return `${lines.join(eol)}${hadFinalEol ? eol : ''}`;
}

function jsoncManagedValuesAreCurrent(content, changes) {
  const { value } = parseSettings(content);
  return changes.every((change) => (
    Object.hasOwn(value, change.key)
    && isDeepStrictEqual(value[change.key], change.installedValue)
  ));
}

function desiredJsonc(generatedRoot, home) {
  const source = path.join(generatedRoot, 'vscode', 'settings.json');
  validateManagedSource(source, generatedRoot);
  const settings = JSON.parse(fs.readFileSync(source, 'utf8'));
  const platform = process.platform;
  let directory;
  if (platform === 'darwin') {
    directory = path.join(home, 'Library', 'Application Support', 'Code', 'User');
  } else if (platform === 'linux') {
    const configRoot = process.env.XDG_CONFIG_HOME
      ? path.resolve(process.env.XDG_CONFIG_HOME)
      : path.join(home, '.config');
    directory = path.join(configRoot, 'Code', 'User');
  } else {
    return null;
  }
  const target = path.join(directory, 'settings.json');
  validateManagedTarget(target, home);
  if (!fs.existsSync(directory) && !fs.existsSync(target)) {
    return null;
  }
  return { path: relativeTarget(home, target), settings, target };
}

function assertInstallPreconditions(ledger, desired, paths, shellTarget) {
  if (!ledger) {
    return;
  }

  for (const record of ledger.files) {
    const target = resolveTarget(paths.home, record.path);
    validateManagedTarget(target, paths.home);
    if (currentFileHash(target) !== record.installedSha256) {
      throw new Error(`Modified managed file blocks update: ${target}`);
    }
  }

  for (const record of ledger.jsonc) {
    const target = resolveTarget(paths.home, record.path);
    validateManagedTarget(target, paths.home);
    const status = lstatIfPresent(target);
    if (
      !status
      || status.isSymbolicLink()
      || !status.isFile()
      || !jsoncManagedValuesAreCurrent(fs.readFileSync(target, 'utf8'), record.changes)
    ) {
      throw new Error(`Modified managed VS Code setting blocks update: ${target}`);
    }
  }

  for (const record of ledger.shell) {
    const target = resolveTarget(paths.home, record.path);
    validateManagedTarget(target, paths.home);
    if (record.added) {
      const status = lstatIfPresent(target);
      const content = status?.isFile() ? fs.readFileSync(target, 'utf8') : '';
      if (!linesContain(content, record.line)) {
        throw new Error(`Modified managed shell line blocks update: ${target}`);
      }
    }
  }

  if (!isDeepStrictEqual(gitConfigValues(paths.home), ledger.git.installedValues)) {
    throw new Error(`Modified managed Git setting blocks update: ${GIT_HOOKS_KEY}`);
  }

  for (const file of desired.values()) {
    validateManagedTarget(file.target, paths.home);
  }
  validateManagedTarget(shellTarget, paths.home);
}

function transactionJournalPath(paths) {
  return path.join(paths.transactionRoot, 'journal.json');
}

function removeTransactionDirectory(paths) {
  const status = lstatIfPresent(paths.transactionRoot);
  if (!status) {
    return;
  }
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error(`Invalid transaction directory: ${paths.transactionRoot}`);
  }
  fs.rmSync(paths.transactionRoot, { recursive: true });
}

function prepareTransaction(paths, targets, gitValues) {
  if (lstatIfPresent(paths.transactionRoot)) {
    throw new Error('An incomplete managed transaction must be recovered before continuing');
  }
  fs.mkdirSync(paths.transactionRoot, { mode: 0o700 });
  const snapshotsRoot = path.join(paths.transactionRoot, 'snapshots');
  fs.mkdirSync(snapshotsRoot, { mode: 0o700 });

  const entries = [];
  const uniqueTargets = [...new Set(targets)].sort();
  const existingDirectories = new Set();
  for (const [index, target] of uniqueTargets.entries()) {
    validateManagedTarget(target, paths.home);
    let directory = path.dirname(target);
    while (directory !== paths.home && isWithin(paths.home, directory)) {
      const directoryStatus = lstatIfPresent(directory);
      if (directoryStatus?.isDirectory() && !directoryStatus.isSymbolicLink()) {
        existingDirectories.add(relativeTarget(paths.home, directory));
      }
      directory = path.dirname(directory);
    }
    const status = lstatIfPresent(target);
    if (!status) {
      entries.push({ path: relativeTarget(paths.home, target), kind: 'absent' });
      continue;
    }
    const snapshotName = String(index);
    fs.copyFileSync(target, path.join(snapshotsRoot, snapshotName), fs.constants.COPYFILE_EXCL);
    entries.push({
      path: relativeTarget(paths.home, target),
      kind: 'file',
      mode: fileMode(status),
      snapshot: snapshotName,
    });
  }

  const journal = {
    schemaVersion: 1,
    gitValues,
    entries,
    existingDirectories: [...existingDirectories].sort(),
  };
  fs.writeFileSync(
    transactionJournalPath(paths),
    `${JSON.stringify(journal, null, 2)}\n`,
    { flag: 'wx', mode: 0o600 },
  );
  return journal;
}

function validateTransactionJournal(journal, paths) {
  if (
    !journal
    || typeof journal !== 'object'
    || Array.isArray(journal)
    || journal.schemaVersion !== 1
    || !Array.isArray(journal.gitValues)
    || !journal.gitValues.every((value) => typeof value === 'string')
    || !Array.isArray(journal.entries)
    || !Array.isArray(journal.existingDirectories)
    || !journal.existingDirectories.every((directory) => typeof directory === 'string')
  ) {
    throw new Error('Invalid managed transaction journal');
  }
  for (const entry of journal.entries) {
    if (!entry || typeof entry.path !== 'string' || !['absent', 'file'].includes(entry.kind)) {
      throw new Error('Invalid managed transaction snapshot entry');
    }
    resolveTarget(paths.home, entry.path);
    if (
      entry.kind === 'file'
      && (
        typeof entry.snapshot !== 'string'
        || !/^\d+$/.test(entry.snapshot)
        || !Number.isSafeInteger(entry.mode)
        || entry.mode < 0
        || entry.mode > 0o777
      )
    ) {
      throw new Error('Invalid managed transaction file snapshot');
    }
  }
  for (const directory of journal.existingDirectories) {
    resolveTarget(paths.home, directory);
  }
  return journal;
}

function rollbackTransaction(paths, journal) {
  validateTransactionJournal(journal, paths);
  const possiblyEmptyDirectories = new Set();
  const existingDirectories = new Set(journal.existingDirectories);
  for (const entry of [...journal.entries].reverse()) {
    const target = resolveTarget(paths.home, entry.path);
    if (entry.kind === 'absent') {
      removeManagedFile(target, paths.home);
      let directory = path.dirname(target);
      while (directory !== paths.home && isWithin(paths.home, directory)) {
        possiblyEmptyDirectories.add(directory);
        directory = path.dirname(directory);
      }
      continue;
    }
    const snapshot = path.join(paths.transactionRoot, 'snapshots', entry.snapshot);
    requireWithin(paths.transactionRoot, snapshot, 'Transaction snapshot escapes its directory');
    const status = fs.lstatSync(snapshot);
    if (status.isSymbolicLink() || !status.isFile()) {
      throw new Error(`Invalid transaction snapshot: ${snapshot}`);
    }
    atomicWriteFile(target, fs.readFileSync(snapshot), entry.mode, paths.home);
  }
  setGitConfigValues(paths.home, journal.gitValues);
  removeTransactionDirectory(paths);
  for (const directory of [...possiblyEmptyDirectories]
    .sort((left, right) => right.length - left.length)) {
    if (existingDirectories.has(relativeTarget(paths.home, directory))) {
      continue;
    }
    const status = lstatIfPresent(directory);
    if (!status || status.isSymbolicLink() || !status.isDirectory()) {
      continue;
    }
    try {
      fs.rmdirSync(directory);
    } catch (error) {
      if (!['ENOTEMPTY', 'EEXIST'].includes(error.code)) {
        throw error;
      }
    }
  }
}

function recoverPendingTransaction(paths) {
  const status = lstatIfPresent(paths.transactionRoot);
  if (!status) {
    return false;
  }
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error(`Invalid transaction directory: ${paths.transactionRoot}`);
  }
  const journalPath = transactionJournalPath(paths);
  const journalStatus = lstatIfPresent(journalPath);
  if (!journalStatus) {
    removeTransactionDirectory(paths);
    return true;
  }
  if (journalStatus.isSymbolicLink() || !journalStatus.isFile()) {
    throw new Error(`Invalid transaction journal path: ${journalPath}`);
  }
  let journal;
  try {
    journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  } catch {
    throw new Error(`Invalid managed transaction journal: ${journalPath}`);
  }
  rollbackTransaction(paths, journal);
  return true;
}

function installManaged({ repoRoot, generatedRoot, home, shellRc }) {
  const paths = statePaths(home);
  const desired = buildDesiredFiles(repoRoot, generatedRoot, paths.home);
  const desiredSettings = desiredJsonc(generatedRoot, paths.home);
  const shellTarget = validateManagedTarget(path.resolve(shellRc), paths.home);
  const ledger = readLedger(paths);
  assertInstallPreconditions(ledger, desired, paths, shellTarget);

  const oldFiles = new Map((ledger?.files || []).map((record) => [record.path, record]));
  const existingBackups = managedBackupFiles(paths);
  const potentialBackups = [];
  for (const file of desired.values()) {
    if (!oldFiles.has(file.path) && currentFileHash(file.target)) {
      potentialBackups.push(backupPath(paths, currentFileHash(file.target)));
    }
  }
  const targets = [
    paths.ledgerPath,
    shellTarget,
    ...existingBackups,
    ...potentialBackups,
    ...[...desired.values()].map((file) => file.target),
    ...(ledger?.files || []).map((record) => resolveTarget(paths.home, record.path)),
    ...(ledger?.jsonc || []).map((record) => resolveTarget(paths.home, record.path)),
  ];
  if (desiredSettings) {
    targets.push(desiredSettings.target);
  }

  const gitBefore = gitConfigValues(paths.home);
  const journal = prepareTransaction(paths, targets, gitBefore);
  try {
    const installedFiles = [];

    for (const record of ledger?.files || []) {
      if (!desired.has(record.path)) {
        restorePrevious(resolveTarget(paths.home, record.path), record.previous, paths);
      }
    }

    for (const file of desired.values()) {
      const oldRecord = oldFiles.get(file.path);
      const previous = oldRecord?.previous || capturePrevious(file.target, paths);
      atomicWriteFile(file.target, file.content, file.mode, paths.home);
      installedFiles.push({
        path: file.path,
        installedSha256: file.installedSha256,
        mode: file.mode,
        previous,
      });
    }

    const oldJsonc = ledger?.jsonc?.[0] || null;
    const installedJsonc = [];
    if (oldJsonc && (!desiredSettings || oldJsonc.path !== desiredSettings.path)) {
      const oldTarget = resolveTarget(paths.home, oldJsonc.path);
      const restored = restoreJsoncSettings(fs.readFileSync(oldTarget, 'utf8'), oldJsonc.changes);
      if (!oldJsonc.fileExisted && Object.keys(parseSettings(restored.content).value).length === 0) {
        removeManagedFile(oldTarget, paths.home);
      } else {
        atomicWriteFile(oldTarget, restored.content, fileMode(fs.lstatSync(oldTarget)), paths.home);
      }
    }
    if (desiredSettings) {
      const targetStatus = lstatIfPresent(desiredSettings.target);
      const fileExisted = oldJsonc?.path === desiredSettings.path
        ? oldJsonc.fileExisted
        : Boolean(targetStatus);
      let base = targetStatus ? fs.readFileSync(desiredSettings.target, 'utf8') : '{}\n';
      if (oldJsonc?.path === desiredSettings.path) {
        base = restoreJsoncSettings(base, oldJsonc.changes).content;
      }
      const applied = applyJsoncSettings(base, desiredSettings.settings);
      atomicWriteFile(
        desiredSettings.target,
        applied.content,
        targetStatus ? fileMode(targetStatus) : 0o644,
        paths.home,
      );
      installedJsonc.push({
        path: desiredSettings.path,
        fileExisted,
        changes: applied.changes,
      });
    }

    const oldShell = ledger?.shell?.find((record) => record.path === relativeTarget(paths.home, shellTarget));
    const shellStatus = lstatIfPresent(shellTarget);
    const shellContent = shellStatus ? fs.readFileSync(shellTarget, 'utf8') : '';
    const shellAdded = oldShell ? oldShell.added : !linesContain(shellContent, SHELL_PATH_LINE);
    const nextShellContent = appendLine(shellContent, SHELL_PATH_LINE);
    if (nextShellContent !== shellContent) {
      atomicWriteFile(shellTarget, nextShellContent, shellStatus ? fileMode(shellStatus) : 0o644, paths.home);
    }
    const installedShell = [{
      path: relativeTarget(paths.home, shellTarget),
      line: SHELL_PATH_LINE,
      added: shellAdded,
      fileExisted: oldShell ? oldShell.fileExisted : Boolean(shellStatus),
    }];

    const installedGitValues = [path.join(paths.home, '.git-hooks')];
    const previousGitValues = ledger?.git.previousValues || gitBefore;
    setGitConfigValues(paths.home, installedGitValues);

    const nextLedger = {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      installedAt: new Date().toISOString(),
      files: installedFiles.sort((left, right) => left.path.localeCompare(right.path)),
      jsonc: installedJsonc,
      shell: installedShell,
      git: {
        key: GIT_HOOKS_KEY,
        installedValues: installedGitValues,
        previousValues: previousGitValues,
      },
    };
    atomicWriteFile(
      paths.ledgerPath,
      `${JSON.stringify(nextLedger, null, 2)}\n`,
      0o600,
      paths.home,
    );
    pruneManagedBackups(
      paths,
      new Set(installedFiles
        .filter((record) => record.previous.kind === 'file')
        .map((record) => record.previous.backup)),
    );
    removeTransactionDirectory(paths);
    return nextLedger;
  } catch (error) {
    try {
      rollbackTransaction(paths, journal);
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        'Managed install failed and rollback was incomplete',
      );
    }
    throw error;
  }
}

function uninstallManaged({ home, shellRc }) {
  const paths = statePaths(home);
  const ledger = readLedger(paths);
  if (!ledger) {
    return { installed: false, preserved: [] };
  }
  const shellTarget = validateManagedTarget(path.resolve(shellRc), paths.home);
  const targets = [
    paths.ledgerPath,
    shellTarget,
    ...managedBackupFiles(paths),
    ...ledger.files.map((record) => resolveTarget(paths.home, record.path)),
    ...ledger.jsonc.map((record) => resolveTarget(paths.home, record.path)),
  ];
  const gitBefore = gitConfigValues(paths.home);
  const journal = prepareTransaction(paths, targets, gitBefore);
  const preserved = [];

  try {
    for (const record of ledger.files) {
      const target = resolveTarget(paths.home, record.path);
      if (currentFileHash(target) === record.installedSha256) {
        restorePrevious(target, record.previous, paths);
      } else {
        preserved.push(target);
      }
    }

    for (const record of ledger.jsonc) {
      const target = resolveTarget(paths.home, record.path);
      const status = lstatIfPresent(target);
      if (!status || status.isSymbolicLink() || !status.isFile()) {
        preserved.push(target);
        continue;
      }
      const restored = restoreJsoncSettings(fs.readFileSync(target, 'utf8'), record.changes);
      if (!record.fileExisted && Object.keys(parseSettings(restored.content).value).length === 0) {
        removeManagedFile(target, paths.home);
      } else {
        atomicWriteFile(target, restored.content, fileMode(status), paths.home);
      }
      preserved.push(...restored.preservedKeys.map((key) => `${target}#${key}`));
    }

    for (const record of ledger.shell) {
      const target = resolveTarget(paths.home, record.path);
      const status = lstatIfPresent(target);
      if (!record.added || !status) {
        continue;
      }
      const content = fs.readFileSync(target, 'utf8');
      const restored = removeLine(content, record.line);
      if (restored === content) {
        preserved.push(`${target}#${record.line}`);
      } else if (!record.fileExisted && restored === '') {
        removeManagedFile(target, paths.home);
      } else {
        atomicWriteFile(target, restored, fileMode(status), paths.home);
      }
    }

    if (isDeepStrictEqual(gitConfigValues(paths.home), ledger.git.installedValues)) {
      setGitConfigValues(paths.home, ledger.git.previousValues);
    } else {
      preserved.push(`git:${ledger.git.key}`);
    }

    removeManagedFile(paths.ledgerPath, paths.home);
    pruneManagedBackups(paths, new Set());
    removeTransactionDirectory(paths);
    return { installed: true, preserved };
  } catch (error) {
    try {
      rollbackTransaction(paths, journal);
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        'Managed uninstall failed and rollback was incomplete',
      );
    }
    throw error;
  }
}

function parseCliArguments(argv) {
  const [command, ...args] = argv;
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error(`Invalid managed-files argument: ${flag || '<missing>'}`);
    }
    const key = flag.slice(2);
    if (Object.hasOwn(values, key)) {
      throw new Error(`Duplicate managed-files argument: ${flag}`);
    }
    values[key] = value;
  }
  return { command, values };
}

function requiredPath(values, name) {
  if (!values[name]) {
    throw new Error(`Missing required argument: --${name}`);
  }
  return path.resolve(values[name]);
}

function validateCliOptions(command, values) {
  const allowedOptions = {
    install: new Set(['repo-root', 'generated-root', 'home', 'shell-rc']),
    uninstall: new Set(['home', 'shell-rc']),
    recover: new Set(['home']),
    unlock: new Set(['home']),
  };
  if (!Object.hasOwn(allowedOptions, command)) {
    throw new Error('Usage: managed-files.js <install|uninstall|recover|unlock> --home <path> [options]');
  }
  for (const option of Object.keys(values)) {
    if (!allowedOptions[command].has(option)) {
      throw new Error(`Unknown option: --${option}`);
    }
  }
}

function runCli(argv) {
  const { command, values } = parseCliArguments(argv);
  validateCliOptions(command, values);
  const home = requiredPath(values, 'home');
  const homeStatus = fs.lstatSync(home);
  if (homeStatus.isSymbolicLink() || !homeStatus.isDirectory()) {
    throw new Error(`Selected home is not a regular directory: ${home}`);
  }
  const paths = statePaths(home);
  const stateDirectoriesCreatedByOperation = missingStateDirectories(paths);
  validateManagedTarget(paths.ledgerPath, home);

  if (command === 'unlock') {
    const owner = unlockStaleOperationLock(paths.stateRoot);
    process.stdout.write(`Removed stale ${owner.operation} lock for PID ${owner.pid}.\n`);
    return;
  }

  const lock = acquireOperationLock(paths.stateRoot, command);
  try {
    const recovered = recoverPendingTransaction(paths);
    if (command === 'recover') {
      process.stdout.write(recovered ? 'Recovered the incomplete transaction.\n' : 'No incomplete transaction found.\n');
      return;
    }
    const shellRc = requiredPath(values, 'shell-rc');
    if (command === 'install') {
      const result = installManaged({
        repoRoot: requiredPath(values, 'repo-root'),
        generatedRoot: requiredPath(values, 'generated-root'),
        home,
        shellRc,
      });
      process.stdout.write(`Installed ${result.files.length} managed files.\n`);
    } else {
      const result = uninstallManaged({ home, shellRc });
      if (!result.installed) {
        process.stdout.write('No managed install ledger found; nothing was removed.\n');
      } else {
        process.stdout.write(`Uninstalled managed values; preserved ${result.preserved.length} user-modified value(s).\n`);
      }
    }
  } finally {
    releaseOperationLock(lock);
    removeCreatedStateDirectories(stateDirectoriesCreatedByOperation);
  }
}

module.exports = {
  acquireOperationLock,
  applyJsoncSettings,
  installManaged,
  releaseOperationLock,
  restoreJsoncSettings,
  runCli,
  uninstallManaged,
  unlockStaleOperationLock,
  validateManagedSource,
  validateManagedTarget,
};

if (require.main === module) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
