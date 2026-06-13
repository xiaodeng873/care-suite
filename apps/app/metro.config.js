const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch the workspace root so hoisted packages (e.g. expo-router v6)
// are visible to Metro's resolver.
config.watchFolders = [workspaceRoot];

// Search workspace root node_modules first (hoisted packages like expo-router v6),
// then app's own node_modules.
// root/node_modules/react and react-dom are symlinked to apps/app (React 19),
// so all packages — hoisted or local — resolve to the same React 19.
config.resolver.nodeModulesPaths = [
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(projectRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './src/global.css' });
