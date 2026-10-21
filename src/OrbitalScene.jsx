import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function OrbitalScene({ reducedMotion }) {
 const host = useRef(null);
 useEffect(() => {
  const el = host.current;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'}); } catch { el.classList.add('scene-fallback'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35,1,.1,100);
  camera.position.set(0,0,10.5);
  scene.add(new THREE.AmbientLight(0xc7e8dc,1.1));
  const key=new THREE.DirectionalLight(0xe4ffe9,5);key.position.set(-3,5,5);scene.add(key);
  const rim=new THREE.PointLight(0xb6fb79,36,15);rim.position.set(3,-1,3);scene.add(rim);
  const blue=new THREE.PointLight(0x57c7d1,25,12);blue.position.set(-4,-2,1);scene.add(blue);
  const assembly=new THREE.Group();scene.add(assembly);
  const coreMat=new THREE.MeshPhysicalMaterial({color:0x172c26,metalness:.9,roughness:.26,clearcoat:1,clearcoatRoughness:.1});
  const core=new THREE.Mesh(new THREE.IcosahedronGeometry(1.39,3),coreMat);assembly.add(core);
  const wire=new THREE.Mesh(new THREE.IcosahedronGeometry(1.405,2),new THREE.MeshBasicMaterial({color:0x8eae8d,wireframe:true,transparent:true,opacity:.15}));assembly.add(wire);
  const inner=new THREE.Mesh(new THREE.IcosahedronGeometry(.92,1),new THREE.MeshPhysicalMaterial({color:0xd1f9a6,metalness:.7,roughness:.2,emissive:0x4f822f,emissiveIntensity:.25}));assembly.add(inner);
  core.material.transparent=true;core.material.opacity=.89;
  const rings=[],comets=[];
  [[1.92,.105,.9,.25],[2.48,.065,-.7,.55],[2.92,.026,1.4,-.4]].forEach(([r,t,x,z],i)=>{
   const g=new THREE.Group();g.rotation.set(x,.3,z);assembly.add(g);
   const ring=new THREE.Mesh(new THREE.TorusGeometry(r,t,16,192),new THREE.MeshPhysicalMaterial({color:i===0?0xb6c5b1:0x607b6a,metalness:.9,roughness:.23,clearcoat:.7}));g.add(ring);
   const line=new THREE.Mesh(new THREE.TorusGeometry(r+t*.8,.009,6,192),new THREE.MeshBasicMaterial({color:0xc4ff8c,transparent:true,opacity:i===2?.4:.85}));line.position.z=.04;g.add(line);
   for(let j=0;j<64;j++) {const a=j/64*Math.PI*2;const tick=new THREE.Mesh(new THREE.BoxGeometry(.012,j%8===0?.14:.045,.025),new THREE.MeshBasicMaterial({color:0xc1e5af,transparent:true,opacity:.6}));tick.position.set(Math.sin(a)*r,Math.cos(a)*r,.1);tick.rotation.z=-a;g.add(tick);}
   const satellite=new THREE.Mesh(new THREE.SphereGeometry(i===0?.1:.065,12,12),new THREE.MeshBasicMaterial({color:0xdcff9d}));satellite.position.set(r,0,0);g.add(satellite);rings.push(g);comets.push({mesh:satellite,radius:r});
   const trailGeometry=new THREE.BufferGeometry();const trailPositions=[],trailColors=[];for(let k=0;k<25;k++){const angle=-k/24*.4;trailPositions.push(Math.cos(angle)*r,Math.sin(angle)*r,0);const fade=(1-k/25)*.65;trailColors.push(fade*.72,fade,fade*.45);}trailGeometry.setAttribute('position',new THREE.Float32BufferAttribute(trailPositions,3));trailGeometry.setAttribute('color',new THREE.Float32BufferAttribute(trailColors,3));const trail=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.8}));g.add(trail);comets[i].trail=trail;
  });
  const dots=[];for(let i=0;i<140;i++){const a=i*2.399;const r=3.3+(i%11)/11*2;dots.push(Math.cos(a)*r,Math.sin(a)*r*.8,(i%7-3)*.3);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(dots,3));const stars=new THREE.Points(geo,new THREE.PointsMaterial({color:0xb5d4b2,size:.018,transparent:true,opacity:.6}));scene.add(stars);
  let px=0,py=0,frame,visible=true,needsRender=true;const onMove=e=>{if(reducedMotion||e.pointerType!=='mouse')return;px=(e.clientX/window.innerWidth-.5)*.25;py=(e.clientY/window.innerHeight-.5)*.15;};
  window.addEventListener('pointermove',onMove,{passive:true});
  const resize=()=>{const {width,height}=el.getBoundingClientRect();renderer.setPixelRatio(Math.min(window.devicePixelRatio,width<600?1.3:1.7));renderer.setSize(width,height);needsRender=true;camera.aspect=width/height;camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(el);resize();
  const observer=new IntersectionObserver(([e])=>{visible=e.isIntersecting;});observer.observe(el);
  let last=0,elapsed=0;
  const render=t=>{frame=requestAnimationFrame(render);if(document.hidden||!visible||t-last<33||(reducedMotion&&!needsRender))return;needsRender=false;elapsed+=Math.min((t-last)/1000,.05);last=t;const time=reducedMotion?0:elapsed;assembly.rotation.y=time*.12+(reducedMotion?0:px);assembly.rotation.z=-.16;assembly.rotation.x=reducedMotion?0:py;assembly.position.y=Math.sin(time*.55)*.14;core.rotation.y=-time*.07;wire.rotation.y=time*.025;inner.rotation.z=time*.04;rim.intensity=33+Math.sin(time*.65)*3;rings[0].rotation.y=time*.19;rings[1].rotation.x=-.7+time*.13;rings[2].rotation.z=-.4-time*.09;comets.forEach(({mesh,radius,trail},i)=>{const angle=time*(.38+i*.13)+i*1.8;mesh.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,.06);trail.rotation.z=angle;});stars.rotation.z=time*.018;renderer.render(scene,camera);};frame=requestAnimationFrame(render);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('pointermove',onMove);ro.disconnect();observer.disconnect();scene.traverse(o=>{o.geometry?.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
 },[reducedMotion]);
 return <div className="orbital-scene" ref={host} aria-hidden="true"><div className="orb-halo"/></div>;
}
