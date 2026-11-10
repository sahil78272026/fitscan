const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude intermediate Android and iOS build artifacts from Metro's file watcher
// to prevent exhausting system inotify file watchers.
const buildExclusions = [
  /.*\/android\/build\/.*/,
  /.*\/android\/\.gradle\/.*/,
  /.*\/ios\/build\/.*/,
  /.*\/node_modules\/.*\/android\/build\/.*/,
];

if (Array.isArray(config.resolver.blockList)) {
  config.resolver.blockList.push(...buildExclusions);
} else if (config.resolver.blockList instanceof RegExp) {
  config.resolver.blockList = [config.resolver.blockList, ...buildExclusions];
} else {
  config.resolver.blockList = buildExclusions;
}

module.exports = config;
