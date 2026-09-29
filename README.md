# Local JSON Editor

A local, two-panel JSON editor built on [vanilla-jsoneditor](https://github.com/josdejong/svelte-jsoneditor), with a resizable splitter to copy content between panels and a built-in curl executor for pulling API responses straight into an editor. Available as a macOS desktop app (Electron) or a local web app (Vite).

## Install (macOS app)

1. Download the latest `Local JSON Editor-x.y.z-arm64.dmg` from the `release/` folder (or wherever it was shared with you).
2. Open the `.dmg` and drag **Local JSON Editor** into **Applications**.
3. The app is unsigned, so macOS Gatekeeper will block the first launch with an "unidentified developer" warning. To open it:
   - Right-click (or Control-click) the app in **Applications** → **Open** → **Open** again in the confirmation dialog.
   - You only need to do this once; after that it opens normally.

## Run from source

Requires [Node.js](https://nodejs.org/) 18+ and npm.

```bash
git clone <this repo>
cd LocalJsonParser
npm install
```

### Desktop app (Electron)

```bash
npm run electron:dev
```

Runs the Vite dev server and opens the app in an Electron window with hot reload.

### Web app (browser)

```bash
npm run dev
```

Opens a local dev server (default `http://localhost:5173`). Functionally the same as the desktop app, including the curl executor — it's routed through a small Vite dev-server proxy instead of Electron's IPC.

> The curl executor only works when the app is served by `vite`/`vite preview` or by the Electron app. It won't work if `dist/` is deployed to a static host with no Node server behind it.

## Build a release DMG

```bash
npm run electron:build
```

Produces `Local JSON Editor-<version>-arm64.dmg` in `release/`. This targets macOS (arm64) as configured in `package.json`'s `build` field.

If code signing fails with an "ambiguous identity" error (duplicate certificates in your keychain), build unsigned instead:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run electron:build
```

## Other scripts

| Script | Description |
| --- | --- |
| `npm run build` | Type-check and build the web assets to `dist/` |
| `npm run preview` | Preview the production web build locally |
