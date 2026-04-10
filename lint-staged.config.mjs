import path from 'node:path';

const repoRoot = process.cwd();

const workspaceConfigs = [
  { dir: 'apps/api', extensions: ['.js', '.jsx', '.ts', '.tsx'] },
  { dir: 'apps/web', extensions: ['.js', '.jsx', '.ts', '.tsx'] },
  { dir: 'apps', extensions: ['.js', '.jsx', '.ts', '.tsx'] },
  { dir: 'packages/domain', extensions: ['.js', '.ts'] },
  { dir: 'packages/integration-sienge', extensions: ['.js', '.ts'] },
  { dir: 'packages/shared', extensions: ['.js', '.ts'] },
  { dir: 'workers', extensions: ['.js', '.ts'] },
].sort((left, right) => right.dir.length - left.dir.length);

function normalize(file) {
  return file.split(path.sep).join('/');
}

function quote(file) {
  return JSON.stringify(file);
}

function findWorkspace(file) {
  const normalizedFile = normalize(file);
  const extension = path.extname(normalizedFile);

  return workspaceConfigs.find(
    (workspace) =>
      normalizedFile.startsWith(`${workspace.dir}/`) && workspace.extensions.includes(extension),
  );
}

function groupFilesByWorkspace(files) {
  const groupedFiles = new Map();

  for (const file of files) {
    const workspace = findWorkspace(file);

    if (!workspace) {
      continue;
    }

    const workspaceFiles = groupedFiles.get(workspace.dir) ?? [];
    workspaceFiles.push(file);
    groupedFiles.set(workspace.dir, workspaceFiles);
  }

  return groupedFiles;
}

function toWorkspaceCommand(workspace, files) {
  if (files.length === 0) {
    return [];
  }

  const relativeFiles = files.map((file) =>
    normalize(path.relative(workspace.dir, path.resolve(repoRoot, file))),
  );

  return [
    `pnpm --dir ${quote(workspace.dir)} exec eslint --fix ${relativeFiles.map(quote).join(' ')}`,
    `pnpm exec prettier --write ${files.map(quote).join(' ')}`,
  ];
}

export default {
  '*.{js,jsx,ts,tsx}': (files) =>
    Array.from(groupFilesByWorkspace(files).entries()).flatMap(([workspaceDir, workspaceFiles]) =>
      toWorkspaceCommand(
        workspaceConfigs.find((workspace) => workspace.dir === workspaceDir),
        workspaceFiles,
      ),
    ),
  '*.{json,md,yml,yaml}': (files) =>
    files.length === 0 ? [] : [`pnpm exec prettier --write ${files.map(quote).join(' ')}`],
};
