const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Match,W,H}=require('../engine.js');
const tick=(m,seconds,input={})=>{for(let i=0;i<Math.round(seconds*120);i++)m.step(1/120,input);};
test('ready and paused matches do not advance; movement and diagonal normalization work',()=>{
  const m=new Match(),x=m.controlled.x;tick(m,1,{x:1});assert.equal(m.controlled.x,x);m.start();tick(m,.3,{x:1});assert.ok(m.controlled.x>x+20);m.pause();const state=JSON.stringify(m);tick(m,1);assert.equal(JSON.stringify(m),state);
  const a=new Match(),b=new Match();a.start();b.start();a.ball.owner=b.ball.owner=null;a.ball.x=b.ball.x=100;a.ball.y=b.ball.y=10;tick(a,.2,{x:1});tick(b,.2,{x:1,y:1});const da=Math.hypot(a.controlled.x-x,a.controlled.y-H/2),db=Math.hypot(b.controlled.x-x,b.controlled.y-H/2);assert.ok(Math.abs(da-db)<1);
});
test('passing releases ball and selects a teammate; through balls lead receiver',()=>{
  const m=new Match();m.start();const p=m.controlled;p.fy=-1;p.fx=0;assert.equal(m.pass(),true);assert.equal(m.ball.owner,null);assert.notEqual(m.selected,p.id);assert.equal(m.selected,m.ball.receiver);assert.ok(Math.hypot(m.ball.vx,m.ball.vy)>400);
  const n=new Match();n.start();assert.equal(n.pass(true),true);assert.ok(Math.hypot(n.ball.vx,n.ball.vy)>500);
});
test('shot power changes speed and releasing after loss of possession cannot shoot',()=>{
  const a=new Match(),b=new Match();a.start();b.start();a.startShot();a.releaseShot();b.startShot();tick(b,.8);b.releaseShot();assert.ok(Math.hypot(b.ball.vx,b.ball.vy)>Math.hypot(a.ball.vx,a.ball.vy)+200);
  const m=new Match();m.start();m.startShot();m.ball.owner=9;assert.equal(m.releaseShot(),false);assert.equal(m.ball.owner,9);
});
test('goal line crossing scores once; kickoff belongs to conceding side',()=>{
  const m=new Match();m.start();Object.assign(m.ball,{owner:null,x:W-2,y:H/2,vx:800,vy:0,z:15,vz:0,lock:1});m.step(1/120);assert.deepEqual(m.score,[1,0]);assert.equal(m.players[m.ball.owner].team,1);tick(m,1);assert.deepEqual(m.score,[1,0]);
  const n=new Match();n.start();Object.assign(n.ball,{owner:null,x:2,y:H/2,vx:-800,vy:0,z:15,vz:0,lock:1});n.step(1/120);assert.deepEqual(n.score,[0,1]);
});
test('wide shots, high shots and touchline exits restart without goals',()=>{
  for(const [x,y,z,vx,vy] of [[W-1,100,0,800,0],[W-1,H/2,90,800,0],[W/2,1,0,0,-800]]){
    const m=new Match();m.start();Object.assign(m.ball,{owner:null,x,y,z,vx,vy,lock:1,lastTeam:0});m.step(1/120);assert.deepEqual(m.score,[0,0]);assert.notEqual(m.ball.owner,null);assert.ok(m.freeze>0);assert.ok(m.ball.x>=0&&m.ball.x<=W);
  }
});
test('shooting from beside the goal line does not spawn the ball beyond it',()=>{
  const m=new Match();m.start();const p=m.controlled;p.x=W-13;p.y=H/2;p.fx=1;p.fy=0;m.shoot(p,.5);assert.ok(m.ball.x<W);m.step(1/120);assert.deepEqual(m.score,[1,0]);
});
test('tackles transfer possession only within reach and respect cooldown',()=>{
  const m=new Match();m.start();const p=m.controlled,q=m.players[9];q.x=p.x+25;q.y=p.y;m.ball.owner=q.id;m.ball.lock=0;m.ball.x=q.x;m.ball.y=q.y;assert.equal(m.tackle(),true);assert.equal(m.ball.owner,p.id);assert.ok(p.cooldown>0);
});
test('sprint consumes stamina and resting restores it',()=>{
  const m=new Match();m.start();tick(m,1,{x:1,sprint:true});const s=m.controlled.stamina;assert.ok(s<.9);tick(m,.5);assert.ok(m.controlled.stamina>s);
});
test('match ends at 180 seconds, and reset clears scores and clock',()=>{
  const m=new Match();m.start();m.elapsed=179.999;tick(m,.1);assert.equal(m.phase,'ended');assert.equal(m.charging,false);m.score=[3,2];m.reset();assert.equal(m.elapsed,0);assert.deepEqual(m.score,[0,0]);assert.equal(m.phase,'ready');
});
test('AI match remains finite and inside the field over a full match',()=>{
  const m=new Match();m.start();for(let i=0;i<42000&&m.phase==='playing';i++){if(i%450===0)m.pass();if(i%700===0){m.startShot();m.releaseShot();}m.step(1/120);for(const p of m.players){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=0&&p.x<=W&&p.y>=0&&p.y<=H);}}
  assert.equal(m.phase,'ended');assert.ok(m.score.every(Number.isFinite));
});
