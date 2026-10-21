import { execFileSync } from 'node:child_process';
import { randomBytes,randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const tag=process.env.CONTAINER_IMAGE||'samp-ventures:deployment-check';
const suffix=randomBytes(5).toString('hex'),name=`samp-check-${suffix}`,volume=`samp-check-data-${suffix}`;
const token=randomBytes(32).toString('hex');
const docker=(...args)=>execFileSync('docker',args,{env:{...process.env,DOCKER_CONFIG:process.env.DOCKER_CONFIG||'/tmp/samp-docker-config',ADMIN_TOKEN:token},encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
let base;
async function start(){
 docker('run','--detach','--name',name,'-e','ADMIN_TOKEN','-e','APP_ORIGIN=https://deployment-check.example','-e','EMAIL_TRANSPORT=disabled','--read-only','--tmpfs','/tmp','--cap-drop','ALL','--security-opt','no-new-privileges:true','-p','127.0.0.1::3001','--mount',`type=volume,source=${volume},target=/app/data`,tag);
 base='http://'+docker('port',name,'3001/tcp').split('\n')[0];
 for(let i=0;i<60;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
 throw Error('Container did not become ready');
}
const admin=()=>fetch(base+'/api/admin/inquiries',{headers:{Authorization:`Bearer ${token}`}});
try{
 docker('volume','create',volume);await start();
 assert.equal(docker('exec',name,'id','-u'),'1000');
 docker('exec',name,'test','!','-e','/app/.env');
 assert.match(await (await fetch(base)).text(),/SAMP —/);
 for(const path of ['/expertise','/approach','/research','/about','/learning','/products','/contact'])assert.equal((await fetch(base+path)).status,200);
 assert.equal((await fetch(base+'/missing-page')).status,404);
 assert.ok((await (await fetch(base+'/sitemap.xml')).text()).includes('/learning'));
 assert.equal((await fetch(base+'/admin')).status,200);
 const key=randomUUID(),body={name:'Deployment Test',email:'deploy@example.com',category:'Product inquiry',message:'Container readiness test; this is temporary test data.',consent:true};
 const response=await fetch(base+'/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key,Origin:'https://deployment-check.example'},body:JSON.stringify(body)});
 assert.equal(response.status,201);const receipt=await response.json();
 assert.equal((await (await admin()).json()).items[0].id,receipt.id);
 docker('stop',name);docker('rm',name);await start();
 const after=await (await admin()).json();assert.equal(after.total,1);assert.equal(after.items[0].id,receipt.id);
 console.log('PASS production container: non-root runtime, private files excluded, frontend/admin/API, real submission, and persistence across container replacement.');
}finally{
 try{docker('rm','-f',name);}catch{}
 try{docker('volume','rm',volume);}catch{}
}
