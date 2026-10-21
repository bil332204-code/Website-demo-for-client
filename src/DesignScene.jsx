import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMechanicalStudy } from './mechanicalStudies';

// Original mechanical assemblies, animated locally without third-party videos.
export default function DesignScene({ reducedMotion, variant = 'geartrain' }) {
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
  const isHero=Boolean(el.closest('.hero'));
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
  const edge = new THREE.DirectionalLight(0x9dc9e3, 7);
  edge.position.set(4, -2, 2); scene.add(edge);
  const study=createMechanicalStudy(variant);
  const assembly=study.root;scene.add(assembly);
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
   study.update(time);
   assembly.position.set(compact ? -.08 : camera.aspect * 1.65, compact ? (isHero ? -1.55 : -.35) : .1, 0);
   assembly.scale.setScalar(compact ? (['geartrain','precision','blueprint','assembly'].includes(variant) ? .58 : .72) : 1);
   assembly.rotation.set((variant==='machining' ? .5 : .2) + py, -.42 + px + Math.sin(time * .12) * .035, -.12);
   renderer.render(scene, camera); dirty = false; el.dataset.state = reducedMotion ? 'still' : 'playing';
  };
  frame = requestAnimationFrame(draw);
  return () => {
   cancelAnimationFrame(frame); observer.disconnect(); ro.disconnect(); window.removeEventListener('pointermove', pointer);
   study.dispose();
   renderer.domElement.removeEventListener('webglcontextlost', handleLoss);
   renderer.domElement.removeEventListener('webglcontextrestored', handleRestore);
   environment.dispose(); renderer.dispose(); renderer.domElement.remove();
  };
 }, [ready, reducedMotion, variant]);
 return <div className={`design-scene design-scene-${variant}`} ref={host} aria-hidden="true"/>;
}
