import { readConfig } from './config.mjs';
import { createStore } from './store.mjs';
import { createApp } from './app.mjs';
import { createNotifier, createDeliveryWorker } from './notifications.mjs';
const config=readConfig();const store=createStore(config.databasePath);const notifier=createNotifier(config);const worker=createDeliveryWorker(store,notifier);
const app=createApp({store,config,notifier});
const server=app.listen(config.port,config.host,()=>{console.log(`SAMP API listening on port ${config.port}. Email notifications: ${notifier.enabled?'enabled':'not configured'}. Admin access: ${config.adminToken?'enabled':'not configured'}.`);worker.start();});
server.on('error',error=>{console.error('Server startup failed:',error.code||error.name);store.close();process.exit(1);});
let stopping=false;
async function shutdown(){if(stopping)return;stopping=true;const timeout=setTimeout(()=>process.exit(1),20000);timeout.unref();server.close(async()=>{await worker.stop();store.close();clearTimeout(timeout);process.exit(0);});}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
