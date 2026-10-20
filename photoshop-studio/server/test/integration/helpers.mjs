// Helpers for tests that drive a real Photoshop: fixture creation, PNG export and a tiny PNG decoder.
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { wrap } from '../../jsx.mjs';
import { runJsx } from '../../ps.mjs';

export const FIXTURE_NAME = 'ps-studio-fixture';

// Fixture geometry (document 400x300): yellow background, blue triangle (the "object"), red square (a distractor).
export const GEOMETRY = {
  triangle: [[150, 60], [230, 200], [70, 200]],
  generousRect: [[50, 40], [250, 40], [250, 220], [50, 220]],
  inside: [150, 150], // inside the triangle
  yellowInRect: [80, 80], // inside generousRect and its bbox, but outside the triangle
  red: [330, 130], // distractor, outside every polygon
};

export async function photoshopAvailable() {
  const r = await runJsx(wrap('return JSON.stringify({ ok: true });'), { timeoutMs: 30000 });
  return r.ok === true;
}

export async function createFixture() {
  const r = await runJsx(
    wrap(`
    function rgb(r, g, b) { var c = new SolidColor(); c.rgb.red = r; c.rgb.green = g; c.rgb.blue = b; return c; }
    var doc = app.documents.add(400, 300, 72, ${JSON.stringify(FIXTURE_NAME)}, NewDocumentMode.RGB, DocumentFill.WHITE);
    doc.selection.selectAll(); doc.selection.fill(rgb(255, 255, 0)); doc.selection.deselect();
    doc.selection.select(${JSON.stringify(GEOMETRY.triangle)}); doc.selection.fill(rgb(0, 0, 255)); doc.selection.deselect();
    doc.selection.select([[300, 100], [360, 100], [360, 160], [300, 160]]); doc.selection.fill(rgb(255, 0, 0)); doc.selection.deselect();
    return JSON.stringify({ ok: true });
  `),
  );
  if (!r.ok) throw new Error('fixture creation failed: ' + JSON.stringify(r));
}

export async function closeFixture() {
  await runJsx(
    wrap(`
    for (var i = app.documents.length - 1; i >= 0; i--) {
      if (app.documents[i].name === ${JSON.stringify(FIXTURE_NAME)}) { app.documents[i].close(SaveOptions.DONOTSAVECHANGES); }
    }
    return JSON.stringify({ ok: true });
  `),
  );
}

/** Layers of the active document with visibility and whether they carry a user mask. */
export async function layerInfo() {
  const r = await runJsx(
    wrap(`
    var doc = app.activeDocument, out = [];
    for (var i = 0; i < doc.layers.length; i++) {
      var l = doc.layers[i], ref = new ActionReference();
      ref.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("hasUserMask"));
      ref.putIdentifier(charIDToTypeID("Lyr "), l.id);
      out.push({ name: l.name, visible: l.visible, hasMask: executeActionGet(ref).getBoolean(stringIDToTypeID("hasUserMask")) });
    }
    return JSON.stringify({ ok: true, name: doc.name, layers: out });
  `),
  );
  if (!r.ok) throw new Error('layerInfo failed: ' + JSON.stringify(r));
  return r;
}

/** Exports the visible layers of the active document as a transparent PNG and decodes it. */
export async function exportAndDecode() {
  const path = join(tmpdir(), `ps-studio-test-${process.pid}-${Date.now()}.png`).replace(/\\/g, '/');
  const r = await runJsx(
    wrap(`
    var o = new ExportOptionsSaveForWeb();
    o.format = SaveDocumentType.PNG; o.PNG8 = false; o.transparency = true; o.interlaced = false; o.quality = 100;
    app.activeDocument.exportDocument(new File(${JSON.stringify(path)}), ExportType.SAVEFORWEB, o);
    return JSON.stringify({ ok: true });
  `),
  );
  if (!r.ok) throw new Error('export failed: ' + JSON.stringify(r));
  try {
    return decodePng(readFileSync(path));
  } finally {
    rmSync(path, { force: true });
  }
}

/** Decodes an 8-bit, non-interlaced RGB/RGBA PNG. Returns { width, height, px(x, y) -> [r, g, b, a] }. */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8, width = 0, height = 0, depth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`unsupported PNG (depth ${depth}, colorType ${colorType}, interlace ${interlace})`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  return {
    width,
    height,
    px(x, y) {
      const i = y * stride + x * bpp;
      return [out[i], out[i + 1], out[i + 2], bpp === 4 ? out[i + 3] : 255];
    },
  };
}
