const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: [
      /android\/.*/,
      /ios\/.*/,
      /\.git\/.*/,
      /\.gemini\/.*/,
      /C:\\Users\\421je\\\.gemini\/.*/,
      /.*\/android\/app\/build\/.*/,
      /.*\/android\/\.gradle\/.*/
    ]
  }
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

