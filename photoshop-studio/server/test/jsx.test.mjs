import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLOR_PRESETS, buildCutoutScript } from '../jsx.mjs';

const square = [[10, 10], [100, 10], [100, 100], [10, 100]];

// ExtendScript is ES3; parsing with the JS engine catches syntax errors in generated code.
const parses = (code) => assert.doesNotThrow(() => new Function(code), 'generated JSX must be syntactically valid');

test('mask script is valid and contains the layer-mask action', () => {
  const code = buildCutoutScript({ points: square, name: 'Cutout', mode: 'mask', hideSource: true });
  parses(code);
  assert.match(code, /RvlS/);
  assert.doesNotMatch(code, /colorPass\("/);
});

test('pixels script with cleanup emits one color pass per entry', () => {
  const code = buildCutoutScript({
    points: square, name: 'Cutout', mode: 'pixels', hideSource: false,
    cleanup: [{ color: 'Ylws', fuzziness: 40 }, { color: 'Rds ', fuzziness: 90 }],
  });
  parses(code);
  assert.equal((code.match(/colorPass\("/g) ?? []).length, 2);
  assert.match(code, /colorPass\("Rds ", 90\)/);
});

test('rejects fewer than 3 points', () => {
  assert.throws(() => buildCutoutScript({ points: [[0, 0], [1, 1]], name: 'x', mode: 'mask' }), /at least 3/);
});

test('rejects non-numeric points', () => {
  assert.throws(() => buildCutoutScript({ points: [[0, 0], [1, 'a'], [2, 2]], name: 'x', mode: 'mask' }), /finite/);
});

test('rejects unknown color presets', () => {
  assert.throws(() => buildCutoutScript({ points: square, name: 'x', mode: 'pixels', cleanup: [{ color: 'Pink', fuzziness: 1 }] }), /unknown color/);
});

test('layer names with quotes cannot break out of the script', () => {
  const code = buildCutoutScript({ points: square, name: 'a"); alert(1); ("', mode: 'mask', hideSource: true });
  parses(code);
  assert.match(code, /var NAME = "a\\"\); alert\(1\); \(\\""/);
});

test('every preset code is 4 characters (Photoshop char IDs)', () => {
  for (const c of COLOR_PRESETS) assert.equal(c.length, 4);
});

test('mask mode with cleanup paints black on the mask channel', () => {
  const code = buildCutoutScript({ points: square, name: 'Cutout', mode: 'mask', hideSource: true, cleanup: [{ color: 'Ylws', fuzziness: 60 }] });
  parses(code);
  assert.match(code, /maskPass\("Ylws", 60\)/);
  assert.match(code, /doc\.selection\.fill\(black\)/);
  assert.match(code, /if \(hasSelection\(\)\)/, 'must never fill without a selection');
  assert.match(code, /target\("RGB "\);\n\s*var cd/, 'color range must sample the RGB pixels, not the mask');
  assert.doesNotMatch(code, /doc\.selection\.clear\(\)/);
});

test('an empty result is rolled back with an error, not reported as success', () => {
  const code = buildCutoutScript({ points: square, name: 'Cutout', mode: 'mask', hideSource: true });
  parses(code);
  assert.match(code, /the result is empty/);
  assert.ok(code.indexOf('the result is empty') < code.indexOf('src.visible = false'), 'source must stay visible when the result is empty');
});

test('passes repeats the whole cleanup list', () => {
  const code = buildCutoutScript({
    points: square, name: 'Cutout', mode: 'mask', hideSource: true, passes: 3,
    cleanup: [{ color: 'Ylws', fuzziness: 60 }, { color: 'Rds ', fuzziness: 60 }],
  });
  parses(code);
  assert.equal((code.match(/maskPass\("/g) ?? []).length, 6);
});

test('passes outside 1..8 is rejected', () => {
  assert.throws(() => buildCutoutScript({ points: square, name: 'x', mode: 'mask', passes: 0 }), /passes/);
  assert.throws(() => buildCutoutScript({ points: square, name: 'x', mode: 'mask', passes: 9 }), /passes/);
});
