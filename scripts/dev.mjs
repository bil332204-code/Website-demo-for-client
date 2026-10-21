import { spawn } from 'node:child_process';
const apiPort=process.env.PORT||'3001';
const children=[
 spawn(process.execPath,['--watch','server/index.mjs'],{stdio:'inherit',env:{...process.env,NODE_ENV:'development',PORT:apiPort}}),
 spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','0.0.0.0','--port','5173','--strictPort',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,API_PORT:apiPort}}),
];
let stopping=false;const stop=code=>{if(stopping)return;stopping=true;children.forEach(child=>child.kill('SIGTERM'));process.exitCode=code;};
children.forEach(child=>{child.on('error',()=>stop(1));child.on('exit',code=>stop(code||0));});
process.on('SIGINT',()=>stop(0));process.on('SIGTERM',()=>stop(0));
