(function (global) {
  'use strict';
  var vendor = global.__LUKEPANEL_VENDOR__;
  if (!vendor) throw new Error('LukePanel vendor runtime did not load');
  var React = vendor.require(96540);
  vendor.alias(44914, React);
  var ReactDOM = vendor.require(40961);
  if (!React || React.version !== '18.2.0' || typeof ReactDOM.createRoot !== 'function') {
    throw new Error('LukePanel React runtime validation failed');
  }
  global.React = React;
  global.ReactDOM = ReactDOM;
})(self);
