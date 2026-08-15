# DeepSeek Pet

卡通风格的 DeepSeek Harness（DSH）桌面宠物。

![DeepSeek Pet demo](preview/deepseek-pet-demo.gif)

## 下载

前往 [Releases](https://github.com/zhaoryder/ds-pet/releases/latest) 下载对应平台安装包。

- macOS：Apple Silicon / Intel
- Windows：x64 `.exe`
- Linux：x64 `.AppImage` / `.deb`

## 功能

- 实时显示 DSH 会话状态
- 工作、思考、等待确认、完成、错误、睡眠和离线动画
- 经典蓝鲸、软糖、夜航、像素四种风格
- 设置音效、风格、DSH 地址、减少动效和开机启动
- DSH 离线时可直接启动或安装 DSH
- 拖拽、点击互动、托盘菜单和鼠标穿透
- 根据系统语言自动选择中文或英文界面

## 运行

```bash
npm install
npm start
```

默认连接 `http://127.0.0.1:3080`。

## 构建

```bash
npm run build:mac
npm run build:win
npm run build:linux
```

GitHub Actions 会在 Windows、macOS 和 Ubuntu runner 上分别构建安装包，并自动发布到 Release。

## 许可证

MIT License，见 [LICENSE](LICENSE)。
