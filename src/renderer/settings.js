/**
 * Settings — panel UI, nav switching, form handling, usage dashboard.
 * Uses global App, dom, escapeHtml from app.js.
 */

const Settings = {
  opened: false,
};

const settingsSections = {
  api: `
    <h2 class="section-title">📡 API 配置</h2>
    <p class="section-desc">配置 DeepSeek API 连接。API Key 存储在本地，不会上传。</p>
    <div class="form-group">
      <label class="form-label">API Key</label>
      <div class="input-with-btn">
        <input type="password" id="cfg-api-key" placeholder="sk-...">
        <button class="btn btn-secondary btn-sm" id="btn-toggle-key">显示</button>
      </div>
      <p class="form-hint connection-status" id="api-status"><span class="status-dot offline"></span> 未验证</p>
    </div>
    <div class="form-group">
      <label class="form-label">Base URL</label>
      <input type="text" id="cfg-base-url" value="https://api.deepseek.com">
      <p class="form-hint">DeepSeek 官方 API 或兼容代理地址。</p>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-secondary btn-sm" id="btn-test-api">测试连接</button>
      <button class="btn btn-secondary btn-sm" id="btn-refresh-models">刷新模型列表</button>
    </div>
    <p class="form-hint" id="models-status" style="margin-top:6px;"></p>
  `,

  agent: `
    <h2 class="section-title">🤖 Agent 配置</h2>
    <p class="section-desc">调整 Agent 的行为参数和默认设置。</p>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Temperature</label>
        <input type="number" id="cfg-temperature" value="0.7" min="0" max="1" step="0.1">
        <p class="form-hint">越高越有创造性，越低越确定。</p>
      </div>
      <div class="form-group">
        <label class="form-label">Max Tokens（单次回复）</label>
        <input type="number" id="cfg-max-tokens" value="4096" min="256" max="8192" step="256">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">最大推理步数</label>
        <input type="number" id="cfg-max-steps" value="10" min="1" max="50">
      </div>
      <div class="form-group">
        <label class="form-label">上下文窗口上限 (Tokens)</label>
        <input type="number" id="cfg-context-limit" value="64000" min="1000" max="64000">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">System Prompt</label>
      <textarea id="cfg-system-prompt" rows="4">你是用户的个人 AI 助手，擅长资料收集、文章撰写和信息查询。回答应简洁准确，必要时使用 Markdown 格式化输出。</textarea>
    </div>
    <div class="toggle-row">
      <div><div class="toggle-label">启用流式输出</div><div class="toggle-desc">回复逐字显示，体验更流畅</div></div>
      <div class="toggle on" id="toggle-stream"></div>
    </div>
    <div class="toggle-row">
      <div><div class="toggle-label">自动压缩超长上下文</div><div class="toggle-desc">接近 Token 上限时自动总结早期消息</div></div>
      <div class="toggle on" id="toggle-compress"></div>
    </div>
  `,

  workspace: `
    <h2 class="section-title">📁 工作目录</h2>
    <p class="section-desc">设置默认工作目录和文件过滤规则。</p>
    <div class="form-group">
      <label class="form-label">默认工作目录</label>
      <div class="input-with-btn">
        <input type="text" id="cfg-workspace-dir" value="D:\\claude">
        <button class="btn btn-secondary btn-sm">浏览</button>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">忽略模式 (Glob)</label>
      <textarea id="cfg-ignore-patterns" rows="5">node_modules/
.git/
*.exe
*.dll
*.obj
.env
*.log
__pycache__/
*.pyc</textarea>
      <p class="form-hint">每行一个 glob 模式。</p>
    </div>
    <div class="form-group">
      <label class="form-label">预览文件大小上限 (KB)</label>
      <input type="number" value="500" min="10" max="10000">
    </div>
  `,

  usage: `
    <h2 class="section-title">📊 用量管理</h2>
    <p class="section-desc">Token 消耗统计与成本核算。汇率: 1 USD ≈ 7.3 CNY</p>
    <div class="dashboard-grid" id="usage-dashboard"></div>
    <div id="usage-breakdown"></div>
    <div id="usage-chart-area">
      <h3 style="font-size:13px;color:#fff;margin:16px 0 8px;">近 14 天 Token 消耗</h3>
      <div class="mini-bars" id="usage-mini-bars"></div>
    </div>
    <hr class="section-divider">
    <h3 style="font-size:13px;color:#fff;margin-bottom:8px;">每日明细</h3>
    <table class="daily-table">
      <thead><tr><th>日期</th><th>Input</th><th>Output</th><th>请求</th><th>费用 (¥)</th></tr></thead>
      <tbody id="usage-daily-table"></tbody>
    </table>
    <hr class="section-divider">
    <h3 style="font-size:13px;color:#fff;margin-bottom:8px;">预算控制</h3>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">月度预算上限 (¥)</label>
        <input type="number" id="cfg-monthly-budget" value="100" min="0" step="10">
      </div>
      <div class="form-group">
        <label class="form-label">单日预算上限 (¥)</label>
        <input type="number" id="cfg-daily-budget" value="20" min="0" step="5">
      </div>
    </div>
    <div class="toggle-row">
      <div><div class="toggle-label">预算预警通知</div></div>
      <div class="toggle on" id="toggle-budget-warn"></div>
    </div>
    <div class="toggle-row">
      <div><div class="toggle-label">超预算自动暂停</div></div>
      <div class="toggle" id="toggle-budget-stop"></div>
    </div>
    <hr class="section-divider">
    <h3 style="font-size:13px;color:#fff;margin-bottom:8px;">模型费率参考 (DeepSeek)</h3>
    <table class="daily-table">
      <thead><tr><th>模型</th><th>Input / M tokens</th><th>Output / M tokens</th></tr></thead>
      <tbody>
        <tr><td style="color:#fff">DeepSeek-V3 (chat)</td><td>$0.27 (¥1.97)</td><td>$1.10 (¥8.03)</td></tr>
        <tr><td style="color:#fff">DeepSeek-R1 (reasoner)</td><td>$0.55 (¥4.02)</td><td>$2.19 (¥15.99)</td></tr>
      </tbody>
    </table>
  `,

  appearance: `
    <h2 class="section-title">🎨 外观</h2>
    <p class="section-desc">界面主题与字体设置。</p>
    <div class="form-group">
      <label class="form-label">主题</label>
      <select><option>深色（默认）</option><option>浅色</option><option>跟随系统</option></select>
    </div>
    <div class="form-group">
      <label class="form-label">界面字号</label>
      <select><option>中（默认）</option><option>小</option><option>大</option></select>
    </div>
  `,

  about: `
    <h2 class="section-title">ℹ 关于</h2>
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:18px;margin-bottom:16px;">
      <h3 style="font-size:16px;color:#fff;">Personal Agent</h3>
      <p style="color:var(--text-muted);margin-bottom:10px;">个人 AI 助手 v0.1.0</p>
      <table style="font-size:12px;color:var(--text-secondary);">
        <tr><td style="padding:3px 16px 3px 0;color:var(--text-muted)">Electron</td><td>v37.x</td></tr>
        <tr><td style="padding:3px 16px 3px 0;color:var(--text-muted)">Node.js</td><td>v22.x</td></tr>
        <tr><td style="padding:3px 16px 3px 0;color:var(--text-muted)">LLM</td><td>DeepSeek API</td></tr>
        <tr><td style="padding:3px 16px 3px 0;color:var(--text-muted)">数据库</td><td>SQLite</td></tr>
      </table>
    </div>
    <hr class="section-divider">
    <div class="danger-zone">
      <h4>⚠ 危险操作</h4>
      <p>以下操作不可撤销，请确认后再执行。</p>
      <button class="btn btn-danger btn-sm" id="btn-clear-all">清除所有对话记录</button>
    </div>
  `,
};

function open() {
  $('#settings-overlay').classList.add('open');
  Settings.opened = true;
  populateForm();
  switchSection('api');
  // Refresh usage async
  refreshUsageDashboard();
}

function close() {
  $('#settings-overlay').classList.remove('open');
  Settings.opened = false;
  saveSettings();
}

$('#btn-close-settings').addEventListener('click', close);
$('#settings-overlay').addEventListener('click', (e) => {
  if (e.target === $('#settings-overlay')) close();
});

// ── Inject section HTML ──
function initSections() {
  const content = $('#settings-window .settings-content');
  Object.entries(settingsSections).forEach(([key, html]) => {
    const div = document.createElement('div');
    div.className = 'settings-section';
    div.id = 'section-' + key;
    div.innerHTML = html;
    content.appendChild(div);
  });
}

// ── Nav switching ──
function switchSection(name) {
  $$('.settings-section').forEach(s => s.classList.remove('active'));
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  const section = $('#section-' + name);
  if (section) section.classList.add('active');
  const navItem = document.querySelector(`.nav-item[data-section="${name}"]`);
  if (navItem) navItem.classList.add('active');

  if (name === 'usage' && Settings.opened) {
    refreshUsageDashboard();
  }
}

// ── Populate form from current settings ──
function populateForm() {
  const s = App.settings;
  setVal('cfg-api-key', s.api_key || '');
  setVal('cfg-base-url', s.api_base_url || 'https://api.deepseek.com');
  setVal('cfg-temperature', s.temperature || '0.7');
  setVal('cfg-max-tokens', s.max_tokens || '4096');
  setVal('cfg-max-steps', s.max_steps || '10');
  setVal('cfg-context-limit', s.context_limit || '64000');
  setVal('cfg-system-prompt', s.system_prompt || '');
  setVal('cfg-monthly-budget', s.monthly_budget || '100');
  setVal('cfg-daily-budget', s.daily_budget || '20');
  setVal('cfg-ignore-patterns', s.ignore_patterns || '');

  setToggle('toggle-stream', s.stream_enabled !== 'false');
  setToggle('toggle-compress', s.auto_compress !== 'false');
  setToggle('toggle-budget-warn', s.budget_warn !== 'false');
  setToggle('toggle-budget-stop', s.budget_stop === 'true');
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setToggle(id, on) {
  const el = document.getElementById(id);
  if (el) on ? el.classList.add('on') : el.classList.remove('on');
}

// ── Collect form values and save ──
async function saveSettings() {
  const updates = {
    api_key: getVal('cfg-api-key'),
    api_base_url: getVal('cfg-base-url'),
    temperature: getVal('cfg-temperature'),
    max_tokens: getVal('cfg-max-tokens'),
    max_steps: getVal('cfg-max-steps'),
    context_limit: getVal('cfg-context-limit'),
    system_prompt: getVal('cfg-system-prompt'),
    monthly_budget: getVal('cfg-monthly-budget'),
    daily_budget: getVal('cfg-daily-budget'),
    ignore_patterns: getVal('cfg-ignore-patterns'),
    stream_enabled: getToggle('toggle-stream') ? 'true' : 'false',
    auto_compress: getToggle('toggle-compress') ? 'true' : 'false',
    budget_warn: getToggle('toggle-budget-warn') ? 'true' : 'false',
    budget_stop: getToggle('toggle-budget-stop') ? 'true' : 'false',
  };

  await window.electronAPI.saveSettings(updates);
  App.settings = await window.electronAPI.getSettings();
  // Refresh models if API key changed
  if (updates.api_key || updates.api_base_url) {
    try { await refreshModels(); } catch (_) {}
  }
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function getToggle(id) {
  const el = document.getElementById(id);
  return el ? el.classList.contains('on') : false;
}

// ── Usage Dashboard ──
async function refreshUsageDashboard() {
  try {
    const monthData = await window.electronAPI.getUsageStats('month');
    const todayData = await window.electronAPI.getUsageStats('today');
    const d14Data = await window.electronAPI.getUsageStats('14d');

    // Stat cards
    const dash = document.getElementById('usage-dashboard');
    if (!dash) return;

    const todayTokens = todayData.totalTokens || 0;
    const monthTokens = monthData.totalTokens || 0;
    const todayCost = todayData.totalCostCny || 0;
    const monthCost = monthData.totalCostCny || 0;

    dash.innerHTML = `
      <div class="stat-card accent"><div class="stat-label">今日消耗</div><div class="stat-value cost-cny">¥${todayCost.toFixed(2)}</div><div class="stat-sub">${(todayTokens/1000).toFixed(1)}K tokens</div></div>
      <div class="stat-card warning"><div class="stat-label">本月累计</div><div class="stat-value cost-cny">¥${monthCost.toFixed(2)}</div><div class="stat-sub">${(monthTokens/1e6).toFixed(2)}M tokens</div></div>
      <div class="stat-card info"><div class="stat-label">今日 Input</div><div class="stat-value">${(todayData.totalTokensInput||0).toLocaleString()}</div><div class="stat-sub">${todayData.totalRequests||0} 次请求</div></div>
      <div class="stat-card success"><div class="stat-label">今日 Output</div><div class="stat-value">${(todayData.totalTokensOutput||0).toLocaleString()}</div><div class="stat-sub">Output 成本更高</div></div>
    `;

    // Cost breakdown bar
    const breakdown = document.getElementById('usage-breakdown');
    if (breakdown && monthData.totalTokens > 0) {
      const inPct = (monthData.totalTokensInput / monthData.totalTokens * 100).toFixed(0);
      const outPct = (monthData.totalTokensOutput / monthData.totalTokens * 100).toFixed(0);
      breakdown.innerHTML = `
        <h3 style="font-size:13px;color:#fff;margin:12px 0 8px;">成本构成（本月）</h3>
        <div class="cost-bar-wrap">
          <div class="cost-bar-input" style="width:${inPct}%">Input ${inPct}%</div>
          <div class="cost-bar-output" style="width:${outPct}%">Output ${outPct}%</div>
        </div>
        <div class="cost-legend">
          <span><span class="legend-dot input"></span> Input</span>
          <span><span class="legend-dot output"></span> Output</span>
        </div>`;
    }

    // Mini bar chart (14 days)
    const barsContainer = document.getElementById('usage-mini-bars');
    if (barsContainer && d14Data.daily.length > 0) {
      const daily = d14Data.daily;
      const maxT = Math.max(...daily.map(d => d.tokensTotal || 0), 1);
      barsContainer.innerHTML = daily.map(d => {
        const h = Math.max(4, ((d.tokensTotal || 0) / maxT) * 56);
        return `<div class="mini-bar" style="height:${h}px" title="${d.date}: ${((d.tokensTotal||0)/1000).toFixed(1)}K tokens / ¥${d.costCny}">
          <span class="bar-tooltip">${d.date}: ¥${d.costCny}</span>
        </div>`;
      }).join('');
    }

    // Daily table
    const tableBody = document.getElementById('usage-daily-table');
    if (tableBody && d14Data.daily.length > 0) {
      tableBody.innerHTML = d14Data.daily.slice().reverse().slice(0, 14).map(d => `
        <tr>
          <td>${d.date}</td>
          <td>${((d.tokensInput||0)/1000).toFixed(1)}K</td>
          <td>${((d.tokensOutput||0)/1000).toFixed(1)}K</td>
          <td>${d.requests}</td>
          <td style="color:var(--warning)">¥${d.costCny}</td>
        </tr>`).join('');
    }

  } catch (err) {
    console.error('Usage refresh error:', err);
  }
}

// ── Event delegation for dynamic elements ──
$('#settings-window').addEventListener('click', async (e) => {
  // Toggle switches
  const toggle = e.target.closest('.toggle');
  if (toggle) {
    toggle.classList.toggle('on');
    return;
  }

  // Show/hide API key
  if (e.target.id === 'btn-toggle-key') {
    const inp = document.getElementById('cfg-api-key');
    if (inp) {
      inp.type = inp.type === 'password' ? 'text' : 'password';
      e.target.textContent = inp.type === 'password' ? '显示' : '隐藏';
    }
    return;
  }

  // Refresh models
  if (e.target.id === 'btn-refresh-models') {
    const status = document.getElementById('models-status');
    if (status) status.textContent = '获取中...';
    try {
      const result = await window.electronAPI.listModels();
      if (status) {
        if (result.error) {
          status.innerHTML = `<span style="color:var(--danger)">获取失败: ${result.error}</span>`;
        } else {
          status.innerHTML = `<span style="color:var(--success)">✓ 获取到 ${result.models.length} 个模型</span>`;
          // Refresh the main window model select
          await refreshModels();
        }
      }
    } catch (err) {
      if (status) status.innerHTML = `<span style="color:var(--danger)">错误: ${err.message}</span>`;
    }
    return;
  }

  // Test API connection
  if (e.target.id === 'btn-test-api') {
    const apiKey = document.getElementById('cfg-api-key')?.value;
    const baseUrl = document.getElementById('cfg-base-url')?.value;
    const status = document.getElementById('api-status');
    if (status) status.innerHTML = '<span class="status-dot offline"></span> 测试中...';

    window.electronAPI.testApi({ apiKey, baseUrl }).then(result => {
      if (status) {
        if (result.ok) {
          status.innerHTML = '<span class="status-dot online"></span> 连接正常';
        } else {
          status.innerHTML = `<span class="status-dot offline"></span> 失败: ${result.error}`;
        }
      }
    });
    return;
  }

  // Clear all
  if (e.target.id === 'btn-clear-all') {
    if (confirm('确定要删除所有对话记录？此操作不可撤销。')) {
      App.conversations.forEach(async (c) => {
        await window.electronAPI.deleteConversation(c.id);
      });
      App.conversations = [];
      renderConvList();
      createNewConversation();
      close();
    }
    return;
  }
});

// ── Nav click handlers ──
$$('.nav-item').forEach(item => {
  item.addEventListener('click', () => switchSection(item.dataset.section));
});

// ── Init ──
initSections();

// Export
Settings.open = open;
Settings.close = close;
