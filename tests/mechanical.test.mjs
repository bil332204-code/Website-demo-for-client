import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMechanicalStudy } from '../src/mechanicalStudies.js';
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
test('Meshing gears rotate in opposite directions at inverse tooth-count ratios',()=>{
 const study=createMechanicalStudy('geartrain');try{
 study.update(0);const parts=['drive-gear','idler-gear','output-gear'].map(name=>study.root.getObjectByName(name));const initial=parts.map(p=>p.rotation.z);study.update(3);
 const delta=parts.map((p,i)=>p.rotation.z-initial[i]);assert.ok(delta[0]>0&&delta[1]<0&&delta[2]<0);near(delta[0]*24+delta[1]*16,0);near(delta[0]*24+delta[2]*20,0);
 }finally{study.dispose();}
});
test('The tightening nut travels along the thread with one revolution per pitch',()=>{
 const study=createMechanicalStudy('fasteners');try{
 study.update(0);const nut=study.root.getObjectByName('threaded-nut'),start=nut.position.z;study.update(7);assert.ok(nut.position.z<start);assert.ok(nut.rotation.z<0);near((start-nut.position.z)/.16*2*Math.PI,-nut.rotation.z);
 const seated=nut.position.z;study.update(9);near(nut.position.z,seated);study.update(13.99);assert.ok(nut.position.z>seated);
 }finally{study.dispose();}
});
test('The milling carriage follows a closed toolpath and the prototype gains depth',()=>{
 const cut=createMechanicalStudy('machining'),build=createMechanicalStudy('prototype');try{
 cut.update(0);const tool=cut.root.getObjectByName('cnc-carriage'),start=tool.position.clone();cut.update(3);assert.ok(tool.position.distanceTo(start)>.5);cut.update(1/.085);assert.ok(tool.position.distanceTo(start)<1e-8);
 build.update(0);const gear=build.root.getObjectByName('prototype-gear'),flat=gear.scale.z;build.update(Math.PI/.4);assert.ok(gear.scale.z>flat*10);
 }finally{cut.dispose();build.dispose();}
});
