#!/usr/bin/env node
// photoshop-studio-tools: high-level, tested Photoshop tools (Windows, COM). Complements the generic photoshop MCP server.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { COLOR_PRESETS, buildCutoutScript } from './jsx.mjs';
import { dismissPopup, runJsx } from './ps.mjs';

// These instructions reach every MCP client (Claude Desktop, Claude Code, ...), also where plugin skills are not available.
const INSTRUCTIONS = [
  'photoshop-studio-tools: tested high-level Photoshop tools (Windows). Complements the generic photoshop MCP server.',
  '',
  '- ps_cutout_polygon cuts ONE specific object out of the active document by a polygon in image pixels (origin top-left).',
  '  For removing the background around the MAIN subject (portrait, product) use photoshop_recipe_remove_background of the photoshop server instead.',
  '  Cleanup presets must match the BACKGROUND colours, never the object. Use passes 3-4: each pass removes pastel fringe further; fuzziness above ~60 changes little.',
  '- Never trust "ok" alone: look at the result (photoshop_get_preview) before telling the user it worked.',
  '- If EVERY Photoshop call fails with "General Photoshop error", a hint popup or dialog is open: call ps_unstick, then retry.',
  '  To prevent it, turn off Window > Contextual Task Bar in Photoshop (ask the user first, it changes a Photoshop setting).',
  '- Custom ExtendScript must set app.displayDialogs = DialogModes.NO (otherwise an error opens a modal dialog that blocks all later calls),',
  '  must be idempotent, and must never set layer.visible to the value it already has.',
  '- Never quit Photoshop or close documents with unsaved work without asking.',
].join('\n');

const server = new McpServer({ name: 'photoshop-studio-tools', version: '0.1.0' }, { instructions: INSTRUCTIONS });

const asText = (obj, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }],
  isError,
});

server.registerTool(
  'ps_cutout_polygon',
  {
    title: 'Cut out one object by polygon',
    description:
      'Cuts ONE specific object out of the active document by a closed polygon given in image pixels. ' +
      'Use this when the user names a single object among several ("cut out the blue book, not the boy"). ' +
      'For removing the background around the main subject use photoshop_recipe_remove_background instead. ' +
      'Works on a duplicate, so the source layer is never modified. Returns the new layer name and bounds. ' +
      'mode "mask" (default) adds a non-destructive layer mask, edges stay editable. ' +
      'mode "pixels" deletes everything outside the polygon instead (destructive, on the duplicate). ' +
      'In both modes `cleanup` removes leftover background colors with Color Range passes (painted black on the mask, or deleted); ' +
      'the presets must match the BACKGROUND colors, never the object. ' +
      'Get coordinates from photoshop_get_document_info (size) and a preview/screenshot. Idempotent: an existing layer with the same name is replaced.',
    inputSchema: {
      points: z
        .array(z.tuple([z.number(), z.number()]))
        .min(3)
        .describe('Closed outline [[x,y], ...] in image pixels, origin top-left, clockwise. Include limbs/handles of the object.'),
      name: z.string().min(1).default('Cutout').describe('Name of the resulting layer'),
      mode: z.enum(['mask', 'pixels']).default('mask'),
      source_layer: z.string().optional().describe('Layer to cut from; defaults to the active layer'),
      cleanup: z
        .array(z.object({ color: z.enum(COLOR_PRESETS), fuzziness: z.number().int().min(0).max(200).default(40) }))
        .optional()
        .describe('Color Range presets of the BACKGROUND to remove, e.g. [{"color":"Ylws","fuzziness":40}]'),
      passes: z
        .number()
        .int()
        .min(1)
        .max(8)
        .default(3)
        .describe('How many times the cleanup list is applied. Pastel fringe pixels are only partly selected per pass; on the test image 1 pass left 4.1% warm fringe, 2 passes 2.8%, 4 passes 1.3%. Ignored without cleanup.'),
      hide_source: z.boolean().default(true).describe('Hide the source layer so the cutout shows on transparency'),
    },
  },
  async (args) => {
    let code;
    try {
      code = buildCutoutScript({
        points: args.points,
        name: args.name,
        mode: args.mode,
        sourceLayer: args.source_layer,
        cleanup: args.cleanup,
        passes: args.passes,
        hideSource: args.hide_source,
      });
    } catch (e) {
      return asText({ ok: false, error: String(e.message ?? e) }, true);
    }
    const result = await runJsx(code);
    return asText(result, result.ok === false);
  },
);

server.registerTool(
  'ps_unstick',
  {
    title: 'Close Photoshop hint popups',
    description:
      'Closes a Photoshop hint popup/tooltip that makes every scripting call fail with "General Photoshop error". ' +
      'The other tools of this server call it automatically on that error; use it manually for the generic photoshop_* tools.',
    inputSchema: {},
  },
  async () => asText({ ok: true, output: await dismissPopup() }),
);

await server.connect(new StdioServerTransport());
