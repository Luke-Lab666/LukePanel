/* Minimal webpack module loader for the vendored React 18.2.0 production chunks. */
(function (global) {
  'use strict';
  var modules = Object.create(null);
  var cache = Object.create(null);
  function requireModule(id) {
    var key = String(id);
    if (cache[key]) return cache[key].exports;
    var factory = modules[key];
    if (!factory) throw new Error('LukePanel vendor module missing: ' + key);
    var module = { exports: {} };
    cache[key] = module;
    factory(module, module.exports, requireModule);
    return module.exports;
  }
  function register(payload) {
    var map = payload && payload[1];
    if (map) Object.keys(map).forEach(function (key) { modules[key] = map[key]; });
    return 0;
  }
  var chunks = [];
  chunks.push = register;
  global.webpackChunk_jupyterlab_application_top = chunks;
  global.__LUKEPANEL_VENDOR__ = {
    require: requireModule,
    alias: function (id, value) { modules[String(id)] = function (module) { module.exports = value; }; }
  };
})(self);
