'use strict';
/**
 * 用 librsvg(sharp) 渲染鲸鱼各状态预览图 + ASCII 校验.
 * 每个状态注入对应的显隐规则, 验证"状态之间长得不一样".
 * 用法: node scripts/gen-preview.js
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const BASE = `
.eyes .eye{display:none}
.eyes .eye.normal{display:block}
.mouths .mouth{display:none}
.mouths .mouth.smile{display:block}
.prop{display:none}
.fx-spout{display:block}
.fx-bubbles{display:block}
`;

const STATES = {
  idle: ``,
  yawn: `.eye.normal{display:none}.eye.yawn{display:block}.mouth.smile{display:none}.mouth.yawn{display:block}`,
  sleep: `.eye.normal{display:none}.eye.closed{display:block}.mouth.smile{display:none}.mouth.flat{display:block}.prop.zzz{display:block}`,
  working: `.eye.focus{display:block}.eye.normal{display:none}.mouth.open{display:block}.mouth.smile{display:none}.prop.glasses{display:block}.prop.laptop{display:block}.prop.typing-fin{display:block}.prop.sweat{display:block}.prop.speedlines{display:block}.flipper-g{display:none}`,
  planning: `.eye.normal{display:none}.eye.focus{display:block}.mouth.smile{display:none}.mouth.flat{display:block}.prop.lamp{display:block}.prop.gears{display:block}.prop.glasses{display:block}.prop.thinking-fin{display:block}.flipper-g{display:none}`,
  awaiting: `.eye.normal{display:none}.eye.oh{display:block}.mouth.smile{display:none}.mouth.open{display:block}.prop.qbubble{display:block}`,
  excited: `.eye.normal{display:none}.eye.star{display:block}.mouth.smile{display:none}.mouth.grin{display:block}.prop.sparks{display:block}`,
  happy: `.eye.normal{display:none}.eye.happy{display:block}.mouth.smile{display:none}.mouth.grin{display:block}.prop.hearts{display:block}`,
  sad: `.eye.normal{display:none}.eye.sad{display:block}.mouth.smile{display:none}.mouth.frown{display:block}.prop.tear{display:block}.prop.cloud{display:block}`,
  confused: `.eye.normal{display:none}.eye.dizzy{display:block}.mouth.smile{display:none}.mouth.open{display:block}`,
  hungry: `.eye.normal{display:none}.eye.star{display:block}.mouth.smile{display:none}.mouth.open{display:block}.prop.fish{display:block}.prop.hungry-text{display:block}`,
  overheat: `.prop.steam{display:block}`,
  scared: `.eye.normal{display:none}.eye.big{display:block}.mouth.smile{display:none}.mouth.open{display:block}.prop.exclaim{display:block}`,
  shy: `.eye.normal{display:none}.eye.tight{display:block}.prop.shy-fin{display:block}`,
  poke: `.eye.normal{display:none}.eye.oh{display:block}.mouth.smile{display:none}.mouth.open{display:block}`,
  dragging: `.eye.normal{display:none}.eye.tight{display:block}.mouth.smile{display:none}.mouth.open{display:block}`,
  offline: `.eye.normal{display:none}.eye.dead{display:block}.mouth.smile{display:none}.mouth.flat{display:block}`,
};

(async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8');
  const svgRaw = html.match(/<svg[\s\S]*?<\/svg>/)[0];
  const outDir = path.join(__dirname, '..', 'preview');
  fs.mkdirSync(outDir, { recursive: true });

  for (const [name, rules] of Object.entries(STATES)) {
    const svg = svgRaw.replace('<defs>', `<style>${BASE}${rules}</style><defs>`);
    const out = path.join(outDir, `whale-${name}.png`);
    await sharp(Buffer.from(svg)).resize(360, 360).png().toFile(out);

    // ASCII 校验 (90 列)
    const { data, info } = await sharp(Buffer.from(svg)).resize(90, 90).raw().toBuffer({ resolveWithObject: true });
    let ascii = '';
    for (let y = 0; y < info.height; y++) {
      let line = '';
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 4;
        if (data[i + 3] < 40) { line += ' '; continue; }
        if (data[i + 2] > 120 && data[i + 2] > data[i] + 40) line += 'B';
        else if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) line += 'W';
        else if (data[i + 2] > 200 && data[i] > 200 && data[i + 1] > 120) line += 'Y';
        else if (data[i] > 180 && data[i + 1] > 120 && data[i + 1] < 190 && data[i + 2] < 150) line += 'O';
        else if (data[i] > 180 && data[i + 1] < 130 && data[i + 2] < 160) line += 'P';
        else if (data[i] < 90 && data[i + 1] < 90 && data[i + 2] < 120) line += '#';
        else line += '.';
      }
      ascii += line + '\n';
    }
    // 只打印中间区域 (有内容的行)
    const rows = ascii.split('\n').filter((l) => l.trim().length > 0);
    console.log(`\n===== [${name}] =====`);
    console.log(rows.join('\n'));
  }
  console.log('\npreviews saved to preview/whale-<state>.png');

  // 生成形态画廊页 gallery.html (浏览器打开即可查看全部形态)
  const LABELS = {
    idle: '空闲', yawn: '打哈欠', sleep: '睡觉', working: '工作', planning: '思考(计划)',
    awaiting: '等待确认', excited: '兴奋', happy: '完成', sad: '出错', confused: '困惑',
    hungry: '饥饿', overheat: '过热', scared: '惊吓', shy: '害羞', poke: '被戳',
    dragging: '拖拽', offline: '离线',
  };
  const DESC = {
    idle: '无任务：眨眼、喷水、划水', yawn: '空闲60s后：闭眼打哈欠', sleep: '打哈欠后入睡：Zzz 呼噜',
    working: '会话运行中：敲电脑+汗滴+眼镜', planning: 'plan.active：灯泡+齿轮+托腮',
    awaiting: '审批/提问：豆豆眼+问号', excited: '新任务开始：星星眼+火花',
    happy: '任务完成：转圈+爱心彩带', sad: '出错：乌云下雨+泪珠',
    confused: '连续出错：蚊香眼+歪头', hungry: '空闲1h+：小鱼干+咕~',
    overheat: '连续工作30min+：冒蒸汽', scared: '审批弹出/睡觉被戳：感叹号+弹起',
    shy: '被戳20%：捂脸+深腮红', poke: '单击：鼓腮', dragging: '拖拽中：挣扎', offline: 'DSH 未连接：死鱼眼+全灰',
  };
  const cards = Object.entries(STATES).map(([name, rules]) => {
    const svg = svgRaw.replace('<defs>', `<style>${BASE}${rules}</style><defs>`);
    return `<div class="card"><div class="svg">${svg}</div><div class="name">${LABELS[name] || name}</div><div class="desc">${DESC[name] || ''}</div></div>`;
  }).join('\n');
  const gallery = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"/><title>DeepSeek 鲸鱼桌宠 · 形态画廊</title>
<style>
  body { margin: 0; padding: 24px; background: linear-gradient(160deg,#eef2ff,#ffffff); font-family: "Microsoft YaHei", system-ui, sans-serif; color: #2b3556; }
  h1 { font-size: 22px; margin: 0 0 4px; } p { margin: 0 0 16px; color: #6b7696; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
  .card { background: #fff; border: 1.5px solid #d3dcff; border-radius: 14px; padding: 10px; text-align: center; box-shadow: 0 4px 14px rgba(40,70,200,.08); }
  .card .svg { background: radial-gradient(circle at 50% 40%, #e8eeff, #f7f9ff); border-radius: 10px; }
  .card .svg svg { width: 100%; height: auto; }
  .name { margin-top: 8px; font-weight: 700; font-size: 15px; }
  .desc { font-size: 12px; color: #6b7696; margin-top: 2px; }
</style></head>
<body><h1>🐋 DeepSeek 鲸鱼桌宠 · 全部形态</h1><p>桌宠运行时可通过托盘菜单「🎬 形态演示」循环播放；本页为静态预览。</p>
<div class="grid">
${cards}
</div></body></html>`;
  fs.writeFileSync(path.join(outDir, 'gallery.html'), gallery);
  console.log('gallery -> preview/gallery.html');
})();
