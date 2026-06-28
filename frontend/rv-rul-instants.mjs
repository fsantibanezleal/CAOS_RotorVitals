import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://localhost:4296/', { waitUntil: 'networkidle', timeout: 30000 });
await pg.waitForTimeout(2500);
await pg.locator('button.chip', { hasText: /Real: RUL/i }).first().click();
await pg.waitForTimeout(1200);
await pg.selectOption('.rv-side select', 'xjtu:Bearing1_1').catch(()=>{});
await pg.waitForTimeout(1500);
const readDiag = async () => {
  const fr = await pg.evaluate(() => document.body.innerText.match(/fr = ([\d.]+) Hz/)?.[1]);
  const diag = await pg.locator('.rv-diag .rv-diag-top strong').first().innerText().catch(()=>'?');
  const conf = await pg.locator('.rv-diag .rv-diag-top .muted.small').last().innerText().catch(()=>'?');
  const inst = await pg.evaluate(() => document.body.innerText.match(/Life instant: ([\d]+%)/)?.[1]);
  return `instant=${inst} fr=${fr}Hz diag=${diag} ${conf}`;
};
const slider = pg.locator('.rv-side input[type=range]').first(); // life-instant slider
for (const v of [1,3,5,7]) {
  await slider.evaluate((el, val) => { el.value=String(val); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }, v);
  await pg.waitForTimeout(1200);
  console.log(await readDiag());
}
console.log('errors:', errs.length ? errs.join(' | ') : 'NONE');
await b.close();
