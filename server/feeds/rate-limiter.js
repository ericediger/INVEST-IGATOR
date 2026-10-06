// Sliding-window rate limiter (per minute, per hour) with a per-day bucket, ported from STOCKER's market-data package.
// The day bucket can be persisted through load/save callbacks so a restart does not forget today's usage.
export class RateLimiter {
 constructor({perMinute=10,perHour=null,perDay=1000,load=null,save=null,now=()=>Date.now()}={}){
  this.perMinute=perMinute; this.perHour=perHour; this.perDay=perDay; this.now=now; this.save=save;
  this.minute=[]; this.hour=[]; this.day=this.utcDay(now()); this.dayCount=0;
  if(load){ const saved=load(); if(saved&&saved.day===this.day) this.dayCount=saved.count||0; }
 }
 utcDay(ms){ return new Date(ms).toISOString().slice(0,10); }
 prune(){ const t=this.now(); this.minute=this.minute.filter(x=>x>t-60000); this.hour=this.hour.filter(x=>x>t-3600000); const d=this.utcDay(t); if(d!==this.day){this.day=d;this.dayCount=0;} }
 remaining(){ this.prune(); return {minute:Math.max(0,this.perMinute-this.minute.length),hour:this.perHour===null?null:Math.max(0,this.perHour-this.hour.length),day:Math.max(0,this.perDay-this.dayCount),usedToday:this.dayCount}; }
 canCall(n=1){ const r=this.remaining(); return r.minute>=n&&(r.hour===null||r.hour>=n)&&r.day>=n; }
 // Budget check for a planned batch: the hourly and daily quotas decide; the per-minute bucket only paces calls (see waitForSlot).
 capacity(){ const r=this.remaining(); return Math.min(r.hour===null?Infinity:r.hour,r.day); }
 waitMs(){ this.prune(); const t=this.now(); if(this.minute.length>=this.perMinute) return this.minute[0]+60000-t+1; if(this.perHour!==null&&this.hour.length>=this.perHour) return this.hour[0]+3600000-t+1; return 0; }
 // Waits (real time) for a per-minute slot; gives up when the hourly or daily quota is exhausted or the timeout passes.
 async waitForSlot(timeoutMs=70000){ const started=Date.now(); while(!this.canCall()){ const r=this.remaining(); if(r.day<=0||(r.hour!==null&&r.hour<=0)) return false; const w=this.waitMs(); if(w<=0||Date.now()-started+w>timeoutMs) return false; await new Promise(res=>setTimeout(res,w)); } return true; }
 recordCall(){ this.prune(); const t=this.now(); this.minute.push(t); this.hour.push(t); this.dayCount++; if(this.save) this.save(this.day,this.dayCount); }
}
