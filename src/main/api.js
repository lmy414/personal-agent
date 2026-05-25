/**
 * DeepSeek API client — OpenAI-compatible format.
 * All LLM calls go through here; renderer never talks to the API directly.
 */
const https = require('https');
const http = require('http');

const MODEL_IDS = {
  'deepseek-chat': 'DeepSeek-V3',
  'deepseek-reasoner': 'DeepSeek-R1',
};

// Pricing per 1M tokens (USD) — DeepSeek official 2026
const PRICING = {
  'deepseek-chat':      { input: 0.27, output: 1.10 },
  'deepseek-reasoner':  { input: 0.55, output: 2.19 },
};

function getApiConfig(settings) {
  return {
    baseUrl: settings.api_base_url || 'https://api.deepseek.com',
    apiKey: settings.api_key || '',
  };
}

function getModelDisplayName(modelId) {
  return MODEL_IDS[modelId] || modelId;
}

function getModelPricing(modelId) {
  return PRICING[modelId] || { input: 0.27, output: 1.10 };
}

/**
 * Non-streaming message.
 */
function sendMessage({ messages, system, model, maxTokens, temperature, settings }) {
  const config = getApiConfig(settings);
  const url = new URL('/v1/chat/completions', config.baseUrl);

  // Build messages array with system prompt
  const msgs = [];
  if (system) {
    msgs.push({ role: 'system', content: system });
  }
  msgs.push(...messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role,
    content: m.content,
  })));

  const body = JSON.stringify({
    model: model,
    max_tokens: maxTokens || 4096,
    temperature: temperature || 0.7,
    messages: msgs,
  });

  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || 'API Error'));
            return;
          }
          const choice = json.choices?.[0] || {};
          const content = choice.message?.content || '';
          const usage = json.usage || {};
          resolve({
            content,
            tokensInput: usage.prompt_tokens || 0,
            tokensOutput: usage.completion_tokens || 0,
            model: json.model || model,
            stopReason: choice.finish_reason || '',
          });
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout (30s)')); });
    req.write(body);
    req.end();
  });
}

/**
 * Streaming message. Calls onToken for each text chunk.
 */
function sendMessageStream({ messages, system, model, maxTokens, temperature, settings, onToken }) {
  const config = getApiConfig(settings);
  const url = new URL('/v1/chat/completions', config.baseUrl);

  const msgs = [];
  if (system) {
    msgs.push({ role: 'system', content: system });
  }
  msgs.push(...messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role,
    content: m.content,
  })));

  const body = JSON.stringify({
    model: model,
    max_tokens: maxTokens || 4096,
    temperature: temperature || 0.7,
    messages: msgs,
    stream: true,
  });

  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(options, (res) => {
      let buffer = '';
      let fullContent = '';
      let usage = { prompt_tokens: 0, completion_tokens: 0 };
      let modelUsed = model;

      res.on('data', chunk => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            const choice = json.choices?.[0];
            if (choice?.delta?.content) {
              fullContent += choice.delta.content;
              onToken(choice.delta.content);
            }
            if (json.model) modelUsed = json.model;
            if (json.usage) usage = json.usage;
          } catch (_) { /* skip partial chunks */ }
        }
      });

      res.on('end', () => {
        resolve({
          content: fullContent,
          tokensInput: usage.prompt_tokens || 0,
          tokensOutput: usage.completion_tokens || 0,
          model: modelUsed,
          stopReason: '',
        });
      });

      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout (30s)')); });
    req.write(body);
    req.end();
  });
}

module.exports = {
  sendMessage,
  sendMessageStream,
  getModelDisplayName,
  getModelPricing,
  MODEL_IDS,
  PRICING,
};
