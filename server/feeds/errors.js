export class FeedError extends Error {
 constructor(message,type='UNKNOWN',provider='feed'){ super(message); this.name='FeedError'; this.type=type; this.provider=provider; }
}
// Fetch with a timeout. Providers parse the body as text first: Tiingo answers rate limits with HTTP 200 and a plain-text body.
export async function fetchText(fetcher,url,{headers={},timeoutMs=15000,provider='feed'}={}){
 const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeoutMs);
 let response;
 try { response=await fetcher(url,{headers,signal:controller.signal}); }
 catch(error){ throw new FeedError(`Network error: ${error?.name==='AbortError'?'timed out':(error?.message||'unknown')}`,'NETWORK_ERROR',provider); }
 finally { clearTimeout(timer); }
 const text=await response.text();
 if(response.status===429) throw new FeedError(`${provider} rate limit exceeded`,'RATE_LIMITED',provider);
 if(response.status===404) throw new FeedError(`${provider}: not found`,'NOT_FOUND',provider);
 if(response.status===401||response.status===403) throw new FeedError(`${provider}: access denied (check the key or contact)`,'AUTH',provider);
 if(!response.ok) throw new FeedError(`${provider} HTTP ${response.status}`,'UNKNOWN',provider);
 return text;
}
export function parseJSON(text,provider){
 try { return JSON.parse(text); }
 catch { const body=text.slice(0,200); throw new FeedError(`${provider} error: ${body}`,/exceeded|limit/i.test(body)?'RATE_LIMITED':'PROVIDER_ERROR',provider); }
}
