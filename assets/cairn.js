// cairn.js — procedural 3D Cairnsite mark for the hero.
// Loaded deferred + capability-gated by the boot script in index.html.
// Vanilla ES module; `three` resolves via the page importmap.
import * as THREE from 'three';

const BRAND = { stoneA:0xC9B79C, stoneB:0xD3BFA1, ember:0xC2691B, paper:0xF3F5F1 };

export function mountCairn(stageEl){
  const canvas = document.createElement('canvas');
  canvas.className = 'cairn-canvas';
  canvas.setAttribute('aria-hidden','true');
  stageEl.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 1.0, 7.4);
  camera.lookAt(0, 0.5, 0);

  scene.add(new THREE.AmbientLight(BRAND.paper, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(3, 6, 4); key.castShadow = true;
  key.shadow.mapSize.set(512, 512); key.shadow.camera.near = 1; key.shadow.camera.far = 20; key.shadow.radius = 6;
  scene.add(key);
  const rim = new THREE.DirectionalLight(BRAND.ember, 0.4); rim.position.set(-3, 1, -4); scene.add(rim);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.ShadowMaterial({ opacity:0.22 }));
  ground.rotation.x = -Math.PI/2; ground.position.y = -1.4; ground.receiveShadow = true; scene.add(ground);

  const cairn = new THREE.Group(); scene.add(cairn);
  const disposables = [];

  function makeStone(radius, flatten, color, jitter){
    const geo = new THREE.IcosahedronGeometry(radius, 1);
    const pos = geo.attributes.position;
    for (let i=0;i<pos.count;i++){
      let n = (Math.sin(i*12.9898)*43758.5453); n = n - Math.floor(n);
      const f = 1 + (n - 0.5) * jitter;
      pos.setXYZ(i, pos.getX(i)*f, pos.getY(i)*f, pos.getZ(i)*f);
    }
    geo.computeVertexNormals(); geo.scale(1, flatten, 1);
    const mat = new THREE.MeshStandardMaterial({ color, roughness:0.86, metalness:0 });
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
    disposables.push(geo, mat); return m;
  }

  const specs = [
    { r:1.15, flat:0.45, c:BRAND.stoneA, j:0.18 },
    { r:0.95, flat:0.48, c:BRAND.stoneB, j:0.20 },
    { r:0.78, flat:0.50, c:BRAND.stoneA, j:0.22 },
    { r:0.60, flat:0.52, c:BRAND.stoneB, j:0.24 },
    { r:0.44, flat:0.55, c:BRAND.stoneA, j:0.26 },
  ];
  let y = -1.15;
  specs.forEach((s,i)=>{
    const stone = makeStone(s.r, s.flat, s.c, s.j);
    const h = s.r*s.flat*2; y += h*0.5;
    stone.position.y = y; stone.position.x = (i%2?1:-1)*0.04*i; stone.rotation.y = i*0.7;
    y += h*0.5 - h*0.12; cairn.add(stone);
  });
  const topY = y + 0.32;

  const sparkGeo = new THREE.IcosahedronGeometry(0.12, 0);
  const sparkMat = new THREE.MeshStandardMaterial({ color:BRAND.ember, emissive:BRAND.ember, emissiveIntensity:2.2, roughness:0.4, metalness:0 });
  const spark = new THREE.Mesh(sparkGeo, sparkMat); spark.position.set(0, topY, 0); cairn.add(spark);
  disposables.push(sparkGeo, sparkMat);

  const glowTex = makeGlow(BRAND.ember);
  const glowMat = new THREE.SpriteMaterial({ map:glowTex, blending:THREE.AdditiveBlending, transparent:true, depthWrite:false });
  const glow = new THREE.Sprite(glowMat); glow.scale.set(1.1,1.1,1); glow.position.copy(spark.position); cairn.add(glow);
  disposables.push(glowTex, glowMat);

  function makeGlow(hex){
    const c = document.createElement('canvas'); c.width=c.height=64; const ctx=c.getContext('2d');
    const col=new THREE.Color(hex); const rgb=`${(col.r*255)|0},${(col.g*255)|0},${(col.b*255)|0}`;
    const g=ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,`rgba(${rgb},0.9)`); g.addColorStop(0.4,`rgba(${rgb},0.35)`); g.addColorStop(1,`rgba(${rgb},0)`);
    ctx.fillStyle=g; ctx.fillRect(0,0,64,64); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
  }

  const target={x:0,y:0}, current={x:0,y:0};
  function onPointer(e){ const r=stageEl.getBoundingClientRect(); target.x=((e.clientX-r.left)/r.width-0.5)*2; target.y=((e.clientY-r.top)/r.height-0.5)*2; }
  window.addEventListener('pointermove', onPointer, { passive:true });

  function resize(){ const w=stageEl.clientWidth,h=stageEl.clientHeight; if(!w||!h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5)); renderer.setSize(w,h,false);
    camera.aspect=w/h; camera.updateProjectionMatrix(); }
  const ro=new ResizeObserver(resize); ro.observe(stageEl); resize();

  let onScreen=true;
  const io=new IntersectionObserver(([e])=>{ onScreen=e.isIntersecting; onScreen?start():stop(); },{threshold:0.01}); io.observe(stageEl);
  document.addEventListener('visibilitychange', ()=> document.hidden?stop():(onScreen&&start()));

  let rafId=0, running=false, t0=performance.now();
  function tick(now){
    rafId=requestAnimationFrame(tick); const dt=Math.min((now-t0)/1000,0.05); t0=now;
    cairn.rotation.y += dt*0.35;
    current.x += (target.x-current.x)*0.05; current.y += (target.y-current.y)*0.05;
    cairn.rotation.z = current.x*0.05; camera.position.x = current.x*0.5; camera.position.y = 1.0 - current.y*0.3; camera.lookAt(0,0.5,0);
    const pulse = 1 + Math.sin(now*0.004)*0.25; sparkMat.emissiveIntensity = 2.0*pulse; glow.scale.setScalar(1.1*pulse);
    renderer.render(scene,camera);
  }
  function start(){ if(running||document.hidden) return; running=true; t0=performance.now(); rafId=requestAnimationFrame(tick); stageEl.classList.add('cairn-3d-ready'); }
  function stop(){ running=false; cancelAnimationFrame(rafId); }
  start();

  function destroy(){ stop(); io.disconnect(); ro.disconnect(); window.removeEventListener('pointermove', onPointer);
    disposables.forEach(o=>o.dispose&&o.dispose()); renderer.dispose(); if(renderer.forceContextLoss) renderer.forceContextLoss(); canvas.remove(); }
  return { destroy };
}
