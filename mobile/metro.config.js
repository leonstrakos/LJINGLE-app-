const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// sqliteWebSharedArrayBufferV2
// expo-sqlite Web uses WASM + SharedArrayBuffer.

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

config.server = {
  ...config.server,

  enhanceMiddleware: (middleware) => {
    return (request, response, next) => {
      response.setHeader(
        'Cross-Origin-Opener-Policy',
        'same-origin',
      );

      response.setHeader(
        'Cross-Origin-Embedder-Policy',
        'credentialless',
      );

      return middleware(
        request,
        response,
        next,
      );
    };
  },
};

module.exports = config;
