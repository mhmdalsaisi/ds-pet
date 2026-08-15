# DeepSeek Pet

一个住在桌面角落的卡通鲸鱼桌宠，会跟着 DeepSeek Harness（DSH）的工作状态变化。

![DeepSeek Pet preview](preview/whale-idle.png)

> English UI is selected automatically from the system language. Chinese is used for other languages by default.

## Download

发布安装包会放在 GitHub Releases，而不是仓库源码目录。发布 `v0.1.0` 后，可从 [最新 Release](../../releases/latest) 下载。

| Platform | Package |
| --- | --- |
| macOS Apple Silicon | `DeepSeek-Pet-0.1.0-arm64.dmg` |
| macOS Intel | `DeepSeek-Pet-0.1.0.dmg` |
| Windows x64 | `DeepSeek-Pet Setup 0.1.0.exe` |
| Linux x64 | `DeepSeek-Pet-0.1.0.AppImage` or `.deb` |

## Features

- Follows DSH sessions through RPC polling and `/api/events.mux` WebSocket events.
- Shows working, planning, approval, complete, error, idle, sleeping and offline cartoon states.
- Four selectable looks: Classic Blue, Candy Pastel, Night Flight and Retro Pixel.
- Settings for style, sound, DSH URL, reduced motion and launch-at-login.
- When DSH is offline, the bubble can start `dsh web` and open `http://127.0.0.1:3080`.
- If `dsh` is not found, the same button attempts to install `@deepseek-ai/dsh` through the system npm, then starts it.
- Drag, poke, double-click to open DSH Web, tray controls and mouse-through mode.

## Run from source

```bash
npm install
npm start
```

DSH should normally be available at `http://127.0.0.1:3080`. You can override it with `DS_PET_URL` or from Settings.

## Build

```bash
npm run build:mac    # DMG, arm64 + x64; run on macOS
npm run build:win    # NSIS, x64; run on Windows
npm run build:linux  # AppImage + deb, x64; run on Linux
npm run build        # all configured targets on a compatible build host
```

All artifacts are written to `release/`. GitHub Actions builds each platform natively and uploads files to the tagged Release.

## Project layout

```text
main.js                 Electron main process, DSH bridge, tray and lifecycle
preload.js              contextBridge API
renderer/               pet UI, settings UI and styles
assets/                 DeepSeek SVG source and generated app/tray icons
scripts/                icon and preview generators
.github/workflows/      native multi-platform release workflow
```

## License

MIT. See [LICENSE](LICENSE).

`v0.1.0` is the first public release line: DeepSeek Pet branding, bilingual UI, four cartoon themes, settings restart flow, offline DSH launcher, and native macOS/Windows/Linux build targets.
