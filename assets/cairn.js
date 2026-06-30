// cairn.js — cinematic full-bleed procedural Cairnsite hero.
// Tier-aware (mid/full), load-assemble intro, scroll-driven. Gated/deferred by index.html.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const BRAND = { stoneA:0xC9B79C, stoneB:0xD3BFA1, ember:0xC2691B, pine:0x0A4F33, paper:0xF3F5F1 };

export function mountCairn(stageEl, opts){
  opts = opts || {};
  const TIER = opts.tier || 'full';
  const wantBloom = TIER === 'full';
  const EMBERS = TIER === 'full' ? 340 : 190;
  const DUST   = TIER === 'full' ? 420 : 0;

  const canvas = document.createElement('canvas');
  canvas.className = 'cairn-canvas'; canvas.setAttribute('aria-hidden','true');
  stageEl.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIER === 'full' ? 2 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x062a1b, 0.072);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const camBase = { y:1.0, z:7.8 };
  camera.position.set(0, camBase.y, camBase.z);
  let lookX = 0; // shifted right on wide screens so hero text (left) stays clear

  scene.add(new THREE.AmbientLight(BRAND.paper, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(3,6,4); key.castShadow=true;
  key.shadow.mapSize.set(1024,1024); key.shadow.camera.near=1; key.shadow.camera.far=22; key.shadow.radius=7; scene.add(key);
  const warm = new THREE.PointLight(BRAND.ember, 7, 9, 2); warm.position.set(0,2.4,1.4); scene.add(warm);
  const fill = new THREE.DirectionalLight(0x2f8f63, 0.5); fill.position.set(-4,1,-3); scene.add(fill);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(5,48), new THREE.ShadowMaterial({ opacity:0.26 }));
  ground.rotation.x = -Math.PI/2; ground.position.y = -1.5; ground.receiveShadow = true; scene.add(ground);

  const cairn = new THREE.Group(); scene.add(cairn);
  const disposables = [];
  const rim = { value: 1.2 };

  function stoneMaterial(color){
    const mat = new THREE.MeshStandardMaterial({ color, roughness:0.8, metalness:0.05, envMapIntensity:1.0 });
    mat.onBeforeCompile = (sh)=>{
      sh.uniforms.uRimPower={value:2.6}; sh.uniforms.uRimColor={value:new THREE.Color(BRAND.ember)}; sh.uniforms.uRimStrength=rim;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>','#include <common>\nuniform float uRimPower;\nuniform vec3 uRimColor;\nuniform float uRimStrength;')
        .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n vec3 _vn=normalize(vNormal); vec3 _vd=normalize(vViewPosition); float _f=pow(1.0-clamp(dot(_vn,_vd),0.0,1.0),uRimPower); totalEmissiveRadiance += uRimColor*_f*uRimStrength;');
    };
    disposables.push(mat); return mat;
  }
  function makeStone(radius, flatten, color, jitter){
    const geo = new THREE.IcosahedronGeometry(radius,1); const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){ let n=Math.sin(i*12.9898)*43758.5453; n=n-Math.floor(n); const f=1+(n-0.5)*jitter; pos.setXYZ(i,pos.getX(i)*f,pos.getY(i)*f,pos.getZ(i)*f); }
    geo.computeVertexNormals(); geo.scale(1,flatten,1);
    const m=new THREE.Mesh(geo,stoneMaterial(color)); m.castShadow=true; m.receiveShadow=true; disposables.push(geo); return m;
  }
  const specs=[
    {r:1.18,flat:0.45,c:BRAND.stoneA,j:0.18},{r:0.97,flat:0.48,c:BRAND.stoneB,j:0.20},
    {r:0.79,flat:0.50,c:BRAND.stoneA,j:0.22},{r:0.61,flat:0.52,c:BRAND.stoneB,j:0.24},{r:0.45,flat:0.55,c:BRAND.stoneA,j:0.26},
  ];
  let y=-1.2; const stones=[];
  specs.forEach((s,i)=>{ const st=makeStone(s.r,s.flat,s.c,s.j); const h=s.r*s.flat*2; y+=h*0.5;
    st.userData.baseY=y; st.userData.baseX=(i%2?1:-1)*0.04*i; st.userData.idx=i;
    st.position.set(st.userData.baseX,y,0); st.rotation.y=i*0.7; y+=h*0.5-h*0.12; cairn.add(st); stones.push(st); });
  const topBaseY=y+0.34;

  const sparkMat=new THREE.MeshStandardMaterial({color:BRAND.ember,emissive:BRAND.ember,emissiveIntensity:2.6,roughness:0.4});
  const spark=new THREE.Mesh(new THREE.IcosahedronGeometry(0.14,0),sparkMat); spark.position.set(0,topBaseY,0); cairn.add(spark);
  disposables.push(sparkMat,spark.geometry);
  const glowTex=radialTex(BRAND.ember);
  const glowMat=new THREE.SpriteMaterial({map:glowTex,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false});
  const glow=new THREE.Sprite(glowMat); glow.scale.set(1.4,1.4,1); glow.position.copy(spark.position); cairn.add(glow);
  disposables.push(glowTex,glowMat);

  // ember field
  const epos=new Float32Array(EMBERS*3), eseed=new Float32Array(EMBERS);
  for(let i=0;i<EMBERS;i++){ epos[i*3]=(Math.random()-0.5)*3.6; epos[i*3+1]=Math.random()*4.5-1.3; epos[i*3+2]=(Math.random()-0.5)*3.6; eseed[i]=Math.random(); }
  const eg=new THREE.BufferGeometry(); eg.setAttribute('position',new THREE.BufferAttribute(epos,3));
  const emberTex=radialTex(BRAND.ember);
  const emberMat=new THREE.PointsMaterial({map:emberTex,color:BRAND.ember,size:0.07,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true});
  const embers=new THREE.Points(eg,emberMat); scene.add(embers); disposables.push(eg,emberTex,emberMat);

  // dust depth field (full tier)
  let dust=null, dg=null;
  if(DUST){
    const dpos=new Float32Array(DUST*3);
    for(let i=0;i<DUST;i++){ dpos[i*3]=(Math.random()-0.5)*14; dpos[i*3+1]=(Math.random()-0.5)*9; dpos[i*3+2]=(Math.random()-0.5)*8-2; }
    dg=new THREE.BufferGeometry(); dg.setAttribute('position',new THREE.BufferAttribute(dpos,3));
    const dtex=radialTex(BRAND.paper);
    const dmat=new THREE.PointsMaterial({map:dtex,color:BRAND.paper,size:0.04,transparent:true,opacity:0.22,depthWrite:false,sizeAttenuation:true});
    dust=new THREE.Points(dg,dmat); scene.add(dust); disposables.push(dg,dtex,dmat);
  }

  function radialTex(hex){
    const c=document.createElement('canvas'); c.width=c.height=64; const ctx=c.getContext('2d');
    const col=new THREE.Color(hex); const rgb=`${(col.r*255)|0},${(col.g*255)|0},${(col.b*255)|0}`;
    const g=ctx.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,`rgba(${rgb},1)`); g.addColorStop(0.45,`rgba(${rgb},0.4)`); g.addColorStop(1,`rgba(${rgb},0)`);
    ctx.fillStyle=g; ctx.fillRect(0,0,64,64); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
  }

  let composer=null;
  function setupBloom(){
    return Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
      import('three/addons/postprocessing/OutputPass.js'),
    ]).then(([EC,RP,UB,OP])=>{
      composer=new EC.EffectComposer(renderer);
      composer.addPass(new RP.RenderPass(scene,camera));
      const b=new UB.UnrealBloomPass(new THREE.Vector2(stageEl.clientWidth||1,stageEl.clientHeight||1),0.7,0.5,0.82);
      composer.addPass(b); composer.addPass(new OP.OutputPass()); composer._bloom=b; sizeAll();
    }).catch(()=>{ composer=null; });
  }
  if(wantBloom) setupBloom();

  const target={x:0,y:0}, current={x:0,y:0};
  let progress=0, progressTarget=0, intro=1;
  function onPointer(e){ const r=stageEl.getBoundingClientRect(); target.x=((e.clientX-r.left)/r.width-0.5)*2; target.y=((e.clientY-r.top)/r.height-0.5)*2; }
  window.addEventListener('pointermove', onPointer, { passive:true });

  function sizeAll(){
    const w=stageEl.clientWidth, h=stageEl.clientHeight; if(!w||!h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, TIER==='full'?2:1.5));
    renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
    lookX = camera.aspect > 1.15 ? -1.5 : 0;     // push cairn right on wide screens
    if(composer){ composer.setSize(w,h); if(composer._bloom) composer._bloom.setSize(w,h); }
  }
  const ro=new ResizeObserver(sizeAll); ro.observe(stageEl); sizeAll();

  let onScreen=true;
  const io=new IntersectionObserver(([e])=>{ onScreen=e.isIntersecting; onScreen?start():stop(); },{threshold:0.01}); io.observe(stageEl);
  document.addEventListener('visibilitychange', ()=> document.hidden?stop():(onScreen&&start()));

  let rafId=0, running=false, t0=performance.now();
  function tick(now){
    rafId=requestAnimationFrame(tick); const dt=Math.min((now-t0)/1000,0.05); t0=now;
    intro += (0 - intro) * 0.026;                 // load-assemble ease
    progress += (progressTarget-progress)*0.08;
    cairn.rotation.y += dt*(0.26 + progress*0.5);
    current.x += (target.x-current.x)*0.05; current.y += (target.y-current.y)*0.05;
    cairn.rotation.z = current.x*0.05;
    camera.position.x = -lookX*0.0 + current.x*0.6;
    camera.position.y = camBase.y - current.y*0.3 + progress*0.25 + intro*0.5;
    camera.position.z = camBase.z - progress*2.0 + intro*1.4;
    camera.lookAt(lookX, 0.4, 0);
    stones.forEach((s,i)=>{
      const ty = s.userData.baseY + progress*(0.4+i*0.22) - intro*(2.4 + i*0.5);
      const tx = s.userData.baseX + progress*Math.sin(i*1.7)*0.55 + intro*Math.sin(i*2.1)*0.6;
      s.position.y += (ty - s.position.y)*0.12; s.position.x += (tx - s.position.x)*0.12;
      s.rotation.y += dt*(0.18 + progress*0.6)*(i%2?1:-1);
    });
    spark.position.y = topBaseY + progress*1.5 - intro*1.5; glow.position.copy(spark.position);
    rim.value = (1.0 + progress*1.7)*(1-intro*0.7) + Math.sin(now*0.003)*0.15;
    const pulse=1+Math.sin(now*0.004)*0.25; sparkMat.emissiveIntensity=(2.2+progress*1.6)*pulse*(1-intro*0.85); glow.scale.setScalar((1.4+progress*0.7)*pulse*(1-intro*0.6));
    warm.intensity = (5+progress*5)*(1-intro*0.6);
    const p=eg.attributes.position;
    for(let i=0;i<EMBERS;i++){ let yy=p.getY(i)+0.007+eseed[i]*0.004; if(yy>3.4) yy=-1.3; p.setX(i,p.getX(i)+Math.sin((yy+eseed[i]*6)*2)*0.001); p.setY(i,yy); }
    p.needsUpdate=true; emberMat.opacity=(0.55+progress*0.4)*(1-intro*0.8);
    if(dust){ const q=dg.attributes.position; for(let i=0;i<DUST;i++){ let yy=q.getY(i)+0.002; if(yy>4.5) yy=-4.5; q.setY(i,yy); } q.needsUpdate=true; }
    composer ? composer.render() : renderer.render(scene,camera);
  }
  function start(){ if(running) return; running=true; t0=performance.now(); rafId=requestAnimationFrame(tick); stageEl.classList.add('cairn-3d-ready'); }
  function stop(){ running=false; cancelAnimationFrame(rafId); }
  start();

  function destroy(){ stop(); io.disconnect(); ro.disconnect(); window.removeEventListener('pointermove',onPointer);
    disposables.forEach(o=>o.dispose&&o.dispose()); if(composer&&composer.dispose) composer.dispose(); pmrem.dispose(); renderer.dispose(); if(renderer.forceContextLoss) renderer.forceContextLoss(); canvas.remove(); }
  return { destroy, setProgress(p){ progressTarget=Math.max(0,Math.min(1,p)); } };
}
