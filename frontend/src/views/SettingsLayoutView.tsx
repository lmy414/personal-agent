import type { JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import { Settings, Palette, Wrench, FolderOpen, Info } from 'lucide-solid'

function kbd(fn: () => void) { return { tabIndex: 0, role: 'button' as const, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() } } } }

type SettingsPage = 'model' | 'display' | 'skills' | 'workdir' | 'system'

const NAV_ITEMS: { id: SettingsPage; icon: () => JSX.Element; label: string; desc: string }[] = [
  { id: 'model',   icon: () => <Settings size={14} />, label: '模型管理',   desc: 'API 密钥 · 模型选择 · 参数配置' },
  { id: 'display', icon: () => <Palette size={14} />,  label: '显示设置',   desc: '主题 · 壁纸 · 字体 · 布局' },
  { id: 'skills',  icon: () => <Wrench size={14} />,   label: '技能管理',   desc: 'MCP 接入 · 扩展管理' },
  { id: 'workdir', icon: () => <FolderOpen size={14} />, label: '工作目录', desc: '项目路径 · 文件索引' },
  { id: 'system',  icon: () => <Info size={14} />,     label: '系统信息',   desc: '版本 · 日志 · 关于澪号' },
]

// ── 复用小组件 ──

function ToggleSmall(props: { initialOn: boolean }) {
  const [on, setOn] = createSignal(props.initialOn)
  return (
    <div {...kbd(() => setOn(!on()))} onClick={() => setOn(!on())} style={{
      width: '32px', height: '18px', 'border-radius': '9px', cursor: 'pointer',
      background: on() ? 'rgba(107,143,168,0.40)' : 'rgba(255,255,255,0.10)',
      border: 'none', position: 'relative', transition: 'background 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: '2px', left: '2px', width: '14px', height: '14px',
        'border-radius': '50%', background: 'white', transition: 'transform 0.2s',
        transform: on() ? 'translateX(14px)' : 'translateX(0)',
      }} />
    </div>
  )
}

function SectionTitle(props: { children: string }) {
  return <div style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '14px', 'font-weight': '600', 'margin-bottom': '16px' }}>{props.children}</div>
}

function Btn(props: { children: string; primary?: boolean }) {
  return (
    <button style={{
      padding: '6px 14px', 'border-radius': '4px', cursor: 'pointer', 'font-family': 'inherit', 'font-size': '12px',
      background: props.primary ? 'rgba(107,143,168,0.15)' : 'rgba(255,255,255,0.04)',
      border: props.primary ? '1px solid rgba(107,143,168,0.20)' : '1px solid rgba(255,255,255,0.06)',
      color: props.primary ? 'var(--accent)' : 'var(--text-secondary)',
    }}>{props.children}</button>
  )
}

// ── mock 数据 ──

const modelProviders = [
  { name: 'Anthropic', meta: '4 个模型 · 已连接', on: true },
  { name: 'DeepSeek', meta: '3 个模型 · 已连接', on: true },
  { name: 'OpenAI', meta: '2 个模型 · 已连接', on: true },
  { name: 'Google AI', meta: '1 个模型 · 未配置', on: false },
]

const models = [
  { name: 'Claude Opus 4.6', provider: 'Anthropic', dots: 4, on: true },
  { name: 'Claude Sonnet 4.6', provider: 'Anthropic', dots: 3, on: true },
  { name: 'Claude Haiku 4.5', provider: 'Anthropic', dots: 2, on: true },
  { name: 'DeepSeek V4 Pro', provider: 'DeepSeek', dots: 3, on: true },
  { name: 'DeepSeek V4 Lite', provider: 'DeepSeek', dots: 2, on: false },
  { name: 'GPT-4o', provider: 'OpenAI', dots: 3, on: true },
  { name: 'GPT-4o Mini', provider: 'OpenAI', dots: 2, on: false },
  { name: 'Gemini 2.5 Pro', provider: 'Google AI', dots: 3, on: false },
]

const themes = [
  { name: '澪号暗蓝', color: '#6B8FA8', active: true },
  { name: '翡翠绿',   color: '#5B8C5A', active: false },
  { name: '琥珀橙',   color: '#C8963E', active: false },
  { name: '樱花紫',   color: '#8B7FB8', active: false },
  { name: '石墨灰',   color: '#7A8B94', active: false },
]

const wallpapers = [
  { name: '对话区主界面', desc: '聊天面板 + 侧栏 + 编辑器', path: './wallpapers/mio-chat.jpg' },
  { name: '设置页面',     desc: '全屏设置覆盖',            path: './wallpapers/mio-settings.jpg' },
  { name: '费用仪表盘',   desc: '用量统计与图表',           path: './wallpapers/mio-dashboard.jpg' },
  { name: '角色管理',     desc: '角色配置与技能',           path: './wallpapers/mio-agents.jpg' },
  { name: '会话记录',     desc: '操作日志与追溯',           path: './wallpapers/mio-records.jpg' },
]

const mcpTools = [
  { name: 'Pencil 设计工具', desc: 'UI/UX 设计协作',    status: '在线', on: true },
  { name: 'Live2D 桌面宠物', desc: '角色交互与动画',   status: '在线', on: true },
  { name: '文件系统访问',    desc: '本地文件读写',     status: '在线', on: true },
  { name: 'Notion 集成',     desc: '知识库同步',       status: '离线', on: false },
  { name: 'SQLite 查询',     desc: '数据库操作',       status: '在线', on: true },
  { name: 'Web 搜索',        desc: '搜索引擎接入',     status: '在线', on: true },
]

const skillGroups = [
  {
    icon: '🌐', title: '全局技能', desc: '所有项目可用',
    skills: [
      { name: '代码审查', desc: '自动检测代码质量与安全漏洞', on: true },
      { name: '多语言翻译', desc: '支持跨语言工程文档', on: true },
      { name: '图像生成', desc: 'AI 根据描述生成图像', on: false },
    ],
  },
  {
    icon: '📁', title: '项目技能', desc: '仅当前项目可用',
    skills: [
      { name: '单元测试生成', desc: '基于代码逻辑自动生成测试用例', on: true },
      { name: '文档生成', desc: '从代码注释生成 API 文档', on: true },
      { name: '重构建议', desc: '识别代码异味并提供重构方案', on: true },
      { name: '性能分析', desc: '检测性能瓶颈并提供优化建议', on: false },
      { name: '依赖检查', desc: '检测过期依赖与安全漏洞', on: true },
    ],
  },
]

const excludeRules = [
  { name: '日志文件', pattern: '*.log' },
  { name: '依赖目录', pattern: 'node_modules' },
  { name: '构建输出', pattern: 'dist' },
  { name: '数据库文件', pattern: '*.db, *.sqlite' },
  { name: '环境变量', pattern: '.env' },
  { name: '临时文件', pattern: '*.tmp' },
  { name: '版本控制', pattern: '.git' },
]

const logs = [
  { time: '14:32:15', level: 'INFO' as const, msg: '会话 #52 已创建 · 模型 Claude Opus 4.6' },
  { time: '14:31:52', level: 'INFO' as const, msg: 'File_exec 完成 · App.tsx L42-58 · 1.2s' },
  { time: '14:31:28', level: 'WARN' as const, msg: 'shell_exec 超时 · npm run build · 30s' },
  { time: '14:31:05', level: 'INFO' as const, msg: '上下文压缩完成 · 释放 8,450 tokens' },
  { time: '14:30:40', level: 'INFO' as const, msg: 'MCP 服务重连成功 · 7 工具可用' },
  { time: '14:29:07', level: 'ERR'  as const, msg: '连接 v3.1.0 启动 · PID 8241 · 端口 9229' },
]

const links = [
  { icon: '🐙', name: 'GitHub',  url: 'github.com/layyck' },
  { icon: '📺', name: 'Bilibili', url: 'space.bilibili.com/2529362295' },
]

// ── 子页面 ──

function ModelPage() {
  const agent = useAgent()
  return (
    <>
      <div style={{ 'margin-bottom': '32px' }}>
        <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', 'margin-bottom': '16px' }}>
          <SectionTitle>模型提供商</SectionTitle>
          <Btn primary>+ 新增提供商</Btn>
        </div>
        <div style={{ display: 'grid', 'grid-template-columns': 'repeat(4, 1fr)', gap: '12px' }}>
          <For each={modelProviders}>
            {(p) => (
              <div style={{
                padding: '14px', background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.04)',
                'border-radius': '6px', display: 'flex', 'align-items': 'center', gap: '10px',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{
                  width: '7px', height: '7px', 'border-radius': '50%', 'flex-shrink': '0',
                  background: p.on ? 'var(--success)' : 'var(--text-muted)',
                  'box-shadow': p.on ? '0 0 4px rgba(91,140,90,0.3)' : 'none',
                }} />
                <div style={{ flex: '1' }}>
                  <div style={{ 'font-size': '13px', 'font-weight': '500' }}>{p.name}</div>
                  <div style={{ 'font-size': '10px', color: 'var(--text-muted)', 'margin-top': '1px' }}>{p.meta}</div>
                </div>
                <button style={{
                  padding: '3px 10px', 'border-radius': '3px', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)', 'font-size': '10px', cursor: 'pointer',
                }}>{p.on ? '配置' : '设置'}</button>
              </div>
            )}
          </For>
        </div>
      </div>
      <SectionTitle>可用模型列表</SectionTitle>
      <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '12px' }}>
        <thead>
          <tr>
            <th style={thStyle}>模型名称</th>
            <th style={thStyle}>思考强度</th>
            <th style={thStyle}>状态</th>
          </tr>
        </thead>
        <tbody>
          <For each={models}>
            {(m, i) => (
              <tr style={{ transition: 'background 0.12s', cursor: 'pointer' }}>
                <td style={tdStyle}>
                  <div style={{ 'font-weight': '500', color: 'var(--text-primary)' }}>{m.name}</div>
                  <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>{m.provider}</div>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[1,2,3,4].map((d) => (
                      <div style={{ width: '5px', height: '5px', 'border-radius': '50%', background: d <= m.dots ? 'var(--accent)' : 'rgba(255,255,255,0.10)' }} />
                    ))}
                  </div>
                </td>
                <td style={tdStyle}><ToggleSmall initialOn={m.on} /></td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </>
  )
}

function DisplayPage() {
  const titleStyle: Record<string, string> = { 'font-family': '"Noto Serif SC", serif', 'font-size': '15px', 'font-weight': '600', color: 'var(--text-primary)' }
  const cardStyle: Record<string, string> = { background: '#0E0E1640', border: '1px solid rgba(255,255,255,0.024)', 'border-radius': '6px' }

  return (
    <>
      <div style={{ ...titleStyle, 'margin-bottom': '16px' }}>主题颜色</div>
      <div style={{ display: 'grid', 'grid-template-columns': 'repeat(5, 1fr)', gap: '16px', 'margin-bottom': '20px' }}>
        <For each={themes}>
          {(t) => (
            <div style={{
              padding: '20px', background: 'var(--card-bg)',
              border: `1px solid ${t.active ? 'var(--accent)' : 'rgba(255,255,255,0.04)'}`,
              'border-radius': '8px', display: 'flex', 'flex-direction': 'column', 'align-items': 'center',
              gap: '10px', cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <div style={{ width: '48px', height: '48px', 'border-radius': '6px', background: t.color }} />
              <div style={{ 'font-size': '12px', color: t.active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{t.name}</div>
            </div>
          )}
        </For>
      </div>

      {/* divider between sections — matches Pencil frame#p2cfV */}
      <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', opacity: '0.35', 'margin-bottom': '20px' }} />

      <div style={{ ...titleStyle, 'margin-bottom': '12px' }}>界面背景图</div>
      <div style={{ 'font-size': '12px', color: 'var(--text-muted)', 'margin-bottom': '12px' }}>每个主界面可单独设置背景图片</div>
      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
        <For each={wallpapers}>
          {(wp) => (
            <div style={{
              display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
              padding: '14px 16px', ...cardStyle,
            }}>
              <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                <div style={{ 'font-size': '13px', 'font-weight': '500' }}>{wp.name}</div>
                <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>{wp.desc}</div>
                <div style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '10px', color: 'var(--text-muted)' }}>{wp.path}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Thumb button — matches Pencil frame#bAfD9: 64×40, fill:#FFFFFF06, stroke:#FFFFFF0D */}
                <div style={{
                  width: '64px', height: '40px', display: 'flex', 'align-items': 'center', 'justify-content': 'center',
                  background: 'rgba(255,255,255,0.024)', border: '1px solid rgba(255,255,255,0.05)',
                  'border-radius': '4px', cursor: 'pointer',
                }}>
                  <span style={{ 'font-size': '16px', color: 'var(--text-muted)' }}>🖼</span>
                </div>
                {/* Browse button — matches Pencil frame#eAztA: transparent fill, stroke:#FFFFFF14, padding:[7,16] */}
                <div style={{
                  display: 'flex', 'align-items': 'center', padding: '7px 16px',
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                  'border-radius': '4px', cursor: 'pointer',
                }}>
                  <span style={{ 'font-size': '11px', 'font-weight': '500', color: 'var(--text-secondary)' }}>浏览</span>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
    </>
  )
}

function SkillsPage() {
  return (
    <>
      <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', 'margin-bottom': '16px' }}>
        <SectionTitle>MCP 工具管理</SectionTitle>
        <Btn primary>+ 添加 MCP</Btn>
      </div>
      <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '12px', 'margin-bottom': '32px' }}>
        <thead>
          <tr>
            <th style={thStyle}>工具名称</th>
            <th style={thStyle}>状态</th>
            <th style={thStyle}>启用</th>
            <th style={thStyle}>操作</th>
          </tr>
        </thead>
        <tbody>
          <For each={mcpTools}>
            {(tool) => (
              <tr>
                <td style={tdStyle}>
                  <div style={{ 'font-weight': '500', color: 'var(--text-primary)' }}>{tool.name}</div>
                  <div style={{ 'font-size': '11px', color: 'var(--text-muted)', 'margin-top': '2px' }}>{tool.desc}</div>
                </td>
                <td style={tdStyle}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', 'border-radius': '3px', 'font-size': '10px',
                    background: tool.status === '在线' ? 'rgba(91,140,90,0.10)' : 'rgba(255,255,255,0.04)',
                    color: tool.status === '在线' ? 'var(--success)' : 'var(--text-muted)',
                  }}>{tool.status}</span>
                </td>
                <td style={tdStyle}><ToggleSmall initialOn={tool.on} /></td>
                <td style={tdStyle}><span style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>配置</span></td>
              </tr>
            )}
          </For>
        </tbody>
      </table>

      <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', 'margin-bottom': '16px' }}>
        <SectionTitle>已安装技能</SectionTitle>
        <Btn>+ 安装技能</Btn>
      </div>
      <For each={skillGroups}>
        {(group) => (
          <div style={{ 'margin-bottom': '20px' }}>
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '10px' }}>
              <span style={{ 'font-size': '14px' }}>{group.icon}</span>
              <span style={{ 'font-size': '12px', 'font-weight': '500' }}>{group.title}</span>
              <span style={{ 'font-size': '11px', color: 'var(--text-muted)', 'margin-left': 'auto' }}>{group.desc}</span>
            </div>
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
              <For each={group.skills}>
                {(skill) => (
                  <div style={{
                    display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
                    padding: '10px 14px', background: 'var(--card-bg)',
                    border: '1px solid rgba(255,255,255,0.03)', 'border-radius': '4px',
                  }}>
                    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
                      <div style={{ 'font-size': '12px' }}>{skill.name}</div>
                      <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>{skill.desc}</div>
                    </div>
                    <ToggleSmall initialOn={skill.on} />
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </>
  )
}

function WorkdirPage() {
  return (
    <>
      <SectionTitle>工作目录</SectionTitle>
      <div style={{
        display: 'flex', 'align-items': 'center', gap: '12px', padding: '12px 16px',
        background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.04)',
        'border-radius': '6px', 'margin-bottom': '8px',
      }}>
        <span style={{ 'font-size': '12px', color: 'var(--text-muted)', 'min-width': '80px' }}>项目根目录</span>
        <input readOnly value="D:\claude\personal-agent" style={inputStyle} />
        <Btn>更改目录</Btn>
      </div>
      <div style={{ 'font-size': '11px', color: 'var(--text-muted)', 'margin-left': '8px', 'margin-bottom': '32px' }}>
        包含 47 个文件 · 12 个目录 · 最后扫描 14:32
      </div>

      <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', 'margin-bottom': '12px' }}>
        <SectionTitle>文件排除规则</SectionTitle>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
          <span style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>已忽略文件将在文件浏览器中隐藏</span>
          <Btn primary>添加规则</Btn>
        </div>
      </div>
      <div style={{
        display: 'flex', 'align-items': 'center', gap: '12px', padding: '12px 16px',
        background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.04)',
        'border-radius': '6px', 'margin-bottom': '16px',
      }}>
        <input placeholder="输入排除规则，如 *.log 或 node_modules" style={inputStyle} />
        <Btn>添加规则</Btn>
      </div>
      <div style={{ display: 'flex', gap: '8px', 'margin-bottom': '16px', 'flex-wrap': 'wrap' }}>
        <For each={['*.log','node_modules','dist','*.db','*.sqlite','.env','*.tmp','.git']}>
          {(tag) => (
            <span style={{
              padding: '4px 10px', 'border-radius': '4px', 'font-size': '11px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              color: 'var(--text-secondary)', 'font-family': '"JetBrains Mono", monospace',
            }}>{tag}</span>
          )}
        </For>
      </div>
      <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '12px', 'margin-top': '12px' }}>
        <thead>
          <tr>
            <th style={thStyle}>规则</th>
            <th style={thStyle}>匹配类型</th>
            <th style={thStyle}>匹配规则</th>
            <th style={thStyle}>操作</th>
          </tr>
        </thead>
        <tbody>
          <For each={excludeRules}>
            {(rule) => (
              <tr>
                <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{rule.name}</td>
                <td style={tdStyle}>
                  <span style={{ display: 'inline-block', padding: '2px 8px', 'border-radius': '3px', 'font-size': '10px', 'font-family': '"JetBrains Mono", monospace', background: 'rgba(232,85,61,0.10)', color: 'var(--error)' }}>排除</span>
                </td>
                <td style={{ ...tdStyle, 'font-family': '"JetBrains Mono", monospace' }}>{rule.pattern}</td>
                <td style={tdStyle}><span style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>移除</span></td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </>
  )
}

function SystemPage() {
  return (
    <>
      <div style={{
        display: 'flex', 'align-items': 'center', gap: '20px', padding: '20px',
        background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.04)',
        'border-radius': '8px', 'margin-bottom': '24px',
      }}>
        <div style={{
          width: '56px', height: '56px', 'border-radius': '8px',
          background: 'rgba(107,143,168,0.15)', border: '1px solid rgba(107,143,168,0.20)',
          display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-size': '24px', 'flex-shrink': '0',
        }}>澪</div>
        <div style={{ flex: '1' }}>
          <div style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '18px', 'font-weight': '600', 'margin-bottom': '4px' }}>澪号 · MIO Terminal</div>
          <div style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '11px', color: 'var(--text-muted)' }}>v3.1.0 · PRTS Build 2026.06.07</div>
        </div>
        <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'flex-end', gap: '4px' }}>
          <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>前端框架: SolidJS + Tailwind</div>
          <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>后端桥接: Node.js + Pi SDK</div>
          <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>AI 引擎: DeepSeek V4 · Claude · GPT-4o</div>
          <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>数据库: SQLite · ~/.personal-agent/</div>
        </div>
      </div>

      <SectionTitle>最近运行日志</SectionTitle>
      <div style={{
        background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.04)',
        'border-radius': '6px', padding: '12px 16px', 'margin-bottom': '24px',
      }}>
        <For each={logs}>
          {(log) => (
            <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', padding: '6px 0', 'font-size': '12px' }}>
              <span style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '10px', color: 'var(--text-muted)', width: '60px', 'flex-shrink': '0' }}>{log.time}</span>
              <span style={{ 'font-size': '10px', 'font-weight': '600', width: '40px', 'flex-shrink': '0', color: log.level === 'INFO' ? 'var(--accent)' : log.level === 'WARN' ? 'var(--warning)' : '#E8553D' }}>{log.level}</span>
              <span style={{ color: 'var(--text-secondary)', flex: '1' }}>{log.msg}</span>
            </div>
          )}
        </For>
      </div>

      <div style={{ display: 'flex', gap: '24px' }}>
        <div style={{ flex: '1' }}>
          <SectionTitle>关于澪号</SectionTitle>
          <div style={{ 'font-size': '12px', 'line-height': '1.7', color: 'var(--text-secondary)' }}>
            澪号是一个面向开发者的个人 AI 助手终端。融合了玻璃拟态视觉设计与多模型 AI 调度能力，通过统一的 WebSocket 桥接层，将 Pi SDK 的能力以插件化方式扩展到前端。
          </div>
        </div>
        <div style={{ flex: '1' }}>
          <SectionTitle>开发者链接</SectionTitle>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '10px' }}>
            <For each={links}>
              {(link) => (
                <div style={{
                  display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
                  padding: '10px 14px', background: 'var(--card-bg)',
                  border: '1px solid rgba(255,255,255,0.04)', 'border-radius': '6px',
                }}>
                  <div style={{ display: 'flex', 'align-items': 'center', gap: '10px' }}>
                    <span style={{ 'font-size': '16px' }}>{link.icon}</span>
                    <div>
                      <div style={{ 'font-size': '13px', 'font-weight': '500' }}>{link.name}</div>
                      <div style={{ 'font-size': '10px', color: 'var(--text-muted)', 'font-family': '"JetBrains Mono", monospace' }}>{link.url}</div>
                    </div>
                  </div>
                  <span style={{ 'font-size': '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>打开 →</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </>
  )
}

// ── 共享样式 ──

const thStyle: Record<string, string> = {
  'text-align': 'left', padding: '10px 12px', 'font-size': '10px', color: 'var(--text-muted)',
  'text-transform': 'uppercase', 'letter-spacing': '1px', 'border-bottom': '1px solid rgba(255,255,255,0.06)',
  'font-weight': '500',
}

const tdStyle: Record<string, string> = {
  padding: '12px', 'border-bottom': '1px solid rgba(255,255,255,0.03)',
  'vertical-align': 'middle', color: 'var(--text-secondary)',
}

const inputStyle: Record<string, string> = {
  flex: '1', background: 'rgba(0,0,0,0.40)', border: '1px solid rgba(255,255,255,0.06)',
  'border-radius': '4px', padding: '8px 12px', color: 'var(--text-primary)', 'font-size': '13px',
  'font-family': '"JetBrains Mono", monospace', outline: 'none',
}

// ── 主组件 ──

export default function SettingsLayoutView() {
  const [page, setPage] = createSignal<SettingsPage>('model')

  return (
    <div class="glass-panel-full" style={{ display: 'flex' }}>
      <div class="bracket-tr"><div class="bracket-h" /><div class="bracket-v" /></div>

      {/* 左侧导航 */}
      <div style={{
        width: '260px', 'flex-shrink': '0', display: 'flex', 'flex-direction': 'column',
        'border-right': '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          padding: '16px 20px', 'font-family': '"Noto Serif SC", serif',
          'font-size': '15px', 'font-weight': '600',
          'border-bottom': '1px solid rgba(255,255,255,0.03)',
        }}>設定</div>
        <div style={{ flex: '1', 'overflow-y': 'auto', padding: '8px 0' }}>
          <For each={NAV_ITEMS}>
            {(item) => (
              <div {...kbd(() => setPage(item.id))} onClick={() => setPage(item.id)} style={{
                display: 'flex', 'align-items': 'center', gap: '10px', padding: '10px 16px',
                cursor: 'pointer', transition: 'all 0.15s',
                'border-left': page() === item.id ? '2px solid var(--accent)' : '2px solid transparent',
                background: page() === item.id ? 'rgba(107,143,168,0.06)' : 'transparent',
              }}>
                <span style={{ 'font-size': '14px', width: '20px', 'text-align': 'center', display: 'flex', 'align-items': 'center', 'justify-content': 'center' }}>{item.icon()}</span>
                <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1px' }}>
                  <div style={{ 'font-size': '13px' }}>{item.label}</div>
                  <div style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>{item.desc}</div>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* 右侧内容 */}
      <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', 'min-width': '0' }}>
        <div style={{
          display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
          padding: '16px 24px', height: '60px', background: 'var(--panel-bg-top)',
          'border-bottom': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0',
        }}>
          <div style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '16px', 'font-weight': '600' }}>
            {NAV_ITEMS.find((n) => n.id === page())?.label ?? '设置'}
          </div>
          <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>
            設定 &gt; {NAV_ITEMS.find((n) => n.id === page())?.label ?? ''}
          </div>
        </div>
        <div style={{ flex: '1', 'overflow-y': 'auto', padding: '20px 24px' }}>
          <Show when={page() === 'model'}><ModelPage /></Show>
          <Show when={page() === 'display'}><DisplayPage /></Show>
          <Show when={page() === 'skills'}><SkillsPage /></Show>
          <Show when={page() === 'workdir'}><WorkdirPage /></Show>
          <Show when={page() === 'system'}><SystemPage /></Show>
        </div>
      </div>
    </div>
  )
}
