// US market calendar: New York calendar dates, weekends and NYSE observed holidays (half-days are not tracked).
// Source: https://www.nyse.com/markets/hours-calendars — update annually.
export const NYSE_HOLIDAYS=new Set([
 '2025-01-01','2025-01-20','2025-02-17','2025-04-18','2025-05-26','2025-06-19','2025-07-04','2025-09-01','2025-11-27','2025-12-25',
 '2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25',
 '2027-01-01','2027-01-18','2027-02-15','2027-03-26','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24'
]);
const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
export function newYork(date=new Date()){
 const parts=Object.fromEntries(fmt.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return {date:`${parts.year}-${parts.month}-${parts.day}`,minutes:(Number(parts.hour)%24)*60+Number(parts.minute)};
}
export function isTradingDay(dateStr){ const d=new Date(dateStr+'T12:00:00Z').getUTCDay(); return d>=1&&d<=5&&!NYSE_HOLIDAYS.has(dateStr); }
export function previousTradingDay(dateStr){ let d=new Date(dateStr+'T12:00:00Z'); do { d=new Date(d.getTime()-86400000); } while(!isTradingDay(d.toISOString().slice(0,10))); return d.toISOString().slice(0,10); }
export function lastTradingDayOnOrBefore(dateStr){ return isTradingDay(dateStr)?dateStr:previousTradingDay(dateStr); }
// The daily close fetch is due once per New York trading day after 16:45 ET.
export function dailyFetchDue(date=new Date(),afterMinutes=16*60+45){ const ny=newYork(date); return isTradingDay(ny.date)&&ny.minutes>=afterMinutes?ny.date:null; }
