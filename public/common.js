const socket = io();
const $ = (sel,root=document)=>root.querySelector(sel);
const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const AVATARS=['😎','🦊','🐸','🐼','🤖','👻','🐱','🦖'];
const MAPS=['Coastal Loop','Neon Circuit','Desert Dash','Frost Ring'];
const CHARACTERS=['fox','robot','frog','astronaut'];
const KARTS=['classic','speedster','heavy','drifter'];
const ABILITIES=['boost','shield','pulse','blink'];
const characterIcon={fox:'🦊',robot:'🤖',frog:'🐸',astronaut:'👨‍🚀'};
const abilityDesc={boost:'Turbo boost for 3 seconds',shield:'Block attacks for 5 seconds',pulse:'Push nearby rivals away',blink:'Jump a short distance forward'};
function avatarHTML(avatar,small=false){return avatar?.startsWith('data:image/')?`<img class="${small?'avatar-small':'avatar'}" src="${esc(avatar)}" alt="Avatar">`:`<span class="${small?'avatar-small':'avatar'}">${esc(avatar||'🏎️')}</span>`;}
function choices(items,selected,iconFn=x=>x){return `<div class="grid">${items.map(x=>`<div class="choice ${x===selected?'active':''}" data-value="${esc(x)}"><span class="emoji">${iconFn(x)}</span><b>${esc(x)}</b></div>`).join('')}</div>`;}
function setError(message){const el=$('.error');if(el)el.textContent=message||'';}
function ack(event,payload){return new Promise(resolve=>socket.emit(event,payload,resolve));}
