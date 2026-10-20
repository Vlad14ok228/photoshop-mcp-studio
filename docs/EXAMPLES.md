# Example requests

Start Photoshop first. These work in Claude Code and Claude Desktop.

**Background removal (main subject)**
> Open `C:\Pictures\portrait.jpg` in Photoshop, remove the background and save a transparent PNG next to it as `portrait_cutout.png`.

Claude uses `photoshop_recipe_remove_background` (one call, non-destructive mask).

**Cut out one object among several**
> In the open image, cut out only the blue book (not the boy). Show me the result on a dark background.

Claude estimates the outline, calls `ps_cutout_polygon` with Color Range cleanup (`passes` 3–4) and checks the preview.

**Documents, text and layers**
> Create a 1080x1080 document, fill it with #1E90FF and add the text "SALE" in white, 120 pt, centered.

**Inspecting**
> List the layers of the open document and tell me which ones are hidden.

**Export**
> Export the active document as WebP at quality 80 to `C:\out\banner.webp`.

Tips
- Say where files should be saved and use new file names.
- Ask Claude to show a preview after important steps.
- If Photoshop stops responding to every call, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
