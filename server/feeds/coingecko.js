// CoinGecko simple prices for crypto records (free tier, no key). Close price only, in USD.
import {FeedError,fetchText,parseJSON} from './errors.js';
const BASE='https://api.coingecko.com/api/v3';
export const COINGECKO_LIMITS={perMinute:10,perHour:null,perDay:5000};
export async function fetchSimplePrices(fetcher,ids){
 const list=[...new Set(ids.map(i=>String(i||'').trim().toLowerCase()).filter(Boolean))]; if(!list.length) return {};
 const url=`${BASE}/simple/price?ids=${encodeURIComponent(list.join(','))}&vs_currencies=usd&include_last_updated_at=true`;
 const d=parseJSON(await fetchText(fetcher,url,{provider:'CoinGecko'}),'CoinGecko');
 if(!d||typeof d!=='object') throw new FeedError('CoinGecko returned an unexpected shape','PROVIDER_ERROR','CoinGecko');
 const out={};
 for(const id of list){ const row=d[id]; if(row&&typeof row.usd==='number'&&row.usd>0) out[id]={price:row.usd,currency:'USD',asOf:row.last_updated_at?new Date(row.last_updated_at*1000).toISOString():null}; }
 return out;
}
export const coingeckoSourceURL=id=>`https://www.coingecko.com/en/coins/${encodeURIComponent(String(id).toLowerCase())}`;
