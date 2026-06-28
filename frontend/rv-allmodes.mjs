import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://localhost:4296/', { waitUntil: 'networkidle', timeout: 30000 });
await pg.waitForTimeout(2500);
const tabN = async () => (await pg.locator('[role="tab"]').count());
// synthetic
console.log('SYNTHETIC tabs:', await tabN());
// cwru
await pg.locator('button.chip', { hasText: /Real: CWRU/i }).first().click(); await pg.waitForTimeout(2000);
console.log('CWRU tabs:', await tabN());
// rul + xjtu
await pg.locator('button.chip', { hasText: /Real: RUL/i }).first().click(); await pg.waitForTimeout(1200);
await pg.selectOption('.rv-side select', 'xjtu:Bearing1_1').catch(()=>{}); await pg.waitForTimeout(2000);
const diagTitle = await pg.locator('.rv-diag .rv-diag-top .muted.small').first().innerText().catch(()=>'?');
const diagTop = await pg.locator('.rv-diag .rv-diag-top strong').first().innerText().catch(()=>'?');
console.log('RUL tabs:', await tabN(), '| diag card:', diagTitle, '→', diagTop);
await pg.screenshot({ path:'out-rv-rul-evidence.png', fullPage:false });
console.log('errors:', errs.length ? errs.join(' | ') : 'NONE');
await b.close();
