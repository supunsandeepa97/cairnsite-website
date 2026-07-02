// cairn.js — smooth matte Cairnsite cairn as a FIXED backdrop that travels across
// the viewport driven by full-page scroll progress (0 top → 1 bottom). No glow/particles.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const STONE = [0xb9b1a4, 0xa69e91, 0xc3bcb0, 0x9d958a, 0xb0a99c];

export function mountCairn(stageEl, opts){
  opts = opts || {};
  const TIER = opts.tier || 'full';

  const canvas = document.createElement('canvas');
  canvas.className = 'cairn-canvas'; canvas.setAttribute('aria-hidden','true');
  stageEl.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIER === 'full' ? 2 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // exposure lowered 1.05 -> 0.92: caps highlight brightness so text over lit
  // pebbles keeps >=4.5:1 contrast (measured, not eyeballed)
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // exponential depth fog toward the page background = cinematic depth falloff,
  // rear pebbles melt into the dark instead of ending abruptly
  scene.fog = new THREE.FogExp2(0x0a120e, 0.045);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.025).texture;

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 0.5, 9.4); camera.lookAt(0, 0.35, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xfff6ec, 2.1);
  key.position.set(4, 8, 6); key.castShadow = true;
  key.shadow.mapSize.set(2048,2048); key.shadow.camera.near=1; key.shadow.camera.far=30; key.shadow.radius=10; key.shadow.bias=-0.0002;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcd0dc, 0.6); fill.position.set(-5,2,-2); scene.add(fill);
  const rimL = new THREE.DirectionalLight(0xffffff, 0.5); rimL.position.set(-2,3,-6); scene.add(rimL);

  const cairn = new THREE.Group(); scene.add(cairn);
  const disposables = [];

  function makePebble(rx, ry, rz, color, sd){
    const geo = new THREE.SphereGeometry(1, 96, 64);
    const pos = geo.attributes.position; const v = new THREE.Vector3();
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos,i);
      const d = 1 + 0.055*Math.sin(v.x*2.3+sd)*Math.cos(v.y*2.0+sd*1.7) + 0.035*Math.sin(v.z*2.7+sd*2.3) + 0.02*Math.cos(v.y*4.1+sd);
      v.multiplyScalar(d); pos.setXYZ(i, v.x*rx, v.y*ry, v.z*rz);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color, roughness:0.58, metalness:0.0, envMapIntensity:1.15 });
    const m = new THREE.Mesh(geo, mat); m.castShadow=true; m.receiveShadow=true; disposables.push(geo,mat); return m;
  }
  const specs=[
    {rx:1.55,ry:0.62,rz:1.30,sd:1.2},{rx:1.28,ry:0.60,rz:1.12,sd:3.4},
    {rx:1.04,ry:0.56,rz:0.94,sd:5.1},{rx:0.80,ry:0.50,rz:0.74,sd:2.0},{rx:0.58,ry:0.46,rz:0.55,sd:6.3},
  ];
  let y=-1.25; const stones=[];
  specs.forEach((s,i)=>{ const st=makePebble(s.rx,s.ry,s.rz,STONE[i],s.sd); y+=s.ry;
    st.userData.baseY=y; st.userData.baseX=(i%2?1:-1)*0.05*i;
    st.position.set(st.userData.baseX,y,0); st.rotation.y=i*0.8; st.rotation.z=(i%2?1:-1)*0.04;
    y+=s.ry-0.08; cairn.add(st); stones.push(st); });

  const target={x:0,y:0}, current={x:0,y:0};
  let progress=0, progressTarget=0, intro=1;
  const gpos={x:0,y:0,s:1};   // smoothed group transform
  function onPointer(e){ const r=stageEl.getBoundingClientRect(); target.x=((e.clientX-r.left)/r.width-0.5)*2; target.y=((e.clientY-r.top)/r.height-0.5)*2; }
  window.addEventListener('pointermove', onPointer, { passive:true });

  function sizeAll(){ const w=stageEl.clientWidth,h=stageEl.clientHeight; if(!w||!h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, TIER==='full'?2:1.5));
    renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
  const ro=new ResizeObserver(sizeAll); ro.observe(stageEl); sizeAll();

  let running=false, rafId=0, t0=performance.now();
  document.addEventListener('visibilitychange', ()=> document.hidden?stop():start());

  function tick(now){
    rafId=requestAnimationFrame(tick); const dt=Math.min((now-t0)/1000,0.05); t0=now;
    intro += (0 - intro) * 0.02;
    progress += (progressTarget-progress)*0.06;
    // slow cinematic camera drift (a gentle handheld dolly, not an effect)
    var ct = now*0.001;
    camera.position.x = Math.sin(ct*0.11)*0.22;
    camera.position.y = 0.5 + Math.cos(ct*0.13)*0.12;
    camera.lookAt(0, 0.35, 0);
    // travel across the viewport with scroll (sweeps right -> left -> right), drifting + scaling
    var wide = camera.aspect > 1.05;
    var range = wide ? 2.2 : 0.9;
    var tx = Math.cos(progress*Math.PI*2) * range;
    var ty = 0.25 + Math.sin(progress*Math.PI*3) * 0.6 - intro*1.2;
    var ts = (wide ? 1.0 : 0.72) - progress*0.12;
    gpos.x += (tx - gpos.x)*0.05; gpos.y += (ty - gpos.y)*0.05; gpos.s += (ts - gpos.s)*0.05;
    cairn.position.set(gpos.x + current.x*0.4, gpos.y, 0);
    cairn.scale.setScalar(gpos.s);
    cairn.rotation.y += dt*0.18;        // continuous slow spin
    cairn.rotation.x = -current.y*0.12;
    cairn.rotation.z = current.x*0.05 + progress*0.6;   // tips as it travels
    current.x += (target.x-current.x)*0.045; current.y += (target.y-current.y)*0.045;
    renderer.render(scene,camera);
  }
  function start(){ if(running) return; running=true; t0=performance.now(); rafId=requestAnimationFrame(tick); stageEl.classList.add('cairn-3d-ready'); }
  function stop(){ running=false; cancelAnimationFrame(rafId); }
  start();

  function destroy(){ stop(); ro.disconnect(); window.removeEventListener('pointermove',onPointer);
    disposables.forEach(o=>o.dispose&&o.dispose()); pmrem.dispose(); renderer.dispose(); if(renderer.forceContextLoss) renderer.forceContextLoss(); canvas.remove(); }
  return { destroy, setProgress(p){ progressTarget=Math.max(0,Math.min(1,p)); } };
}
