import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { inquirySchema, statusSchema, querySchema } from './validation.mjs';

export function createApp({store,config,notifier}){
 const app=express();app.disable('x-powered-by');app.set('trust proxy',config.trustProxy||false);
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:'],fontSrc:["'self'"],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],upgradeInsecureRequests:config.production?[]:null}},strictTransportSecurity:config.production?undefined:false}));
 app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 app.use('/api',(req,res,next)=>{
  if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
  const origin=req.get('origin');const ownOrigin=config.appOrigin||`${req.protocol}://${req.get('host')}`;
  const allowedOrigins=config.allowedOrigins?.length?config.allowedOrigins:[ownOrigin];
  if((origin&&!allowedOrigins.includes(origin))||req.get('sec-fetch-site')==='cross-site')return res.status(403).json({error:'This request must come from the SAMP website.'});
  next();
 });
 const contactLimit=rateLimit({windowMs:15*60*1000,limit:10,validate:{xForwardedForHeader:config.trustProxy>0},standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many inquiries. Please try again in 15 minutes.'}});
 const adminLimit=rateLimit({windowMs:15*60*1000,limit:20,validate:{xForwardedForHeader:config.trustProxy>0},skipSuccessfulRequests:true,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many failed authentication attempts. Please try again later.'}});
 const parseJson=express.json({limit:'32kb',strict:true});
 app.get('/api/health',(_req,res)=>{try{store.db.prepare('SELECT 1').get();res.json({status:'ok'});}catch{res.status(503).json({status:'unavailable'});}});
 app.post('/api/inquiries',contactLimit,(req,res,next)=>{
  if(!req.is('application/json'))return res.status(415).json({error:'Send the inquiry as application/json.'});next();
 },parseJson,(req,res,next)=>{
  const parsed=inquirySchema.safeParse(req.body);
  if(!parsed.success){const fields={};for(const issue of parsed.error.issues)fields[String(issue.path[0]||'form')]=issue.message;return res.status(400).json({error:'Please check the highlighted fields.',fields});}
  if(parsed.data.website)return res.status(400).json({error:'Unable to accept this submission.'});
  const key=req.get('idempotency-key');if(!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key))return res.status(400).json({error:'A valid Idempotency-Key header is required.'});
  try{
   const {website,...data}=parsed.data;const saved=store.create(data,key);
   if(saved.conflict)return res.status(409).json({error:'This submission key was already used. Please start a new inquiry.'});
   // Receipt means committed to SQLite, independently of optional email delivery.
   return res.status(saved.duplicate?200:201).json({id:saved.id,status:'received',message:'Your inquiry has been received.'});
  }catch(error){next(error);}
 });
 app.use('/api/admin',adminLimit,(req,res,next)=>{
  if(!config.adminToken)return res.status(503).json({error:'Admin access has not been configured.'});
  const match=/^Bearer ([^\s]+)$/.exec(req.get('authorization')||'');
  const digest=value=>createHash('sha256').update(value).digest();
  if(!match||!timingSafeEqual(digest(match[1]),digest(config.adminToken)))return res.status(401).json({error:'Invalid administrator token.'});
  next();
 });
 app.get('/api/admin/inquiries',(req,res)=>{
  const parsed=querySchema.safeParse(req.query);if(!parsed.success)return res.status(400).json({error:'Invalid search or pagination.'});
  res.json({...store.list(parsed.data),notificationsEnabled:Boolean(notifier.enabled)});
 });
 app.patch('/api/admin/inquiries/:id',parseJson,(req,res)=>{
  const parsed=statusSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Choose new, in_progress, or closed.'});
  if(!store.setStatus(req.params.id,parsed.data.status))return res.status(404).json({error:'Inquiry not found.'});res.json({status:parsed.data.status});
 });
 app.delete('/api/admin/inquiries/:id',(req,res)=>{if(!store.delete(req.params.id))return res.status(404).json({error:'Inquiry not found.'});res.status(204).end();});
 app.post('/api/admin/inquiries/:id/retry-notification',(req,res)=>{
  if(!notifier.enabled)return res.status(503).json({error:'Email notifications are not configured.'});
  if(!store.retry(req.params.id))return res.status(409).json({error:'Only failed notifications can be retried.'});res.status(202).json({status:'pending'});
 });
 app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found.'}));
 if(config.distPath&&existsSync(join(config.distPath,'index.html'))){
  app.use(express.static(config.distPath,{index:false,maxAge:0,setHeaders(res,path){if(path.includes('/assets/'))res.set('Cache-Control','public, max-age=31536000, immutable');}}));
  app.get(['/', '/admin'],(_req,res)=>{res.set('Cache-Control','no-cache');res.sendFile(join(config.distPath,'index.html'));});
 }
 app.use((_req,res)=>res.status(404).send('Not found'));
 app.use((error,_req,res,_next)=>{
  if(error.type==='entity.too.large')return res.status(413).json({error:'The inquiry is too large.'});
  if(error.type==='entity.parse.failed')return res.status(400).json({error:'Invalid JSON.'});
  console.error('Request failed:',error.code||error.name||'UnknownError');
  res.status(500).json({error:'We could not save your inquiry. Please try again.'});
 });
 return app;
}
