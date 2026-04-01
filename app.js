const SUPABASE_URL='https://cnpiikpcmcsvvsozfmnx.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNucGlpa3BjbWNzdnZzb3pmbW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjI3NTksImV4cCI6MjA5MDI5ODc1OX0.-uvRagRsaGHuw5ypf4quHCm8yF54pmO8F8w1P_HokRc';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

let userId=null;
let D={tracks:[],sessions:[],runs:[]};
let cTrack=null,cSession=null,cRun=null;
let selWeather='',nav=[],runMode='best';
let charts={},photoData=null,lapInputs=[];
let editingTrackId=null,editingSessionId=null,editingRunId=null;

function getTelegramUserId(){
  return new Promise((resolve) => {
    // Попытка 1: сразу проверяем
    const tryGet = () => {
      try {
        if(window.Telegram && window.Telegram.WebApp){
          const user = window.Telegram.WebApp.initDataUnsafe?.user;
          if(user?.id) return String(user.id);
        }
      } catch(e){}
      return null;
    };

    const immediate = tryGet();
    if(immediate){
      resolve(immediate);
      return;
    }

    // Попытка 2: ждём инициализацию Telegram WebApp
    let attempts = 0;
    const maxAttempts = 20; // 2 секунды максимум

    const interval = setInterval(() => {
      attempts++;
      const result = tryGet();

      if(result){
        clearInterval(interval);
        resolve(result);
        return;
      }

      if(attempts >= maxAttempts){
        clearInterval(interval);
        // Fallback: используем стабильный ID
        console.warn('Telegram user ID не получен, используем fallback');
        let devId = localStorage.getItem('dev_uid');
        if(!devId){
          devId = 'dev_' + Math.random().toString(36).slice(2,10);
          localStorage.setItem('dev_uid', devId);
        }
        resolve(devId);
      }
    }, 100);
  });
}

function showSync(state,text){
  const el=document.getElementById('sync-indicator');
  const dot=document.getElementById('sync-dot');
  el.style.display='flex';
  dot.className='sync-dot'+(state==='syncing'?' syncing':state==='error'?' error':'');
  document.getElementById('sync-text').textContent=text;
  if(state==='done')setTimeout(()=>{el.style.display='none';},2000);
}

// COMPRESS PHOTO — max 400px wide, quality 0.7
function compressPhoto(file){
  return new Promise((resolve)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const maxW=400,maxH=400;
        let w=img.width,h=img.height;
        if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}
        if(h>maxH){w=Math.round(w*maxH/h);h=maxH;}
        const canvas=document.createElement('canvas');
        canvas.width=w;canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/jpeg',0.7));
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handlePhoto(inp){
  if(!inp.files||!inp.files[0])return;
  document.getElementById('photo-loading').style.display='block';
  document.getElementById('tpp').style.display='none';
  try{
    photoData=await compressPhoto(inp.files[0]);
    const p=document.getElementById('tpp');
    p.src=photoData;p.style.display='block';
  }catch(e){console.error(e);}
  document.getElementById('photo-loading').style.display='none';
}

async function loadFromCloud(){
  try{
    document.getElementById('loading-text').textContent='Загружаем данные...';
    const[t,s,r]=await Promise.all([
      sb.from('tracks').select('*').eq('user_id',userId).order('created_at'),
      sb.from('sessions').select('*').eq('user_id',userId).order('created_at'),
      sb.from('runs').select('*').eq('user_id',userId).order('created_at'),
    ]);
    if(t.error)throw t.error;
    D.tracks=(t.data||[]).map(row=>({id:row.id,name:row.name,city:row.city,length:row.length,photo:row.photo,rightsTime:row.rights_time,noRights:row.no_rights,createdAt:row.created_at}));
    D.sessions=(s.data||[]).map(row=>({id:row.id,trackId:row.track_id,date:row.date,weather:row.weather,notes:row.notes,createdAt:row.created_at}));
    D.runs=(r.data||[]).map(row=>({id:row.id,sessionId:row.session_id,bestSec:row.best_sec,bestStr:row.best_str,lapTimes:row.lap_times||[],laps:row.laps,kart:row.kart,notes:row.notes,createdAt:row.created_at}));
    return true;
  }catch(e){console.error('Load error:',e);return false;}
}

async function init(){
  // Сначала инициализируем Telegram
  try {
    if(window.Telegram && window.Telegram.WebApp){
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
    }
  } catch(e){}

  // Ждём получения userId
  document.getElementById('loading-text').textContent = 'Авторизация...';
  userId = await getTelegramUserId();

  console.log('User ID:', userId); // для отладки

  const ok = await loadFromCloud();
  document.getElementById('loading').style.display = 'none';

  if(!ok) showSync('error','Ошибка соединения');
  renderTracks();
}

  async function loadFromCloud(){
  try{
    document.getElementById('loading-text').textContent='Загружаем данные...';
    const[t,s,r]=await Promise.all([
      sb.from('tracks').select('*').eq('user_id',userId).order('created_at'),
      sb.from('sessions').select('*').eq('user_id',userId).order('created_at'),
      sb.from('runs').select('*').eq('user_id',userId).order('created_at'),
    ]);
    if(t.error)throw t.error;
    D.tracks=(t.data||[]).map(row=>({id:row.id,name:row.name,city:row.city,length:row.length,photo:row.photo,rightsTime:row.rights_time,noRights:row.no_rights,createdAt:row.created_at}));
    D.sessions=(s.data||[]).map(row=>({id:row.id,trackId:row.track_id,date:row.date,weather:row.weather,notes:row.notes,createdAt:row.created_at}));
    D.runs=(r.data||[]).map(row=>({id:row.id,sessionId:row.session_id,bestSec:row.best_sec,bestStr:row.best_str,lapTimes:row.lap_times||[],laps:row.laps,kart:row.kart,notes:row.notes,createdAt:row.created_at}));

    // ✅ Кэшируем в localStorage
    try {
      localStorage.setItem('cache_'+userId, JSON.stringify(D));
    } catch(e){} // если фото слишком большие — молча пропускаем

    return true;
  }catch(e){
    console.error('Load error:',e);

    // ✅ Пробуем загрузить из кэша
    try {
      const cached = localStorage.getItem('cache_'+userId);
      if(cached){
        D = JSON.parse(cached);
        showSync('error','Офлайн режим (кэш)');
        return true;
      }
    } catch(e2){}

    return false;
  }
}

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,5);}
function fmtT(inp){
  let r=inp.value.replace(/\D/g,'');
  if(r.length>8)r=r.slice(0,8);
  let o='';
  if(r.length<=2)o=r;
  else if(r.length<=4)o=r.slice(0,2)+':'+r.slice(2);
  else o=r.slice(0,2)+':'+r.slice(2,4)+'.'+r.slice(4);
  inp.value=o;
}
function t2s(t){
  if(!t)return NaN;
  t=t.trim().replace(',','.');
  if(t.includes(':'))return parseFloat(t.split(':')[0])*60+parseFloat(t.split(':')[1]||0);
  return parseFloat(t);
}
function s2t(s){
  if(isNaN(s)||s==null)return '--';
  const m=Math.floor(s/60),sec=(s%60).toFixed(3).padStart(6,'0');
  return `${m}:${sec}`;
}
function toggleRN(cb){const el=document.getElementById('tr');el.disabled=cb.checked;el.style.opacity=cb.checked?.4:1;}

function setMode(m){
  runMode=m;
  document.getElementById('mode-best').classList.toggle('active',m==='best');
  document.getElementById('mode-laps').classList.toggle('active',m==='laps');
  document.getElementById('sec-best').style.display=m==='best'?'':'none';
  document.getElementById('sec-laps').style.display=m==='laps'?'':'none';
  if(m==='laps'&&lapInputs.length===0){addLapInput();addLapInput();}
}
function addLapInput(){lapInputs.push('');renderLapInputs();}
function removeLapInput(i){lapInputs.splice(i,1);renderLapInputs();}
function renderLapInputs(){
  document.getElementById('laps-list').innerHTML=lapInputs.map((v,i)=>`
    <div class="lap-input-row">
      <span class="lap-n">${i+1}</span>
      <input type="text" placeholder="00:00.000" maxlength="9" inputmode="numeric"
        value="${v}" oninput="fmtT(this);lapInputs[${i}]=this.value">
      ${lapInputs.length>1?`<button class="del-lap" onclick="removeLapInput(${i})">✕</button>`:''}
    </div>`).join('');
}

function openModal(id){
  if(id==='mt'){
    editingTrackId=null;photoData=null;
    document.getElementById('mt-title').textContent='Новая трасса';
    document.getElementById('tpp').style.display='none';
    document.getElementById('tpp').src='';
    document.getElementById('tpi').value='';
    document.getElementById('photo-loading').style.display='none';
    ['tn','tc','tl','tr'].forEach(x=>{const el=document.getElementById(x);el.value='';el.disabled=false;el.style.opacity=1;});
    document.getElementById('tr-none').checked=false;
  }
  if(id==='ms'){
    editingSessionId=null;selWeather='';
    document.getElementById('ms-title').textContent='Новая сессия';
    document.getElementById('sd').value=new Date().toISOString().slice(0,10);
    document.querySelectorAll('.w-chip').forEach(c=>c.classList.remove('sel'));
    document.getElementById('sn').value='';
  }
  if(id==='mr'){
    editingRunId=null;runMode='best';lapInputs=[];
    document.getElementById('mr-title').textContent='Новый заезд';
    ['rk','rt','rl','rn'].forEach(x=>document.getElementById(x).value='');
    document.getElementById('mode-best').classList.add('active');
    document.getElementById('mode-laps').classList.remove('active');
    document.getElementById('sec-best').style.display='';
    document.getElementById('sec-laps').style.display='none';
    document.getElementById('laps-list').innerHTML='';
  }
  document.getElementById(id).classList.add('open');
}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function selW(el,v){document.querySelectorAll('.w-chip').forEach(c=>c.classList.remove('sel'));el.classList.add('sel');selWeather=v;}

function editTrack(tid){
  const t=D.tracks.find(x=>x.id===tid);if(!t)return;
  editingTrackId=tid;photoData=t.photo||null;
  document.getElementById('mt-title').textContent='Редактировать трассу';
  document.getElementById('tn').value=t.name||'';
  document.getElementById('tc').value=t.city||'';
  document.getElementById('tl').value=t.length||'';
  const tr=document.getElementById('tr');
  tr.value=t.rightsTime?s2t(t.rightsTime):'';
  tr.disabled=!!t.noRights;tr.style.opacity=t.noRights?.4:1;
  document.getElementById('tr-none').checked=!!t.noRights;
  document.getElementById('photo-loading').style.display='none';
  const p=document.getElementById('tpp');
  if(t.photo){p.src=t.photo;p.style.display='block';}
  else{p.style.display='none';p.src='';}
  document.getElementById('mt').classList.add('open');
}
function editSession(sid){
  const s=D.sessions.find(x=>x.id===sid);if(!s)return;
  editingSessionId=sid;selWeather=s.weather||'';
  document.getElementById('ms-title').textContent='Редактировать сессию';
  document.getElementById('sd').value=s.date||'';
  document.querySelectorAll('.w-chip').forEach(c=>{c.classList.toggle('sel',c.textContent.trim()===selWeather);});
  document.getElementById('sn').value=s.notes||'';
  document.getElementById('ms').classList.add('open');
}
function editRun(rid){
  const r=D.runs.find(x=>x.id===rid);if(!r)return;
  editingRunId=rid;lapInputs=[];
  document.getElementById('mr-title').textContent='Редактировать заезд';
  document.getElementById('rk').value=r.kart||'';
  document.getElementById('rn').value=r.notes||'';
  const hasLaps=r.lapTimes&&r.lapTimes.length>0;
  if(hasLaps){lapInputs=r.lapTimes.map(lt=>s2t(lt));setMode('laps');renderLapInputs();}
  else{document.getElementById('rt').value=r.bestStr||'';document.getElementById('rl').value=r.laps||'';setMode('best');}
  document.getElementById('mr').classList.add('open');
}

async function saveTrack(){
  const name=document.getElementById('tn').value.trim();
  if(!name)return alert('Введи название трассы');
  const noRights=document.getElementById('tr-none').checked;
  const rightsTime=noRights?null:(t2s(document.getElementById('tr').value)||null);
  const photo=photoData||(editingTrackId?D.tracks.find(t=>t.id===editingTrackId)?.photo:null)||null;
  const row={user_id:userId,name,city:document.getElementById('tc').value.trim(),length:parseInt(document.getElementById('tl').value)||0,photo,rights_time:rightsTime,no_rights:noRights};
  showSync('syncing','Сохраняем...');
  try{
    if(editingTrackId){
      const{error}=await sb.from('tracks').update(row).eq('id',editingTrackId);
      if(error)throw error;
      const t=D.tracks.find(x=>x.id===editingTrackId);
      Object.assign(t,{name,city:row.city,length:row.length,photo,rightsTime,noRights});
    }else{
      const id=uid();
      const{error}=await sb.from('tracks').insert({...row,id,created_at:Date.now()});
      if(error)throw error;
      D.tracks.push({id,name,city:row.city,length:row.length,photo,rightsTime,noRights,createdAt:Date.now()});
    }
    showSync('done','Сохранено ✓');
    closeModal('mt');photoData=null;
    if(editingTrackId&&cTrack?.id===editingTrackId){cTrack=D.tracks.find(t=>t.id===editingTrackId);renderSessions();}
    else renderTracks();
  }catch(e){console.error(e);showSync('error','Ошибка: '+e.message);}
}

async function saveSession(){
  const date=document.getElementById('sd').value;
  if(!date)return alert('Выбери дату');
  const row={user_id:userId,track_id:cTrack.id,date,weather:selWeather,notes:document.getElementById('sn').value.trim()};
  showSync('syncing','Сохраняем...');
  try{
    if(editingSessionId){
      const{error}=await sb.from('sessions').update(row).eq('id',editingSessionId);
      if(error)throw error;
      const s=D.sessions.find(x=>x.id===editingSessionId);
      Object.assign(s,{date,weather:selWeather,notes:row.notes});
    }else{
      const id=uid();
      const{error}=await sb.from('sessions').insert({...row,id,created_at:Date.now()});
      if(error)throw error;
      D.sessions.push({id,trackId:cTrack.id,date,weather:selWeather,notes:row.notes,createdAt:Date.now()});
    }
    showSync('done','Сохранено ✓');closeModal('ms');renderSessions();
  }catch(e){console.error(e);showSync('error','Ошибка: '+e.message);}
}

async function saveRun(){
  const kart=document.getElementById('rk').value.trim();
  const notes=document.getElementById('rn').value.trim();
  let bestSec=null,lapTimes=[],laps=0;
  if(runMode==='best'){
    const ts=document.getElementById('rt').value.trim();
    if(!ts)return alert('Введи время круга');
    bestSec=t2s(ts);
    if(isNaN(bestSec)||bestSec<=0)return alert('Формат: 01:23.456');
    laps=parseInt(document.getElementById('rl').value)||0;
  }else{
    const filled=lapInputs.filter(v=>v.trim());
    if(!filled.length)return alert('Добавь хотя бы один круг');
    lapTimes=filled.map(v=>t2s(v)).filter(s=>!isNaN(s)&&s>0);
    if(!lapTimes.length)return alert('Неверный формат времени');
    bestSec=Math.min(...lapTimes);laps=lapTimes.length;
  }
  const row={user_id:userId,session_id:cSession.id,best_sec:bestSec,best_str:s2t(bestSec),lap_times:lapTimes,laps,kart,notes};
  showSync('syncing','Сохраняем...');
  try{
    if(editingRunId){
      const{error}=await sb.from('runs').update(row).eq('id',editingRunId);
      if(error)throw error;
      const r=D.runs.find(x=>x.id===editingRunId);
      Object.assign(r,{bestSec,bestStr:s2t(bestSec),lapTimes,laps,kart,notes});
    }else{
      const id=uid();
      const{error}=await sb.from('runs').insert({...row,id,created_at:Date.now()});
      if(error)throw error;
      D.runs.push({id,sessionId:cSession.id,bestSec,bestStr:s2t(bestSec),lapTimes,laps,kart,notes,createdAt:Date.now()});
    }
    showSync('done','Сохранено ✓');closeModal('mr');renderRuns();
  }catch(e){console.error(e);showSync('error','Ошибка: '+e.message);}
}

async function delTrack(tid){
  if(!confirm('Удалить трассу и все данные?'))return;
  showSync('syncing','Удаляем...');
  try{
    const{error}=await sb.from('tracks').delete().eq('id',tid);
    if(error)throw error;
    const sids=D.sessions.filter(s=>s.trackId===tid).map(s=>s.id);
    D.tracks=D.tracks.filter(t=>t.id!==tid);
    D.sessions=D.sessions.filter(s=>s.trackId!==tid);
    D.runs=D.runs.filter(r=>!sids.includes(r.sessionId));
    showSync('done','Удалено ✓');renderTracks();
  }catch(e){showSync('error','Ошибка удаления');}
}
async function delSession(sid){
  if(!confirm('Удалить сессию?'))return;
  showSync('syncing','Удаляем...');
  try{
    const{error}=await sb.from('sessions').delete().eq('id',sid);
    if(error)throw error;
    D.sessions=D.sessions.filter(s=>s.id!==sid);
    D.runs=D.runs.filter(r=>r.sessionId!==sid);
    showSync('done','Удалено ✓');renderSessions();
  }catch(e){showSync('error','Ошибка удаления');}
}
async function delRun(rid){
  if(!confirm('Удалить заезд?'))return;
  showSync('syncing','Удаляем...');
  try{
    const{error}=await sb.from('runs').delete().eq('id',rid);
    if(error)throw error;
    D.runs=D.runs.filter(r=>r.id!==rid);
    showSync('done','Удалено ✓');renderRuns();
  }catch(e){showSync('error','Ошибка удаления');}
}

function showPage(n){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById('page-'+n).classList.add('active');}
function isMain(p){return p==='tracks'||p==='stats';}
function navigate(page,title,render){
  nav.push(page);showPage(page);
  document.getElementById('header-title').innerHTML=title;
  document.getElementById('back-btn').style.display='flex';
  document.getElementById('bottom-nav').style.display='none';
  if(render)render();
}
function goBack(){
  nav.pop();
  const prev=nav[nav.length-1];
  if(!prev||isMain(prev)){
    const tab=prev||'tracks';nav=[];showPage(tab);
    document.getElementById('header-title').innerHTML='KART<span style="color:var(--red)">TRACK</span>';
    document.getElementById('back-btn').style.display='none';
    document.getElementById('bottom-nav').style.display='flex';
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    document.getElementById('nav-'+tab).classList.add('active');
    if(tab==='tracks')renderTracks();else renderStats();
  }else if(prev==='sessions'){nav.pop();navigate('sessions',cTrack.name.toUpperCase(),renderSessions);}
  else if(prev==='runs'){nav.pop();const d=new Date(cSession.date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}).toUpperCase();navigate('runs',d,renderRuns);}
  else if(prev==='run-detail'){nav.pop();const d=new Date(cSession.date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}).toUpperCase();navigate('runs',d,renderRuns);}
}
function switchTab(tab){
  nav=[];showPage(tab);
  document.getElementById('header-title').innerHTML='KART<span style="color:var(--red)">TRACK</span>';
  document.getElementById('back-btn').style.display='none';
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('nav-'+tab).classList.add('active');
  if(tab==='tracks')renderTracks();else renderStats();
}

function rightsBar(track,bestSec){
  if(!track||track.noRights||!track.rightsTime)return '';
  const rt=track.rightsTime;
  const achieved=bestSec&&bestSec<=rt;
  const diff=bestSec?bestSec-rt:null;
  const pct=bestSec?Math.min(100,Math.max(0,(1-(bestSec-rt)/(rt*0.12+0.001))*100)):0;
  const fillColor=achieved?'#4CAF50':pct>70?'#FF9800':'#E53935';
  return `<div class="rights-bar">
    <div class="rights-header">
      <div class="rights-title">🏆 Время на права</div>
      ${achieved?'<div class="rights-achieved">✓ Достигнуто!</div>':''}
    </div>
    <div class="rights-gap">
      <div><div style="font-size:10px;color:var(--gray2);margin-bottom:1px">Цель</div><div class="rights-target">${s2t(rt)}</div></div>
      ${diff!==null?`<div style="text-align:right"><div style="font-size:10px;color:var(--gray2);margin-bottom:1px">${achieved?'Лучше на':'Отставание'}</div><div class="rights-diff ${achieved?'done':Math.abs(diff)<2?'close':'far'}">${achieved?'-'+s2t(Math.abs(diff)):'+'+s2t(diff)}</div></div>`:''}
    </div>
    ${diff!==null?`<div class="rights-progress"><div class="rights-fill" style="width:${Math.min(100,pct)}%;background:${fillColor}"></div></div>`:''}
  </div>`;
}

function drawLineChart(canvasId,labels,values,bestVal){
  if(charts[canvasId]){charts[canvasId].destroy();delete charts[canvasId];}
  const c=document.getElementById(canvasId);if(!c)return;
  const cols=values.map(v=>v===bestVal?'#9C27B0':'#E53935');
  charts[canvasId]=new Chart(c.getContext('2d'),{
    type:'line',
    data:{labels,datasets:[{data:values,borderColor:'#E53935',backgroundColor:'rgba(229,57,53,0.08)',fill:true,tension:0.35,pointBackgroundColor:cols,pointBorderColor:cols,pointRadius:4,pointHoverRadius:6,borderWidth:1.5}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{
      y:{ticks:{callback:v=>s2t(v),font:{size:9},color:'#757575'},grid:{color:'rgba(255,255,255,0.04)'},border:{color:'transparent'}},
      x:{grid:{display:false},ticks:{font:{size:10},color:'#757575',maxRotation:0},border:{color:'transparent'}}
    }}
  });
}

function renderTracks(){
  const list=document.getElementById('tracks-list'),empty=document.getElementById('tracks-empty');
  const tracks=[...D.tracks].sort((a,b)=>b.createdAt-a.createdAt);
  if(!tracks.length){list.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  list.innerHTML=tracks.map(t=>{
    const sess=D.sessions.filter(s=>s.trackId===t.id);
    const runs=D.runs.filter(r=>sess.some(s=>s.id===r.sessionId));
    const best=runs.length?Math.min(...runs.map(r=>r.bestSec)):null;
    const rightsAch=best&&t.rightsTime&&best<=t.rightsTime;
    const thumb=t.photo?`<img src="${t.photo}">`:`<div class="track-thumb-ph">🏎️</div>`;
    return `<div class="card track-card clickable" onclick="openTrack('${t.id}')">
      <div class="track-thumb">${thumb}</div>
      <div class="track-info">
        <div class="track-name">${t.name}</div>
        <div class="track-sub">${t.city||''}${t.length?' · '+t.length+' м':''}</div>
        <div class="badges">
          <span class="badge b-gray">${sess.length} сессий</span>
          ${best?`<span class="badge b-purple">🟣 ${s2t(best)}</span>`:''}
          ${rightsAch?'<span class="badge b-green">🏆 Права</span>':''}
          ${t.rightsTime&&!t.noRights&&best&&!rightsAch?`<span class="badge b-yellow">🎯 ${s2t(t.rightsTime)}</span>`:''}
        </div>
        <div class="action-row">
          <button class="act-btn edit-btn" onclick="event.stopPropagation();editTrack('${t.id}')">✏️ Изменить</button>
          <button class="act-btn danger" onclick="event.stopPropagation();delTrack('${t.id}')">✕ Удалить</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openTrack(tid){cTrack=D.tracks.find(t=>t.id===tid);navigate('sessions',cTrack.name.toUpperCase(),renderSessions);}

function renderSessions(){
  const list=document.getElementById('sessions-list'),empty=document.getElementById('sessions-empty');
  const sess=D.sessions.filter(s=>s.trackId===cTrack.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!sess.length){list.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  const allRuns=D.runs.filter(r=>sess.some(s=>s.id===r.sessionId));
  const trackBest=allRuns.length?Math.min(...allRuns.map(r=>r.bestSec)):null;
  const rBar=rightsBar(cTrack,trackBest);
  const prog=`<div class="card clickable" onclick="openProgress()" style="border-color:rgba(229,57,53,.3)">
    <div style="display:flex;align-items:center;gap:10px;padding:11px;color:var(--red)">
      <span style="font-size:18px">📈</span>
      <span style="font-family:Rajdhani,sans-serif;font-size:15px;font-weight:700">ПРОГРЕСС НА ТРАССЕ</span>
    </div>
  </div>`;
  list.innerHTML=rBar+prog+sess.map(s=>{
    const runs=D.runs.filter(r=>r.sessionId===s.id);
    const best=runs.length?Math.min(...runs.map(r=>r.bestSec)):null;
    const date=new Date(s.date).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
    return `<div class="card">
      <div style="padding:11px">
        <div onclick="openSession('${s.id}')" style="cursor:pointer">
          <div style="font-family:Rajdhani,sans-serif;font-size:16px;font-weight:700">${date}</div>
          <div class="badges" style="margin-top:4px">
            ${s.weather?`<span class="badge b-gray">${s.weather}</span>`:''}
            <span class="badge b-gray">${runs.length} заездов</span>
            ${best?`<span class="badge b-purple">🟣 ${s2t(best)}</span>`:''}
          </div>
          ${s.notes?`<div style="font-size:11px;color:var(--gray2);margin-top:3px">${s.notes}</div>`:''}
        </div>
        <div class="action-row">
          <button class="act-btn edit-btn" onclick="editSession('${s.id}')">✏️ Изменить</button>
          <button class="act-btn danger" onclick="delSession('${s.id}')">✕ Удалить</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openSession(sid){
  cSession=D.sessions.find(s=>s.id===sid);
  const d=new Date(cSession.date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}).toUpperCase();
  navigate('runs',d,renderRuns);
}

function renderRuns(){
  const el=document.getElementById('runs-content');
  const runs=D.runs.filter(r=>r.sessionId===cSession.id).sort((a,b)=>a.createdAt-b.createdAt);
  const best=runs.length?Math.min(...runs.map(r=>r.bestSec)):null;
  const avg=runs.length?runs.reduce((a,b)=>a+b.bestSec,0)/runs.length:null;
  const laps=runs.reduce((a,b)=>a+(b.laps||0),0);
  const banner=cTrack.photo?`<div class="track-banner"><img src="${cTrack.photo}"><div class="banner-name">${cTrack.name}</div></div>`:`<div class="track-banner"><div class="track-banner-ph"><span>🏎️</span><p>${cTrack.name}</p></div></div>`;
  const date=new Date(cSession.date).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
  const sinfo=`<div style="margin-bottom:8px;padding:9px 11px;background:var(--s2);border:1px solid var(--border);border-radius:9px">
    <div style="font-size:11px;color:var(--gray2)">${date}${cSession.weather?' · '+cSession.weather:''}</div>
    ${cSession.notes?`<div style="font-size:10px;color:var(--gray);margin-top:1px">${cSession.notes}</div>`:''}
  </div>`;
  const stats=`<div class="stat-row g4">
    <div class="stat-card"><div class="sv sv-purple">${best?s2t(best):'—'}</div><div class="sl">Рекорд</div></div>
    <div class="stat-card"><div class="sv">${runs.length}</div><div class="sl">Заездов</div></div>
    <div class="stat-card"><div class="sv">${avg?s2t(avg):'—'}</div><div class="sl">Среднее</div></div>
    <div class="stat-card"><div class="sv">${laps||'—'}</div><div class="sl">Кругов</div></div>
  </div>`;
  const rBar=rightsBar(cTrack,best);
  const chart=runs.length>1?`<div class="chart-card"><div class="chart-title">Лучшие времена заездов</div><canvas id="rc" height="80"></canvas></div>`:'';
  const rlist=runs.length?`<div class="sec-title">Заезды</div>`+runs.map((r,i)=>{
    const ib=r.bestSec===best;
    const hasLaps=r.lapTimes&&r.lapTimes.length>0;
    return `<div class="run-item${ib?' best-run':''}${hasLaps?' clickable':''}"${hasLaps?` onclick="openRunDetail('${r.id}')"`:''}>
      <div style="flex:1">
        <div class="run-num">Заезд ${i+1}${r.laps?' · '+r.laps+' кр.':''}${r.kart?' · '+r.kart:''}</div>
        ${r.notes?`<div class="run-note">${r.notes}</div>`:''}
        ${hasLaps?`<div class="run-note" style="color:rgba(229,57,53,.7)">▶ Нажми для деталей</div>`:''}
        <div class="action-row">
          <button class="act-btn edit-btn" onclick="event.stopPropagation();editRun('${r.id}')">✏️</button>
          <button class="act-btn danger" onclick="event.stopPropagation();delRun('${r.id}')">✕</button>
        </div>
      </div>
      <div class="run-time${ib?' rt-purple':''}" style="margin-left:8px">${r.bestStr}${ib?' 🟣':''}</div>
    </div>`;
  }).join(''):`<div class="empty"><div class="empty-icon">⏱️</div><div class="empty-text">Нет заездов. Нажми +</div></div>`;
  el.innerHTML=banner+sinfo+stats+rBar+chart+rlist;
  if(runs.length>1)setTimeout(()=>drawLineChart('rc',runs.map((_,i)=>`#${i+1}`),runs.map(r=>r.bestSec),best),50);
}

function openRunDetail(rid){cRun=D.runs.find(r=>r.id===rid);navigate('run-detail','ДЕТАЛИ ЗАЕЗДА',renderRunDetail);}
function renderRunDetail(){
  const el=document.getElementById('run-detail-content');
  const r=cRun,laps=r.lapTimes||[];
  const best=Math.min(...laps),avg=laps.reduce((a,b)=>a+b,0)/laps.length,worst=Math.max(...laps);
  const date=new Date(cSession.date).toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
  el.innerHTML=`
    <div style="margin-bottom:8px;padding:9px 11px;background:var(--s2);border:1px solid var(--border);border-radius:9px">
      <div style="font-size:11px;color:var(--gray2)">${date} · ${cTrack.name}${r.kart?' · '+r.kart:''}</div>
      ${r.notes?`<div style="font-size:10px;color:var(--gray);margin-top:1px">${r.notes}</div>`:''}
    </div>
    <div class="stat-row g3">
      <div class="stat-card"><div class="sv sv-purple">${s2t(best)}</div><div class="sl">Лучший</div></div>
      <div class="stat-card"><div class="sv">${s2t(avg)}</div><div class="sl">Среднее</div></div>
      <div class="stat-card"><div class="sv sv-red">${s2t(worst)}</div><div class="sl">Худший</div></div>
    </div>
    <div class="chart-card"><div class="chart-title">Все круги заезда</div><canvas id="dc" height="90"></canvas></div>
    <div class="sec-title">Круги</div>
    ${laps.map((lt,i)=>{const ib=lt===best;return`<div class="lap-item${ib?' best-run':''}"><div style="font-size:10px;color:var(--gray2)">Круг ${i+1}</div><div class="lap-time${ib?' lap-best':''}">${s2t(lt)}${ib?' 🟣':''}</div></div>`;}).join('')}`;
  setTimeout(()=>drawLineChart('dc',laps.map((_,i)=>`${i+1}`),laps,best),50);
}

function openProgress(){navigate('progress',cTrack.name.toUpperCase()+' · ПРОГРЕСС',renderProgress);}
function renderProgress(){
  const el=document.getElementById('progress-content');
  const sess=D.sessions.filter(s=>s.trackId===cTrack.id).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const bests=sess.map(s=>{const runs=D.runs.filter(r=>r.sessionId===s.id);return{date:s.date,best:runs.length?Math.min(...runs.map(r=>r.bestSec)):null,weather:s.weather};}).filter(s=>s.best!==null);
  if(bests.length<2){el.innerHTML=`<div class="empty"><div class="empty-icon">📈</div><div class="empty-text">Нужно минимум 2 сессии с данными</div></div>`;return;}
  const ab=Math.min(...bests.map(s=>s.best));
  const diff=bests[0].best-bests[bests.length-1].best;
  const good=diff>0;
  el.innerHTML=`<div class="prog-hero"><div class="prog-lbl">Рекорд трассы</div><div class="prog-rec">🟣 ${s2t(ab)}</div><div class="improve ${good?'good':'bad'}">${good?'↓ Улучшение':'↑ Ухудшение'} на ${s2t(Math.abs(diff))} за ${bests.length} сессий</div></div>
  ${rightsBar(cTrack,ab)}
  <div class="chart-card"><div class="chart-title">Прогресс по сессиям</div><canvas id="pc" height="95"></canvas></div>
  <div class="sec-title">По сессиям</div>
  ${bests.map((s,i)=>{const ib=s.best===ab;const prev=i>0?bests[i-1].best:null;const d=prev?prev-s.best:null;const date=new Date(s.date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'});return`<div class="run-item${ib?' best-run':''}"><div><div class="run-num">${date}${s.weather?' · '+s.weather:''}</div>${d!==null?`<div class="run-note improve ${d>0?'good':'bad'}">${d>0?'↓ -'+s2t(d):'↑ +'+s2t(Math.abs(d))}</div>`:'<div class="run-note" style="color:var(--gray)">Первая сессия</div>'}</div><div class="run-time${ib?' rt-purple':''}">${s2t(s.best)}${ib?' 🟣':''}</div></div>`;}).join('')}`;
  setTimeout(()=>drawLineChart('pc',bests.map(s=>new Date(s.date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})),bests.map(s=>s.best),ab),50);
}

function renderStats(){
  const el=document.getElementById('stats-content');
  const totalSess=D.sessions.length,totalRuns=D.runs.length;
  const totalLaps=D.runs.reduce((a,b)=>a+(b.laps||0),0);
  const allBests=D.runs.map(r=>r.bestSec).filter(s=>!isNaN(s));
  const overallBest=allBests.length?Math.min(...allBests):null;
  const rightsAch=D.tracks.filter(t=>{if(t.noRights||!t.rightsTime)return false;const sess=D.sessions.filter(s=>s.trackId===t.id);const runs=D.runs.filter(r=>sess.some(s=>s.id===r.sessionId));const best=runs.length?Math.min(...runs.map(r=>r.bestSec)):null;return best&&best<=t.rightsTime;});
  let bestTrackName='—';
  if(overallBest){const br=D.runs.find(r=>r.bestSec===overallBest);if(br){const s=D.sessions.find(s=>s.id===br.sessionId);if(s){const t=D.tracks.find(t=>t.id===s.trackId);if(t)bestTrackName=t.name;}}}
  const trackStats=D.tracks.map(t=>{const sess=D.sessions.filter(s=>s.trackId===t.id);const runs=D.runs.filter(r=>sess.some(s=>s.id===r.sessionId));const best=runs.length?Math.min(...runs.map(r=>r.bestSec)):null;return{name:t.name,sessions:sess.length,runs:runs.length,best};}).filter(t=>t.sessions>0).sort((a,b)=>b.sessions-a.sessions);
  el.innerHTML=`
    <div class="stats-hero"><div class="stats-hero-num">${totalSess}</div><div class="stats-hero-label">Всего сессий на картинге</div></div>
    <div class="stat-row g2">
      <div class="stat-card"><div class="sv sv-red">${totalRuns}</div><div class="sl">Заездов</div></div>
      <div class="stat-card"><div class="sv">${totalLaps||'—'}</div><div class="sl">Кругов</div></div>
    </div>
    <div class="stat-row g2">
      <div class="stat-card"><div class="sv sv-purple">${overallBest?s2t(overallBest):'—'}</div><div class="sl">Лучший круг ever</div></div>
      <div class="stat-card"><div class="sv sv-green">${rightsAch.length}/${D.tracks.filter(t=>!t.noRights&&t.rightsTime).length}</div><div class="sl">Прав получено</div></div>
    </div>
    ${overallBest?`<div style="padding:9px 11px;background:var(--s2);border:1px solid var(--border);border-radius:9px;margin-bottom:8px;font-size:11px;color:var(--gray2)">🏆 Рекорд на <span style="color:var(--white);font-weight:600">${bestTrackName}</span></div>`:''}
    ${trackStats.length?`<div class="sec-title">По трассам</div>`+trackStats.map(t=>`<div class="run-item"><div><div style="font-family:Rajdhani,sans-serif;font-size:14px;font-weight:700">${t.name}</div><div class="run-note">${t.sessions} сессий · ${t.runs} заездов</div></div><div class="run-time${t.best?' rt-purple':''}">${t.best?s2t(t.best):'—'}</div></div>`).join(''):''}
    ${!totalSess?`<div class="empty"><div class="empty-icon">📊</div><div class="empty-text">Данных пока нет</div></div>`:''}`;
}

document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');});
});

init();
