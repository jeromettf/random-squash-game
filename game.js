/* 랜덤 스쿼시 게임 ─ v3.3.2 (2025-07-02)
   · 배치 다시하기를 게임 시작 前 눌러도 벽돌이 공개되지 않도록 수정   */

const totalBricks   = 40;
const brickGrid     = document.getElementById('brickGrid');
const resultBox     = document.getElementById('resultBox');
const ball          = document.getElementById('ball');
const court         = document.querySelector('.court-container');
const shuffleBtn    = document.getElementById('shuffleBricks');

const particleCV    = document.getElementById('particleCanvas');
const pCtx          = particleCV.getContext('2d');

let users = [], userColors = {};
let brickData = [], brickElements = [];
let courtRect, animationId = null, gameRunning = false;

/* --- 사운드 --------------------------------------------------- */
const sndHit   = new Howl({ src:['./sounds/hit.mp3'],   volume:.3 });
const sndBrick = new Howl({ src:['./sounds/brick.mp3'], volume:.25 });
const sndWin   = new Howl({ src:['./sounds/win.mp3'],   volume:.4 });

/* --- 유틸 ----------------------------------------------------- */
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function getUserColor(name){
  if(!userColors[name])
    userColors[name] = `hsl(${Math.floor(Math.random()*360)},80%,55%)`;
  return userColors[name];
}
function updateCourtRect(){
  courtRect = court.getBoundingClientRect();
  particleCV.width  = courtRect.width;
  particleCV.height = courtRect.height;
}
addEventListener('resize', updateCourtRect);

/* --- 파티클 --------------------------------------------------- */
const particles=[]; let particleLoopId=null;
function spawnParticles(x,y,color){
  for(let i=0;i<10;i++)
    particles.push({x,y,vx:(Math.random()*2-1)*3,vy:(Math.random()*2-1)*3,life:18,color});
  if(!particleLoopId) particleLoopId=requestAnimationFrame(pLoop);
}
function pLoop(){
  pCtx.clearRect(0,0,particleCV.width,particleCV.height);
  particles.forEach(p=>{
    p.x+=p.vx; p.y+=p.vy; p.vy+=.15; p.life--;
    pCtx.fillStyle=p.color; pCtx.fillRect(p.x,p.y,3,3);
  });
  for(let i=particles.length-1;i>=0;i--) if(!particles[i].life) particles.splice(i,1);
  if(particles.length)  particleLoopId=requestAnimationFrame(pLoop);
  else { cancelAnimationFrame(particleLoopId); particleLoopId=null; }
}

/* --- UI & 벽돌 ------------------------------------------------ */
function updateUserList(){
  document.getElementById('userList').textContent =
    users.length ? users.join(', ') : '등록된 유저 없음';
}
function generateBricks(){
  brickData=[]; brickGrid.innerHTML=''; brickElements=[];
  const picks=[...Array(totalBricks).keys()].sort(()=>Math.random()-.5)
               .slice(0, users.length);
  const assign=[...users].sort(()=>Math.random()-.5);

  for(let i=0;i<totalBricks;i++){
    let info={type:'obstacle'};
    const idx=picks.indexOf(i);
    if(idx!==-1) info={type:'user',owner:assign[idx]};
    brickData.push(info);
  }
  brickData.forEach((b,i)=>{
    const div=document.createElement('div');
    div.className='brick';
    if(b.type==='user'){
      div.classList.add('unknown-user');
      div.dataset.owner=b.owner;
    }
    div.dataset.index=i;
    brickGrid.appendChild(div);
    brickElements.push(div);
  });
}
function revealBricks(){
  brickElements.forEach((el,i)=>{
    const info=brickData[i];
    if(info.type==='user'){
      el.classList.remove('unknown-user');
      el.classList.add('user-revealed');
      el.style.background = getUserColor(info.owner);
      el.textContent      = info.owner.slice(0,2);
    }
  });
}

/* --- 모달 ----------------------------------------------------- */
function openModal(winner,restartCb){
  const m=document.createElement('div');
  m.className='win-modal';
  m.innerHTML=`<div class="win-card">
      <h2>🏆 ${winner} 승리!</h2>
      <button id="againBtn">다시 하기</button>
    </div>`;
  document.body.appendChild(m);
  document.body.style.overflow='hidden';
  setTimeout(() => document.getElementById('againBtn').focus(), 50);
  document.getElementById('againBtn').onclick=()=>{
    m.remove(); document.body.style.overflow='';
    restartCb();
  };
}

/* --- 게임 ----------------------------------------------------- */
function startGame(){
  if(gameRunning || !users.length){
    if(!users.length) alert('먼저 유저를 등록하세요!');
    return;
  }

  /* 초기화 */
  if(animationId) cancelAnimationFrame(animationId);
  if(particleLoopId){ cancelAnimationFrame(particleLoopId); particleLoopId=null; }
  particles.length=0; if(confetti.reset) confetti.reset();

  shuffleBtn.disabled = true; shuffleBtn.setAttribute('aria-disabled','true');

  updateCourtRect();
  const SIZE=20;
  let x=courtRect.width/2-SIZE/2, y=courtRect.height-SIZE-8;
  let vx=(Math.random()<.5?-1:1)*5, vy=-6;
  const winOrder = parseInt(document.getElementById('winOrder').value, 10);
  let destroyed=new Set(), hitUsers=[];

  brickElements.forEach(el=>{
    el.style.opacity='1';
    el.classList.remove('breaking'); el.textContent='';
  });
  revealBricks();                       // ← 공개는 여기서만

  pCtx.clearRect(0,0,particleCV.width,particleCV.height);
  resultBox.style.display='none';

  ball.style.display='block';
  ball.style.left=`${x}px`; ball.style.top=`${y}px`;
  gameRunning=true;

  function collide(){
    for(let i=0;i<brickElements.length;i++){
      if(destroyed.has(i)) continue;
      const r=brickElements[i].getBoundingClientRect();
      const L=r.left-courtRect.left, T=r.top-courtRect.top;
      if(x+SIZE>L && x<L+r.width && y+SIZE>T && y<T+r.height) return i;
    }
    return -1;
  }

  function animate(){
    x+=vx; y+=vy;
    if(x<=0||x+SIZE>=courtRect.width) vx*=-1;
    if(y<=0) vy=Math.abs(vy);
    if(y+SIZE>=courtRect.height) vy=-Math.abs(vy);

    const hit=collide();
    if(hit!==-1){
      const el=brickElements[hit], info=brickData[hit];
      destroyed.add(hit);
      el.classList.add('breaking');
      const rc=el.getBoundingClientRect();
      spawnParticles(rc.left-courtRect.left+rc.width/2,
                     rc.top -courtRect.top +rc.height/2,
                     info.type==='user'?getUserColor(info.owner):'#d17a6c');
      vy*=-1; sndBrick.play();

      if(info.type==='user' && !hitUsers.includes(info.owner)){
        hitUsers.push(info.owner);
        if(hitUsers.length===winOrder) return endGame(info.owner);
      }
    }

    ball.style.left=`${x}px`; ball.style.top=`${y}px`;
    animationId=requestAnimationFrame(animate);
  }

  function endGame(winner){
    cancelAnimationFrame(animationId); gameRunning=false; ball.style.display='none';
    shuffleBtn.disabled=false; shuffleBtn.removeAttribute('aria-disabled');
    sndWin.play();
    confetti({
      particleCount:120, spread:90, origin:{y:.3},
      colors:[getUserColor(winner),'#fff'],
      disableForReducedMotion:prefersReduced
    });
    openModal(winner, () => { generateBricks(); startGame(); });
  }

  sndHit.play();
  animationId=requestAnimationFrame(animate);
}

/* --- 이벤트 --------------------------------------------------- */
document.getElementById('addUser').onclick=()=>{
  const v=document.getElementById('username').value.trim();
  if(!v) return;
  if(users.some(u=>u.toLowerCase()===v.toLowerCase())){ alert('이미 등록된 이름'); return; }
  users.push(v); document.getElementById('username').value='';
  updateUserList(); generateBricks();
};

shuffleBtn.onclick = () => {
  if(shuffleBtn.disabled) return;   // 게임 중엔 비활성
  generateBricks();                 // 👉 revealBricks() 호출 제거
  resultBox.style.display='none';
};

document.getElementById('startGame').onclick = startGame;

document.getElementById('themeToggle').onclick=()=>{
  const html=document.documentElement, next=html.dataset.theme==='light'?'dark':'light';
  html.dataset.theme=next; localStorage.setItem('theme', next);
};
(() => { const saved=localStorage.getItem('theme'); if(saved) document.documentElement.dataset.theme=saved; })();

/* 초기 구동 */
generateBricks();
updateUserList();
updateCourtRect();
