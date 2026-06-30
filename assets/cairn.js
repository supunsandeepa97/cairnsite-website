// cairn.js — refined, smooth procedural Cairnsite mark (premium product-render look).
// Smooth high-poly pebbles, matte stone material, soft studio lighting. No glow/particles.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const STONE = [0xb9b1a4, 0xa69e91, 0xc3bcb0, 0x9d958a, 0xb0a99c]; // warm neutral pebble greys

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.025).texture;

  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
  const camBase = { y:0.7, z:8.4 };
  camera.position.set(0, camBase.y, camBase.z);
  let lookX = 0;

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xfff6ec, 2.4);
  key.position.set(4, 8, 6); key.castShadow = true;
  key.shadow.mapSize.set(2048,2048); key.shadow.camera.near=1; key.shadow.camera.far=28;
  key.shadow.radius=10; key.shadow.bias=-0.0002;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcd0dc, 0.6); fill.position.set(-5,2,-2); scene.add(fill);
  const rimL = new THREE.DirectionalLight(0xffffff, 0.5); rimL.position.set(-2,3,-6); scene.add(rimL);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(8,64), new THREE.ShadowMaterial({ opacity:0.16 }));
  ground.rotation.x = -Math.PI/2; ground.position.y = -1.55; ground.receiveShadow = true; scene.add(ground);

  const cairn = new THREE.Group(); scene.add(cairn);
  const disposables = [];

  // smooth ellipsoid pebble with gentle low-frequency surface (no faceting/jitter)
  function makePebble(rx, ry, rz, color, sd){
    const geo = new THREE.SphereGeometry(1, 96, 64);
    const pos = geo.attributes.position; const v = new THREE.Vector3();
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos,i);
      const d = 1
        + 0.055*Math.sin(v.x*2.3 + sd) * Math.cos(v.y*2.0 + sd*1.7)
        + 0.035*Math.sin(v.z*2.7 + sd*2.3)
        + 0.02 *Math.cos(v.y*4.1 + sd);
      v.multiplyScalar(d);
      pos.setXYZ(i, v.x*rx, v.y*ry, v.z*rz);
    }
    geo.computeVertexNormals();                    // smooth shading
    const mat = new THREE.MeshStandardMaterial({ color, roughness:0.58, metalness:0.0, envMapIntensity:1.15 });
    const m = new THREE.Mesh(geo, mat); m.castShadow=true; m.receiveShadow=true;
    disposables.push(geo, mat); return m;
  }

  // rx, ry(height/flatten), rz per pebble — gently varied, narrowing upward
  const specs = [
    { rx:1.55, ry:0.62, rz:1.30, sd:1.2 },
    { rx:1.28, ry:0.60, rz:1.12, sd:3.4 },
    { rx:1.04, ry:0.56, rz:0.94, sd:5.1 },
    { rx:0.80, ry:0.50, rz:0.74, sd:2.0 },
    { rx:0.58, ry:0.46, rz:0.55, sd:6.3 },
  ];
  let y = -1.25; const stones = [];
  specs.forEach((s,i)=>{
    const st = makePebble(s.rx, s.ry, s.rz, STONE[i], s.sd);
    y += s.ry; st.userData.baseY = y; st.userData.baseX = (i%2?1:-1)*0.05*i;
    st.position.set(st.userData.baseX, y, 0);
    st.rotation.y = i*0.8; st.rotation.z = (i%2?1:-1)*0.04;
    y += s.ry - 0.08; cairn.add(st); stones.push(st);
  });

  const target={x:0,y:0}, current={x:0,y:0};
  let progress=0, progressTarget=0, intro=1;
  function onPointer(e){ const r=stageEl.getBoundingClientRect(); target.x=((e.clientX-r.left)/r.width-0.5)*2; target.y=((e.clientY-r.top)/r.height-0.5)*2; }
  window.addEventListener('pointermove', onPointer, { passive:true });

  function sizeAll(){ const w=stageEl.clientWidth,h=stageEl.clientHeight; if(!w||!h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, TIER==='full'?2:1.5));
    renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
    lookX = camera.aspect > 1.15 ? -1.5 : 0; }
  const ro=new ResizeObserver(sizeAll); ro.observe(stageEl); sizeAll();

  let onScreen=true;
  const io=new IntersectionObserver(([e])=>{ onScreen=e.isIntersecting; onScreen?start():stop(); },{threshold:0.01}); io.observe(stageEl);
  document.addEventListener('visibilitychange', ()=> document.hidden?stop():(onScreen&&start()));

  let rafId=0, running=false, t0=performance.now();
  function tick(now){
    rafId=requestAnimationFrame(tick); const dt=Math.min((now-t0)/1000,0.05); t0=now;
    intro += (0 - intro) * 0.02;                   // gentle assemble
    progress += (progressTarget-progress)*0.07;
    cairn.rotation.y += dt*(0.12 + progress*0.25); // slow, elegant
    current.x += (target.x-current.x)*0.045; current.y += (target.y-current.y)*0.045;
    cairn.rotation.z = current.x*0.03;
    camera.position.x = current.x*0.45;
    camera.position.y = camBase.y - current.y*0.22 + progress*0.2 + intro*0.35;
    camera.position.z = camBase.z - progress*1.3 + intro*0.9;
    camera.lookAt(lookX, 0.25, 0);
    stones.forEach((s,i)=>{
      const ty = s.userData.baseY + progress*(0.22+i*0.14) - intro*(1.1 + i*0.32);
      const tx = s.userData.baseX + progress*Math.sin(i*1.7)*0.32;
      s.position.y += (ty - s.position.y)*0.09; s.position.x += (tx - s.position.x)*0.09;
      s.rotation.y += dt*(0.08 + progress*0.25)*(i%2?1:-1);
    });
    renderer.render(scene,camera);
  }
  function start(){ if(running) return; running=true; t0=performance.now(); rafId=requestAnimationFrame(tick); stageEl.classList.add('cairn-3d-ready'); }
  function stop(){ running=false; cancelAnimationFrame(rafId); }
  start();

  function destroy(){ stop(); io.disconnect(); ro.disconnect(); window.removeEventListener('pointermove',onPointer);
    disposables.forEach(o=>o.dispose&&o.dispose()); pmrem.dispose(); renderer.dispose(); if(renderer.forceContextLoss) renderer.forceContextLoss(); canvas.remove(); }
  return { destroy, setProgress(p){ progressTarget=Math.max(0,Math.min(1,p)); } };
}
