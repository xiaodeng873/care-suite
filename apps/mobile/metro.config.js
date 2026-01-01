const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 添加 monorepo 支援
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 支援 shared package
config.resolver.extraNodeModules = {
  '@care-suite/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
};

module.exports = config;
