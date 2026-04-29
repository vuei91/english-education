/**
 * Babel configuration.
 *
 * We extend babel-preset-expo (Expo's default). No extra plugins for now.
 * If we need to strip `import.meta` out of a third-party package later,
 * add a targeted `overrides` block here (see babel-plugin-transform-import-meta).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
