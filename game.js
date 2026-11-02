(function () {
  'use strict';
  const {Match,W,H,GOAL,clamp}=Football;
  const $=id=>document.getElementById(id),canvas=$('pitch'),ctx=canvas.getContext('2d'),radar=$('radar'),r=radar.getContext('2d');
  const OX=115,OY=80,keys=new Set(),match=new Match();
  window.touchline={match};
  let last=0,accumulator=0,started=false,bannerUntil=0,soundEnabled=false,audio=null,shake=0;
  const colors=['#b4f178','#f38c76'];
  const keyCodes=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyJ','KeyK','KeyL','Space','ShiftLeft','ShiftRight','Escape']);

  function tone(type){
    if(!soundEnabled)return;
    try{
      audio=audio||new (window.AudioContext||window.webkitAudioContext)();audio.resume();
      const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;
      o.type=type==='goal'?'triangle':'sine';o.frequency.setValueAtTime(type==='goal'?440:type==='shot'?140:220,t);
      o.frequency.exponentialRampToValueAtTime(type==='goal'?880:65,t+.15);
      g.gain.setValueAtTime(type==='goal'?.07:.045,t);g.gain.exponentialRampToValueAtTime(.001,t+(type==='goal'?.7:.15));
      o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+(type==='goal'?.7:.16));
    }catch(_){soundEnabled=false;$('sound').textContent='声音 OFF';}
  }
  function clearInput(){keys.clear();match.cancelCharge();accumulator=0;}
  function showOverlay(kind){
    $('overlay').classList.remove('hidden');$('difficulty-row').style.display=kind==='ready'?'flex':'none';
    if(kind==='paused'){
      $('overlay-tag').textContent='TAKE A BREATHER.';$('overlay-title').textContent='中场歇一歇。';$('overlay-copy').textContent='比赛已暂停。准备好了，继续下一次进攻。';$('start').innerHTML='继续比赛 <span>↗</span>';$('intro-foot').textContent='ESC 也可以继续比赛';
    }else if(kind==='ended'){
      const [a,b]=match.score;$('overlay-tag').textContent='FULL TIME';$('overlay-title').textContent=a>b?'好球，拿下比赛。':a===b?'势均力敌。':'下一场，再来。';$('overlay-copy').textContent=`翡翠联 ${a} : ${b} 珊瑚竞技 · 全场比赛结束`;$('start').innerHTML='再踢一场 <span>↗</span>';$('intro-foot').textContent='继续练习跑位与传切，让下一脚更从容。';
    }
  }
  function start(){
    if(match.phase==='paused'){match.pause();}
    else {if(match.phase==='ended')match.reset();match.difficulty=$('difficulty').value;match.start();started=true;}
    clearInput();last=performance.now();$('overlay').classList.add('hidden');$('pause').innerHTML='暂停 <kbd>ESC</kbd>';canvas.focus();tone('pass');
  }
  function pause(){
    if(!started||match.phase==='ended')return;
    match.pause();clearInput();
    if(match.phase==='paused'){showOverlay('paused');$('pause').innerHTML='继续 <kbd>ESC</kbd>';}
    else {$('overlay').classList.add('hidden');$('pause').innerHTML='暂停 <kbd>ESC</kbd>';canvas.focus();}
  }
  $('start').addEventListener('click',start);$('pause').addEventListener('click',pause);
  $('restart').addEventListener('click',()=>{
    match.reset();match.difficulty=$('difficulty').value;match.start();started=true;clearInput();bannerUntil=0;$('banner').classList.remove('visible');$('overlay').classList.add('hidden');$('pause').innerHTML='暂停 <kbd>ESC</kbd>';canvas.focus();
  });
  $('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound').textContent='声音 '+(soundEnabled?'ON':'OFF');$('sound').setAttribute('aria-label',soundEnabled?'关闭声音':'开启声音');tone('pass');canvas.focus();});
  $('fullscreen').addEventListener('click',async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.stadium').requestFullscreen();canvas.focus();}
    catch(_){$('hint').textContent='当前浏览器不支持全屏，可使用浏览器缩放';}
  });
  window.addEventListener('keydown',e=>{
    if(!keyCodes.has(e.code))return;
    if(e.target.tagName==='SELECT')return;
    e.preventDefault();if(e.repeat)return;
    if(e.code==='Escape'){pause();return;}
    if(match.phase!=='playing')return;
    keys.add(e.code);
    if(e.code==='KeyJ')match.tackle();
    if(e.code==='KeyL')match.pass(true);
    if(e.code==='KeyK')match.startShot();
    if(e.code==='Space')match.switchPlayer();
  });
  window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyK'){e.preventDefault();match.releaseShot();}});
  window.addEventListener('blur',()=>{if(match.phase==='playing')pause();else clearInput();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&match.phase==='playing')pause();});
  canvas.addEventListener('pointerdown',()=>canvas.focus());
  const input=()=>({x:(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),y:(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight')});
  function line(x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function ellipse(x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
  function text(str,x,y,size,color,align='center',font='sans-serif'){ctx.font=`600 ${size}px ${font}`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(str,x,y);}
  function ground(){
    ctx.fillStyle='#223c2b';ctx.fillRect(0,0,1280,820);
    // Quiet rows of seats frame the playing surface.
    for(let i=0;i<64;i++){
      const x=21+i*20;
      ctx.fillStyle=i%4===0?'#536746':'#354e35';ctx.fillRect(x,12,10,5);ctx.fillRect(x+5,24,10,5);ctx.fillRect(x,790,10,5);ctx.fillRect(x+5,802,10,5);
    }
    ctx.fillStyle='#192e24';ctx.fillRect(OX-42,OY-25,W+84,H+50);
    ctx.fillStyle='#415940';ctx.fillRect(OX-19,OY-15,W+38,H+30);
    ctx.fillStyle='#2a5037';ctx.fillRect(OX-14,OY-10,W+28,H+20);
    for(let i=0;i<10;i++){ctx.fillStyle=i%2?'#346342':'#396b47';ctx.fillRect(OX+i*W/10,OY,W/10,H);}
    // Fine turf grain is deterministic, keeping the field calm in motion.
    ctx.fillStyle='#9bbd6a09';for(let i=0;i<900;i++){const x=(i*137.51)%W,y=(i*79.37)%H;ctx.fillRect(OX+x,OY+y,2,1);}
    ctx.save();ctx.translate(OX,OY);ctx.strokeStyle='#c6d9a780';ctx.lineWidth=2;
    ctx.strokeRect(0,0,W,H);line(W/2,0,W/2,H,'#c6d9a780',2);
    ctx.beginPath();ctx.arc(W/2,H/2,83,0,Math.PI*2);ctx.stroke();ellipse(W/2,H/2,3,3,'#c6d9a7aa');
    for(const side of [0,1]){
      const x=side?W:0,dir=side?-1:1;
      ctx.strokeRect(side?W-165:0,H/2-190,165,380);ctx.strokeRect(side?W-58:0,H/2-88,58,176);
      ellipse(x+dir*113,H/2,3,3,'#c6d9a7aa');ctx.beginPath();ctx.arc(x+dir*113,H/2,83,side?Math.PI*.71:-Math.PI*.29,side?Math.PI*1.29:Math.PI*.29);ctx.stroke();
      for(const y of [0,H]){ctx.beginPath();ctx.arc(x,y,14,side?(y?Math.PI:Math.PI/2):(y?-Math.PI/2:0),side?(y?Math.PI*1.5:Math.PI):(y?0:Math.PI/2));ctx.stroke();}
      // Goal nets are behind the goal line; balls cross the same line in physics.
      const gx=side?W:-31,gy=H/2-GOAL/2;
      ctx.fillStyle='#b8d9a017';ctx.fillRect(gx,gy,31,GOAL);ctx.strokeStyle='#b9ce9e50';ctx.lineWidth=1;
      for(let nx=0;nx<=31;nx+=7)line(gx+nx,gy,gx+nx,gy+GOAL,'#b9ce9e50');
      for(let ny=0;ny<=GOAL;ny+=9)line(gx,gy+ny,gx+31,gy+ny,'#b9ce9e50');
      ctx.strokeStyle='#e1e5ce';ctx.lineWidth=3;ctx.strokeRect(gx,gy,31,GOAL);
      for(const y of [0,H]){line(x,y,x,y-18,'#b8c4a1',2);ctx.fillStyle=side?colors[1]:colors[0];ctx.beginPath();ctx.moveTo(x,y-18);ctx.lineTo(x+dir*10,y-15);ctx.lineTo(x,y-11);ctx.fill();}
    }
    ctx.restore();
    text('TOUCHLINE',OX+W*.25,OY+H+31,11,'#9cb38377','center','monospace');text('PLAY THE BEAUTIFUL GAME',OX+W*.75,OY+H+31,9,'#9cb38377','center','monospace');
    ctx.save();ctx.translate(43,410);ctx.rotate(-Math.PI/2);text('F O O T B A L L   C L U B',0,0,10,'#829b6a77');ctx.restore();
    ctx.save();ctx.translate(1238,410);ctx.rotate(Math.PI/2);text('T O U C H L I N E',0,0,10,'#829b6a77');ctx.restore();
  }
  function player(p){
    const x=OX+p.x,y=OY+p.y,selected=p.id===match.selected;
    ellipse(x,y+7,12,5,'#10281c66');
    if(selected){
      ctx.beginPath();ctx.ellipse(x,y+4,18,10,0,0,Math.PI*2);ctx.strokeStyle='#c9ff91';ctx.lineWidth=1.8;ctx.stroke();
      const u=Football.unit(p.fx,p.fy);line(x+u.x*23,y+u.y*23,x+u.x*36,y+u.y*36,'#d6fc9d88',2);
      ctx.fillStyle=colors[0];ctx.beginPath();ctx.moveTo(x-5,y-40);ctx.lineTo(x+5,y-40);ctx.lineTo(x,y-33);ctx.fill();
    }
    const speed=Math.hypot(p.vx,p.vy),stride=speed>15?Math.sin(p.stride)*4:0;
    ctx.save();ctx.translate(x,y);
    const angle=Math.atan2(p.fy,p.fx)+Math.PI/2;ctx.rotate(angle*.18);
    // Boots, socks, shorts, shirt, shoulders, and head: small readable sprites.
    ctx.fillStyle='#162e29';ctx.fillRect(-7,0+stride,5,8);ctx.fillRect(2,0-stride,5,8);
    ctx.fillStyle=p.team?'#e7d9c2':'#d5e5b9';ctx.fillRect(-6,0+stride,3,5);ctx.fillRect(3,0-stride,3,5);
    ctx.fillStyle=p.team?'#50372e':'#263c2b';ctx.fillRect(-7,-5,14,7);
    ctx.fillStyle=p.keeper?'#e9c863':colors[p.team];ctx.fillRect(-8,-18,16,15);
    ctx.fillStyle=p.keeper?'#c5a44f':p.team?'#cd6a58':'#8dbf5c';ctx.fillRect(-11,-17+stride*.3,4,11);ctx.fillRect(7,-17-stride*.3,4,11);
    ctx.fillStyle='#d6af88';ctx.fillRect(-11,-7+stride*.3,4,4);ctx.fillRect(7,-7-stride*.3,4,4);
    ctx.fillStyle='#f0f1d2';ctx.fillRect(-8,-17,16,2);
    text(String(p.number),0,-7,8,p.team?'#4c3028':'#2c4b2c','center','monospace');
    ellipse(0,-23,6,7,'#2b2924');ellipse(0,-21,5.2,5.4,p.team?'#bc8968':'#d8b78d');
    ctx.fillStyle='#34322a';ctx.fillRect(-5,-27,10,4);ctx.restore();
    if(p.tackle>0){ctx.beginPath();ctx.arc(x,y,27,0,Math.PI*2);ctx.strokeStyle='#e4efbd55';ctx.stroke();}
    if(selected){text(p.name.split(' · ')[1],x,y+29,10,'#e3edc8','center','monospace');}
  }
  function drawBall(){
    const b=match.ball;
    if(b.owner===null&&Math.hypot(b.vx,b.vy)>200)b.trail.forEach((t,i)=>{ellipse(OX+t.x,OY+t.y-t.z*.45,2.5,2.5,`rgba(237,243,208,${i/b.trail.length*.24})`);});
    ellipse(OX+b.x,OY+b.y+4,5+b.z*.025,2.8,'#10241988');
    const x=OX+b.x,y=OY+b.y-b.z*.45;
    ellipse(x,y,5.5,5.5,'#f3f0d9');ellipse(x-1,y-1,2.1,2.1,'#48594a');ellipse(x+3,y+2,1.4,1.6,'#6f7c68');
    if(b.z>10)line(x,y+9,x,OY+b.y-1,'#f4f3cf33');
  }
  function drawRadar(){
    r.clearRect(0,0,300,185);r.fillStyle='#152a20';r.fillRect(0,0,300,185);r.strokeStyle='#506f4d';r.lineWidth=1;r.strokeRect(9,9,282,167);r.beginPath();r.moveTo(150,9);r.lineTo(150,176);r.stroke();r.beginPath();r.arc(150,92.5,23,0,Math.PI*2);r.stroke();r.strokeRect(9,49,44,88);r.strokeRect(247,49,44,88);
    for(const p of match.players){const x=9+p.x/W*282,y=9+p.y/H*167;r.fillStyle=p.keeper?'#d9c66d':colors[p.team];r.beginPath();r.arc(x,y,p.id===match.selected?4:2.8,0,Math.PI*2);r.fill();if(p.id===match.selected){r.strokeStyle='#eff5df';r.beginPath();r.arc(x,y,6,0,Math.PI*2);r.stroke();}}
    r.fillStyle='#fff';r.beginPath();r.arc(9+match.ball.x/W*282,9+match.ball.y/H*167,2,0,Math.PI*2);r.fill();
  }
  function hud(now){
    $('home-score').textContent=match.score[0];$('away-score').textContent=match.score[1];
    const secs=Math.min(90*60,Math.floor(match.elapsed*30));$('clock').textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
    $('player-name').textContent=match.controlled.name;$('stamina-fill').style.width=match.controlled.stamina*100+'%';
    $('charge').classList.toggle('visible',match.charging);$('charge-fill').style.width=match.charge*100+'%';$('charge-fill').style.background=match.charge>.82?'#f4b96c':'#b4f178';
    const owner=match.ball.owner===null?null:match.players[match.ball.owner];
    $('phase').textContent=match.phase==='playing'?(owner?(owner.team===0?'翡翠联控球 →':'珊瑚竞技控球 ←'):'争夺球权'):({ready:'准备开球',paused:'比赛暂停',ended:'全场结束'}[match.phase]);
    $('hint').textContent=owner&&owner.id===match.selected?'J 短传 · L 直塞 · K 蓄力射门':'SPACE 切换 · J 抢断 · SHIFT 冲刺';
    while(match.events.length){const e=match.events.shift();if(['goal','out','tackle','shot','save'].includes(e.type)){$('banner').textContent=e.text;bannerUntil=now+(e.type==='goal'?2100:1000);if(e.type==='goal')shake=7;}
      if(['goal','shot','pass','tackle','save'].includes(e.type))tone(e.type);
      if(e.type==='end'){clearInput();showOverlay('ended');}
    }
    $('banner').classList.toggle('visible',now<bannerUntil);
  }
  function frame(now){
    const dt=last?Math.min((now-last)/1000,.1):0;last=now;
    if(match.phase==='playing'){accumulator+=dt;let n=0;while(accumulator>=1/120&&n++<12){match.step(1/120,input());accumulator-=1/120;}}else accumulator=0;
    ctx.save();if(shake>0){ctx.translate(Math.sin(now*.1)*shake,Math.cos(now*.12)*shake*.5);shake*=.88;if(shake<.1)shake=0;}
    ground();for(const p of [...match.players].sort((a,b)=>a.y-b.y))player(p);drawBall();ctx.restore();
    drawRadar();hud(now);requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
