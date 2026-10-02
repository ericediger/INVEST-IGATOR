// Bounds structured model output leniently before strict validation. Over-long arrays are truncated and
// over-long strings shortened, and each adjustment is recorded, so an expensive run is not lost to verbosity.
export function clampOutput(value,{arrays={},strings={}}={},notes=[]) {
  const walk=(node,key)=>{
    if(Array.isArray(node)) {
      const max=arrays[key]; let out=node;
      if(max&&node.length>max) {notes.push(`${key}: kept ${max} of ${node.length} items returned by the model.`); out=node.slice(0,max);}
      return out.map(v=>walk(v,key));
    }
    if(node&&typeof node==='object') {const out={}; for(const [k,v] of Object.entries(node)) out[k]=walk(v,k); return out;}
    if(typeof node==='string') {const max=strings[key]; if(max&&node.length>max) {notes.push(`${key}: shortened from ${node.length} to ${max} characters.`); return node.slice(0,max-1)+'…';}}
    return node;
  };
  return walk(value,'');
}
