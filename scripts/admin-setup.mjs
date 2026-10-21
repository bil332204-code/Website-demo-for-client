import { randomBytes } from 'node:crypto';
import { openSync, readFileSync, writeFileSync, closeSync, chmodSync, existsSync } from 'node:fs';
const path='.env';
const existing=existsSync(path)?readFileSync(path,'utf8'):'';
if(/^[ \t]*ADMIN_TOKEN[ \t]*=[ \t]*\S+/m.test(existing)){console.log('ADMIN_TOKEN is already configured in .env; it was not changed.');}
else {
 const token=randomBytes(32).toString('hex');
 const contents=existing.replace(/^[ \t]*ADMIN_TOKEN[ \t]*=.*$/m,'');
 const fd=openSync(path,'w',0o600);try{writeFileSync(fd,contents+(contents.endsWith('\n')||!contents?'':'\n')+`ADMIN_TOKEN=${token}\n`);}finally{closeSync(fd);}
 chmodSync(path,0o600);console.log('A new admin token was saved privately in .env. Restart the API, then use the token at /admin. The token is never printed.');
}
