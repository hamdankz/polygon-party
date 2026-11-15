const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 350000 });
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));
const rooms = new Map();
const MAPS = ['Coastal Loop', 'Neon Circuit', 'Desert Dash', 'Frost Ring'];
const ABILITIES = ['boost', 'shield', 'pulse', 'blink'];
const KARTS = ['classic', 'speedster', 'heavy', 'drifter'];
const CHARACTERS = ['fox', 'robot', 'frog', 'astronaut'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({length: 6}, () => CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join('');
const clean = (x, max = 20) => String(x ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
const publicPlayer = p => ({ id:p.id, name:p.name, avatar:p.avatar, character:p.character, kart:p.kart, ability:p.ability, ready:p.ready, connected:p.connected, vote:p.vote, finishTime:p.finishTime, progress:p.progress, lap:p.lap, finished:p.finished });
const publicRoom = r => ({code:r.code, phase:r.phase, hostConnected:!!r.hostId, players:[...r.players.values()].map(publicPlayer), map:r.map, mode:'Classic 3-Lap Race', votingEnds:r.votingEnds, raceStarted:r.raceStarted, results:r.results, orbPositions:r.orbPositions});
function publish(r) { io.to(r.code).emit('room:update', publicRoom(r)); }
function getRoom(code) { return rooms.get(clean(code,6).toUpperCase()); }
function safeAck(ack, value) { if (typeof ack === 'function') ack(value); }
function transition(r, phase) { r.phase = phase; publish(r); }
function resetRace(r) {
 r.results=[]; r.raceStarted=0; r.orbPositions=[0.12,0.29,0.46,0.63,0.8,0.94];
 for(const p of r.players.values()) {p.ready=false;p.finished=false;p.finishTime=null;p.progress=0;p.lap=1;p.charge=0;p.lastAbility=0;p.orbHits=new Map();p.lastInput=0;p.input={steer:0,accelerate:false,brake:false,drift:false};}
}
function finishVoting(r) {
 if(r.phase!=='voting') return;
 const votes=new Map(MAPS.map(m=>[m,0]));
 for(const p of r.players.values()) if(votes.has(p.vote)) votes.set(p.vote,votes.get(p.vote)+1);
 const max=Math.max(...votes.values());
 const tied=[...votes].filter(([_,n])=>n===max).map(([m])=>m);
 r.map=tied[Math.floor(Math.random()*tied.length)];
 transition(r,'mode');
}
function cleanup(r) { if(!r.hostId && !r.players.size) {clearTimeout(r.voteTimer);rooms.delete(r.code);} }
io.on('connection', socket => {
 socket.on('host:create', (_,ack) => {
   if(socket.data.code) return safeAck(ack,{error:'Already in a room'});
   let code; do {code=randomCode();} while(rooms.has(code));
   const r={code,hostId:socket.id,players:new Map(),phase:'lobby',map:null,votingEnds:null,voteTimer:null,raceStarted:0,results:[],orbPositions:[]};
   rooms.set(code,r);socket.data={code,role:'host'};socket.join(code);safeAck(ack,{ok:true,code});publish(r);
 });
 socket.on('host:reclaim', ({code},ack)=>{
   const r=getRoom(code);if(!r || r.hostId) return safeAck(ack,{error:'Room unavailable or host connected'});
   r.hostId=socket.id;socket.data={code:r.code,role:'host'};socket.join(r.code);safeAck(ack,{ok:true,code:r.code});publish(r);
 });
 socket.on('player:join', ({code,name,avatar},ack)=>{
   const r=getRoom(code);
   if(!r) return safeAck(ack,{error:'Room not found. Check the code.'});
   if(r.phase!=='lobby') return safeAck(ack,{error:'Race in progress. Join between races.'});
   if(r.players.size>=4) return safeAck(ack,{error:'Room full (4 players).'});
   if(socket.data.code) return safeAck(ack,{error:'Already connected to a room.'});
   name=clean(name,18); if(!name) return safeAck(ack,{error:'Enter your name.'});
   avatar=clean(avatar,100);if(!/^([\p{Emoji}\u200d\ufe0f]{1,12}|data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/u.test(avatar)) avatar='🏎️';
   if(avatar.length>90000) avatar='🏎️';
   const p={id:socket.id,name,avatar,character:'fox',kart:'classic',ability:'boost',ready:false,connected:true,vote:null,finishTime:null,progress:0,lap:1,finished:false,charge:0,lastAbility:0,lastInput:0,input:{steer:0,accelerate:false,brake:false,drift:false},orbHits:new Map()};
   r.players.set(socket.id,p);socket.data={code:r.code,role:'player'};socket.join(r.code);safeAck(ack,{ok:true,id:socket.id,code:r.code});publish(r);
 });
 socket.on('host:advance', ({phase},ack)=>{
   const r=getRoom(socket.data.code);if(!r||r.hostId!==socket.id) return safeAck(ack,{error:'Not host'});
   if(phase==='voting'&&r.phase==='lobby') {
     if(r.players.size<1) return safeAck(ack,{error:'At least one player must join'});
     for(const p of r.players.values()) p.vote=null;
     r.votingEnds=Date.now()+20000;transition(r,'voting');
     clearTimeout(r.voteTimer);r.voteTimer=setTimeout(()=>finishVoting(r),20050);
   } else if(phase==='customize'&&r.phase==='mode') transition(r,'customize');
   else if(phase==='racing'&&r.phase==='customize') {
     if([...r.players.values()].some(p=>!p.ready)) return safeAck(ack,{error:'All players must be ready'});
     resetRace(r);r.raceStarted=Date.now()+3500;transition(r,'racing');
     io.to(r.code).emit('race:start',{startAt:r.raceStarted});
   } else if(phase==='lobby'&&r.phase==='results') {resetRace(r);r.map=null;transition(r,'lobby');}
   else return safeAck(ack,{error:'Invalid transition'});
   safeAck(ack,{ok:true});
 });
 socket.on('player:vote', ({map},ack)=>{
   const r=getRoom(socket.data.code);const p=r?.players.get(socket.id);
   if(!p||r.phase!=='voting'||!MAPS.includes(map)) return safeAck(ack,{error:'Voting unavailable'});
   p.vote=map;publish(r);safeAck(ack,{ok:true});
 });
 socket.on('player:customize', ({character,kart,ability,ready},ack)=>{
   const r=getRoom(socket.data.code);const p=r?.players.get(socket.id);
   if(!p||r.phase!=='customize') return safeAck(ack,{error:'Customization unavailable'});
   if(CHARACTERS.includes(character))p.character=character;
   if(KARTS.includes(kart))p.kart=kart;
   if(ABILITIES.includes(ability))p.ability=ability;
   p.ready=!!ready;publish(r);safeAck(ack,{ok:true});
 });
 socket.on('player:input', input=>{
   const r=getRoom(socket.data.code);const p=r?.players.get(socket.id);
   if(!p||r.phase!=='racing'||p.finished)return;
   p.input={steer:Math.max(-1,Math.min(1,Number(input.steer)||0)),accelerate:!!input.accelerate,brake:!!input.brake,drift:!!input.drift};
   p.lastInput=Date.now();
   if(r.hostId)io.to(r.hostId).emit('race:input',{id:p.id,input:p.input});
 });
 socket.on('player:ability', (_,ack)=>{
   const r=getRoom(socket.data.code);const p=r?.players.get(socket.id);
   if(!p||r.phase!=='racing'||p.finished||Date.now()<r.raceStarted) return safeAck(ack,{error:'Unavailable'});
   if(p.charge<20)return safeAck(ack,{error:'Ability still charging'});
   p.charge=0;p.lastAbility=Date.now();
   io.to(r.hostId).emit('race:ability',{id:p.id,ability:p.ability});
   io.to(socket.id).emit('ability:charge',{charge:0});safeAck(ack,{ok:true});
 });
 socket.on('host:orb', ({playerId,orbIndex},ack)=>{
   const r=getRoom(socket.data.code);if(!r||r.hostId!==socket.id||r.phase!=='racing')return;
   const p=r.players.get(playerId);const index=Number(orbIndex);
   if(!p||!Number.isInteger(index)||index<0||index>=r.orbPositions.length||p.finished)return;
   const last=p.orbHits.get(index)||0;if(Date.now()-last<7000)return;
   p.orbHits.set(index,Date.now());p.charge=Math.min(20,p.charge+10);
   io.to(p.id).emit('ability:charge',{charge:p.charge});
   io.to(r.hostId).emit('race:orbAccepted',{playerId,orbIndex:index});
 });
 socket.on('host:progress', ({players},ack)=>{
   const r=getRoom(socket.data.code);if(!r||r.hostId!==socket.id||r.phase!=='racing'||!Array.isArray(players))return;
   for(const entry of players) {
     const p=r.players.get(entry.id);if(!p||p.finished)continue;
     const prog=Number(entry.progress);if(!Number.isFinite(prog))continue;
     p.progress=Math.max(p.progress,Math.min(3,prog));p.lap=Math.min(3,Math.floor(p.progress)+1);
     if(p.progress>=3&&Date.now()>=r.raceStarted) {
       p.finished=true;p.finishTime=(Date.now()-r.raceStarted)/1000;
       r.results.push({id:p.id,name:p.name,avatar:p.avatar,time:p.finishTime,progress:p.progress,finished:true});
       io.to(r.code).emit('race:finish',{id:p.id,rank:r.results.length});
     }
   }
   if([...r.players.values()].every(p=>p.finished))endRace(r);
 });
 socket.on('host:endRace', (_,ack)=>{
   const r=getRoom(socket.data.code);if(!r||r.hostId!==socket.id||r.phase!=='racing')return safeAck(ack,{error:'Unavailable'});
   endRace(r);safeAck(ack,{ok:true});
 });
 socket.on('disconnect',()=>{
   const r=getRoom(socket.data.code);if(!r)return;
   if(socket.data.role==='host') {r.hostId=null;io.to(r.code).emit('host:disconnected');}
   else if(socket.data.role==='player') {
     r.players.delete(socket.id);
     if(r.phase==='racing'&&r.players.size===0)endRace(r);
   }
   publish(r);cleanup(r);
 });
});
function endRace(r) {
 if(r.phase!=='racing')return;
 const unfinished=[...r.players.values()].filter(p=>!p.finished).sort((a,b)=>b.progress-a.progress);
 r.results.push(...unfinished.map(p=>({id:p.id,name:p.name,avatar:p.avatar,time:null,progress:p.progress,finished:false})));
 transition(r,'results');
}
setInterval(()=>{
 for(const r of rooms.values())if(r.phase==='racing'&&Date.now()>=r.raceStarted) {
   for(const p of r.players.values())if(!p.finished) {
     p.charge=Math.min(20,p.charge+0.1);
     io.to(p.id).emit('ability:charge',{charge:p.charge});
     if(Date.now()-p.lastInput>250&&r.hostId)io.to(r.hostId).emit('race:input',{id:p.id,input:{steer:0,accelerate:false,brake:false,drift:false}});
   }
 }
},100);
setInterval(()=>{for(const r of rooms.values())if(r.phase==='racing')publish(r);},1000);
const port=Number(process.env.PORT)||3000;
server.listen(port,'0.0.0.0',()=>console.log(`Kart Party listening on ${port}`));
