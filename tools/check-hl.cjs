const puppeteer = require('/sandbox/workspace/.devtools/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath:'/sandbox/workspace/.devtools/chrome-headless-shell-linux64/chrome-headless-shell', headless:true, args:['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 900, height: 700, deviceScaleFactor: 2 });
  await p.goto('file:///sandbox/workspace/md-studio-electron/renderer/index.html', { waitUntil:'load' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil:'load' });
  await sleep(4000);
  const r = await p.evaluate(() => {
    const lines = [...document.querySelectorAll('.cm-line')];
    const pick = (idx) => {
      const ln = lines[idx];
      if (!ln) return null;
      return {
        text: ln.textContent.slice(0, 24),
        spans: [...ln.querySelectorAll('span')].map(s => ({
          cls: s.className,
          color: getComputedStyle(s).color,
          weight: getComputedStyle(s).fontWeight,
          bg: getComputedStyle(s).backgroundColor
        })).slice(0, 4)
      };
    };
    return {
      lineCount: lines.length,
      line0: pick(0),   // # 标题
      line2: pick(2),   // 正文含粗体
      line6: pick(6),   // 行内代码或列表
      head: [...document.querySelectorAll('style')].map(s => (s.textContent||'').slice(0,60)).slice(-2)
    };
  });
  console.log(JSON.stringify(r, null, 1).slice(0, 2500));
  const el = await p.$('#editor');
  await el.screenshot({ path: '/sandbox/workspace/md-studio-electron/tools/shot-hl.png' });
  await b.close();
})();
