import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
await p.goto("http://localhost:3100/login"); await p.fill('input[name=username]', "ruan.carlos"); await p.fill('input[name=password]', "Teste12345"); await p.click('button[type=submit]'); await p.waitForTimeout(2500);
await p.goto("http://localhost:3100/atender"); await p.click('text=Shufflar >> nth=-1'); await p.waitForTimeout(4000);
await p.screenshot({ path: "/tmp/shots/f0.png", fullPage: true });
for (const [i,n] of [[1,"f1"],[4,"f4"]]) { await p.click('ol button >> nth='+i); await p.waitForTimeout(700); await p.screenshot({ path: "/tmp/shots/"+n+".png", fullPage: true }); }
await b.close();
