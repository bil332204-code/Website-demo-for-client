import * as THREE from 'three';

const TAU = Math.PI * 2;
const steel = () => new THREE.MeshStandardMaterial({color:0x9cabb6,metalness:.82,roughness:.29});
const darkSteel = () => new THREE.MeshStandardMaterial({color:0x354552,metalness:.85,roughness:.34});
const redSteel = () => new THREE.MeshStandardMaterial({color:0xc32331,metalness:.7,roughness:.25});
const technical = (color=0x9ab6c7,opacity=.3) => new THREE.LineBasicMaterial({color,transparent:true,opacity});
function circle(radius,segments=48){const path=new THREE.Path();path.absarc(0,0,radius,0,TAU,true);return path;}
function outline(radius,teeth){
 const points=[],module=2*radius/teeth;
 for(let tooth=0;tooth<teeth;tooth++)for(const [phase,r] of [[0,radius-module*1.15],[.16,radius-module*1.15],[.32,radius+module],[.68,radius+module],[.84,radius-module*1.15]]){
  const angle=(tooth+phase)/teeth*TAU;points.push(new THREE.Vector2(Math.cos(angle)*r,Math.sin(angle)*r));
 }
 return points;
}
export function gearGeometry(radius,teeth,depth=.32){
 const shape=new THREE.Shape(outline(radius,teeth));shape.closePath();shape.holes.push(circle(radius*.23));
 for(let i=0;i<6;i++){const angle=i/6*TAU;const hole=circle(radius*.145,20);const translated=new THREE.Path(hole.getPoints(20).map(p=>p.add(new THREE.Vector2(Math.cos(angle)*radius*.62,Math.sin(angle)*radius*.62))));shape.holes.push(translated);}
 return new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,steps:1,curveSegments:16});
}
function ring(outer,inner,depth,material,sides=64){
 const shape=new THREE.Shape();for(let i=0;i<sides;i++){const a=i/sides*TAU;i?shape.lineTo(Math.cos(a)*outer,Math.sin(a)*outer):shape.moveTo(Math.cos(a)*outer,Math.sin(a)*outer);}shape.closePath();shape.holes.push(circle(inner));
 return new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,curveSegments:24}),material);
}
function cylinder(radius,length,material){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,24),material);mesh.rotation.x=Math.PI/2;return mesh;}
function makeGear(radius,teeth,accent=false){
 const group=new THREE.Group(),body=new THREE.Mesh(gearGeometry(radius,teeth),accent?redSteel():steel());group.add(body);
 const hub=ring(radius*.34,radius*.23,.16,accent?darkSteel():steel());hub.position.z=.32;group.add(hub);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(radius*.84,.012,4,64),new THREE.MeshBasicMaterial({color:accent?0xff797b:0xe0e9ef,transparent:true,opacity:.4}));rim.position.z=.36;group.add(rim);
 return group;
}
function addShaft(group,x,y,length=1.15){
 const shaft=cylinder(.19,length,darkSteel());shaft.position.set(x,y,.2);group.add(shaft);
 const cap=ring(.27,.13,.12,steel(),6);cap.position.set(x,y,.49);group.add(cap);
}
function blueprint(){
 const group=new THREE.Group(),grid=[];
 for(let i=-10;i<=10;i++){grid.push(i*.45,-4,-.95,i*.45,4,-.95);grid.push(-5,i*.4,-.95,5,i*.4,-.95);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(grid,3));group.add(new THREE.LineSegments(geometry,technical(0x86adba,.09)));
 const line=(points,opacity=.3)=>{const geo=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const mesh=new THREE.Line(geo,technical(0x9bb6c4,opacity));group.add(mesh);return mesh;};
 for(const [r,x,y] of [[1.8,-.35,.55],[1.24,1.9,.55],[1.5,-.35,-1.9]]){
  const points=outline(r,24).map(p=>[p.x+x,p.y+y,-.86]);points.push(points[0]);line(points,.19);
  for(const factor of [.45,.7]){const pts=Array.from({length:65},(_,i)=>[x+Math.cos(i/64*TAU)*r*factor,y+Math.sin(i/64*TAU)*r*factor,-.86]);line(pts,.15);}
 }
 const dims=[[-2.1,2.7,-.8],[2.9,2.7,-.8]];line(dims,.42);
 for(const x of [-2.1,2.9]){line([[x,2.5,-.8],[x,3,-.8]],.4);line([[x-.08,2.62,-.8],[x+.08,2.78,-.8]],.5);}
 line([[-2.8,-3,-.8],[-2.8,2.2,-.8]],.4);line([[-3,-3,-.8],[-2.6,-3,-.8]],.4);line([[-3,2.2,-.8],[-2.6,2.2,-.8]],.4);
 const labels=[];
 for(const [text,x,y,w] of [['Ø 54.0',-.6,3.05,1.45],['SECTION A—A',1,-3.3,2.1],['SAMP / DESIGN STUDY',-1.3,3.6,3.3]]){
  if(typeof document==='undefined')continue;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const context=canvas.getContext('2d');if(!context)continue;context.fillStyle='#a4becb';context.font='32px monospace';context.textAlign='center';context.fillText(text,256,57);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;labels.push(texture);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,w*96/512),new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.65,depthWrite:false}));mesh.position.set(x,y,-.75);group.add(mesh);
 }
 return {group,textures:labels};
}
function gearTrain(root,{draft=false,exploded=false}={}){
 const gears=[makeGear(1.35,24),makeGear(.9,16),makeGear(1.125,20,true)];
 const centers=[[-.55,.95],[1.7,.95],[-.55,-1.525]];
 gears.forEach((gear,i)=>{gear.name=['drive-gear','idler-gear','output-gear'][i];gear.position.set(...centers[i],0);root.add(gear);addShaft(root,...centers[i]);});
 // Common module and inverse tooth-count speeds keep the three gears meshing.
 gears[1].rotation.z=Math.PI/16;gears[2].rotation.z=Math.PI/20;
 const wires=[];
 if(draft)gears.forEach(gear=>{const body=gear.children[0];body.material.transparent=true;const wire=new THREE.LineSegments(new THREE.WireframeGeometry(body.geometry),technical(0xc6edff,.7));wire.position.z=.005;gear.add(wire);wires.push(wire);});
 const bearings=[];
 if(exploded)for(let i=0;i<3;i++){const bearing=ring(1.35-i*.18,1.07-i*.18,.14,i===1?redSteel():steel());bearing.position.set(.8,-.8,1+i*.45);root.add(bearing);bearings.push(bearing);}
 return time=>{
  gears[0].rotation.z=time*.25;gears[1].rotation.z=Math.PI/16-time*.25*24/16;gears[2].rotation.z=Math.PI/20-time*.25*24/20;
  if(draft){const blend=(Math.sin(time*.55)+1)/2;gears.forEach((gear,i)=>{gear.children[0].material.opacity=.15+blend*.85;wires[i].material.opacity=.8-blend*.65;});}
  if(exploded){const spread=(Math.sin(time*.45)+1)/2;gears.forEach((gear,i)=>gear.position.z=spread*i*.45);bearings.forEach((bearing,i)=>{bearing.position.z=.8+i*(.25+spread*.65);bearing.rotation.z=time*.12*(i%2?-1:1);});}
 };
}
class ThreadCurve extends THREE.Curve{getPoint(t,target=new THREE.Vector3()){const angle=t*TAU*14;return target.set(Math.cos(angle)*.195,Math.sin(angle)*.195,t*2.24);}}
function fastener(root,paired=false){
 const group=new THREE.Group();root.add(group);group.position.set(0,.1,0);group.rotation.set(.05,-.5,-.3);
 const plate=ring(1.5,.23,.28,darkSteel(),6);plate.rotation.z=Math.PI/6;plate.position.z=-.15;group.add(plate);
 const shaft=cylinder(.17,2.65,steel());shaft.position.z=.95;group.add(shaft);
 const thread=new THREE.Mesh(new THREE.TubeGeometry(new ThreadCurve(),280,.025,5,false),steel());group.add(thread);
 const head=ring(.43,.08,.26,steel(),6);head.position.z=-.42;group.add(head);
 const washer=ring(.58,.235,.09,steel());washer.position.z=.22;group.add(washer);
 const nut=ring(.49,.215,.36,redSteel(),6);nut.name='threaded-nut';nut.position.z=1.8;group.add(nut);
 const seat=new THREE.Mesh(new THREE.TorusGeometry(.64,.018,5,64),new THREE.MeshBasicMaterial({color:0x91f5c5,transparent:true,opacity:.2}));seat.position.z=.24;group.add(seat);
 let secondary;
 if(paired){secondary=makeGear(1.05,20);secondary.position.set(-1.6,-1.35,-.1);root.add(secondary);group.scale.setScalar(.8);group.position.x=.7;}
 return time=>{
  const cycle=time%14;const progress=cycle<7?THREE.MathUtils.smoothstep(cycle,0,7):cycle<10?1:1-THREE.MathUtils.smoothstep(cycle,10,14);
  const travel=progress*1.42;nut.position.z=1.8-travel;nut.rotation.z=-travel/.16*TAU;seat.material.opacity=.12+progress*.65;
  if(secondary)secondary.rotation.z=-time*.25;
 };
}
function machining(root){
 const gear=makeGear(1.6,28);gear.position.set(0,-.35,0);root.add(gear);
 const table=new THREE.Mesh(new THREE.BoxGeometry(4.5,4,.22),darkSteel());table.position.set(0,-.35,-.4);root.add(table);
 for(let i=-2;i<=2;i++){const groove=new THREE.Mesh(new THREE.BoxGeometry(.025,3.8,.025),new THREE.MeshBasicMaterial({color:0x121e27}));groove.position.set(i*.7,-.35,-.27);root.add(groove);}
 const tool=new THREE.Group();tool.name='cnc-carriage';root.add(tool);
 const spindle=cylinder(.23,1.15,steel());spindle.position.z=1;tool.add(spindle);
 const collar=cylinder(.31,.27,darkSteel());collar.position.z=1.52;tool.add(collar);
 const bit=cylinder(.055,.35,steel());bit.position.z=.31;tool.add(bit);
 const flutes=new THREE.Group();flutes.position.z=.31;tool.add(flutes);for(let i=0;i<3;i++){const edge=new THREE.Mesh(new THREE.BoxGeometry(.025,.025,.3),darkSteel());edge.position.set(Math.cos(i/3*TAU)*.055,Math.sin(i/3*TAU)*.055,0);flutes.add(edge);}
 const path=outline(1.6,28),points=path.map(p=>new THREE.Vector3(p.x,p.y-.35,.42));points.push(points[0].clone());
 const trail=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),technical(0xf3bf85,.7));root.add(trail);
 const sparks=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(30),3)),new THREE.PointsMaterial({color:0xe8be87,size:.028,transparent:true,opacity:.7}));tool.add(sparks);
 return time=>{
  const advance=(time*.085)%1,index=advance*path.length,i=Math.floor(index),p=path[i].clone().lerp(path[(i+1)%path.length],index-i);
  tool.position.set(p.x,p.y-.35,.05);flutes.rotation.z=time*8;trail.geometry.setDrawRange(0,Math.max(2,Math.floor(advance*points.length)));
  const positions=sparks.geometry.attributes.position;for(let j=0;j<10;j++){const phase=(time*1.5+j*.13)%1,angle=j*2.4;positions.setXYZ(j,Math.cos(angle)*phase*.35,Math.sin(angle)*phase*.35,.25+Math.sin(phase*Math.PI)*.3);}positions.needsUpdate=true;
 };
}
function prototype(root){
 const gear=makeGear(1.6,28);gear.position.set(0,.1,0);root.add(gear);
 gear.name='prototype-gear';
 const wire=new THREE.LineSegments(new THREE.WireframeGeometry(gear.children[0].geometry),technical(0xaecded,.5));wire.position.copy(gear.position);root.add(wire);
 const contours=[];
 for(let i=0;i<9;i++){const pts=outline(1.6,28).map(p=>new THREE.Vector3(p.x,p.y+.1,i*.12));pts.push(pts[0].clone());const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),technical(0xa4c9dc,.28));root.add(line);contours.push(line);}
 return time=>{const build=(Math.sin(time*.4-Math.PI/2)+1)/2;gear.scale.z=.12+build*2.5;gear.rotation.z=time*.09;wire.rotation.z=gear.rotation.z;contours.forEach((line,i)=>{line.rotation.z=gear.rotation.z;line.material.opacity=i/9<build?.25:.035;});};
}
export function createMechanicalStudy(variant){
 const root=new THREE.Group(),drawing=blueprint();root.add(drawing.group);
 let animate;
 switch(variant){
  case 'fasteners':animate=fastener(root);break;
  case 'machining':animate=machining(root);break;
  case 'assembly':animate=gearTrain(root,{exploded:true});break;
  case 'blueprint':animate=gearTrain(root,{draft:true});break;
  case 'prototype':animate=prototype(root);break;
  case 'connection':animate=fastener(root,true);break;
  case 'precision':animate=gearTrain(root,{draft:true});break;
  default:animate=gearTrain(root);
 }
 return {root,update:animate,dispose(){root.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});drawing.textures.forEach(texture=>texture.dispose());}};
}
