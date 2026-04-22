# Dragon Block Adventure

A kid-friendly, Minecraft-like **3D** browser game with blocky platforms, a friendly dragon statue, and golden coins.

Three.js is loaded from a pinned **CDN import map** in `index.html`, so you do **not** need a `vendor/` folder or a bundler for preview or production static hosting.

## Preview inside Cursor (recommended)

1. Install the **Live Preview** extension when Cursor prompts you (see `.vscode/extensions.json`), or install **`ms-vscode.live-preview`** from the Extensions view.
2. Command Palette (**Cmd+Shift+P** / **Ctrl+Shift+P**) → **“Live Preview: Show Preview (Internal Browser)”** (or **Show Preview**).
3. Open **`index.html`** from the file tree, then use the Live Preview “show preview” command if needed.

The game should load **inside a Cursor panel**. You need network access once so the CDN can load Three.js. Click **Play**, then use the mouse and wheel as usual.

**Alternative:** Run **`npm run dev`**, then use the **Ports** view; port **5173** is set to prefer **`openPreview`** when the editor forwards it.

## Features

- First-person 3D world built with [Three.js](https://threejs.org/).
- **Mouse** — click **Play**, then move the mouse to look around (pointer lock).
- **Mouse wheel** — roll to walk forward or backward across grass blocks and gaps.
- **Left click** or **Space** — jump onto higher platforms and over obstacles.
- Collect **20 coins** to win (extra coins are hidden around the course).
- Optional **W** / **S** keys for forward and back if the wheel feels tricky.

## Run locally (optional static server)

```bash
npm run dev
```

Then open `http://127.0.0.1:5173` and click **Play**.

## Build for production

```bash
npm run build
```

Output is in `dist/` (same `index.html` + `src/` layout as the repo root).

## Deploy with GitHub + Netlify

Repository: [learn-burn-code-123/minecraft-like-game](https://github.com/learn-burn-code-123/minecraft-like-game)

1. Push this project to GitHub (see remote above).
2. In Netlify: **Add new site** → **Import from Git** → pick the repo.
3. Build command: `npm run build`  
4. Publish directory: `dist`

`netlify.toml` sets these automatically. Netlify’s build image includes Node.js, so the copy-only build runs without extra dependencies.
