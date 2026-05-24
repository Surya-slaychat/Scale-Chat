// Expo SDK 56 — monorepo-aware Metro config.
//
// We hoist node_modules to the monorepo root via npm workspaces, so Metro
// needs both `watchFolders` (to pick up changes in packages/shared) and
// `nodeModulesPaths` (so module resolution finds hoisted deps).
//
// Docs: https://docs.expo.dev/guides/monorepos/

const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
