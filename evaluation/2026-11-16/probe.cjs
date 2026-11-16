const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const page=await browser.newPage({serviceWorkers:'block'});
 page.on('pageerror',e=>console.log('PAGEERROR',e.message));
 page.on('console',m=>{if(m.type()==='warning'||m.type()==='error') console.log(m.type(),m.text().slice(0,600));});
 await page.goto('http://localhost:5189/');
 const result=await page.evaluate(async()=>{
  let c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d').fillRect(0,0,256,256);
  const r=await FIT_DETECTOR.analyzeFoodImage(c.toDataURL());delete r.previewUrl;return {state:FIT_DETECTOR.getState(),result:r};
 });
 console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
