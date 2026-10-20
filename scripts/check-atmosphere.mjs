import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openPreview} from './browser.mjs';
const p = await openPreview({publicFonts:true});
const config = readFileSync('app/config.js','utf8').replace('idleSeconds: 60','idleSeconds: 1').replace("name: ''", "name: '<Hezaerd>'");
try {
 const page=await p.browser.newPage({viewport:{width:1920,height:1080}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:config}));
 await page.goto(p.baseURL+'/home/');await page.waitForFunction(()=>window.ShoreQA && ShoreQA.ready());
 assert.match(await page.locator('.greeting').innerText(),/Good (morning|afternoon|evening), <Hezaerd>/);
 assert.equal(await page.locator('.greeting hezaerd').count(),0);
 await page.waitForFunction(()=>ShoreQA.state().cinemaDimmed);
 await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>ShoreQA.state().cinemaDimmed),false);
 await page.evaluate(()=>ShoreQA.scene('settings'));await page.waitForTimeout(1150);assert.equal(await page.evaluate(()=>ShoreQA.state().cinemaDimmed),false);
 await page.evaluate(()=>ShoreQA.activate('settings.group.atmosphere'));
 await page.evaluate(()=>ShoreQA.activate('choice.cinema.off'));
 await page.evaluate(()=>ShoreQA.activate('choice.greeting.off'));assert.equal(await page.locator('.greeting').count(),0);
 await page.evaluate(()=>ShoreQA.activate('choice.greeting.on'));
 await page.screenshot({path:'.local/atmosphere-settings.png'});
 await page.evaluate(()=>{ShoreQA.scene('settings');ShoreQA.activate('settings.group.background');ShoreQA.activate('background.collections');});
 await page.evaluate(()=>ShoreQA.activate('choice.collection.coasts'));await page.waitForFunction(()=>ShoreQA.ready());
 assert.equal(await page.evaluate(()=>ShoreQA.state().wall),'misty');
 assert.equal(await page.evaluate(()=>ShoreQA.state().collection),'coasts');
 await page.screenshot({path:'.local/collections-settings.png'});
 for(const viewport of [{width:1920,height:1080},{width:1280,height:720}]) {
   await page.setViewportSize(viewport);
   await page.waitForFunction(w=>Math.abs(document.getElementById("stage").getBoundingClientRect().width-w)<1,viewport.width);
   for(const group of ['background','atmosphere','collections']) {
     await page.evaluate(group=>{ShoreQA.scene('settings');ShoreQA.activate('settings.group.'+(group==='collections'?'background':group));if(group==='collections')ShoreQA.activate('background.collections');},group);
     const boxes=await page.locator('#appearanceRows [data-action]').evaluateAll(els=>els.map(e=>{const b=e.getBoundingClientRect();return {bottom:b.bottom,right:b.right};}));
     assert.ok(boxes.every(b=>b.bottom<viewport.height-40 && b.right<=viewport.width),JSON.stringify({group,viewport,boxes}));
   }
 }
 await page.setViewportSize({width:1920,height:1080});
 await page.evaluate(()=>ShoreQA.scene('home'));
 await page.evaluate(()=>ShoreQA.look({wall:'cove'}));await page.waitForFunction(()=>ShoreQA.state().crossfading);
 assert.equal(await page.locator('.wallpaper-outgoing').count(),1);
 await page.waitForFunction(()=>!ShoreQA.state().crossfading);
 await page.screenshot({path:'.local/atmosphere-home.png'});
 await page.reload();await page.waitForFunction(()=>window.ShoreQA && ShoreQA.ready());
 assert.equal(await page.evaluate(()=>ShoreQA.state().cinema),'off');assert.equal(await page.evaluate(()=>ShoreQA.state().collection),'coasts');
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.ShoreQA && ShoreQA.ready());
 await page.evaluate(()=>ShoreQA.look({wall:'golden'}));await page.waitForFunction(()=>ShoreQA.ready());assert.equal(await page.locator('.wallpaper-outgoing').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Atmosphere: idle wake, settings pause, escaped greeting, collections, viewport fit, crossfade cleanup, persistence and reduced motion passed.');
} finally {await p.close();}
