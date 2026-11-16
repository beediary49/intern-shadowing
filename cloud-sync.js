// Intern Shadowing v35 — Firebase Google Auth + Cloud Firestore synchronization.
// Videos are never uploaded. Local study continues to work when cloud config is absent.
const $ = id => document.getElementById(id);
const config = window.INTERN_FIREBASE_CONFIG || {};
const status = message => { $('cloudStatus').textContent = message; };
const prefix = 'intern-shadow-v13:';
const types = ['favorites','completed','notes'];
const maps = {favorites,completed,notes}; // Existing app globals from index.html (same document scope)
let auth, db, user, docs = {}, cloudInitialized = false, applying = false;
let lastResumeSent = 0, remoteResume = null, booted = Date.now(), userInteracted = false;
let pending = new Map(), flushHandle = null, unsubscribe = [];
const deviceID = (()=>{const k='intern-shadow-sync-device';let id=localStorage.getItem(k);if(!id){id=crypto.randomUUID?.()||String(Math.random());localStorage.setItem(k,id)}return id})();
const versions = (()=>{try{return JSON.parse(localStorage.getItem('intern-shadow-sync-versions')||'{}')}catch{return {}}})();
const persistVersions=()=>{try{localStorage.setItem('intern-shadow-sync-versions',JSON.stringify(versions))}catch{}};
const getVersion=(type,k)=>Number(versions[type+'|'+k]||0);
const setVersion=(type,k,ts)=>{versions[type+'|'+k]=ts;persistVersions()};
const settingsReady = config.apiKey && config.authDomain && config.projectId && config.appId;
const snapshot = {};
for(const type of types) snapshot[type] = structuredClone(maps[type]);
let recentResume = {...resume};
function localChange(type,obj){
 const before=snapshot[type]; const after={...obj};
 const keys=new Set([...Object.keys(before),...Object.keys(after)]);
 const changes={};
 for(const key of keys){
  if(JSON.stringify(before[key])===JSON.stringify(after[key]))continue;
  const ts=Date.now();setVersion(type,key,ts);
  changes[key]={v:Object.hasOwn(after,key)?after[key]:(type==='notes'?'':false),ts,device:deviceID};
 }
 snapshot[type]=after;
 if(Object.keys(changes).length)queue(type,changes);
}
function queue(type,changes){
 const old=pending.get(type)||{};pending.set(type,{...old,...changes});
 if(flushHandle)clearTimeout(flushHandle);
 flushHandle=setTimeout(flush,900);
}
async function flush(){
 if(!user||!db||!cloudInitialized)return;
 const batches=[...pending.entries()];pending.clear();
 for(const [type,changes] of batches){
  try {await setDoc(doc(db,'users',user.uid,'records',type),{items:changes},{merge:true});}
  catch(e){pending.set(type,{...changes,...(pending.get(type)||{})});status('동기화 실패 · 인터넷 연결 및 Firestore 규칙을 확인하세요. '+(e.code||''));}
 }
 if(pending.size){flushHandle=setTimeout(flush,8000)}
 else status(user.displayName+' · 동기화됨');
}
function combineMap(type,items){
 let changed=false;
 const changes={};
 for(const [key,remote] of Object.entries(items||{})){
  if(!remote||typeof remote!=='object'||!Number.isFinite(Number(remote.ts)))continue;
  const remoteTS=Number(remote.ts),localTS=getVersion(type,key);
  // A previously unversioned local record may be copied to the cloud if absent there.
  if(remoteTS>=localTS){
   const value=remote.v;
   if(type==='notes'&&typeof value!=='string')continue;
   if(type!=='notes'&&typeof value!=='boolean'&&typeof value!=='number')continue;
   if(value===false||value===''||value===null)delete maps[type][key];else maps[type][key]=value;
   setVersion(type,key,remoteTS);changed=true;
  }
 }
 for(const [key,value] of Object.entries(maps[type])){
  if(!Object.hasOwn(items||{},key)){
   const ts=getVersion(type,key)||Date.now();setVersion(type,key,ts);
   changes[key]={v:value,ts,device:deviceID};
  } else if(getVersion(type,key)>Number(items[key]?.ts||0)){
   changes[key]={v:value,ts:getVersion(type,key),device:deviceID};
  }
 }
 if(changed){
  applying=true;localStorage.setItem(prefix+type,JSON.stringify(maps[type]));snapshot[type]={...maps[type]};applying=false;
  if(type==='favorites'||type==='completed'){filter();} // refresh list without altering playback
  if(type==='notes'&&st.current>=0){const c=st.cues[st.current];if(c)$('note').value=notes[keyFor(c)]||'';}
 }
 if(Object.keys(changes).length)queue(type,changes);
}
async function restoreProgress(cloud){
 if(!cloud||!cloud.v)return;
 const v=cloud.v,ts=Number(cloud.ts||0);
 if(!Number.isFinite(ts))return;
 const localTime=Number(recentResume.updatedAt||0);
 if(ts<=localTime)return;
 remoteResume={part:safePart(v.part),time:Number(v.time)||0,start:Number(v.start)||0,updatedAt:ts};
 $('restoreCloudProgress').hidden=false;
 // On an untouched opening session, restore the latest cloud position automatically.
 if(!userInteracted && Date.now()-booted<25000 && $('video').paused){await applyProgress();}
 else status('다른 기기에 더 최근 학습 위치가 있습니다. ‘클라우드 학습 위치로 이동’을 누르세요.');
}
async function applyProgress(){
 if(!remoteResume)return;
 const data=remoteResume;remoteResume=null;$('restoreCloudProgress').hidden=true;
 applying=true;
 Object.assign(resume,data);localStorage.setItem(prefix+'resume',JSON.stringify(resume));
 try {
  if(st.part!==data.part)await loadPart(data.part);
  Object.assign(resume,data);localStorage.setItem(prefix+'resume',JSON.stringify(resume));recentResume={...data};
  const idx=indexAtTime(data.time||data.start);
  if(idx>=0){select(idx,false);focusCue(idx,'auto');}
  const v=$('video');const seek=()=>{if(Number.isFinite(v.duration)&&v.duration>0)v.currentTime=Math.min(data.time||data.start,Math.max(0,v.duration-0.3))};
  if(v.readyState>=1)seek();else v.addEventListener('loadedmetadata',seek,{once:true});
  status('클라우드 학습 위치 복원 · Part '+data.part+' · '+pretty(data.time));
 }finally{applying=false}
}
$('restoreCloudProgress').onclick=applyProgress;
window.addEventListener('pointerdown',e=>{if(!e.target.closest('#openCloud,#cloudModal'))userInteracted=true},{capture:true});
window.addEventListener('intern-record-change',e=>{
 if(applying)return;
 const {key,value}=e.detail||{};
 if(types.includes(key)){localChange(key,value);return}
 if(key==='resume'){
  const now=Date.now();recentResume={...value};
  if(!user||!cloudInitialized||now-lastResumeSent<15000)return;
  lastResumeSent=now;
  const ts=Number(value.updatedAt)||now;
  setDoc(doc(db,'users',user.uid,'records','resume'),{last:{v:{part:value.part,time:value.time,start:value.start},ts,device:deviceID}},{merge:true})
   .catch(()=>status('학습 위치 동기화 대기 중 · 인터넷 연결 확인'));
 }
});
$('googleLogout').onclick=async()=>{if(auth)await signOut(auth)};
let signOut,signInWithPopup,setDoc,doc;
async function start(){
 if(!settingsReady){status('설정 필요: firebase-config.js에 Firebase 웹앱 설정을 입력하세요.');$('googleLogin').disabled=true;return}
 try{
  const version='12.6.0';
  const [{initializeApp},{getAuth,GoogleAuthProvider,signInWithPopup:popup,onAuthStateChanged,signOut:logout},{getFirestore,doc:documentRef,getDoc,setDoc:writeDoc,onSnapshot}]=await Promise.all([
   import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
   import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
   import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
  ]);
  const app=initializeApp(config);auth=getAuth(app);db=getFirestore(app);signOut=logout;setDoc=writeDoc;doc=documentRef;
  $('googleLogin').onclick=async()=>{
   try{status('Google 로그인 중…');await popup(auth,new GoogleAuthProvider())}
   catch(e){status('로그인 실패: '+(e.code||e.message)+' · Chrome 또는 Edge에서 사용하고 인증 도메인을 확인하세요.')}
  };
  onAuthStateChanged(auth,async u=>{
   for(const stop of unsubscribe)stop();unsubscribe=[];cloudInitialized=false;user=u;
   if(!u){$('googleLogin').hidden=false;$('googleLogout').hidden=true;$('openCloud').textContent='☁ Google 로그인';status('로그인하면 휴대폰 ↔ 노트북 자동 동기화됩니다.');return}
   $('googleLogin').hidden=true;$('googleLogout').hidden=false;$('openCloud').textContent='☁ 동기화 ✓';status(u.displayName+' · 기록 불러오는 중…');
   try{
    for(const type of types){
     const ref=doc(db,'users',u.uid,'records',type);const snap=await getDoc(ref);
     combineMap(type,snap.exists()?snap.data().items:{});
    }
    const pr=await getDoc(doc(db,'users',u.uid,'records','resume'));
    if(pr.exists()&&pr.data().last){await restoreProgress(pr.data().last)}
    else if(recentResume.updatedAt){await setDoc(doc(db,'users',u.uid,'records','resume'),{last:{v:{part:recentResume.part,time:recentResume.time,start:recentResume.start},ts:recentResume.updatedAt,device:deviceID}},{merge:true})}
    cloudInitialized=true;await flush();
    for(const type of types){
     const ref=doc(db,'users',u.uid,'records',type);
     unsubscribe.push(onSnapshot(ref,snap=>{if(user?.uid!==u.uid)return;combineMap(type,snap.exists()?snap.data().items:{})},()=>status('실시간 동기화 오류 · 데이터베이스 규칙을 확인하세요.')));
    }
    unsubscribe.push(onSnapshot(doc(db,'users',u.uid,'records','resume'),snap=>{
     if(user?.uid!==u.uid)return;
     const remote=snap.data()?.last;
     if(remote&&remote.device!==deviceID)restoreProgress(remote);
    }));
    status(u.displayName+' · 자동 동기화 활성화');
   }catch(e){status('클라우드 연결 오류: '+(e.code||e.message)+' · Firestore 데이터베이스/보안 규칙 확인')}
  });
 }catch(e){status('Firebase 모듈을 불러오지 못했습니다. 인터넷 연결 확인: '+e.message)}
}
start();
