// ===== CORRIDA DE CARRO 3D =====
const $=i=>document.getElementById(i),$$=s=>document.querySelectorAll(s);
const CARS=[
 {n:'Vermelho',c:0xd01818,a:0xffffff,max:78,acc:28,hd:1.8},
 {n:'Azul',c:0x1f5bff,a:0xffffff,max:74,acc:33,hd:2.2},
 {n:'Amarelo',c:0xffc800,a:0x111111,max:82,acc:25,hd:1.6},
 {n:'Preto',c:0x15151a,a:0xff2a2a,max:80,acc:30,hd:1.9},
 {n:'Branco',c:0xf2f2f2,a:0x2266ff,max:76,acc:31,hd:2.1}];
// Fases: len=comprimento, opp=adversários, v=faixa de velocidade, obs=obstáculos, cu=curvatura (rad)
const LV=[
 {len:9000,opp:7,v:[46,64],obs:12,cu:[.3,.8]},
 {len:9600,opp:9,v:[50,68],obs:18,cu:[.4,1.1]},
 {len:10200,opp:10,v:[54,73],obs:24,cu:[.5,1.4]},
 {len:10800,opp:11,v:[58,78],obs:30,cu:[.7,1.8]},
 {len:11400,opp:12,v:[62,83],obs:38,cu:[.9,2.2]}];
const SP=6,HALF=13,RAIL=17.5;
let sel=0,unlocked=+localStorage.getItem('cc3d')||1,lvl=0,state='menu',paused=false,keys={},seed=1,cdown=3;
let sc,pts,P,opps,obs,gnd,gt,sun,t=0,shake=0,last=0,trackG;
const rnd=()=>(seed=seed*16807%2147483647)/2147483647;
const M=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.6},o));
const R=new THREE.WebGLRenderer({canvas:$('c'),antialias:true,alpha:true});
R.shadowMap.enabled=true;
const cam=new THREE.PerspectiveCamera(65,1,1,1500);

// ----- Áudio (opcional: coloque arquivos .mp3 na pasta sounds/) -----
const SND={};['motor','freio','colisao','vitoria','gameover'].forEach(n=>SND[n]=new Audio('sounds/'+n+'.mp3'));
const play=n=>{try{SND[n].currentTime=0;SND[n].play().catch(()=>{})}catch(e){}};

// ----- Carro 3D -----
function makeCar(col,acc){
 const g=new THREE.Group(),m=M(col,{metalness:.5,roughness:.3}),d=M(0x111111),gl=M(0x223344,{metalness:.9,roughness:.1}),a=M(acc),
 B=(w,h,l)=>new THREE.BoxGeometry(w,h,l),
 add=(geo,mt,x,y,z)=>{const o=new THREE.Mesh(geo,mt);o.position.set(x,y,z);o.castShadow=true;g.add(o)};
 add(B(2,.5,3.2),m,0,.6,-.2);add(B(1.8,.3,1.4),m,0,.5,2.1);
 add(B(1.5,.5,1.7),gl,0,1.1,-.3);add(B(1.4,.08,1.2),m,0,1.38,-.35);
 add(B(.4,.02,3.2),a,0,.86,-.2);add(B(.4,.02,1.4),a,0,.66,2.1);
 add(B(.1,.4,.1),d,-.7,1.05,-1.9);add(B(.1,.4,.1),d,.7,1.05,-1.9);add(B(2.1,.08,.55),a,0,1.3,-1.95);
 const wg=new THREE.CylinderGeometry(.42,.42,.4,14).rotateZ(Math.PI/2);
 for(const x of[-1.05,1.05])for(const z of[-1.3,1.5])add(wg,d,x,.42,z);
 const hl=M(0xffffcc,{emissive:0xffffaa}),tl=M(0xff0000,{emissive:0xff0000});
 for(const x of[-.65,.65]){add(B(.45,.15,.1),hl,x,.55,2.8);add(B(.5,.15,.1),tl,x,.7,-1.82)}
 return g}

// ----- Pré-visualização do menu -----
const pv=new THREE.Scene(),pcam=new THREE.PerspectiveCamera(40,1,.1,100);
pcam.position.set(0,2.5,8);pcam.lookAt(0,.7,0);
pv.add(new THREE.HemisphereLight(0xffffff,0x334455,1.1));
const pl=new THREE.DirectionalLight(0xffffff,1.2);pl.position.set(5,8,5);pv.add(pl);
const disc=new THREE.Mesh(new THREE.CylinderGeometry(3.5,3.5,.1,40),M(0x222530));disc.position.y=-.05;pv.add(disc);
let pcar;
function setPreview(){if(pcar)pv.remove(pcar);pcar=makeCar(CARS[sel].c,CARS[sel].a);pv.add(pcar)}
function resize(){R.setPixelRatio(Math.min(devicePixelRatio,2));R.setSize(innerWidth,innerHeight);
 cam.aspect=pcam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();pcam.updateProjectionMatrix()}
addEventListener('resize',resize);resize();setPreview();

// ----- Pista -----
function genTrack(n,L){pts=[];let x=0,z=0,h=0,cur=0,left=0,sg=1;
 for(let i=0;i<n;i++){pts.push({x,z,h});
  if(i>40&&--left<=0){if(cur){cur=0;left=15+rnd()*40|0}else{const np=25+rnd()*15|0,a=L.cu[0]+rnd()*(L.cu[1]-L.cu[0]);cur=sg*a/np;sg=rnd()<.7?-sg:sg;left=np}}
  h+=cur;x+=Math.sin(h)*SP;z+=Math.cos(h)*SP}}
function at(s,lat){const f=Math.max(0,Math.min(pts.length-1.001,s/SP)),i=f|0,k=f-i,a=pts[i],b=pts[i+1],h=a.h+(b.h-a.h)*k;
 return{x:a.x+(b.x-a.x)*k+Math.cos(h)*lat,z:a.z+(b.z-a.z)*k-Math.sin(h)*lat,h}}
const lp=(i,l)=>{const p=pts[i];return{x:p.x+Math.cos(p.h)*l,z:p.z-Math.sin(p.h)*l,r:p.h}};
function ribbon(a,b,y,col){const pos=[],cl=[],ix=[];
 pts.forEach((p,i)=>{const c=Math.cos(p.h),s=Math.sin(p.h),k=new THREE.Color(typeof col=='function'?col(i):col);
  for(const o of[a,b])pos.push(p.x+c*o,y,p.z-s*o);cl.push(k.r,k.g,k.b,k.r,k.g,k.b);
  if(i)ix.push(2*i-2,2*i-1,2*i,2*i-1,2*i+1,2*i)});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 g.setAttribute('color',new THREE.Float32BufferAttribute(cl,3));g.setIndex(ix);g.computeVertexNormals();
 const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.9}));
 m.receiveShadow=true;trackG.add(m)}
function inst(geo,mat,items,cast){const m=new THREE.InstancedMesh(geo,mat,items.length),d=new THREE.Object3D();
 items.forEach((it,i)=>{d.position.set(it.x,it.y,it.z);d.rotation.set(0,it.r||0,0);d.scale.setScalar(it.s||1);d.updateMatrix();
  m.setMatrixAt(i,d.matrix);if(it.c!=null)m.setColorAt(i,new THREE.Color(it.c))});
 m.castShadow=cast;trackG.add(m)}
function checker(){const c=document.createElement('canvas');c.width=64;c.height=16;const x=c.getContext('2d');
 for(let i=0;i<16;i++)for(let j=0;j<4;j++){x.fillStyle=(i+j)%2?'#fff':'#111';x.fillRect(i*4,j*4,4,4)}return new THREE.CanvasTexture(c)}
function mkObs(k){const g=new THREE.Group(),o=(geo,c,y)=>{const m=new THREE.Mesh(geo,M(c));m.position.y=y;m.castShadow=true;g.add(m)};
 if(k==0){o(new THREE.ConeGeometry(.6,1.5,10),0xff6a00,.75);o(new THREE.BoxGeometry(1.4,.1,1.4),0x333333,.05)}
 else if(k==1){o(new THREE.CylinderGeometry(.7,.7,1.4,12),0xc0392b,.7);o(new THREE.CylinderGeometry(.72,.72,.25,12),0xffffff,.7)}
 else o(new THREE.BoxGeometry(1.9,1.6,1.9),0x9c6b30,.8);
 return g}

function build(){
 const L=LV[lvl],n=Math.floor(L.len/SP);seed=1000+lvl*77;
 sc=new THREE.Scene();sc.fog=new THREE.Fog(0xbfe3f5,150,900);
 sc.add(new THREE.HemisphereLight(0xcfe8ff,0x4a6b3a,.9));
 sun=new THREE.DirectionalLight(0xffffff,1.1);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 const sh=sun.shadow.camera;sh.left=sh.bottom=-60;sh.right=sh.top=60;sh.far=300;sc.add(sun,sun.target);
 // chão
 const cv=document.createElement('canvas');cv.width=cv.height=64;const x=cv.getContext('2d');
 x.fillStyle='#3f8f3a';x.fillRect(0,0,64,64);
 for(let i=0;i<200;i++){x.fillStyle=i%2?'#368233':'#4a9d44';x.fillRect(Math.random()*64,Math.random()*64,3,3)}
 gt=new THREE.CanvasTexture(cv);gt.wrapS=gt.wrapT=THREE.RepeatWrapping;gt.repeat.set(400,400);
 gnd=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),M(0xffffff,{map:gt}));
 gnd.rotation.x=-Math.PI/2;gnd.position.y=-.05;gnd.receiveShadow=true;sc.add(gnd);
 // pista
 genTrack(n,L);trackG=new THREE.Group();sc.add(trackG);
 ribbon(-HALF,HALF,.03,0x3a3d44);ribbon(HALF,RAIL,0,0x9a8a62);ribbon(-RAIL,-HALF,0,0x9a8a62);
 const cb=i=>i%4<2?0xe02020:0xffffff;ribbon(HALF,HALF+1.4,.05,cb);ribbon(-HALF-1.4,-HALF,.05,cb);
 const D=[],RL=[];
 for(let i=1;i<n;i++){if(i%2==0)D.push(Object.assign(lp(i,0),{y:.07}));
  if(i%3==0)for(const sd of[-1,1])RL.push(Object.assign(lp(i,sd*(RAIL+.3)),{y:.85}))}
 inst(new THREE.BoxGeometry(.4,.02,3),M(0xffffff),D,false);
 inst(new THREE.BoxGeometry(.35,.55,SP*3-.5),M(0xcfd3d8,{metalness:.6}),RL,true);
 // árvores, arbustos, placas
 const T=[],F=[],Bu=[],S=[],Sp=[],gc=[0x2f7d32,0x3a9140,0x23652a,0x4aa24a];
 for(let k=0;k<600;k++){const s=.8+rnd()*.9,i=rnd()*(n-1)|0,l=(rnd()<.5?-1:1)*(24+rnd()*70);
  T.push(Object.assign(lp(i,l),{y:1.5*s,s}));F.push(Object.assign(lp(i,l),{y:7*s,s,c:gc[k%4]}))}
 for(let k=0;k<350;k++){const s=.7+rnd()*.9,i=rnd()*(n-1)|0,l=(rnd()<.5?-1:1)*(19+rnd()*25);
  Bu.push(Object.assign(lp(i,l),{y:.7*s,s,c:gc[k%4]}))}
 for(let i=30,k=0;i<n;i+=40,k++){const sd=k%2?1:-1,l=sd*(RAIL+4);
  Sp.push(Object.assign(lp(i,l),{y:2}));S.push(Object.assign(lp(i,l),{y:4.4,r:pts[i].h+sd*.35,c:[0xff3b30,0x2f80ff,0xffc800,0x22c55e][k%4]}))}
 inst(new THREE.CylinderGeometry(.4,.5,3,6),M(0x6b4423),T,true);
 inst(new THREE.ConeGeometry(3,8,7),M(0xffffff),F,true);
 inst(new THREE.IcosahedronGeometry(1.2,0),M(0xffffff),Bu,true);
 inst(new THREE.BoxGeometry(.3,4,.3),M(0x555555),Sp,true);
 inst(new THREE.BoxGeometry(6,2.4,.3),M(0xffffff),S,true);
 // linha de chegada
 const fp=pts[n-4],fg=new THREE.Group(),ck=checker(),fm=new THREE.MeshBasicMaterial({map:ck});
 const fl=new THREE.Mesh(new THREE.PlaneGeometry(HALF*2,3),fm);fl.rotation.x=-Math.PI/2;fl.position.y=.09;fg.add(fl);
 const bm=new THREE.Mesh(new THREE.BoxGeometry(HALF*2+4,2,.6),fm);bm.position.y=8;fg.add(bm);
 for(const sd of[-1,1]){const p=new THREE.Mesh(new THREE.BoxGeometry(.6,8,.6),M(0xdddddd));p.position.set(sd*(HALF+2),4,0);fg.add(p)}
 fg.position.set(fp.x,0,fp.z);fg.rotation.y=fp.h;sc.add(fg);
 // obstáculos
 obs=[];
 for(let k=0;k<L.obs;k++){const s=400+(n*SP-700)*(k+rnd()*.7)/L.obs,lane=(rnd()*2-1)*10,p=at(s,lane),m=mkObs(k%3);
  m.position.set(p.x,0,p.z);m.rotation.y=rnd()*6;sc.add(m);obs.push({s,lane,x:p.x,z:p.z})}
 // adversários
 opps=[];const behind=Math.floor(L.opp*.4);
 for(let k=0;k<L.opp;k++){const s=k<behind?86-14*k:116+14*(k-behind),lane=(k%2?1:-1)*(4+rnd()*5),
  g=makeCar(new THREE.Color().setHSL(rnd(),.7,.5).getHex(),0xffffff);sc.add(g);
  opps.push({g,s,lane,l0:lane,v:0,b:L.v[0]+rnd()*(L.v[1]-L.v[0]),ph:rnd()*6,slow:0})}
 // jogador
 const C=CARS[sel],p0=at(100,0),g=makeCar(C.c,C.a);sc.add(g);
 P={g,x:p0.x,z:p0.z,h:p0.h,cam:p0.h,v:0,idx:16,s:100,lives:3,cd:0,off:false,rank:1,time:0,n};
 gnd.position.set(P.x,-.05,P.z);t=0;shake=0;
}

// ----- Fluxo do jogo -----
function show(id){$$('.screen').forEach(e=>e.classList.add('hidden'));if(id)$(id).classList.remove('hidden')}
function go(id){state='menu';paused=false;try{SND.motor.pause()}catch(e){}
 $('hud').classList.add('hidden');$('touch').classList.add('hidden');$('count').classList.add('hidden');$('speedfx').style.opacity=0;
 if(id=='phases'){$('phaseList').innerHTML='';for(let i=0;i<5;i++){const b=document.createElement('button');
  b.textContent='FASE '+i+1>9?'':'';b.textContent='FASE '+(i+1)+(i<unlocked?'':' 🔒');b.disabled=i>=unlocked;b.onclick=()=>start(i);$('phaseList').appendChild(b)}}
 if(id=='select')drawSelect();show(id)}
function start(l){lvl=l;build();state='count';cdown=3;paused=false;keys={};show(null);
 $('hud').classList.remove('hidden');$('touch').classList.remove('hidden');$('count').classList.remove('hidden');
 $('hPhase').textContent='FASE '+(l+1)+' / 5';hearts();
 try{SND.motor.loop=true;SND.motor.play().catch(()=>{})}catch(e){}}
function hearts(){$('hLives').textContent='❤️'.repeat(P.lives)+'🖤'.repeat(3-P.lives)}
function hit(){P.lives--;P.cd=1.8;P.v*=.45;shake=.6;hearts();play('colisao');
 const f=$('flash');f.classList.add('on');setTimeout(()=>f.classList.remove('on'),60);
 if(P.lives<=0)endScreen('GAME OVER','VOCÊ PERDEU!',[['TENTAR NOVAMENTE',()=>start(lvl)],['VOLTAR AO MENU',()=>go('menu')]],'gameover')}
function fmt(s){s|=0;return String(s/60|0).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function endScreen(title,info,btns,snd){state='end';try{SND.motor.pause()}catch(e){}play(snd);
 $('eTitle').textContent=title;$('eInfo').innerHTML=info;const c=$('eBtns');c.innerHTML='';
 btns.forEach(([l,f])=>{const b=document.createElement('button');b.textContent=l;b.onclick=f;c.appendChild(b)});
 $('touch').classList.add('hidden');show('end')}
function finish(){unlocked=Math.max(unlocked,Math.min(5,lvl+2));localStorage.setItem('cc3d',unlocked);
 const b=[];if(lvl<4)b.push(['PRÓXIMA FASE',()=>start(lvl+1)]);
 b.push(['JOGAR NOVAMENTE',()=>start(lvl)],['MENU',()=>go('menu')]);
 endScreen('CORRIDA FINALIZADA!','Posição: '+P.rank+'º / '+(opps.length+1)+'<br>Tempo: '+fmt(P.time)+'<br>Fase '+(lvl+1)+' concluída'+(lvl<4?'<br>FASE '+(lvl+2)+' DESBLOQUEADA':''),b,'vitoria')}

// ----- Atualização -----
function step(dt){
 t+=dt;const C=CARS[sel];
 if(state=='count'){cdown-=dt;$('count').textContent=cdown>0?Math.ceil(cdown):'VAI!';
  if(cdown<-.6){state='race';$('count').classList.add('hidden')}}
 const racing=state=='race'||(state=='count'&&cdown<=0);
 if(racing){
  if(state=='race')P.time+=dt;
  const up=keys.up,dn=keys.down,st=(keys.left?1:0)-(keys.right?1:0);
  const mx=C.max*(P.off?.4:1),ac=C.acc*(P.off?.3:1);
  if(up)P.v+=ac*dt;else P.v-=8*dt;
  if(dn)P.v-=60*dt;
  if(P.v>mx)P.v=Math.max(mx,P.v-(P.off?50:20)*dt);
  P.v=Math.max(0,P.v);
  P.h+=st*C.hd*Math.min(1,P.v/12)*(.65+.35*(1-P.v/(C.max*1.1)))*dt;
  P.x+=Math.sin(P.h)*P.v*dt;P.z+=Math.cos(P.h)*P.v*dt;
  // posição na pista
  let b=1e9,bi=P.idx;
  for(let i=Math.max(0,P.idx-8);i<=Math.min(pts.length-1,P.idx+30);i++){const q=pts[i],d=(q.x-P.x)**2+(q.z-P.z)**2;if(d<b){b=d;bi=i}}
  P.idx=bi;const q=pts[bi],dx=P.x-q.x,dz=P.z-q.z,lat=dx*Math.cos(q.h)-dz*Math.sin(q.h);
  P.s=bi*SP+dx*Math.sin(q.h)+dz*Math.cos(q.h);
  P.off=Math.abs(lat)>HALF-.3;
  if(Math.abs(lat)>RAIL){const ex=lat-Math.sign(lat)*RAIL;P.x-=Math.cos(q.h)*ex;P.z+=Math.sin(q.h)*ex;P.v*=Math.max(0,1-2.5*dt)}
  // colisões: obstáculos
  for(const o of obs){if(Math.abs(o.s-P.s)>25)continue;const dx=P.x-o.x,dz=P.z-o.z,d=Math.hypot(dx,dz);
   if(d<3){P.x+=dx/d*(3-d);P.z+=dz/d*(3-d);if(P.cd<=0)hit()}}
  P.cd-=dt;
 }
 // adversários
 for(const o of opps){
  let tv=state=='race'?o.b*(1+.04*Math.sin(t*.5+o.ph)):0,tl=o.l0;
  if(o.slow>0){o.slow-=dt;tv*=.55}
  for(const ob of obs){const ds=ob.s-o.s;if(ds>-3&&ds<45&&Math.abs(ob.lane-o.lane)<4)tl=ob.lane>0?ob.lane-6:ob.lane+6;
   if(Math.abs(ds)<2.5&&Math.hypot(o.px-ob.x,o.pz-ob.z)<2.8)o.slow=1.2}
  for(const q of opps)if(q!=o){const ds=q.s-o.s;if(ds>0&&ds<14&&Math.abs(q.lane-o.lane)<3.2){tv=Math.min(tv,q.v*.98);tl=o.lane<q.lane?o.lane-5:o.lane+5}}
  tl=Math.max(-10,Math.min(10,tl));
  o.v+=Math.max(-40*dt,Math.min(25*dt,tv-o.v));o.s+=o.v*dt;o.lane+=(tl-o.lane)*Math.min(1,2*dt);
  const p=at(o.s,o.lane);o.px=p.x;o.pz=p.z;o.g.position.set(p.x,0,p.z);o.g.rotation.y=p.h;
  if(racing){const dx=P.x-p.x,dz=P.z-p.z,d=Math.hypot(dx,dz);
   if(d<3.6&&d>0){P.x+=dx/d*(3.6-d);P.z+=dz/d*(3.6-d);if(P.cd<=0){hit();o.slow=1}}}
 }
 if(racing){
  P.rank=1+opps.filter(o=>o.s>P.s).length;
  P.g.position.set(P.x,0,P.z);P.g.rotation.y=P.h;P.g.visible=P.cd<=0||Math.floor(t*12)%2==0;
  if(P.s>=(P.n-4)*SP&&state=='race')finish();
 }
 // câmera
 P.cam+=(P.h-P.cam)*Math.min(1,5*dt);
 const fx=Math.sin(P.cam),fz=Math.cos(P.cam);shake=Math.max(0,shake-dt);
 cam.position.set(P.x-fx*9.5+(Math.random()-.5)*shake,4.3+(Math.random()-.5)*shake*.5,P.z-fz*9.5);
 cam.lookAt(P.x+fx*12,1.4,P.z+fz*12);cam.fov=62+22*P.v/90;cam.updateProjectionMatrix();
 sun.position.set(P.x+60,100,P.z+40);sun.target.position.set(P.x,0,P.z);
 gnd.position.set(P.x,-.05,P.z);gt.offset.set(P.x/10,-P.z/10);
 // HUD
 $('hSpeed').textContent=Math.round(P.v*2.6);$('hPos').textContent=P.rank+'º / '+(opps.length+1);
 $('hTime').textContent=fmt(P.time);$('warn').classList.toggle('hidden',!P.off);
 $('speedfx').style.opacity=Math.pow(P.v/C.max,3)*.8;
 try{SND.motor.volume=Math.min(1,.2+P.v/C.max*.8)}catch(e){}
}
function loop(ts){requestAnimationFrame(loop);const dt=Math.min(.05,(ts-last)/1000||0);last=ts;
 if(state=='menu'){pcar.rotation.y+=dt*.8;R.render(pv,pcam);return}
 if(!paused)step(dt);R.render(sc,cam)}

// ----- Seleção de carro -----
function drawSelect(){const l=$('carList');l.innerHTML='';
 CARS.forEach((c,i)=>{const b=document.createElement('button');b.textContent=c.n;b.className=i==sel?'on':'';
  b.style.background='linear-gradient(135deg,#'+c.c.toString(16).padStart(6,'0')+',#222)';
  b.onclick=()=>{sel=i;setPreview();drawSelect()};l.appendChild(b)});
 const C=CARS[sel],bar=(n,v)=>'<div><b>'+n+'</b><i style="width:'+v*120+'px"></i></div>';
 $('stats').innerHTML=bar('Velocidade',C.max/90)+bar('Aceleração',C.acc/40)+bar('Controle',C.hd/2.5)}

// ----- Entradas -----
const KM={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
addEventListener('keydown',e=>{if(KM[e.code]){keys[KM[e.code]]=true;e.preventDefault()}
 if(e.code=='Escape'&&(state=='race'||state=='count')){paused=!paused;show(paused?'pause':null)}});
addEventListener('keyup',e=>{if(KM[e.code])keys[KM[e.code]]=false});
$('bResume').onclick=()=>{paused=false;show(null)};
$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
$$('[data-k]').forEach(b=>{const k=b.dataset.k,on=e=>{e.preventDefault();keys[k]=true},off=()=>keys[k]=false;
 b.addEventListener('pointerdown',on);['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,off))});
requestAnimationFrame(loop);
