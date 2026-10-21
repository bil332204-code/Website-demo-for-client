import nodemailer from 'nodemailer';
export function createNotifier(config, fetchImpl=fetch, createTransport=nodemailer.createTransport) {
 const smtp=config.emailTransport==='smtp'&&config.smtpHost?createTransport({host:config.smtpHost,port:config.smtpPort,secure:config.smtpPort===465,requireTLS:true,auth:{user:config.smtpUser,pass:config.smtpPassword},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000}):null;
 return {
  enabled: Boolean((smtp||(config.emailTransport==='resend'&&config.resendApiKey)) && config.mailFrom && config.inquiryTo),
  async send(inquiry) {
   if(!this.enabled)throw new Error('Email notifications are disabled');
   if(smtp){const result=await smtp.sendMail({from:config.mailFrom,to:config.inquiryTo,replyTo:inquiry.email,subject:`New SAMP inquiry: ${inquiry.category}`,text:`New website inquiry\nReference: ${inquiry.id}\n\nName: ${inquiry.name}\nEmail: ${inquiry.email}\nPhone: ${inquiry.phone||'Not provided'}\nCategory: ${inquiry.category}\nReceived: ${inquiry.created_at}\n\n${inquiry.message}\n\nAdditional notes: ${inquiry.notes||'None'}\n\nConsent recorded: ${inquiry.consent_at}`,messageId:`<samp-inquiry-${inquiry.id}@sampventure.com>`});if(!result.accepted?.length)throw new Error('SMTP recipient not accepted');return;}
   const response=await fetchImpl('https://api.resend.com/emails', {
    method:'POST',signal:AbortSignal.timeout(15000),
    headers:{'Authorization':`Bearer ${config.resendApiKey}`,'Content-Type':'application/json','Idempotency-Key':`inquiry-${inquiry.id}`},
    body:JSON.stringify({from:config.mailFrom,to:[config.inquiryTo],reply_to:inquiry.email,
     subject:`New SAMP inquiry: ${inquiry.category}`,
     text:`New website inquiry\nReference: ${inquiry.id}\n\nName: ${inquiry.name}\nEmail: ${inquiry.email}\nPhone: ${inquiry.phone||'Not provided'}\nCategory: ${inquiry.category}\nReceived: ${inquiry.created_at}\n\n${inquiry.message}\n\nAdditional notes: ${inquiry.notes||'None'}\n\nConsent recorded: ${inquiry.consent_at}`}),
   });
   if(!response.ok)throw new Error('Email provider rejected delivery');
  },
 };
}
export function createDeliveryWorker(store, notifier, { intervalMs=15000 }={}) {
 let busy=false, timer,stopped=false;
 async function tick(){
  if(stopped||busy||!notifier.enabled)return;
  busy=true;
  try{
   for(let i=0;i<10&&!stopped;i++){
    const item=store.nextNotification();if(!item)break;if(!store.claimNotification(item.id))continue;
    try{await notifier.send(item);store.sent(item.id);}catch{store.failed(item.id,item.notification_attempts+1);}
   }
  } finally{busy=false;}
 }
 return { tick, start(){timer=setInterval(()=>{void tick().catch(()=>console.error('Notification queue unavailable'));},intervalMs);timer.unref();void tick().catch(()=>console.error('Notification queue unavailable'));},async stop(){stopped=true;clearInterval(timer);while(busy)await new Promise(resolve=>setTimeout(resolve,20));} };
}
