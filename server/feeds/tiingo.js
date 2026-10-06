// Tiingo end-of-day prices (free tier: 50 requests an hour, 1,000 a day, 500 symbols a month). One request per symbol per day.
import {FeedError,fetchText,parseJSON} from './errors.js';
const BASE='https://api.tiingo.com';
export const TIINGO_LIMITS={perMinute:30,perHour:50,perDay:1000}; // minute value paces a batch; the hourly and daily quotas are Tiingo's free tier
export const tiingoSymbol=ticker=>String(ticker||'').trim().toUpperCase().replace(/\./g,'-'); // BRK.B → BRK-B
const day=v=>typeof v==='string'&&v.length>=10?v.slice(0,10):null;
const num=v=>typeof v==='number'&&Number.isFinite(v)&&v>0?v:null;
// Daily bars for [startDate, endDate]; returns [{date, close, adjClose}] ascending. Raw close is the quote of record; adjClose carries splits/dividends.
export async function fetchDailyPrices(fetcher,key,symbol,{startDate,endDate}){
 const url=`${BASE}/tiingo/daily/${encodeURIComponent(tiingoSymbol(symbol))}/prices?startDate=${startDate}&endDate=${endDate}&format=json&token=${encodeURIComponent(key)}`;
 const data=parseJSON(await fetchText(fetcher,url,{provider:'Tiingo'}),'Tiingo');
 if(!Array.isArray(data)) throw new FeedError('Tiingo returned an unexpected shape','PROVIDER_ERROR','Tiingo');
 return data.map(b=>({date:day(b.date),close:num(b.close),adjClose:num(b.adjClose)??num(b.close)})).filter(b=>b.date&&b.close!==null).sort((a,b)=>a.date.localeCompare(b.date));
}
// Ticker metadata: name, exchange code, listing dates. Used to confirm coverage.
export async function fetchMeta(fetcher,key,symbol){
 const url=`${BASE}/tiingo/daily/${encodeURIComponent(tiingoSymbol(symbol))}?token=${encodeURIComponent(key)}`;
 const d=parseJSON(await fetchText(fetcher,url,{provider:'Tiingo'}),'Tiingo');
 if(!d||typeof d!=='object'||Array.isArray(d)) throw new FeedError('Tiingo returned an unexpected shape','PROVIDER_ERROR','Tiingo');
 return {ticker:d.ticker||null,name:d.name||null,exchangeCode:d.exchangeCode||null,startDate:day(d.startDate),endDate:day(d.endDate)};
}
export const tiingoSourceURL=symbol=>`https://www.tiingo.com/${encodeURIComponent(tiingoSymbol(symbol))}/overview`;
