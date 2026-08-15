# DeepSeek Pet

A cartoon desktop pet for DeepSeek Harness (DSH).

![DeepSeek Pet demo](preview/deepseek-pet-demo.gif)

## Download

Download the latest installer from [GitHub Releases](https://github.com/zhaoryder/ds-pet/releases/latest).

- macOS: Apple Silicon / Intel
- Windows: x64 `.exe`
- Linux: x64 `.AppImage` / `.deb`

## Features

- Live DSH session status
- Working, planning, approval, complete, error, sleeping and offline animations
- Four looks: Classic Blue, Candy Pastel, Night Flight and Retro Pixel
- Settings for sound, style, DSH URL, reduced motion and launch at login
- Start or install DSH when it is offline
- Dragging, poke interaction, tray menu and mouse-through mode
- Automatic Chinese or English UI based on the system language

## Run from source

```bash
npm install
npm start
```

The default DSH address is `http://127.0.0.1:3080`.

## Build

```bash
npm run build:mac
npm run build:win
npm run build:linux
```

GitHub Actions builds native installers on Windows, macOS and Ubuntu, then publishes them to Releases.

## License

MIT License. See [LICENSE](LICENSE).
