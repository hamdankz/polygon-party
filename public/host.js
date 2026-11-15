const overlay=$('#overlay'),hud=$('#hud'),canvas=$('#renderCanvas');
let room=null,hostCode=null,engine=null,scene=null,karts=new Map(),orbs=[],lastTick=performance.now(),progressTimer=0,raceEndTimer=0,starting=false,renderedPhase='';
const palette=['#54a7ff','#ff766a','#ffd55b','#77e3a6'];
const MAP_STYLES={
 'Coastal Loop':{ground:'#5da96c',road:'#565c66',sky:'#9bdaff',decor:'#2d8658'},
 'Neon Circuit':{ground:'#252a4c',road:'#454b68',sky:'#141c3d',decor:'#b24aff'},
 'Desert Dash':{ground:'#c99c5b',road:'#6c6158',sky:'#ffd49c',decor:'#a9783e'},
 'Frost Ring':{ground:'#d9ebf7',road:'#697d91',sky:'#b6dfff',decor:'#79bbdb'}
};
function hostInit(){overlay.innerHTML=`<section class="panel center"><h1>🏁 KART PARTY</h1><h2>TV / Host Screen</h2><p>Open this page on a laptop connected to your TV. Friends join on their phones.</p><button id="create">Create Lobby</button><p class="error"></p></section>`;$('#create').onclick=async()=>{const res=await ack('host:create',{});if(res.ok){hostCode=res.code;sessionStorage.setItem('kartHostCode',hostCode);history.replaceState(null,'',`/host.html?code=${hostCode}`);}else setError(res.error);};const code=new URLSearchParams(location.search).get('code')||sessionStorage.getItem('kartHostCode');if(code){ack('host:reclaim',{code}).then(res=>{if(res.ok)hostCode=res.code;});}}
function hostView(r){room=r;if(r.phase==='racing'){if(renderedPhase!=='racing')start3D(r);renderedPhase='racing';return;}if(renderedPhase==='racing')stop3D();renderedPhase=r.phase;overlay.classList.remove('hidden');hud.classList.add('hidden');
 const players=`<div class="players">${r.players.map((p,i)=>`<div class="player" style="border-top:4px solid ${palette[i]}">${avatarHTML(p.avatar)}<b>${esc(p.name)}</b>${r.phase==='customize'?`<div>${esc(p.character)} · ${esc(p.kart)}<br>${p.ready?'✅ Ready':'⌛ Choosing'}</div>`:''}</div>`).join('')}</div>`;
 if(r.phase==='lobby')overlay.innerHTML=`<section class="panel center"><h1>🏎️ KART PARTY</h1><p>Players: open <strong>${esc(location.origin)}/play.html</strong></p><p>Enter room code:</p><div class="code">${esc(r.code)}</div><p>${r.players.length}/4 players connected</p>${players}<button id="next" ${!r.players.length?'disabled':''}>Start Game → Map Vote</button><p class="error"></p><p class="footer">Keep this tab open and use fullscreen (F11). 1–4 players supported.</p></section>`;
 else if(r.phase==='voting'){const counts=Object.fromEntries(MAPS.map(m=>[m,r.players.filter(p=>p.vote===m).length]));overlay.innerHTML=`<section class="panel center"><h1>🗺️ MAP VOTING</h1><div class="grid">${MAPS.map(m=>`<div class="choice"><h3>${esc(m)}</h3><p>🗳️ ${counts[m]} vote${counts[m]===1?'':'s'}</p></div>`).join('')}</div><h2 id="countdown">Voting closes soon…</h2>${players}</section>`;}
 else if(r.phase==='mode')overlay.innerHTML=`<section class="panel center"><h1>🏆 MODE SELECT</h1><div class="status"><h2>CLASSIC RACE — 3 LAPS</h2><p>First across the finish line wins.</p></div><p>Chosen map: <b>${esc(r.map)}</b></p><button id="next">Continue to Racer Selection →</button><p class="error"></p></section>`;
 else if(r.phase==='customize')overlay.innerHTML=`<section class="panel center"><h1>🏎️ RACER SELECTION</h1><p>Players: choose your character, kart, and special power on your phone.</p>${players}<p>${r.players.filter(p=>p.ready).length}/${r.players.length} ready</p><button id="next" ${r.players.length===0||r.players.some(p=>!p.ready)?'disabled':''}>Start 3-Lap Race!</button><p class="error"></p></section>`;
 else if(r.phase==='results')overlay.innerHTML=`<section class="panel"><h1 class="center">🏆 FINAL LEADERBOARD</h1><p class="center">${esc(r.map)} · Classic 3-Lap Race</p>${(r.results||[]).map((p,i)=>`<div class="resultrow"><span style="font-size:1.5rem;font-weight:900">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span>${avatarHTML(p.avatar,true)}<span class="name">${esc(p.name)}</span><span>${p.finished?p.time.toFixed(2)+'s':'DNF'}</span></div>`).join('')}<div class="center"><button id="next">Play Again → Lobby</button></div><p class="error"></p></section>`;
 const next=$('#next');if(next)next.onclick=async()=>{const target={lobby:'voting',mode:'customize',customize:'racing',results:'lobby'}[r.phase];const res=await ack('host:advance',{phase:target});if(!res.ok)setError(res.error);};
}
function mat(name,hex,emissive=false){const m=new BABYLON.StandardMaterial(name,scene);m.diffuseColor=BABYLON.Color3.FromHexString(hex);if(emissive)m.emissiveColor=BABYLON.Color3.FromHexString(hex).scale(.6);return m;}
function createTrack(style){const rx=35,rz=24,width=12;
 const ground=BABYLON.MeshBuilder.CreateGround('terrain',{width:160,height:140},scene);ground.material=mat('grass',style.ground);ground.position.y=-.12;
 const outer=[],inner=[],middle=[];for(let i=0;i<=160;i++){const t=i/160*Math.PI*2;const dx=Math.cos(t),dz=Math.sin(t);outer.push(new BABYLON.Vector3((rx+width/2)*dx,.02,(rz+width/2)*dz));inner.push(new BABYLON.Vector3((rx-width/2)*dx,.02,(rz-width/2)*dz));middle.push(new BABYLON.Vector3(rx*dx,.045,rz*dz));}
 const road=BABYLON.MeshBuilder.CreateRibbon('road',{pathArray:[outer,inner],sideOrientation:BABYLON.Mesh.DOUBLESIDE},scene);road.material=mat('road',style.road);
 const white=mat('lines','#f7e7bd');for(let i=0;i<56;i++){const t=i/56*Math.PI*2;const p=new BABYLON.Vector3(rx*Math.cos(t),.08,rz*Math.sin(t));const box=BABYLON.MeshBuilder.CreateBox('dash',{width:1.6,height:.045,depth:.23},scene);box.position=p;box.rotation.y=-t;box.material=white;}
 for(const radius of [1,-1])for(let i=0;i<90;i++){const t=i/90*Math.PI*2;const b=BABYLON.MeshBuilder.CreateBox('kerb',{width:2.7,height:.16,depth:.5},scene);const rr=radius===1?width/2:-width/2;b.position.set((rx+rr)*Math.cos(t),.12,(rz+rr)*Math.sin(t));b.rotation.y=-t;b.material=mat('kerb'+i+(radius===1?'a':'b'),i%2?'#ffffff':'#ee665d');}
 for(let i=0;i<18;i++){const t=i/18*Math.PI*2,rad=50+(i%3)*5;const trunk=BABYLON.MeshBuilder.CreateCylinder('tree',{height:3,diameter:1},scene);trunk.position.set(rad*Math.cos(t),1.5,rad*.75*Math.sin(t));trunk.material=mat('wood'+i,'#80573d');const top=BABYLON.MeshBuilder.CreateSphere('top',{diameter:4.5,segments:8},scene);top.position.set(trunk.position.x,4.2,trunk.position.z);top.material=mat('leaf'+i,style.decor);}
 const line=BABYLON.MeshBuilder.CreateBox('finishline',{width:width,height:.08,depth:1.5},scene);line.position.set(rx,.09,0);line.rotation.y=Math.PI/2;line.material=mat('finish','#ffffff');
 for(let i=0;i<6;i++){const t=room.orbPositions[i]*Math.PI*2;const orb=BABYLON.MeshBuilder.CreateSphere('orb',{diameter:2.3,segments:12},scene);orb.position.set(rx*Math.cos(t),1.6,rz*Math.sin(t));orb.material=mat('orbmat'+i,'#45e9ff',true);const glow=BABYLON.MeshBuilder.CreateTorus('orbRing',{diameter:3.2,thickness:.2},scene);glow.position=orb.position.clone();glow.material=mat('glow'+i,'#c4ffff',true);orbs.push({orb,glow,index:i,angle:t});}
}
function start3D(r){overlay.classList.add('hidden');hud.classList.remove('hidden');if(engine)stop3D();engine=new BABYLON.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true},true);scene=new BABYLON.Scene(engine);const style=MAP_STYLES[r.map]||MAP_STYLES['Coastal Loop'];scene.clearColor=BABYLON.Color4.FromHexString(style.sky+'ff');scene.ambientColor=new BABYLON.Color3(.8,.8,.8);const light=new BABYLON.HemisphericLight('sun',new BABYLON.Vector3(.3,1,.5),scene);light.intensity=1.15;createTrack(style);
 karts.clear();const count=r.players.length;
 r.players.forEach((p,i)=>{
  const angle=-.09*i;const body=BABYLON.MeshBuilder.CreateBox('kart'+i,{width:2.1,height:.85,depth:3.2},scene);body.material=mat('kartmat'+i,palette[i]);
  const cockpit=BABYLON.MeshBuilder.CreateBox('seat'+i,{width:1.35,height:.7,depth:1.1},scene);cockpit.parent=body;cockpit.position.y=.7;cockpit.material=mat('seat'+i,'#202a3c');
  const head=BABYLON.MeshBuilder.CreateSphere('driver'+i,{diameter:.9},scene);head.parent=body;head.position.set(0,1.35,.1);head.material=mat('head'+i,'#ffe3ad');
  for(const side of [-1,1])for(const z of [-1,1]){const wheel=BABYLON.MeshBuilder.CreateCylinder('wheel',{height:.42,diameter:.9,tessellation:12},scene);wheel.parent=body;wheel.position.set(side*1.05,-.18,z*1.05);wheel.rotation.z=Math.PI/2;wheel.material=mat('tire'+i+side+z,'#1c2232');}
  body.position.set(35+angle*0,1,angle*23);body.rotation.y=0;
  const camera=new BABYLON.FreeCamera('camera'+i,new BABYLON.Vector3(35,8,angle*23-11),scene);camera.minZ=.1;camera.fov=.95;
  // Initialize behind this kart, not at world origin (prevents an initial camera fly-through).
  const initialTarget=body.position.add(new BABYLON.Vector3(0,2,8));
  camera.setTarget(initialTarget);
  const viewports=count===1?[[0,0,1,1]]:count===2?[[0,.5,1,.5],[0,0,1,.5]]:count===3?[[0,.5,.5,.5],[.5,.5,.5,.5],[0,0,1,.5]]:[[0,.5,.5,.5],[.5,.5,.5,.5],[0,0,.5,.5],[.5,0,.5,.5]];
  const v=viewports[i];camera.viewport=new BABYLON.Viewport(...v);
  karts.set(p.id,{id:p.id,body,camera,index:i,input:{steer:0,accelerate:false,brake:false,drift:false},speed:0,yaw:0,progress:0,prevAngle:angle,totalAngle:0,boostUntil:0,shieldUntil:0,finished:false,orbCooldown:new Map()});
 });scene.activeCameras=[...karts.values()].map(k=>k.camera);
 lastTick=performance.now();progressTimer=0;raceEndTimer=0;starting=true;
 engine.runRenderLoop(()=>{const now=performance.now();const dt=Math.min(.05,(now-lastTick)/1000);lastTick=now;updateRace(dt);scene.render();});window.addEventListener('resize',resizeEngine);
}
function resizeEngine(){engine?.resize();}
function stop3D(){if(engine){engine.stopRenderLoop();scene?.dispose();engine.dispose();engine=null;scene=null;}karts.clear();orbs=[];window.removeEventListener('resize',resizeEngine);}
function updateRace(dt){if(!room||!engine)return;const now=Date.now();const active=now>=room.raceStarted;
 if(active){for(const k of karts.values()){
  if(k.finished)continue;
  const inp=k.input;
  const target=inp.accelerate?23:inp.brake?-7:0;
  const acceleration=inp.accelerate?17:inp.brake?20:10;
  k.speed+=Math.max(-acceleration*dt,Math.min(acceleration*dt,target-k.speed));
  if(now<k.boostUntil)k.speed=Math.max(k.speed,34);
  const turn=inp.drift?2.2:1.5;
  k.yaw+=inp.steer*turn*dt*Math.min(1,Math.abs(k.speed)/9)*(k.speed>=0?1:-1);
  const dx=Math.sin(k.yaw)*k.speed*dt,dz=Math.cos(k.y)*k.speed*dt;
  k.body.position.x+=dx;k.body.position.z+=dz;
  const norm=Math.hypot(k.body.position.x/35,k.body.position.z/24);
  if(norm<.72||norm>1.28){k.speed*=Math.max(.5,1-2*dt);}
  if(norm<.56||norm>1.49){const safe=Math.max(.56,Math.min(1.49,norm));k.body.position.x*=safe/norm;k.body.position.z*=safe/norm;k.speed*=.5;}
  k.body.rotation.y=k.yaw;
  let angle=Math.atan2(k.body.position.z/24,k.body.position.x/35);let delta=angle-k.prevAngle;
  if(delta>Math.PI)delta-=Math.PI*2;if(delta< -Math.PI)delta+=Math.PI*2;
  // Credit only plausible forward movement near the track; backwards driving can reduce progress.
  if(norm>.73&&norm<1.27&&Math.abs(delta)<.13)k.totalAngle=Math.max(-.1,k.totalAngle+delta);
  k.prevAngle=angle;k.progress=Math.max(0,k.totalAngle/(Math.PI*2));
  if(k.progress>=3){k.finished=true;k.speed=0;}
  for(const o of orbs){const distance=BABYLON.Vector3.Distance(k.body.position,o.orb.position);const last=k.orbCooldown.get(o.index)||0;
   if(distance<3.5&&now-last>8000){k.orbCooldown.set(o.index,now);socket.emit('host:orb',{playerId:k.id,orbIndex:o.index});}
  }
 }
 }
 for(const k of karts.values()){
  const forward=new BABYLON.Vector3(Math.sin(k.yaw),0,Math.cos(k.yaw));const target=k.body.position.add(new BABYLON.Vector3(0,2,0));const desired=target.subtract(forward.scale(11)).add(new BABYLON.Vector3(0,6,0));
  // Each viewport owns a dedicated follow camera. Smooth its position but always aim at its kart.
  // Exponential smoothing is stable across different frame rates.
  const followAlpha=1-Math.exp(-12*dt);
  k.camera.position.copyFrom(BABYLON.Vector3.Lerp(k.camera.position,desired,followAlpha));
  k.camera.setTarget(target.add(forward.scale(5)));
 }
 for(const o of orbs){o.orb.rotation.y+=dt*1.4;o.glow.rotation.y+=dt;o.orb.position.y=1.7+Math.sin(now/350+o.index)*.35;o.glow.position.y=o.orb.position.y;}
 progressTimer+=dt;if(progressTimer>.15&&active){progressTimer=0;socket.emit('host:progress',{players:[...karts.values()].map(k=>({id:k.id,progress:k.progress}))});}
 if(active){raceEndTimer+=dt;if(raceEndTimer>240)socket.emit('host:endRace',{});}
 drawHUD(active?Math.max(0,Math.ceil((240-raceEndTimer))):Math.ceil((room.raceStarted-now)/1000));
}
function drawHUD(seconds){if(!room)return;const width=window.innerWidth,height=window.innerHeight,count=karts.size;
 const boxes=count===1?[[0,0,1,1]]:count===2?[[0,0,1,.5],[0,.5,1,.5]]:count===3?[[0,0,.5,.5],[.5,0,.5,.5],[0,.5,1,.5]]:[[0,0,.5,.5],[.5,0,.5,.5],[0,.5,.5,.5],[.5,.5,.5,.5]];
 hud.innerHTML=[...karts.values()].map((k,i)=>{const p=room.players.find(x=>x.id===k.id),b=boxes[i];if(!p)return '';return `<div class="hudbox" style="left:${b[0]*100+1}%;top:${b[1]*100+1}%;border-left:5px solid ${palette[i]}">${esc(p.name)} · Lap ${Math.min(3,Math.floor(k.progress)+1)}/3 ${k.finished?'🏁':''}<div style="font-size:.8em">${Math.max(0,Math.round(k.speed*5))} km/h</div></div>`;}).join('')+`<div class="hudbox" style="left:50%;top:8px;transform:translateX(-50%);font-size:1.2rem">${Date.now()<room.raceStarted?'START IN '+seconds:'⏱ '+seconds+'s'}</div>`;
}
socket.on('room:update',r=>{if(!hostCode||r.code!==hostCode)return;hostView(r);});
socket.on('race:input',({id,input})=>{const k=karts.get(id);if(k)k.input=input;});
socket.on('race:ability',({id,ability})=>{const k=karts.get(id);if(!k)return;const now=Date.now();if(ability==='boost')k.boostUntil=now+3000;else if(ability==='shield')k.shieldUntil=now+5000;else if(ability==='pulse'){for(const other of karts.values())if(other!==k&&BABYLON.Vector3.Distance(k.body.position,other.body.position)<11&&now>other.shieldUntil){other.speed*=.35;other.yaw+=.55;}}else if(ability==='blink'){const x=k.body.position.x+Math.sin(k.yaw)*7,z=k.body.position.z+Math.cos(k.yaw)*7,norm=Math.hypot(x/35,z/24);if(norm>.76&&norm<1.24){k.body.position.x=x;k.body.position.z=z;}}});
socket.on('disconnect',()=>{if(hostCode)overlay.innerHTML='<section class="panel center"><h2>Connection lost</h2><p>Refresh the page after your server reconnects.</p></section>';});
hostInit();
