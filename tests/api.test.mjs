import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID,randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createStore } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';
import { readConfig } from '../server/config.mjs';
import { createNotifier,createDeliveryWorker } from '../server/notifications.mjs';
const valid={name:'Test Engineer',email:'engineer@example.com',phone:'',category:'Engineering analysis',message:'Please analyze the structure of our prototype.',notes:'',consent:true,website:''};
async function fixture(fn,overrides={}){
 const dir=mkdtempSync(join(tmpdir(),'samp-api-'));const store=createStore(join(dir,'samp.sqlite'));
 const config={adminToken:randomBytes(32).toString('hex'),appOrigin:'http://samp.test',distPath:null,trustProxy:0,...overrides};
 const notifier={enabled:false};const server=createApp({store,config,notifier}).listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 const send=(payload=valid,key=randomUUID(),headers={})=>fetch(base+'/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key,...headers},body:JSON.stringify(payload)});
 const admin=(path='/inquiries',options={})=>fetch(base+'/api/admin'+path,{...options,headers:{'Authorization':`Bearer ${config.adminToken}`,...options.headers}});
 try{await fn({store,config,base,send,admin,dir});}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();rmSync(dir,{recursive:true,force:true});}
}
test('Inquiry is committed before acknowledgment; consent and notification retained',()=>fixture(async({send,store})=>{
 const r=await send();assert.equal(r.status,201);const body=await r.json();assert.equal(body.status,'received');assert.ok(body.id);assert.equal(Object.hasOwn(body,'email'),false);
 const row=store.db.prepare('SELECT * FROM inquiries WHERE id=?').get(body.id);assert.equal(row.email,valid.email);assert.ok(row.consent_at);assert.equal(store.db.prepare('SELECT count(*) AS n FROM notifications').get().n,1);
}));
test('Idempotency returns the same receipt and rejects changed content',()=>fixture(async({send,store})=>{
 const key=randomUUID();const first=await (await send(valid,key)).json();const retry=await send(valid,key);assert.equal(retry.status,200);assert.equal((await retry.json()).id,first.id);assert.equal((await send({...valid,message:'A different inquiry and requirements.'},key)).status,409);assert.equal(store.db.prepare('SELECT count(*) AS n FROM inquiries').get().n,1);
}));
test('Server enforces fields, consent, lengths, and category independently of browser',()=>fixture(async({send,store})=>{
 for(const payload of [{...valid,email:'invalid'},{...valid,consent:false},{...valid,name:' '},{...valid,category:'Invented category'},{...valid,message:'short'},{...valid,notes:'x'.repeat(1001)}])assert.equal((await send(payload)).status,400);
 assert.equal(store.db.prepare('SELECT count(*) AS n FROM inquiries').get().n,0);
}));
test('Honeypot blocks bots; origin policy rejects cross-site requests',()=>fixture(async({send})=>{
 assert.equal((await send({...valid,website:'spam.example'})).status,400);assert.equal((await send(valid,randomUUID(),{Origin:'https://attacker.example'})).status,403);assert.equal((await send(valid,randomUUID(),{'Sec-Fetch-Site':'cross-site'})).status,403);assert.equal((await send(valid,randomUUID(),{Origin:'http://samp.test'})).status,201);
}));
test('Malformed JSON, unsupported media, missing keys, and oversized requests fail safely',()=>fixture(async({base})=>{
 assert.equal((await fetch(base+'/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'})).status,400);
 assert.equal((await fetch(base+'/api/inquiries',{method:'POST',body:'text'})).status,415);
 assert.equal((await fetch(base+'/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(valid)})).status,400);
 assert.equal((await fetch(base+'/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...valid,message:'x'.repeat(40000)})})).status,413);
}));
test('Public cannot read, modify, or delete private inquiries',()=>fixture(async({base,send})=>{
 const {id}=await (await send()).json();for(const [path,method] of [['/inquiries','GET'],[`/inquiries/${id}`,'DELETE'],[`/inquiries/${id}`,'PATCH']])assert.equal((await fetch(base+'/api/admin'+path,{method})).status,401);
 assert.equal((await fetch(base+'/api/inquiries/'+id)).status,404);
}));
test('Admin search, filtering, statuses, pagination, and deletion work',()=>fixture(async({send,admin})=>{
 const {id}=await (await send()).json();const list=await (await admin()).json();assert.equal(list.total,1);assert.equal(list.counts.new,1);assert.equal(list.notificationsEnabled,false);assert.equal(Object.hasOwn(list.items[0],'idempotency_key'),false);
 const update=await admin(`/inquiries/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'in_progress'})});assert.equal(update.status,200);
 assert.equal((await (await admin('/inquiries?status=new')).json()).total,0);assert.equal((await (await admin('/inquiries?search=engineer')).json()).total,1);assert.equal((await (await admin('/inquiries?search=%25')).json()).total,0);
 assert.equal((await admin('/inquiries?page=-1')).status,400);assert.equal((await admin(`/inquiries/${id}`,{method:'DELETE'})).status,204);assert.equal((await (await admin()).json()).total,0);
}));
test('Admin is disabled when no token is configured',()=>fixture(async({base})=>{assert.equal((await fetch(base+'/api/admin/inquiries')).status,503);},{adminToken:''}));
test('Rate limit cannot be bypassed using an untrusted X-Forwarded-For',()=>fixture(async({send})=>{
 for(let i=0;i<10;i++)assert.equal((await send({...valid,message:'bad'},randomUUID(),{'X-Forwarded-For':`1.2.3.${i}`})).status,400);
 const r=await send();assert.equal(r.status,429);assert.ok(r.headers.get('retry-after'));
}));
test('Security headers and no-store policy protect API responses',()=>fixture(async({base})=>{
 const r=await fetch(base+'/api/health');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.ok(r.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
}));
test('SQLite persists inquiries across close and reopen',()=>{const dir=mkdtempSync(join(tmpdir(),'samp-persist-'));const path=join(dir,'db.sqlite');let store=createStore(path);const {id}=store.create(valid,randomUUID());store.close();store=createStore(path);assert.equal(store.db.prepare('SELECT id FROM inquiries').get().id,id);store.close();rmSync(dir,{recursive:true});});
test('Queue records failures, retries, and eventually marks delivery sent',async()=>{
 const store=createStore(':memory:');const {id}=store.create(valid,randomUUID());let sends=0;
 const worker=createDeliveryWorker(store,{enabled:true,async send(){sends++;if(sends===1)throw Error('mock failure');}});
 await worker.tick();assert.equal(store.db.prepare('SELECT status FROM notifications').get().status,'pending');assert.equal(store.db.prepare('SELECT attempts FROM notifications').get().attempts,1);
 store.db.prepare("UPDATE notifications SET next_attempt_at='2000-01-01T00:00:00Z'").run();await worker.tick();assert.equal(store.db.prepare('SELECT status FROM notifications').get().status,'sent');assert.equal(sends,2);await worker.tick();assert.equal(sends,2);await worker.stop();store.close();
});
test('Queue stops automatic retries after five failures',async()=>{const store=createStore(':memory:');store.create(valid,randomUUID());let calls=0;const worker=createDeliveryWorker(store,{enabled:true,async send(){calls++;throw Error('mock');}});for(let i=0;i<6;i++){store.db.prepare("UPDATE notifications SET next_attempt_at='2000-01-01T00:00:00Z'").run();await worker.tick();}assert.equal(calls,5);assert.equal(store.db.prepare('SELECT status FROM notifications').get().status,'failed');await worker.stop();store.close();});
test('SMTP uses verified TLS and a trusted sender with visitor reply-to',async()=>{
 let settings,mail;const config={emailTransport:'smtp',smtpHost:'smtp.example.com',smtpPort:587,smtpUser:'site@example.com',smtpPassword:'test-only-not-a-real-secret',mailFrom:'SAMP <site@example.com>',inquiryTo:'contact@example.com'};
 const notifier=createNotifier(config,()=>{throw Error('HTTPS must not be used');},options=>{settings=options;return{async sendMail(input){mail=input;return{accepted:['contact@example.com']};}};});
 assert.equal(notifier.enabled,true);await notifier.send({...valid,id:randomUUID(),created_at:'now',consent_at:'now'});assert.equal(settings.requireTLS,true);assert.equal(settings.tls.rejectUnauthorized,true);assert.equal(settings.secure,false);assert.equal(mail.from,config.mailFrom);assert.equal(mail.replyTo,valid.email);assert.ok(mail.text.includes(valid.message));
});
test('Resend uses provider idempotency and reports rejected delivery',async()=>{let options;const config={emailTransport:'resend',resendApiKey:'test-only',mailFrom:'site@example.com',inquiryTo:'contact@example.com'};const item={...valid,id:randomUUID()};const notifier=createNotifier(config,async(_url,input)=>{options=input;return{ok:true};});await notifier.send(item);assert.equal(options.headers['Idempotency-Key'],'inquiry-'+item.id);assert.equal(JSON.parse(options.body).reply_to,valid.email);await assert.rejects(()=>createNotifier(config,async()=>({ok:false})).send(item));});
test('Production requires HTTPS origin and strong administrator credentials',()=>{
 const hosted=readConfig({NODE_ENV:'production',APP_ORIGIN:'https://sampventures.tech',RENDER_EXTERNAL_URL:'https://samp-demo.onrender.com'});assert.deepEqual(hosted.allowedOrigins,['https://sampventures.tech','https://samp-demo.onrender.com']);
 assert.equal(readConfig({NODE_ENV:'production',RENDER_EXTERNAL_URL:'https://samp-demo.onrender.com'}).appOrigin,'https://samp-demo.onrender.com');
 assert.throws(()=>readConfig({NODE_ENV:'production'}),/APP_ORIGIN/);assert.throws(()=>readConfig({NODE_ENV:'production',APP_ORIGIN:'http://example.com'}),/HTTPS/);assert.throws(()=>readConfig({ADMIN_TOKEN:'short'}),/32 bytes/);assert.throws(()=>readConfig({EMAIL_TRANSPORT:'smtp',SMTP_HOST:'smtp.example.com'}),/SMTP_USER/);assert.throws(()=>readConfig({SMTP_PORT:'25'}),/465/);
});
