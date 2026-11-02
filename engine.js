/* Simulation is independent of the renderer and runs at a fixed 120 Hz. */
(function (root) {
  'use strict';
  const W = 1050, H = 660, GOAL = 126;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const length = (x, y) => Math.hypot(x, y);
  const distance = (a, b) => length(a.x - b.x, a.y - b.y);
  const unit = (x, y) => { const n = length(x, y); return n > .001 ? {x: x/n, y: y/n} : {x: 1, y: 0}; };
  class Match {
    constructor(difficulty = 'normal') { this.difficulty = difficulty; this.reset(); }
    reset() {
      this.time = 0; this.elapsed = 0; this.score = [0, 0]; this.phase = 'ready';
      this.freeze = 0; this.charge = 0; this.charging = false; this.events = []; this.lastEvent = '';
      this.players = [];
      const positions = [[55,330],[305,330],[490,177],[490,483],[560,330]];
      const names = [['01 · PARK','04 · CHEN','07 · KAI','11 · REN','08 · LIN'],['01 · CRUZ','04 · SILVA','07 · LEO','11 · RUI','09 · LUIS']];
      for (let t = 0; t < 2; t++) positions.forEach(([x,y], i) => this.players.push({
        id: t*5+i, team:t, keeper:i===0, homeX:t?W-x:x, homeY:y,
        x:t?W-x:x, y, vx:0, vy:0, fx:t?-1:1, fy:0,
        name:names[t][i], number:[1,4,7,11,t?9:8][i], stamina:1,
        cooldown:0, tackle:0, decision:.5+i*.13, stride:i, flash:0
      }));
      this.selected = 4;
      this.ball = {x:W/2-14,y:H/2,vx:0,vy:0,z:0,vz:0,owner:null,lock:0,lastTeam:0,receiver:null,trail:[]};
      this.kickoff(0);
    }
    get controlled() { return this.players[this.selected]; }
    emit(type, text) { this.events.push({type,text}); this.lastEvent=text; }
    start() { if(this.phase==='ready')this.phase='playing'; }
    pause() { if(this.phase==='playing'){this.phase='paused';this.cancelCharge();} else if(this.phase==='paused')this.phase='playing'; }
    cancelCharge() { this.charging=false;this.charge=0; }
    kickoff(team) {
      for(const p of this.players){p.x=p.homeX;p.y=p.homeY;p.vx=p.vy=0;p.cooldown=0;p.tackle=0;}
      const p = this.players[team*5+4];p.x=W/2+(team?16:-16);p.y=H/2;
      const opponent=this.players[(1-team)*5+4];opponent.x=W/2+(team?-115:115);
      const b=this.ball;Object.assign(b,{x:p.x+(team?-16:16),y:H/2,z:0,vx:0,vy:0,vz:0,owner:p.id,lock:1,lastTeam:team,receiver:null,trail:[]});
      this.selected=4;this.cancelCharge();
    }
    switchPlayer() {
      if(this.phase!=='playing'||this.freeze>0)return;
      const b=this.ball;
      if(b.owner!==null && this.players[b.owner].team===0){this.selected=b.owner;return;}
      const target={x:clamp(b.x+b.vx*.16,25,W-25),y:clamp(b.y+b.vy*.16,20,H-20)};
      const candidates=this.players.filter(p=>p.team===0&&!p.keeper).sort((a,c)=>distance(a,target)-distance(c,target));
      this.selected=candidates[0].id===this.selected?candidates[1].id:candidates[0].id;
    }
    pass(through=false, player=this.controlled) {
      if(this.phase!=='playing'||this.freeze>0||this.ball.owner!==player.id)return false;
      this.cancelCharge();
      const team=this.players.filter(p=>p.team===player.team&&!p.keeper&&p.id!==player.id);
      const ranked=team.map(p=>{const d=distance(p,player),u=unit(p.x-player.x,p.y-player.y);return {p,score:(u.x*player.fx+u.y*player.fy)*250-d*.28};}).sort((a,b)=>b.score-a.score);
      const target=ranked[0].p,dir=player.team?-1:1;
      let tx=target.x+(through?dir*120:target.vx*.15),ty=target.y+(through?target.vy*.45:target.vy*.15);
      tx=clamp(tx,40,W-40);ty=clamp(ty,25,H-25);
      const delta=unit(tx-player.x,ty-player.y),speed=through?525:440;
      this.kick(player,delta.x*speed,delta.y*speed,through?32:12);
      this.ball.receiver=target.id;
      if(player.team===0){this.selected=target.id;this.emit('pass',through?'直塞 · 跑向空当':'短传 · 接应');}
      return true;
    }
    startShot() {
      if(this.phase==='playing'&&this.freeze<=0&&this.ball.owner===this.selected){this.charging=true;this.charge=.06;}
    }
    releaseShot() {
      if(!this.charging)return false;
      const power=this.charge;this.cancelCharge();
      if(this.ball.owner!==this.selected||this.phase!=='playing'||this.freeze>0)return false;
      return this.shoot(this.controlled,power);
    }
    shoot(p,power=.55) {
      if(this.ball.owner!==p.id)return false;
      const goalX=p.team?0:W,dir=p.team?-1:1;
      // Assist towards the mouth, but retain directional aim across the goal.
      const targetY=H/2+p.fy*GOAL*.38;
      const aim=unit(goalX-p.x,targetY-p.y);
      const shootingBack=p.fx*dir<-.5;
      const u=shootingBack?unit(p.fx,p.fy):aim;
      const speed=430+clamp(power,0,1)*420;
      this.kick(p,u.x*speed,u.y*speed,35+power*95);
      this.emit('shot',p.team===0?'射门！':'对方射门');return true;
    }
    kick(p,vx,vy,lift=0) {
      const b=this.ball,u=unit(vx,vy);
      Object.assign(b,{owner:null,x:clamp(p.x+u.x*20,2,W-2),y:clamp(p.y+u.y*20,2,H-2),vx,vy,vz:lift,z:3,lock:.15,lastTeam:p.team,receiver:null});
      p.cooldown=.22;p.fx=u.x;p.fy=u.y;
    }
    tackle() {
      if(this.phase!=='playing'||this.freeze>0)return false;
      const p=this.controlled;if(this.ball.owner===p.id)return this.pass();
      if(p.cooldown>0)return false;
      p.cooldown=.65;p.tackle=.18;
      const u=unit(this.ball.x-p.x,this.ball.y-p.y);p.fx=u.x;p.fy=u.y;p.vx+=u.x*170;p.vy+=u.y*170;
      this.trySteal(p,39);return true;
    }
    trySteal(p,reach=27) {
      const b=this.ball;if(b.owner===null||this.players[b.owner].team===p.team||b.lock>0||b.z>24)return;
      const owner=this.players[b.owner];
      if(distance(p,owner)<reach){b.owner=p.id;b.lock=.45;b.lastTeam=p.team;p.flash=.3;owner.cooldown=.25;
        if(p.team===0){this.selected=p.id;this.emit('tackle','抢断成功');}else this.emit('tackle','失去球权');
        this.cancelCharge();}
    }
    move(p,tx,ty,dt,sprint=false) {
      const u=unit(tx,ty),moving=length(tx,ty)>.06;
      let speed=p.keeper?145:158;
      if(p.team===1)speed*=this.difficulty==='easy'?.77:.94;
      if(sprint&&p.stamina>.04){speed*=1.38;p.stamina=Math.max(0,p.stamina-dt*.23);}else p.stamina=Math.min(1,p.stamina+dt*.13);
      if(p.id===this.ball.owner&&sprint)speed*=.94;
      const blend=1-Math.exp(-14*dt);
      p.vx+=((moving?u.x*speed:0)-p.vx)*blend;p.vy+=((moving?u.y*speed:0)-p.vy)*blend;
      if(moving){p.fx=u.x;p.fy=u.y;}
      if(p.tackle>0){p.vx+=p.fx*300*dt;p.vy+=p.fy*300*dt;}
      p.x=clamp(p.x+p.vx*dt,13,W-13);p.y=clamp(p.y+p.vy*dt,13,H-13);
      p.stride+=length(p.vx,p.vy)*dt*.045;
    }
    ai(p,dt,chaser) {
      const b=this.ball,dir=p.team?-1:1,owner=b.owner===null?null:this.players[b.owner];
      p.decision-=dt;
      if(p.keeper){
        const ownX=p.team?W-32:32;
        const danger=p.team?b.x>W*.65:b.x<W*.35;
        let ty=clamp(H/2+(b.y-H/2)*(danger?.8:.3),H/2-GOAL*.66,H/2+GOAL*.66);
        if(b.owner===null&&b.vx*dir<0&&Math.abs(b.vx)>1){const intercept=b.y+(ownX-b.x)/b.vx*b.vy;ty=clamp(intercept,H/2-GOAL*.65,H/2+GOAL*.65);}
        this.move(p,ownX-p.x,ty-p.y,dt);
        if(b.owner===p.id&&p.decision<=0){p.fx=dir;p.fy=0;this.pass(false,p);p.decision=.7;}
        return;
      }
      let tx,ty;
      if(b.owner===p.id){
        tx=p.team?75:W-75;ty=H/2+(p.homeY-H/2)*.25;
        const goalDistance=p.team?p.x:W-p.x;
        const enemy=this.players.filter(q=>q.team!==p.team).reduce((a,q)=>Math.min(a,distance(p,q)),Infinity);
        if(p.decision<=0){
          if(goalDistance<330&&Math.abs(p.y-H/2)<205){this.shoot(p,.46+(Math.sin(this.time*2)+1)*.12);p.decision=.8;}
          else if(enemy<64){p.fx=dir;p.fy=(H/2-p.y)/300;this.pass(false,p);p.decision=1.1;}
        }
      }else if(p.id===chaser&&(!owner||owner.team!==p.team)){
        tx=clamp(b.x+b.vx*.12,15,W-15);ty=clamp(b.y+b.vy*.12,15,H-15);
        if(owner&&p.cooldown<=0&&distance(p,owner)<29){this.trySteal(p);p.cooldown=.65;}
      }else if(b.receiver===p.id&&!owner){tx=b.x+b.vx*.22;ty=b.y+b.vy*.22;}
      else {
        const attacking=owner&&owner.team===p.team;
        tx=p.homeX+(b.x-W/2)*(attacking?.55:.32)+(attacking?dir*75:-dir*35);
        ty=p.homeY+(b.y-H/2)*.22;
        // Stay available ahead or alongside the ball instead of clustering.
        if(attacking&&Math.abs(p.homeY-H/2)>50)tx=b.x+dir*(p.number===4?-135:115);
        tx=clamp(tx,100,W-100);ty=clamp(ty,65,H-65);
      }
      const d=length(tx-p.x,ty-p.y);
      this.move(p,d>9?tx-p.x:0,d>9?ty-p.y:0,dt,false);
    }
    step(dt,input={}) {
      if(this.phase!=='playing')return;
      dt=clamp(dt,0,1/30);this.time+=dt;
      if(this.freeze>0){this.freeze=Math.max(0,this.freeze-dt);return;}
      this.elapsed+=dt;
      if(this.elapsed>=180){this.phase='ended';this.cancelCharge();this.emit('end','全场比赛结束');return;}
      const b=this.ball;b.lock=Math.max(0,b.lock-dt);
      if(this.charging){if(b.owner!==this.selected)this.cancelCharge();else this.charge=clamp(this.charge+dt/.95,0,1);}
      const chase=[0,1].map(t=>this.players.filter(p=>p.team===t&&!p.keeper&&p.id!==this.selected).sort((a,c)=>distance(a,b)-distance(c,b))[0]?.id);
      for(const p of this.players){
        p.cooldown=Math.max(0,p.cooldown-dt);p.tackle=Math.max(0,p.tackle-dt);p.flash=Math.max(0,p.flash-dt);
        if(p.id===this.selected)this.move(p,input.x||0,input.y||0,dt,!!input.sprint);
        else this.ai(p,dt,chase[p.team]);
      }
      // Gentle separation makes tight challenges readable without violent rigid-body impulses.
      for(let i=0;i<this.players.length;i++)for(let j=i+1;j<this.players.length;j++){
        const a=this.players[i],c=this.players[j],d=distance(a,c);
        if(d<22&&d>.01){const push=(22-d)*.35,u=unit(a.x-c.x,a.y-c.y);a.x=clamp(a.x+u.x*push,13,W-13);a.y=clamp(a.y+u.y*push,13,H-13);c.x=clamp(c.x-u.x*push,13,W-13);c.y=clamp(c.y-u.y*push,13,H-13);}
      }
      if(b.owner!==null){
        const p=this.players[b.owner],offset=input.sprint&&p.id===this.selected?19:16;
        const u=length(p.vx,p.vy)>20?unit(p.vx,p.vy):{x:p.fx,y:p.fy};
        const t=1-Math.exp(-28*dt);b.x=clamp(b.x+(p.x+u.x*offset-b.x)*t,3,W-3);b.y=clamp(b.y+(p.y+u.y*offset-b.y)*t,3,H-3);b.z=0;b.vz=b.vx=b.vy=0;
      } else {
        const previousX=b.x,previousY=b.y,previousZ=b.z;
        b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.vz-=300*dt;
        if(b.z<0){b.z=0;if(b.vz< -25)b.vz=-b.vz*.28;else b.vz=0;}
        const drag=Math.exp(-(b.z>2?.15:.65)*dt);b.vx*=drag;b.vy*=drag;
        // Test the exact goal-line crossing, before an out-of-play restart.
        if((b.x<0&&previousX>=0)||(b.x>W&&previousX<=W)){
          const line=b.x<0?0:W,f=(line-previousX)/(b.x-previousX),y=previousY+(b.y-previousY)*f,z=previousZ+(b.z-previousZ)*f;
          if(Math.abs(y-H/2)<GOAL/2-4&&z<70){this.goal(b.x>W?0:1);return;}
        }
        if(b.x<0||b.x>W||b.y<0||b.y>H){this.restartOut();return;}
        if(b.lock<=0){
          const candidates=this.players.filter(p=>p.cooldown<=0&&distance(p,b)<(p.keeper?27:19)&&b.z<(p.keeper?53:17)).sort((a,c)=>distance(a,b)-distance(c,b));
          if(candidates.length){const p=candidates[0];b.owner=p.id;b.lastTeam=p.team;b.receiver=null;b.lock=.26;
            if(p.team===0&&!p.keeper)this.selected=p.id;
            if(p.keeper)this.emit('save','门将拿到球');else this.emit('receive',p.team===0?'接球':'对方控球');
          }
        }
      }
      if(Math.floor(this.time*25)!==Math.floor((this.time-dt)*25)){b.trail.push({x:b.x,y:b.y,z:b.z});if(b.trail.length>8)b.trail.shift();}
    }
    goal(team) {
      this.score[team]++;this.kickoff(1-team);this.freeze=2;
      this.emit('goal',team===0?'GOAL!  翡翠联进球':'GOAL!  珊瑚竞技进球');
    }
    restartOut() {
      const b=this.ball,team=1-b.lastTeam;
      let x=clamp(b.x,25,W-25),y=clamp(b.y,25,H-25);
      const goalLine=b.x<0||b.x>W;
      let restartTeam=team,type='界外球';
      if(goalLine){
        const defending=b.x<0?0:1;
        if(b.lastTeam!==defending){restartTeam=defending;x=defending?W-75:75;y=H/2;type='球门球';}
        else {x=b.x<0?22:W-22;y=b.y<H/2?22:H-22;type='角球';}
      }
      const p=this.players.filter(p=>p.team===restartTeam&&!p.keeper).sort((a,c)=>distance(a,{x,y})-distance(c,{x,y}))[0];
      p.x=x;p.y=y;p.vx=p.vy=0;p.fx=restartTeam?-1:1;p.fy=0;
      for(const q of this.players)if(q.team!==restartTeam&&distance(p,q)<70){q.x=clamp(q.x+(q.team?-1:1)*75,13,W-13);q.y=clamp(q.y+65,13,H-13);}
      Object.assign(b,{x,y,z:0,vz:0,vx:0,vy:0,owner:p.id,lastTeam:restartTeam,lock:.65,receiver:null,trail:[]});
      if(restartTeam===0)this.selected=p.id;
      this.freeze=.85;this.cancelCharge();this.emit('out',(restartTeam===0?'我方':'对方')+type);
    }
  }
  const api={Match,W,H,GOAL,clamp,unit,distance};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.Football=api;
})(typeof window==='undefined'?globalThis:window);
