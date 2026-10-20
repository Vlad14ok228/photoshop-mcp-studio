// Integration tests for ps_cutout_polygon against a REAL Photoshop. Run: npm run test:integration
// Needs Photoshop running. Uses its own synthetic document and closes it afterwards.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { buildCutoutScript, wrap } from '../../jsx.mjs';
import { runJsx } from '../../ps.mjs';
import { GEOMETRY, closeFixture, createFixture, exportAndDecode, layerInfo, photoshopAvailable } from './helpers.mjs';

const available = await photoshopAvailable();
const opts = { skip: available ? false : 'Photoshop is not running' };

const cut = (o) =>
  runJsx(buildCutoutScript({ name: 'Cutout', mode: 'mask', hideSource: true, sourceLayer: 'Background', ...o }));

const OPAQUE = 250; // alpha considered "fully visible"
const alpha = (png, [x, y]) => png.px(x, y)[3];
const isBlue = ([r, g, b, a]) => r < 40 && g < 40 && b > 215 && a > OPAQUE;

before(async () => { if (available) await createFixture(); });
after(async () => { if (available) await closeFixture(); });
beforeEach(async () => {
  if (!available) return;
  // reset: drop results of the previous test, show the source again
  await runJsx(
    wrap(`
    var d = app.activeDocument;
    for (var i = d.layers.length - 1; i >= 0; i--) { if (d.layers[i].name !== "Background") d.layers[i].remove(); }
    if (!d.backgroundLayer.visible) d.backgroundLayer.visible = true;
    return JSON.stringify({ ok: true });
  `),
  );
});

test('mask mode: exact triangle is opaque, everything else transparent', opts, async () => {
  const r = await cut({ points: GEOMETRY.triangle });
  assert.equal(r.ok, true, JSON.stringify(r));
  const info = await layerInfo();
  const layer = info.layers.find((l) => l.name === 'Cutout');
  assert.ok(layer?.hasMask, 'result layer must carry a layer mask (non-destructive)');
  assert.equal(info.layers.find((l) => l.name === 'Background').visible, false, 'source hidden');

  const png = await exportAndDecode();
  assert.ok(isBlue(png.px(...GEOMETRY.inside)), 'center of the triangle stays blue and opaque');
  assert.equal(alpha(png, GEOMETRY.yellowInRect), 0, 'point outside the triangle but inside its bbox is transparent');
  assert.equal(alpha(png, GEOMETRY.red), 0, 'the red distractor is not part of the cutout');
  assert.equal(alpha(png, [5, 5]), 0, 'far background is transparent');
});

test('mask mode + cleanup removes the yellow margin of a generous polygon', opts, async () => {
  const r = await cut({ points: GEOMETRY.generousRect, cleanup: [{ color: 'Ylws', fuzziness: 40 }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  const png = await exportAndDecode();
  assert.ok(isBlue(png.px(...GEOMETRY.inside)), 'object survives the cleanup');
  assert.equal(alpha(png, GEOMETRY.yellowInRect), 0, 'yellow margin inside the polygon is removed');
  assert.equal(alpha(png, GEOMETRY.red), 0, 'outside the polygon stays transparent');
});

test('pixels mode + cleanup gives the same visible result', opts, async () => {
  const r = await cut({ points: GEOMETRY.generousRect, mode: 'pixels', cleanup: [{ color: 'Ylws', fuzziness: 40 }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  const info = await layerInfo();
  assert.equal(info.layers.find((l) => l.name === 'Cutout').hasMask, false, 'pixels mode does not use a mask');
  const png = await exportAndDecode();
  assert.ok(isBlue(png.px(...GEOMETRY.inside)));
  assert.equal(alpha(png, GEOMETRY.yellowInRect), 0);
  assert.equal(alpha(png, GEOMETRY.red), 0);
});

test('a cleanup that erases everything fails and rolls everything back', opts, async () => {
  const before = await layerInfo();
  // polygon lies completely in the yellow area, so removing yellow leaves nothing
  const r = await cut({ points: [[250, 230], [390, 230], [390, 290], [250, 290]], cleanup: [{ color: 'Ylws', fuzziness: 40 }] });
  assert.equal(r.ok, false, 'must not report success for an empty result');
  assert.match(r.error, /result is empty/);
  const after = await layerInfo();
  assert.deepEqual(after.layers.map((l) => l.name), before.layers.map((l) => l.name), 'no leftover layers');
  assert.equal(after.layers.find((l) => l.name === 'Background').visible, true, 'source stays visible');
});

test('running twice replaces the layer instead of duplicating it', opts, async () => {
  await cut({ points: GEOMETRY.triangle });
  const r = await cut({ points: GEOMETRY.triangle });
  assert.equal(r.ok, true, JSON.stringify(r));
  const names = (await layerInfo()).layers.map((l) => l.name).sort();
  assert.deepEqual(names, ['Background', 'Cutout']);
});

test('a point outside the document is rejected without touching the document', opts, async () => {
  const before = await layerInfo();
  const r = await cut({ points: [[10, 10], [900, 10], [900, 100]] });
  assert.equal(r.ok, false);
  assert.match(r.error, /outside the document/);
  assert.deepEqual((await layerInfo()).layers, before.layers);
});

test('the source layer is never modified', opts, async () => {
  const first = await exportAndDecode();
  const reference = [GEOMETRY.inside, GEOMETRY.yellowInRect, GEOMETRY.red].map((p) => first.px(...p).join());
  await cut({ points: GEOMETRY.generousRect, cleanup: [{ color: 'Ylws', fuzziness: 40 }], hideSource: false });
  await runJsx(
    wrap(`
    var l = app.activeDocument.layers.getByName("Cutout");
    if (l.visible) l.visible = false;
    return JSON.stringify({ ok: true });
  `),
  );
  const again = await exportAndDecode();
  assert.deepEqual([GEOMETRY.inside, GEOMETRY.yellowInRect, GEOMETRY.red].map((p) => again.px(...p).join()), reference);
});

test('every Color Range preset is accepted by Photoshop', opts, async () => {
  const { COLOR_PRESETS } = await import('../../jsx.mjs');
  const bad = [];
  for (const code of COLOR_PRESETS) {
    const r = await runJsx(
      wrap(`
      var cd = new ActionDescriptor();
      cd.putEnumerated(charIDToTypeID("Clrs"), charIDToTypeID("Clrs"), charIDToTypeID(${JSON.stringify(code)}));
      cd.putInteger(charIDToTypeID("Fzns"), 40);
      executeAction(charIDToTypeID("ClrR"), cd, DialogModes.NO);
      app.activeDocument.selection.deselect();
      return JSON.stringify({ ok: true });
    `),
    );
    if (!r.ok) bad.push(`${JSON.stringify(code)}: ${String(r.error).split('\n').pop()}`);
  }
  assert.deepEqual(bad, [], 'presets rejected by Photoshop');
});
