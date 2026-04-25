'use strict';

const fs   = require('fs');
const path = require('path');

const { Resvg } = require('@resvg/resvg-js');
const { default: pngToIco } = require('png-to-ico');

const ROOT       = path.join(__dirname, '..');
const BUILD_SVG  = path.join(ROOT, 'build',  'icon.svg');
const TRAY_SVG   = path.join(ROOT, 'assets', 'tray.svg');
const BUILD_PNG  = path.join(ROOT, 'build',  'icon.png');
const TRAY_PNG   = path.join(ROOT, 'assets', 'tray.png');
const ICON_ICO   = path.join(ROOT, 'assets', 'icon.ico');

function svgToPng(svgPath, outPath, size) {
  const svg = fs.readFileSync(svgPath, 'utf8');
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  const pngData = resvg.render().asPng();
  fs.writeFileSync(outPath, pngData);
  console.log(`  wrote ${outPath} (${size}px)`);
}

async function main() {
  console.log('Generating icons…');

  svgToPng(BUILD_SVG, BUILD_PNG, 1024);
  svgToPng(TRAY_SVG,  TRAY_PNG,  32);

  // ICO needs multiple sizes; generate 256px from main icon
  const ico256Path = path.join(ROOT, 'build', 'icon-256.png');
  svgToPng(BUILD_SVG, ico256Path, 256);

  const icoBuffer = await pngToIco([ico256Path]);
  fs.writeFileSync(ICON_ICO, icoBuffer);
  console.log(`  wrote ${ICON_ICO}`);

  fs.unlinkSync(ico256Path);
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
