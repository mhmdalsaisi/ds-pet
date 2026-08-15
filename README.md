# DeepSeek Pet

English · [简体中文](README.zh-CN.md)

[![Release](https://img.shields.io/github/v/release/zhaoryder/ds-pet?display_name=tag)](https://github.com/zhaoryder/ds-pet/releases/latest)
[![Build](https://github.com/zhaoryder/ds-pet/actions/workflows/build.yml/badge.svg)](https://github.com/zhaoryder/ds-pet/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A small cartoon whale that lives on your desktop and reacts to DeepSeek Harness (DSH) sessions in real time.

<p align="center">
  <img src="preview/deepseek-pet-demo.gif" width="360" alt="DeepSeek Pet switching between session states">
</p>

## Download

Get the latest installer from [GitHub Releases](https://github.com/zhaoryder/ds-pet/releases/latest).

| Platform | Package |
| --- | --- |
| macOS Apple Silicon | `DeepSeek-Pet-0.1.1-mac-arm64.dmg` |
| macOS Intel | `DeepSeek-Pet-0.1.1-mac-x64.dmg` |
| Windows x64 | `DeepSeek-Pet-0.1.1-windows-x64.exe` |
| Linux x64 | `.AppImage` or `.deb` |

### Installing on macOS

The macOS build is structurally signed but not Apple-notarized, so macOS may block its first launch. Follow these steps:

1. Open the downloaded `.dmg` and drag **DeepSeek Pet** into the **Applications** folder.
2. Open **Applications** and try to launch **DeepSeek Pet** once. If macOS blocks it, close the warning.
3. Open **System Settings** from the Apple menu.
4. Select **Privacy & Security** in the sidebar, then scroll down to the **Security** section.
5. Find the message saying that **DeepSeek Pet was blocked** and click **Open Anyway**.
6. Authenticate with Touch ID or your Mac password, then click **Open Anyway** again in the confirmation dialog.

You only need to do this for the first launch. If macOS instead says that the app is damaged, make sure it is already in **Applications**, open **Terminal**, and run:

```bash
xattr -d com.apple.quarantine "/Applications/DeepSeek Pet.app"
```

Then open **DeepSeek Pet** again from **Applications**.

### Installing on Windows with Microsoft Edge

Windows and Microsoft Edge may warn about the installer because it does not yet have a commercial code-signing certificate. If Edge blocks the download:

1. Open Edge's **Downloads** panel by clicking the download icon in the top-right corner, or press `Ctrl+J`.
2. Find the blocked **DeepSeek Pet** installer and click **Keep**.
3. Click the arrow or **Show more** next to the warning, then choose **Keep anyway**.
4. Open the downloaded `.exe`. If Microsoft Defender SmartScreen appears, click **More info**, then **Run anyway**.

Only continue if the file was downloaded from this repository's official [GitHub Releases](https://github.com/zhaoryder/ds-pet/releases/latest) page.

## What it does

- Mirrors working, planning, approval, completion, error, sleep, and offline states from DSH.
- Includes Classic Blue, Candy Pastel, Night Flight, and Retro Pixel styles.
- Supports sound, reduced motion, launch at login, drag, poke, tray controls, and mouse-through mode.
- Can start `dsh web`; if DSH is missing, it can install `@deepseek-ai/dsh` with npm.
- Selects English or Chinese from the system language.

## Requirements

- Windows 10/11, macOS, or a modern x64 Linux desktop
- [Node.js](https://nodejs.org/) when installing DSH from the app
- DSH Web at `http://127.0.0.1:3080` by default

## Run from source

```bash
npm install
npm start
```

Use `DS_PET_URL` or the settings window to connect to another DSH address.

## Build

```bash
npm run build:mac
npm run build:win
npm run build:linux
```

Tagged releases are built natively on macOS, Windows, and Ubuntu by [GitHub Actions](.github/workflows/build.yml).

## License

[MIT](LICENSE) © 2026 zhaoryder.
