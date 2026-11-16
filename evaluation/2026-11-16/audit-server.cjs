const {spawn}=require('node:child_process');
const path=require('node:path');
const http=require('node:http');
const fs=require('node:fs');
const app=path.resolve(__dirname,'../../FitApp');
const child=spawn(process.execPath,[path.join(app,'server.js')],{env:{...process.env,PORT:'5190',NO_OPEN:'1'},windowsHide:true});
const result={stderr:'',stdout:''};
let sent=false;
const timeout=setTimeout(()=>child.kill(),10000);
child.stdout.on('data',data=>{
 result.stdout+=data;
 const match=result.stdout.match(/Desktop\s*:\s*(http:\/\/localhost:\d+)/);
 if(match&&!sent){sent=true;http.get(match[1]+'/%E0%A4%A',res=>{result.responseStatus=res.statusCode;res.resume();}).on('error',e=>result.requestError=e.code);}
});
child.stderr.on('data',data=>result.stderr+=data);
child.on('exit',(code,signal)=>{
 clearTimeout(timeout);result.exitCode=code;result.signal=signal;
 const sibling=path.resolve(app,'../FitApp_sibling/example.txt');
 result.prefixCheck={root:app,sibling,wouldBeAllowed:sibling.startsWith(app)};
 fs.writeFileSync(path.join(__dirname,'server-audit.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
});
