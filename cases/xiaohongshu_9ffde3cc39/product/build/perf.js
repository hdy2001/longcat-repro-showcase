// Perf probe: run the page script's step() 600x (10s @60fps) and time it.
const fs = require('fs');
const ROOT = 'workspace';
const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) throw new Error('no inline script found');
let src = m[1];
if (!src.includes('})();')) throw new Error('unexpected script ending');
// splice the timing driver inside the IIFE, right before its closing
src = src.replace(/\}\)\(\);\s*$/, '') + `
var __t0 = Date.now();
for (var __i = 0; __i < 600; __i++) step(__i / 60, 1 / 60);
var __t1 = Date.now();
console.log('PHYSICS 600 steps (12000 particles): ' + ((__t1 - __t0) / 600).toFixed(3) + ' ms/step');
console.log('PARTICLES: ' + (typeof N0 !== 'undefined' ? N0 : 'n/a'));
})();
`;

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
    getBoundingClientRect: () => ({ width: 0, height: 0 }) };
}
global.window = { addEventListener: () => {}, devicePixelRatio: 2, innerWidth: 1181, innerHeight: 744 };
global.location = { search: '' };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => {};
global.document = {
  getElementById: () => elStub(),
  readyState: 'complete',
  body: { offsetWidth: 1181, offsetHeight: 744 }
};
global.URLSearchParams = URLSearchParams;
eval(src);
