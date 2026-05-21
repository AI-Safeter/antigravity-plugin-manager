---
name: tauri-desktop
description: Tauri 2 for cross-platform desktop and mobile apps with a Rust backend and a web frontend (any JS framework). Covers project structure, IPC commands with
---

# Tauri Desktop

Tauri 2 builds desktop and mobile apps using a Rust core and a web-based UI rendered in the OS's native webview (WebView2 on Windows, WebKit on macOS/iOS, WebKitGTK on Linux). Bundles are usually 3-10 MB versus 80-150 MB for Electron because no Chromium is shipped.

## Use this skill when

- Scaffolding a new Tauri 2 app with `npm create tauri-app@latest`
- Exposing a Rust function to the web frontend via `#[tauri::command]`
- Configuring `tauri.conf.json` for bundle id, icons, windows, and signing
- Granting capabilities and permissions to specific windows
- Adding official plugins (fs, dialog, http, sql, store, updater)
- Building and signing for Windows MSI, macOS DMG, Linux AppImage/deb, iOS, or Android

## Do not use this skill when

- The team has a hard requirement on Chromium-only features unavailable in Edge/WebKit
- You need Electron-specific APIs and a large existing Electron codebase the team won't migrate
- You are building a pure web app with no native shell

## Core concepts

A Tauri app has two halves: `src-tauri/` (Rust, becomes the binary) and a frontend folder (`src/`, `web/`, etc., your bundled HTML/JS). They communicate via IPC: the frontend calls `invoke("cmd_name", { args })` and Rust replies. The capability system whitelists which windows can call which commands and plugins.

## Quick start

```bash
npm create tauri-app@latest my-app
cd my-app && npm install
npm run tauri dev
npm run tauri build
```

```rust
// src-tauri/src/lib.rs
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}!")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```ts
// src/main.ts
import { invoke } from "@tauri-apps/api/core";
const msg = await invoke<string>("greet", { name: "Ada" });
console.log(msg);
```

```json
// src-tauri/tauri.conf.json (abbreviated)
{
  "productName": "MyApp",
  "identifier": "com.example.myapp",
  "build": { "frontendDist": "../dist", "devUrl": "http://localhost:5173" },
  "app": {
    "windows": [{ "title": "MyApp", "width": 1000, "height": 700 }],
    "security": { "csp": "default-src 'self'" }
  },
  "bundle": { "active": true, "targets": "all", "icon": ["icons/icon.png"] }
}
```

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": ["core:default", "dialog:allow-open", "fs:read-files"]
}
```

## Key patterns

### IPC commands
Annotate Rust functions with `#[tauri::command]`. Arguments and return types must be `serde::Serialize`/`Deserialize`. Use `Result<T, String>` (or a custom error) to surface failures to the frontend as rejected promises.

### State management
`tauri::Builder::default().manage(MyState::default())` then accept `State<'_, MyState>` in a command to share Rust state across calls.

### Events
`app.emit("download-progress", payload)?` from Rust, `listen("download-progress", e => ...)` from JS, for streaming updates the IPC return value can't model.

### Capabilities and permissions
Capabilities scope which windows can invoke which permissions. Permissions ship with each plugin; you opt in explicitly. This replaces Tauri 1's flat allowlist.

### Plugins
Official plugins: `fs`, `dialog`, `http`, `shell`, `sql`, `store`, `notification`, `updater`, `clipboard-manager`. Install with `cargo add tauri-plugin-x` and `npm add @tauri-apps/plugin-x`.

### Bundling and signing
`tauri build` produces installers per OS. Configure code signing via env vars (`APPLE_CERTIFICATE`, `WINDOWS_CERTIFICATE`) or `signingIdentity` in config.

## Common pitfalls

- Forgetting to register a command in `tauri::generate_handler![...]`; the call rejects with `Command not found`.
- Granting `fs:default` instead of a scoped permission; this opens broad filesystem access.
- Mixing Tauri 1 and Tauri 2 APIs and plugins (`@tauri-apps/api` major changed).
- Hardcoding `http://localhost:5173` and shipping it; use `devUrl` for dev and `frontendDist` for prod.
- Returning non-serializable types from commands; everything must be JSON via serde.
- Ignoring CSP and loading remote scripts that the webview blocks.
- Building on the wrong host: cross-compiling to macOS from Linux is not supported; use a Mac runner.

## Reference

- Official docs: https://tauri.app/
- Plugin index: https://tauri.app/plugin/
- Related: [[remotion-video]]
