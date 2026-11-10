module.exports = function(api) {
  api.cache(true);
  const plugins = [];
  if (process.env.NODE_ENV === 'production') {
    try {
      require.resolve('babel-plugin-transform-remove-console');
      plugins.push(['transform-remove-console', { exclude: ['error'] }]);
    } catch (_e) {
      // safe fallback if babel-plugin-transform-remove-console is not installed
    }
  }
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
