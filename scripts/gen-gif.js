'use strict';
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const GIFEncoder = require('gif-encoder-2');

const names = ['idle', 'working', 'planning', 'happy', 'sad', 'offline'];
const size = 240;
(async () => {
  const encoder = new GIFEncoder(size, size, 'octree', true, names.length);
  encoder.setRepeat(0); encoder.setDelay(850); encoder.setQuality(8); encoder.start();
  for (const name of names) {
    const file = path.join(__dirname, '..', 'preview', `whale-${name}.png`);
    const { data } = await sharp(file).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    encoder.addFrame(data);
  }
  encoder.finish();
  fs.writeFileSync(path.join(__dirname, '..', 'preview', 'deepseek-pet-demo.gif'), encoder.out.getData());
  console.log('preview/deepseek-pet-demo.gif generated');
})().catch((err) => { console.error(err); process.exitCode = 1; });
