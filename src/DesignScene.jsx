import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Original, real-time motion studies. Everything is local: no stock-video requests.
export default function DesignScene({ reducedMotion, variant = 'silk' }) {
 const host = useRef(null);
 const [ready, setReady] = useState(false);
 useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
   if (entry.isIntersecting) { setReady(true); observer.disconnect(); }
  }, { rootMargin: '300px' });
  observer.observe(host.current);
  return () => observer.disconnect();
 }, []);
 useEffect(() => {
  if (!ready) return;
  const el = host.current;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch { el.dataset.state = 'fallback'; return; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 60);
  camera.position.set(0, 0, 12);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  room.dispose(); pmrem.dispose();
  const key = new THREE.DirectionalLight(0xffe9dd, 5);
  key.position.set(-3, 5, 4); scene.add(key);
  const edge = new THREE.DirectionalLight(variant === 'silk' ? 0xb3a7ff : 0x81ece2, 7);
  edge.position.set(4, -2, 2); scene.add(edge);
  const assembly = new THREE.Group(); scene.add(assembly);
  const ribbons = [];
  const studies = {
   silk:{colors:[0xc2b9ed,0x9295c9,0xf0b79b],form:'silk'},
   prism:{colors:[0x9bbaf2,0x7689bd,0xd1e2f1],form:'fold'},
   current:{colors:[0xefb18e,0xcf8c79,0xf0d5b5],form:'tide'},
   tide:{colors:[0x68d7ca,0x92b8c2,0xd9f4e4],form:'tide'},
   bloom:{colors:[0xd2c2a6,0xa8c4b4,0xeac2b1],form:'bloom'},
   ripple:{colors:[0xc2d996,0x88ad9a,0xe5eac3],form:'ripple'},
   fold:{colors:[0xc6a8e9,0x9d86b6,0xe9c3e3],form:'fold'},
   aurora:{colors:[0x9bd7bb,0x6baba8,0xc8dfcb],form:'bloom'},
  };
  const {colors,form}=studies[variant] || studies.silk;
  // Wide, undulating surfaces rather than wireframes, mechanical rings, or gears.
  for (let i = 0; i < 3; i++) {
   const geometry = new THREE.PlaneGeometry(1, 1, 64, 12);
   const material = new THREE.MeshStandardMaterial({ color: colors[i], metalness: .9, roughness: .19, side: THREE.DoubleSide, envMapIntensity: 1.5 });
   const mesh = new THREE.Mesh(geometry, material);
   assembly.add(mesh); ribbons.push(mesh);
  }
  const positions = ribbons.map(mesh => mesh.geometry.attributes.position);
  let width = 1, height = 1, visible = false, frame = 0, last = 0, elapsed = 0, dirty = true, px = 0, py = 0;
  let contextLost = false;
  const handleLoss = event => { event.preventDefault(); contextLost = true; el.dataset.state = 'fallback'; };
  const handleRestore = () => { contextLost = false; dirty = true; };
  renderer.domElement.addEventListener('webglcontextlost', handleLoss);
  renderer.domElement.addEventListener('webglcontextrestored', handleRestore);
  const resize = () => {
   ({ width, height } = el.getBoundingClientRect());
   if (!width || !height) return;
   renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25, 1280 / width, 1000 / height));
   renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); dirty = true;
  };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: '100px' });
  observer.observe(el);
  const ro = new ResizeObserver(resize); ro.observe(el); resize();
  const pointer = event => {
   if (event.pointerType !== 'mouse' || reducedMotion) return;
   px = (event.clientX / window.innerWidth - .5) * .2;
   py = (event.clientY / window.innerHeight - .5) * .12;
  };
  window.addEventListener('pointermove', pointer, { passive: true });
  const draw = timestamp => {
   frame = requestAnimationFrame(draw);
   if (contextLost || document.hidden || !visible || (reducedMotion && !dirty)) { last = timestamp; return; }
   if (timestamp - last < 50) return;
   elapsed += Math.min((timestamp - last) / 1000, .06); last = timestamp;
   const time = reducedMotion ? 0 : elapsed;
   const compact = width < 700;
   ribbons.forEach((mesh, index) => {
    const position = positions[index];
    for (let j = 0; j < position.count; j++) {
     const u = (j % 65) / 64, v = Math.floor(j / 65) / 12 - .5;
     let x, y, z;
     if (form === 'silk') {
      const a = u * Math.PI * 1.8 + index * .85 + time * .13;
      const r = 1.7 + v * 1.65;
      x = Math.cos(a) * r;
      y = (u - .5) * 7 + Math.sin(a * 1.5 + time * .18) * .45;
      z = Math.sin(a) * r + Math.sin(v * 3 + u * 7 + time * .28) * .3;
     } else if (form === 'tide') {
      x = (u - .5) * 9;
      y = Math.sin(u * 6 + index * .8 + time * .24) * 1.4 + v * 2.4 + (index - 1) * .7;
      z = Math.cos(u * 5 + v * 2 + time * .16 + index) * 1.6;
     } else if (form === 'fold') {
      x = (u - .5) * 6;
      y = (index - 1) * 1.3 + v * 3 + Math.sin(u * 9 + time * .25 + index) * .8;
      z = Math.cos(u * 7 + time * .18 + index) * 1.4 + Math.sin(v * 5 + u * 3) * .65;
     } else if (form === 'ripple') {
      const a = u * Math.PI * 1.8 + index * .8;
      const r = 1.7 + v * 2 + Math.sin(u * 12 + time * .28) * .3;
      x = Math.cos(a) * r; y = Math.sin(a) * r;
      z = Math.sin(u * 5 + v * 2 + time * .25) * 1.5 + (index - 1) * .6;
     } else {
      const a = u * Math.PI * 1.7 + time * .1 + index * .9;
      x = Math.cos(a) * (2.1 + v * 1.7);
      y = Math.sin(a * 1.3 + time * .13) * 1.8 + v * 1.5 + (index - 1) * .8;
      z = Math.sin(a) * (2 + v) + v * .6;
     }
     position.setXYZ(j, x, y, z);
    }
    position.needsUpdate = true; mesh.geometry.computeVertexNormals();
   });
   assembly.position.set(form === 'silk' ? (compact ? .45 : camera.aspect * 1.55) : camera.aspect * 1.2, variant === 'silk' && compact ? -1.7 : 0, 0);
   assembly.scale.setScalar(variant === 'silk' ? (compact ? .8 : 1) : 1.15);
   assembly.rotation.set(.1 + py, -.35 + Math.sin(time * .12) * .15 + px, variant === 'silk' ? -.5 : -.25);
   renderer.render(scene, camera); dirty = false; el.dataset.state = reducedMotion ? 'still' : 'playing';
  };
  frame = requestAnimationFrame(draw);
  return () => {
   cancelAnimationFrame(frame); observer.disconnect(); ro.disconnect(); window.removeEventListener('pointermove', pointer);
   ribbons.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
   renderer.domElement.removeEventListener('webglcontextlost', handleLoss);
   renderer.domElement.removeEventListener('webglcontextrestored', handleRestore);
   environment.dispose(); renderer.dispose(); renderer.domElement.remove();
  };
 }, [ready, reducedMotion, variant]);
 return <div className={`design-scene design-scene-${variant}`} ref={host} aria-hidden="true"/>;
}
