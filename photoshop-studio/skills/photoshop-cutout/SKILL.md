---
name: photoshop-cutout
description: How to cut an object out of an image or remove a background in Photoshop via MCP, choosing the method that works (native Remove Background vs polygon + Color Range) and avoiding the approaches that fail. Use for "cut out", "remove background", "isolate", "extract", "transparent PNG".
---

# Cutout and background removal

Read `photoshop-basics` first. Reply in the user's language.

## Decide the intent first (the photoshop MCP server has its own hard rule)
The server instructs: for "remove background / cut out the subject / isolate / transparent background" call `photoshop_get_state`, then `photoshop_recipe_remove_background` once, then `photoshop_get_preview` once, and STOP; do not rasterize, duplicate, select_subject, mask or script around it, and if the recipe errors report the error instead of inventing a workaround. Follow that rule for the **whole-subject** intent.

The recipe cannot be told which object to keep, so it is the wrong tool only when the user explicitly names **one specific object among several** (e.g. "cut out the blue book, not the boy"). That is a different intent, and only then use the polygon workflow below. If unsure which intent applies, run the recipe first, look at the preview, and switch only if it kept the wrong thing.

## Pick the method
| Request | Method |
|---|---|
| Remove the background around the main subject (portrait, product) | `photoshop_recipe_remove_background` (one call, non-destructive layer mask, one undo). Do not rebuild it by hand. |
| Extract ONE specific object from a busy image (character, item among others) | Polygon + copy to new layer + Color Range cleanup (below) |
| Add a white sticker border after the cutout | `photoshop_recipe_sticker_outline` |

## Methods that FAILED in testing (do not retry them)
- **Magic wand (Action Manager) on a stippled / textured fill**: selected only the dark outline pixels. Fine for flat colors only.
- **`photoshop_select_subject` on a layer that was already cut out**: selects the whole layer content, so it removes nothing.
- **`photoshop_recipe_remove_background` on a roughly cropped layer**: treated the whole crop as the subject, the mask stayed full. Native removal decides what "the subject" is; it cannot be told which of several objects to keep.

## Preferred: the `ps_cutout_polygon` tool (server `studio-tools` of this plugin)
It runs the verified workflow below in one call, works on a duplicate (the source is never changed), is idempotent, recovers from hint popups itself, and returns `ok:false` (with everything rolled back) when the result would be empty.
- `points`: closed outline `[[x,y],...]` in image pixels; `name`; `mode`: `mask` (default, non-destructive) or `pixels`; `source_layer` (pass it when the active layer is a previous result, e.g. `"Background"`); `cleanup`: Color Range presets of the BACKGROUND, e.g. `[{"color":"Ylws","fuzziness":100},{"color":"Rds ","fuzziness":100},{"color":"Grns","fuzziness":80}]`; `passes` (1-8, default 3: how many times the cleanup list is applied); `hide_source` (default true).
- Measured on a real image (blue book on a yellow/orange/green illustration), warm fringe left: no cleanup 6.1%, 1 pass 4.1%, 2 passes 2.8%, 4 passes 1.3%. Fuzziness above ~60 made no difference; extra PASSES are what help. Presets only catch saturated hues: dark olive remnants of a green shirt and a thin pale rim can remain, so tighten the polygon near such areas and always look at the result.
- Then export with `photoshop_export_as` (PNG, source hidden).
Fall back to the manual steps below only if the tool is unavailable.

## Workflow: extract one specific object (manual, verified)
1. **Locate it.** Take a screenshot or `photoshop_get_preview`; with the document size known, estimate the outline as image-pixel coordinates. Include limbs/handles that belong to the object.
2. **Polygon selection + new layer**, in one `photoshop_execute_script`:
```javascript
var doc = app.activeDocument;
doc.activeLayer = doc.backgroundLayer; doc.selection.deselect();
var P = [[x1,y1],[x2,y2] /* ...closed outline, clockwise... */];
doc.selection.select(P, SelectionType.REPLACE, 0, true);   // true = anti-alias
doc.selection.copy(); var l = doc.paste(); l.name = "Cutout";
if (doc.backgroundLayer.visible) doc.backgroundLayer.visible = false;
doc.selection.deselect();
return "layers:" + doc.layers.length;
```
3. **Look at it** on the transparency grid. Expect leftover background slivers along the polygon edge where it was generous.
4. **Remove leftover background colors with Color Range presets that match the BACKGROUND, not the object** (e.g. yellow/orange sand and sky, a green shirt around a blue/purple book):
```javascript
var doc = app.activeDocument;
doc.activeLayer = doc.layers.getByName("Cutout"); doc.selection.deselect();
function cr(code, fuzz) {            // codes: "Rds ", "Ylws", "Grns", "Cyns", "Bls ", "Mgnt"
  var d = new ActionDescriptor();
  d.putEnumerated(charIDToTypeID("Clrs"), charIDToTypeID("Clrs"), charIDToTypeID(code));
  d.putInteger(charIDToTypeID("Fzns"), fuzz);
  executeAction(charIDToTypeID("ClrR"), d, DialogModes.NO);
  doc.selection.clear(); doc.selection.deselect();
}
cr("Ylws", 40); cr("Rds ", 40);     // gentle first pass
return "ok";
```
   A pass at fuzz 40 leaves semi-transparent leftovers; a second pass at 80-100 clears most of them but can soften thin edges. Never use a preset that matches the object's own colors.
5. **Check on a contrasting backdrop** (temporarily add a solid dark or bright layer under the cutout) to spot halos. If the user wants cleaner edges: `photoshop_contract_selection` 1 px + `photoshop_feather_selection` 1 px.
6. **Export**: background hidden, `photoshop_export_as` PNG to a NEW path, plus an optional PSD.

If the user may want to refine the edge later, make a **layer mask from the polygon selection** (`photoshop_create_layer_mask`) instead of deleting pixels with `clear()`.

## Honest limits
Color-range cleanup gives a rough edge: it cannot separate an object from background of the same color family. Say so, show the result, and offer a manual refinement round instead of claiming a perfect cut.
