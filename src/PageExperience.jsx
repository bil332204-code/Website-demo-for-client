import React from 'react';
import { ArrowUpRight, ArrowDown, Layers3, Sparkles, Fingerprint, GraduationCap, FlaskConical, Route, Package } from 'lucide-react';
import { pages } from './pages';
const symbols = {expertise:Layers3,approach:Route,research:FlaskConical,about:Fingerprint,learning:GraduationCap,products:Package,contact:Sparkles};
export function PageHero({page}) {
 return <section className="page-hero" aria-labelledby="page-title">
  <div className="page-breadcrumb"><a href="/">SAMP</a><span>/</span><span>{page.label}</span></div>
  <div className="page-hero-copy"><p className="page-kicker"><span className="live-dot"/>{page.study}</p>
   <h1 id="page-title"><span className="hero-line"><span>{page.line}</span></span><span className="hero-line"><span><em>{page.emphasis}</em></span></span></h1>
   <p className="page-summary hero-intro">{page.description}</p>
   <a className="page-discover" href={page.key==='not-found'?'/':'#page-content'}>{page.key==='not-found'?'Return home':'Explore this chapter'}{page.key==='not-found'?<ArrowUpRight size={16}/>:<ArrowDown size={16}/>}</a>
  </div>
  <div className="page-study" aria-hidden="true"><span>ENGINEERING IN MOTION</span><strong>{String(pages.findIndex(p=>p.key===page.key)+1).padStart(2,'0')}</strong><span>SAMP / {page.study}</span></div>
 </section>;
}
export function PageDirectory(){
 return <section className="page-directory section-pad"><div className="directory-intro" data-reveal><span className="eyebrow">CHOOSE YOUR NEXT CHAPTER</span><h2>A world of<br/><em>possibility.</em></h2><p>Go deeper into the people, disciplines, and ideas behind SAMP.</p></div><div className="directory-grid">{pages.filter(p=>p.key!=='home'&&p.key!=='contact').map((p,i)=>{const Icon=symbols[p.key];return <a className={`chapter-card chapter-${p.variant}`} style={{'--chapter-accent':p.accent}} href={p.path} key={p.key} data-reveal data-motion data-tilt><div className="chapter-top"><span>0{i+1} / EXPLORE</span><ArrowUpRight size={22}/></div><div className="chapter-sculpture" aria-hidden="true"><i/><i/><i/><Icon strokeWidth={.8}/></div><h3>{p.label}</h3><p>{p.description}</p><span className="chapter-enter">Enter chapter <ArrowUpRight size={14}/></span></a>})}</div></section>;
}
export function NextChapter({page}){
 const index=pages.findIndex(p=>p.key===page.key), next=pages[(index+1)%pages.length];
 return <section className="next-chapter section-pad" data-motion><span className="eyebrow">{page.key==='home'?'YOUR NEXT CHAPTER STARTS HERE':'KEEP EXPLORING'}</span><a href={page.key==='home'?'/contact':next.path}><span>{page.key==='home'?'Let’s build something.':next.label}<em>{page.key==='home'?'Together.':'Discover what’s next.'}</em></span><ArrowUpRight strokeWidth={.7}/></a></section>;
}
export function ProductsContent({openConsult}){
 return <section className="product-page section-pad"><div className="product-statement" data-reveal><span className="eyebrow">SAMP / PRODUCTS</span><h2>From possibility<br/>to <em>something tangible.</em></h2><p>Our public product catalogue is not available yet. We’re shaping what comes next. In the meantime, talk to us about the product you have in mind.</p><button className="button button-lime" data-magnetic onClick={()=>openConsult('Product inquiry')}>Talk products with us <ArrowUpRight size={19}/></button></div><div className="product-paths">{[{title:'A custom solution',text:'Explore engineering built around your specific challenge.'},{title:'A functional prototype',text:'Turn an early concept into something you can test and refine.'},{title:'A production partnership',text:'Discuss design validation, manufacturing readiness, and next steps.'}].map((p,i)=><article key={p.title} data-reveal><span>0{i+1}</span><Package strokeWidth={1}/><h3>{p.title}</h3><p>{p.text}</p></article>)}</div></section>;
}
