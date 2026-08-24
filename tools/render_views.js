// Renderiza um .glb em N ângulos com fundo transparente -> PNGs para o mapa 2D
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [glbUrl, outDir, prefix] = process.argv.slice(2);
  // theta por direção: 200 = frente do modelo (olhando pra câmera)
  const DIRS = { down: 200, right: 290, up: 20, left: 110 };
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 420 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8777/_render.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!customElements.get('model-viewer'), { timeout: 60000 });
  await page.evaluate(u => document.getElementById('mv').src = u, glbUrl);
  await page.waitForFunction(() => { const m = document.getElementById('mv'); return m && m.loaded; }, { timeout: 60000 });
  for (const [dir, theta] of Object.entries(DIRS)) {
    await page.evaluate(t => { document.getElementById('mv').cameraOrbit = `${t}deg 76deg 100%`; }, theta);
    await page.waitForTimeout(1200);
    const el = await page.$('#mv');
    await el.screenshot({ path: `${outDir}/${prefix}-${dir}.png`, omitBackground: true });
    console.log(dir, theta, 'ok');
  }
  await browser.close();
})();
