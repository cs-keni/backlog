// Preloaded via tsx --require before importing bank files.
// Adds a no-op module to the require cache for 'server-only', which is a
// Next.js-only package that throws if imported outside the server runtime.
// This lets the validation script run in plain Node/tsx without Next.js.
const Module = require('module')
const _original = Module._resolveFilename.bind(Module)
Module._resolveFilename = function (request, ...args) {
  if (request === 'server-only') return __filename
  return _original(request, ...args)
}
// Mark this module itself as the 'server-only' stub in the cache
require.cache['server-only'] = require.cache[__filename]
