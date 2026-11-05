import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
const [,, user, out, ...paths] = process.argv;
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
await p.goto("http://localhost:3100/login"); await p.fill('input[name=username]', user); await p.fill('input[name=password]', "Teste12345"); await p.click('button[type=submit]'); await p.waitForTimeout(2500);
for (const path of paths) { await p.goto("http://localhost:3100" + path, { waitUntil: "networkidle" }).catch(()=>{}); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${path.replace(/\W+/g,"_")}.png`, fullPage: true }); }
await b.close();
