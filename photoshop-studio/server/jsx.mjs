// Builders for ExtendScript (JSX) bodies. Pure functions, so they can be tested without Photoshop.
import { readFileSync } from 'node:fs';

const JSON_POLYFILL = readFileSync(new URL('./json-lite.jsx', import.meta.url), 'utf8');

export const COLOR_PRESETS = ['Rds ', 'Ylws', 'Grns', 'Cyns', 'Bls ', 'Mgnt'];

/** Wraps a body so the script always returns a JSON string and restores Photoshop preferences. */
export function wrap(body) {
  return [
    '(function () {',
    JSON_POLYFILL,
    '  var __dlg = app.displayDialogs, __units = app.preferences.rulerUnits;',
    '  try {',
    '    app.displayDialogs = DialogModes.NO;',
    '    app.preferences.rulerUnits = Units.PIXELS;',
    body,
    '  } catch (e) {',
    '    return JSON.stringify({ ok: false, error: String(e) });',
    '  } finally {',
    '    try { app.displayDialogs = __dlg; app.preferences.rulerUnits = __units; } catch (e2) {}',
    '  }',
    '})()',
  ].join('\n');
}

function num(v) {
  return Number(v);
}

/**
 * @param {object} o
 * @param {number[][]} o.points closed outline in image pixels, at least 3 points
 * @param {string} o.name name of the resulting layer
 * @param {'mask'|'pixels'} o.mode mask = non-destructive layer mask; pixels = transparent pixels outside the outline
 * @param {string|undefined} o.sourceLayer layer to cut from; defaults to the active layer
 * @param {{color: string, fuzziness: number}[]} o.cleanup Color Range passes that remove background colors (painted black on the mask, or deleted in pixels mode)
 * @param {number} [o.passes] how many times the cleanup list is applied (default 1)
 * @param {boolean} o.hideSource hide the source layer afterwards
 */
export function buildCutoutScript(o) {
  if (!Array.isArray(o.points) || o.points.length < 3) throw new Error('points needs at least 3 [x, y] pairs');
  const pts = o.points.map((p) => {
    if (!Array.isArray(p) || p.length !== 2 || !Number.isFinite(num(p[0])) || !Number.isFinite(num(p[1]))) {
      throw new Error('every point must be [x, y] with finite numbers');
    }
    return [num(p[0]), num(p[1])];
  });
  const passes = o.passes ?? 1;
  if (!Number.isInteger(passes) || passes < 1 || passes > 8) throw new Error('passes must be an integer from 1 to 8');
  // Pastel pixels are only partly selected by Color Range, so each pass removes them a bit further: repeat the list.
  const cleanup = Array.from({ length: passes }, () => o.cleanup ?? []).flat();
  for (const c of cleanup) {
    if (!COLOR_PRESETS.includes(c.color)) throw new Error(`unknown color preset "${c.color}"`);
  }
  const lines = [
    'var doc = app.activeDocument;',
    'var P = ' + JSON.stringify(pts) + ';',
    'var NAME = ' + JSON.stringify(o.name) + ';',
    'var SOURCE = ' + JSON.stringify(o.sourceLayer ?? null) + ';',
    'function findLayer(n) { for (var i = 0; i < doc.layers.length; i++) { if (doc.layers[i].name === n) return doc.layers[i]; } return null; }',
    'var W = Number(doc.width.as("px")), H = Number(doc.height.as("px"));',
    'for (var i = 0; i < P.length; i++) { if (P[i][0] < 0 || P[i][1] < 0 || P[i][0] > W || P[i][1] > H) throw new Error("point " + (i + 1) + " is outside the document (" + W + "x" + H + ")"); }',
    'var src = SOURCE ? findLayer(SOURCE) : doc.activeLayer;',
    'if (!src) throw new Error("source layer not found: " + SOURCE);',
    'if (src.name === NAME) throw new Error("name of the new layer equals the source layer; pass another name");',
    'var old = findLayer(NAME); if (old) old.remove();',
    'doc.selection.deselect();',
    'doc.activeLayer = src;',
    'var work = src.duplicate(); work.name = NAME; doc.activeLayer = work;',
    'try {',
    'doc.selection.select(P, SelectionType.REPLACE, 0, true);',
  ];
  if (o.mode === 'mask') {
    lines.push(
      'var d = new ActionDescriptor(); d.putClass(charIDToTypeID("Nw  "), charIDToTypeID("Chnl"));',
      'var r = new ActionReference(); r.putEnumerated(charIDToTypeID("Chnl"), charIDToTypeID("Chnl"), charIDToTypeID("Msk "));',
      'd.putReference(charIDToTypeID("At  "), r); d.putEnumerated(charIDToTypeID("Usng"), charIDToTypeID("UsrM"), charIDToTypeID("RvlS"));',
      'executeAction(charIDToTypeID("Mk  "), d, DialogModes.NO);',
      'doc.selection.deselect();',
      ...(cleanup.length
        ? [
            // Color Range must sample the layer PIXELS (target the RGB composite), then the black fill goes to the MASK.
            'function target(code) {',
            '  var td = new ActionDescriptor(), tr = new ActionReference();',
            '  tr.putEnumerated(charIDToTypeID("Chnl"), charIDToTypeID("Chnl"), charIDToTypeID(code));',
            '  td.putReference(charIDToTypeID("null"), tr); td.putBoolean(charIDToTypeID("MkVs"), false);',
            '  executeAction(charIDToTypeID("slct"), td, DialogModes.NO);',
            '}',
            'function hasSelection() { try { var sb = doc.selection.bounds; return Number(sb[2].as("px")) > Number(sb[0].as("px")); } catch (e) { return false; } }',
            'var black = new SolidColor(); black.rgb.red = 0; black.rgb.green = 0; black.rgb.blue = 0;',
            'function maskPass(code, fuzz) {',
            '  target("RGB ");',
            '  var cd = new ActionDescriptor();',
            '  cd.putEnumerated(charIDToTypeID("Clrs"), charIDToTypeID("Clrs"), charIDToTypeID(code));',
            '  cd.putInteger(charIDToTypeID("Fzns"), fuzz);',
            '  executeAction(charIDToTypeID("ClrR"), cd, DialogModes.NO);',
            '  if (hasSelection()) { target("Msk "); doc.selection.fill(black); }',  // never fill without a selection: that would blacken the whole mask
            '  doc.selection.deselect();',
            '}',
            ...cleanup.map((c) => `maskPass(${JSON.stringify(c.color)}, ${Math.round(c.fuzziness)});`),
            'target("RGB ");',
          ]
        : []),
    );
  } else {
    lines.push(
      'doc.selection.invert(); doc.selection.clear(); doc.selection.deselect();',
      'function colorPass(code, fuzz) {',
      '  var cd = new ActionDescriptor();',
      '  cd.putEnumerated(charIDToTypeID("Clrs"), charIDToTypeID("Clrs"), charIDToTypeID(code));',
      '  cd.putInteger(charIDToTypeID("Fzns"), fuzz);',
      '  executeAction(charIDToTypeID("ClrR"), cd, DialogModes.NO);',
      '  doc.selection.clear(); doc.selection.deselect();',
      '}',
      ...cleanup.map((c) => `colorPass(${JSON.stringify(c.color)}, ${Math.round(c.fuzziness)});`),
    );
  }
  lines.push(
    'function px(u) { return Math.round(Number(u.as("px"))); }',
    'var b = work.bounds;',
    'if (px(b[2]) - px(b[0]) <= 0 || px(b[3]) - px(b[1]) <= 0) { throw new Error("the result is empty: cleanup or polygon removed everything (nothing was changed)"); }',
    '} catch (cutErr) {',
    // roll back: no half-finished layer, no leftover selection, source untouched
    '  try { doc.selection.deselect(); } catch (e1) {}',
    '  try { work.remove(); } catch (e2) {}',
    '  try { doc.activeLayer = src; } catch (e3) {}',
    '  throw cutErr;',
    '}',
    'if (' + (o.hideSource ? 'true' : 'false') + ' && src.visible) src.visible = false;',
    'return JSON.stringify({ ok: true, layer: NAME, mode: ' + JSON.stringify(o.mode) + ', bounds: [px(b[0]), px(b[1]), px(b[2]), px(b[3])], layer_count: doc.layers.length });',
  );
  return wrap(lines.join('\n'));
}
