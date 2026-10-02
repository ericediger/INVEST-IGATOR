import {readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {fail} from './model.js';

export function readAPIKey(dataDir) {
  if (process.env.OPENAI_API_KEY?.trim()) return process.env.OPENAI_API_KEY.trim();
  const path = process.env.OPENAI_API_KEY_FILE || join(dataDir, 'openai-api-key');
  try {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > 4096 || (stat.mode & 0o077)) return '';
    return readFileSync(path, 'utf8').trim();
  } catch { return ''; }
}

export function safeURL(value) {
  try {
    const u = new URL(value);
    return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password && value.length <= 2000 ? u.href : null;
  } catch { return null; }
}

export function responseText(response) {
  if (response.status !== 'completed') fail('The provider did not finish this response. Start a new run to try again.', 502);
  const parts = (response.output || []).filter(i => i.type === 'message').flatMap(i => i.content || []);
  if (parts.some(i => i.type === 'refusal')) fail('The provider could not complete this research request.', 502);
  const text = parts.filter(i => i.type === 'output_text').map(part => {
    let value = part.text;
    const annotations = (part.annotations || []).filter(a => a.type === 'url_citation' && safeURL(a.url) && Number.isInteger(a.start_index) && Number.isInteger(a.end_index) && a.start_index >= 0 && a.end_index > a.start_index && a.end_index <= value.length).sort((a,b) => b.start_index-a.start_index);
    let boundary = value.length;
    for (const a of annotations) {
      if (a.end_index > boundary) continue;
      const label = String(a.title || 'Source').replace(/[\[\]\n]/g, ' ').slice(0, 200);
      value = value.slice(0,a.start_index) + `[${label}](${safeURL(a.url)})` + value.slice(a.end_index);
      boundary = a.start_index;
    }
    return value;
  }).join('\n');
  if (!text.trim()) fail('The provider returned no research text.', 502);
  return text;
}

export function responseSources(response) {
  const sources = [];
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const part of item.content || []) for (const a of part.annotations || []) {
      const url = safeURL(a.url);
      if (a.type === 'url_citation' && url && !sources.some(s => s.url === url)) sources.push({url, title: String(a.title || url).slice(0, 500)});
    }
  }
  return sources;
}

export class OpenAIResearchProvider {
  constructor({key, model = process.env.RESEARCH_AI_MODEL || 'gpt-6-astra', reasoningEffort = process.env.RESEARCH_AI_REASONING_EFFORT || 'medium', fetcher = fetch}) {
    if (!['low','medium','high','xhigh','max'].includes(reasoningEffort)) throw new Error('Unsupported research reasoning effort.');
    this.key = key; this.model = model; this.reasoningEffort = reasoningEffort; this.fetcher = fetcher;
  }
  configured() { return !!this.key(); }
  async request({instructions, input, search = false, schema = null, schemaName = 'investment_assessment', maxToolCalls = 4, signal}) {
    const key = this.key();
    if (!key) fail('Connect an OpenAI API key on the server to run research.', 503);
    const timeout = AbortSignal.timeout(240000);
    const controller = new AbortController();
    const abort = () => controller.abort();
    timeout.addEventListener('abort', abort, {once: true});
    signal?.addEventListener('abort', abort, {once: true});
    if (signal?.aborted) controller.abort();
    try {
      const response = await this.fetcher('https://api.openai.com/v1/responses', {
        method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${key}`}, signal: controller.signal,
        body: JSON.stringify({model: this.model, reasoning: {effort: this.reasoningEffort}, store: false, instructions, input, max_output_tokens: 6500,
          ...(search ? {tools: [{type: 'web_search'}], tool_choice: 'required', max_tool_calls: Math.min(8, Math.max(1, maxToolCalls))} : {}),
          ...(schema ? {text: {format: {type: 'json_schema', name: schemaName, strict: true, schema}}} : {})})
      });
      if (!response.ok) {
        const messages = {401: 'The OpenAI API key was rejected. Update the server key.', 403: 'This API project cannot access the requested model or tools.', 404: 'The requested research model is unavailable to this API project. Check model access.', 429: 'OpenAI usage or rate limit reached. Check API billing and limits before trying again.'};
        fail(messages[response.status] || `Research provider unavailable (HTTP ${response.status}). Start a new run to retry.`, 502);
      }
      const result = await response.json();
      responseText(result);
      return result;
    } catch (error) {
      if (error.status) throw error;
      fail(controller.signal.aborted ? 'Research stopped or timed out. A provider charge may still apply; no automatic retry was made.' : 'Could not reach OpenAI. Check the server connection and start a new run to retry.', 502);
    } finally {
      timeout.removeEventListener('abort', abort); signal?.removeEventListener('abort', abort);
    }
  }
}
