// Exercise the unmodified app in actual Chrome with its bundled ONNX WASM runtime.
const {chromium}=require('playwright-core');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=__dirname;
const app=path.resolve(root,'../../FitApp');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const compact=r=>({provider:r.provider,inferenceMs:r.inferenceMs,isNonFood:r.isNonFood,results:r.results.map(v=>({id:v.food.id,name:v.food.name,confidence:v.confidence,cosine:v.cosine}))});
(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const result={date:'2026-11-16',browser:browser.version(),node:process.version,modelSha256:hash(path.join(app,'models/food_vision_fp16.onnx')),detectorSha256:hash(path.join(app,'js/detector.js')),embeddingsSha256:hash(path.join(app,'js/food_embeddings.js')),samples:[],diagnostics:[],errors:[]};
 try {
  const normal=await browser.newPage({serviceWorkers:'block'});
  const fallback=await browser.newPage({serviceWorkers:'block'});
  await fallback.route('**/*.onnx',route=>route.abort());
  for(const p of [normal,fallback])await p.goto('http://localhost:5189/');
  const infer=async(p,url)=>{
   const t=performance.now();
   const r=await p.evaluate(async u=>{const r=await FIT_DETECTOR.analyzeFoodImage(u);delete r.previewUrl;return r;},url);
   return {...compact(r),wallMs:performance.now()-t};
  };
  // Exclude one explicit warm-up from benchmark timings.
  await normal.evaluate(async()=>{let c=document.createElement('canvas');c.width=c.height=256;return FIT_DETECTOR.analyzeFoodImage(c.toDataURL());});
  for(const s of manifest.samples){
   try{
    const url='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,s.path)).toString('base64');
    const onnx=await infer(normal,url);
    if(onnx.provider!=='onnx')throw Error('Unexpected fallback during neural benchmark');
    const heuristic=await infer(fallback,url);
    if(heuristic.provider!=='heuristic')throw Error('Expected forced fallback');
    result.samples.push({id:s.id,group:s.group,label:s.label,expected:s.expected,sha256:s.sha256,onnx,heuristic});
   }catch(e){result.errors.push({id:s.id,error:e.message});}
   if((result.samples.length+result.errors.length)%40===0){
    fs.writeFileSync(path.join(root,'results.partial.json'),JSON.stringify(result,null,2));
    console.log('evaluated',result.samples.length,'errors',result.errors.length);
   }
  }
  for(const color of ['black','white','red','lime','blue','yellow','orange','#808080']){
   const url=await normal.evaluate(color=>{let c=document.createElement('canvas');c.width=c.height=256;let x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,256,256);return c.toDataURL();},color);
   result.diagnostics.push({id:'solid_'+color,type:'synthetic_nonfood',onnx:await infer(normal,url),heuristic:await infer(fallback,url)});
  }
  for(const name of fs.readdirSync(path.join(app,'assets/muscles')).sort()){
   const url='data:image/png;base64,'+fs.readFileSync(path.join(app,'assets/muscles',name)).toString('base64');
   result.diagnostics.push({id:'muscle_'+name,type:'anatomical_illustration_nonfood',onnx:await infer(normal,url),heuristic:await infer(fallback,url)});
  }
  result.runtime=await normal.evaluate(()=>({state:FIT_DETECTOR.getState(),isolated:crossOriginIsolated,threads:ort.env.wasm.numThreads,userAgent:navigator.userAgent}));
  fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(result,null,2));
  console.log('COMPLETE',result.samples.length,'diagnostics',result.diagnostics.length,'errors',result.errors.length);
  if(result.errors.length)process.exitCode=1;
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
