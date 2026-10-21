import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, LoaderCircle } from 'lucide-react';
import { services } from './data';
export default function ContactForm({initialCategory='',compact=false}){
 const [receipt,setReceipt]=useState(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const submission=useRef(null),controller=useRef(null),result=useRef(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{if(receipt)result.current?.focus();},[receipt]);
 async function submit(event){
  event.preventDefault();if(busy)return;
  const form=new FormData(event.currentTarget);
  const payload={name:form.get('name'),email:form.get('email'),phone:form.get('phone'),category:form.get('category'),message:form.get('message'),notes:form.get('notes')||'',consent:form.get('consent')==='on',website:form.get('website')||''};
  const fingerprint=JSON.stringify(payload);
  if(submission.current?.fingerprint!==fingerprint)submission.current={fingerprint,key:crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,'0')).join('')};
  controller.current=new AbortController();const timer=setTimeout(()=>controller.current.abort(),20000);
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':submission.current.key},body:fingerprint,signal:controller.current.signal});
   const data=await response.json().catch(()=>null);
   if(!response.ok)throw new Error(data?.fields?Object.entries(data.fields).map(([field,message])=>`${field}: ${message}`).join(' · '):data?.error||'We could not save your inquiry. Please try again.');
   if(!data?.id||data.status!=='received')throw new Error('We could not confirm receipt. Please try again.');
   setReceipt(data.id);
  }catch(caught){setError(caught.name==='AbortError'?'The connection timed out. Please retry; the same inquiry will not be saved twice.':caught.message||'Connection unavailable. Please try again.');}
  finally{clearTimeout(timer);setBusy(false);}
 }
 if(receipt)return <div className="form-result" role="status" ref={result} tabIndex={-1}><div className="result-icon"><Check size={30}/></div><h3>Your idea is in good hands.</h3><p>Your inquiry has been received and securely saved for the SAMP team to review.</p><div className="receipt"><span>YOUR REFERENCE</span><code>{receipt}</code></div><button className="text-button" onClick={()=>{submission.current=null;setReceipt(null);}}>Send another inquiry <ArrowUpRight size={16}/></button></div>;
 return <form className={`contact-form ${compact?'compact':''}`} onSubmit={submit} aria-busy={busy}>
 <fieldset disabled={busy} className="form-fields">
 <div className="form-row"><label>Your name <span>*</span><input name="name" required minLength={2} autoComplete="name" placeholder="Alex Morgan" maxLength={100}/></label><label>Email address <span>*</span><input type="email" name="email" required autoComplete="email" placeholder="alex@company.com" maxLength={200}/></label></div>
 <div className="form-row"><label>What are you exploring? <span>*</span><select name="category" required defaultValue={initialCategory}><option value="" disabled>Select a service</option>{services.map(s=><option key={s.id}>{s.title}</option>)}<option>SolidWorks mentorship</option><option>Ansys mentorship</option><option>Academic project guidance</option><option>Product inquiry</option><option>Other / not sure yet</option></select></label><label>Phone / WhatsApp <small>optional</small><input name="phone" type="tel" autoComplete="tel" placeholder="+92 …" maxLength={40}/></label></div>
 <label>Tell us about your idea <span>*</span><textarea name="message" required rows={3} placeholder="The challenge, the ambition, and where you’d like to go…" minLength={10} maxLength={5000}/></label>
 {compact&&<label>Additional notes <small>optional</small><input name="notes" placeholder="Timelines, existing designs, or anything else we should know" maxLength={1000}/></label>}
 <div className="form-trap" aria-hidden="true"><label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" maxLength={200}/></label></div>
 <label className="consent"><input type="checkbox" name="consent" required/> <span>I agree to be contacted by SAMP Ventures about this inquiry.</span></label>
 {error&&<p className="form-error" role="alert">{error}</p>}
 <div className="form-bottom"><button className="button button-lime" type="submit" disabled={busy}>{busy?'Sending your inquiry…':'Send my inquiry'}{busy?<LoaderCircle size={17} className="loading-spinner"/>:<ArrowUpRight size={19}/>}</button><small>Delivered securely.<br/>Let’s build what’s next.</small></div>
 </fieldset></form>;
}
