/**
 * @format
 */

// Polyfill global.Worklets to wrap the native HostObject in a Proxy.
// This intercepts and patches 'createRunInJsFn' before other modules can import and use it.
let patchedWorklets = null;

function wrapWorklets(rawWorklets) {
  if (rawWorklets && !rawWorklets.__isPatched) {
    const proxy = new Proxy(rawWorklets, {
      get(target, prop, receiver) {
        if (prop === 'createRunInJsFn') {
          // Safe redirect to correct functioning JSI methods
          return target.createRunOnJS || target.runOnJS;
        }
        return Reflect.get(target, prop, receiver);
      },
      has(target, prop) {
        if (prop === 'createRunInJsFn') return true;
        return Reflect.has(target, prop);
      }
    });
    proxy.__isPatched = true;
    patchedWorklets = proxy;
  } else {
    patchedWorklets = rawWorklets;
  }
}

const originalValue = global.Worklets;
Object.defineProperty(global, 'Worklets', {
  get() {
    return patchedWorklets;
  },
  set(value) {
    if (value) {
      wrapWorklets(value);
    } else {
      patchedWorklets = value;
    }
  },
  configurable: true,
  enumerable: true,
});

if (originalValue) {
  wrapWorklets(originalValue);
}

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
