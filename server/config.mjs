import { resolve } from 'node:path';
export function readConfig(env=process.env){
 const production=env.NODE_ENV==='production';
 let appOrigin='';
 const configuredOrigin=env.APP_ORIGIN||env.RENDER_EXTERNAL_URL;
 if(configuredOrigin){const url=new URL(configuredOrigin);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('APP_ORIGIN must be an HTTP(S) origin without a path');appOrigin=url.origin;}
 if(production&&!appOrigin)throw new Error('Set APP_ORIGIN to the public site origin in production');
 if(production&&new URL(appOrigin).protocol!=='https:')throw new Error('Production APP_ORIGIN must use HTTPS');
 if(env.ADMIN_TOKEN&&Buffer.byteLength(env.ADMIN_TOKEN)<32)throw new Error('ADMIN_TOKEN must contain at least 32 bytes');
 const emailTransport=env.EMAIL_TRANSPORT||'disabled';
 if(!['disabled','smtp','resend'].includes(emailTransport))throw new Error('EMAIL_TRANSPORT must be disabled, smtp, or resend');
 const smtpHost=env.SMTP_HOST||'';const smtpPort=Number(env.SMTP_PORT||465);
 if(![465,587].includes(smtpPort))throw new Error('SMTP_PORT must be 465 (implicit TLS) or 587 (STARTTLS)');
 if(smtpHost&&!/^[a-zA-Z0-9.-]+$/.test(smtpHost))throw new Error('SMTP_HOST must be a hostname');
 const smtpUser=env.SMTP_USER||'',smtpPassword=env.SMTP_PASSWORD||'';
 if(emailTransport==='smtp'&&!(smtpHost&&smtpUser&&smtpPassword&&env.MAIL_FROM))throw new Error('Set SMTP_USER, SMTP_PASSWORD, and MAIL_FROM with SMTP_HOST');
 if(emailTransport==='resend'&&!(env.RESEND_API_KEY&&env.MAIL_FROM))throw new Error('Set RESEND_API_KEY and MAIL_FROM for Resend');
 
 const trustProxy=Number(env.TRUST_PROXY_HOPS||0);if(!Number.isInteger(trustProxy)||trustProxy<0||trustProxy>5)throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5');
 const port=Number(env.PORT||3001);if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid PORT');
 const inquiryTo=env.INQUIRY_TO||'contact@sampventure.com';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inquiryTo))throw new Error('INQUIRY_TO must be an email address');
 const allowedOrigins=appOrigin?[appOrigin]:[];
 if(env.RENDER_EXTERNAL_URL){const preview=new URL(env.RENDER_EXTERNAL_URL);if(preview.protocol!=='https:'||!preview.hostname.endsWith('.onrender.com')||preview.username||preview.password||preview.pathname!=='/'||preview.search||preview.hash)throw new Error('RENDER_EXTERNAL_URL must be the Render-provided HTTPS origin');if(!allowedOrigins.includes(preview.origin))allowedOrigins.push(preview.origin);}
 return {production,appOrigin,allowedOrigins,emailTransport,smtpHost,smtpPort,smtpUser,smtpPassword,adminToken:env.ADMIN_TOKEN||'',resendApiKey:env.RESEND_API_KEY||'',mailFrom:env.MAIL_FROM||'',inquiryTo,
  databasePath:resolve(env.DATABASE_PATH||'data/samp.sqlite'),distPath:resolve('dist'),trustProxy,port,host:env.HOST||(production?'0.0.0.0':'127.0.0.1')};
}
