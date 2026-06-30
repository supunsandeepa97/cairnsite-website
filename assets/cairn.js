// cairn.js — refined, professional procedural Cairnsite mark.
// Matte stones, soft studio lighting, elegant motion. No glow / particles / bloom.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const STONE = [0x9c958a, 0xb1a99d, 0x8e887d, 0xa8a094, 0x959085]; // muted neutral stone tones

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const camBase = { y:0.9, z:8.0 };
  camera.position.set(0, camBase.y, camBase.z);
  let lookX = 0;

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(3.5, 7, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024,1024); key.shadow.camera.near=1; key.shadow.camera.far=24; key.shadow.radius=8;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xaebfc6, 0.45); fill.position.set(-4,2,-3); scene.add(fill);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(6,48), new THREE.ShadowMaterial({ opacity:0.18 }));
  ground.rotation.x = -Math.PI/2; ground.position.y = -1.5; ground.receiveShadow = true; scene.add(ground);

  const cairn = new THREE.Group(); scene.add(cairn);
  const disposables = [];

  function makeStone(radius, flatten, color, jitter){
    const geo = new THREE.IcosahedronGeometry(radius,1); const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){ let n=Math.sin(i*12.9898)*43758.5453; n=n-Math.floor(n); const f=1+(n-0.5)*jitter; pos.setXYZ(i,pos.getX(i)*f,pos.getY(i)*f,pos.getZ(i)*f); }
    geo.computeVertexNormals(); geo.scale(1,flatten,1);
    const mat = new THREE.MeshStandardMaterial({ color, roughness:0.92, metalness:0.0, envMapIntensity:0.7 });
    const m = new THREE.Mesh(geo, mat); m.castShadow=true; m.receiveShadow=true; disposables.push(geo,mat); return m;
  }
  const specs=[
    {r:1.18,flat:0.46,j:0.16},{r:0.97,flat:0.49,j:0.18},
    {r:0.79,flat:0.51,j:0.20},{r:0.61,flat:0.53,j:0.22},{r:0.45,flat:0.56,j:0.24},
  ];
  let y=-1.2; const stones=[];
  specs.forEach((s,i)=>{ const st=makeStone(s.r,s.flat,STONE[i],s.j); const h=s.r*s.flat*2; y+=h*0.5;
    st.userData.baseY=y; st.userData.baseX=(i%2?1:-1)*0.04*i;
    st.position.set(st.userData.baseX,y,0); st.rotation.y=i*0.7; y+=h*0.5-h*0.12; cairn.add(st); stones.push(st); });

  const target={x:0,y:0}, current={x:0,y:0};
  let progress=0, progressTarget=0, intro=1;
  function onPointer(e){ const r=stageEl.getBoundingClientRect(); target.x=((e.clientX-r.left)/r.width-0.5)*2; target.y=((e.clientY-r.top)/r.height-0.5)*2; }
  window.addEventListener('pointermove', onPointer, { passive:true });

  function sizeAll(){ const w=stageEl.clientWidth,h=stageEl.clientHeight; if(!w||!h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, TIER==='full'?2:1.5));
    renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
    lookX = camera.aspect > 1.15 ? -1.4 : 0; }
  const ro=new ResizeObserver(sizeAll); ro.observe(stageEl); sizeAll();

  let onScreen=true;
  const io=new IntersectionObserver(([e])=>{ onScreen=e.isIntersecting; onScreen?start():stop(); },{threshold:0.01}); io.observe(stageEl);
  document.addEventListener('visibilitychange', ()=> document.hidden?stop():(onScreen&&start()));

  let rafId=0, running=false, t0=performance.now();
  function tick(now){
    rafId=requestAnimationFrame(tick); const dt=Math.min((now-t0)/1000,0.05); t0=now;
    intro += (0 - intro) * 0.024;
    progress += (progressTarget-progress)*0.08;
    cairn.rotation.y += dt*(0.16 + progress*0.3);
    current.x += (target.x-current.x)*0.05; current.y += (target.y-current.y)*0.05;
    cairn.rotation.z = current.x*0.04;
    camera.position.x = current.x*0.5;
    camera.position.y = camBase.y - current.y*0.25 + progress*0.2 + intro*0.4;
    camera.position.z = camBase.z - progress*1.4 + intro*1.0;
    camera.lookAt(lookX, 0.35, 0);
    stones.forEach((s,i)=>{
      const ty = s.userData.baseY + progress*(0.28+i*0.16) - intro*(2.0 + i*0.45);
      const tx = s.userData.baseX + progress*Math.sin(i*1.7)*0.4;
      s.position.y += (ty - s.position.y)*0.1; s.position.x += (tx - s.position.x)*0.1;
      s.rotation.y += dt*(0.12 + progress*0.35)*(i%2?1:-1);
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
