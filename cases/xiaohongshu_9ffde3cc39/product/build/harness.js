// DOM stubs to run the page script in Node and surface runtime errors
const ctxStub = new Proxy({}, {
  get(t, k) {
    if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(8) });
    if (typeof t[k] !== 'undefined') return t[k];
    return () => {};
  },
  set(t, k, v) { t[k] = v; return true; }
});
function elStub() {
  return { style: {}, width: 0, height: 0,
    getContext: () => ctxStub,
    getBoundingClientRect: () => ({ toJSON: () => ({}) }) };
}
global.window = { addEventListener: () => {}, devicePixelRatio: 2, innerWidth: 1181, innerHeight: 744 };
global.location = { search: '?t=0.5&freeze=1' };
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => {};
global.document = {
  getElementById: () => elStub(),
  readyState: 'complete',
  body: { offsetWidth: 1181, offsetHeight: 744 }
};
global.URLSearchParams = URLSearchParams;
require('workspace/build/check.js');
console.log('SCRIPT RAN TO COMPLETION');
