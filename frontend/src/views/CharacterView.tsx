import type { JSX } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import { accentRgb } from '@/shell/theme'
import { BookOpen, Pencil, Search, Terminal, Globe, FileText, ClipboardList, Palette } from 'lucide-solid'

function kbd(fn: () => void) { return { tabIndex: 0, role: 'button' as const, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() } } } }

function ToggleRow(props: { label: string; desc: string; initialOn: boolean }) {
  const [on, setOn] = createSignal(props.initialOn)
  return (
    <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '12px 16px', background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.04)', 'border-radius': '6px' }}>
      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
        <div style={{ 'font-size': '13px', color: 'var(--text-primary)' }}>{props.label}</div>
        <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>{props.desc}</div>
      </div>
      <div {...kbd(() => setOn(!on()))} onClick={() => setOn(!on())} style={{ width: '36px', height: '20px', 'border-radius': '10px', cursor: 'pointer', background: on() ? `rgba(${accentRgb()},0.40)` : 'rgba(255,255,255,0.10)', border: 'none', position: 'relative', transition: 'background 0.2s' }}>
        <div style={{ position: 'absolute', top: '2px', left: '2px', width: '16px', height: '16px', 'border-radius': '50%', background: 'white', transition: 'transform 0.2s', transform: on() ? 'translateX(16px)' : 'translateX(0)' }} />
      </div>
    </div>
  )
}

interface AgentDef {
  id: string; avatar: string; name: string; role: string
  model: string; avatarPath: string; memDir: string
  prompt: string; examples: string; prohibitions: string
}

const agents: AgentDef[] = [
  {
    id: 'opus', avatar: 'C', name: 'Claude Opus 4.6', role: '技術顧問 · 戦術支援',
    model: 'Claude Opus 4.6', avatarPath: './avatars/claude-opus.png', memDir: './mio-harness/memories/',
    prompt: '你是澪号，一个高度智能的AI助手。擅长技术问题解决、代码审查、架构设计，以简洁专业的中文回复用户。',
    examples: '用户：帮我找一下这个代码的bug\n澪号：好的，让我检查一下代码。定位问题所在。\n\n用户：我想加一个新功能\n澪号：请详细描述一下你需要什么功能？',
    prohibitions: '• 不在日志中输出敏感信息（API密钥、密码等）\n• 未经用户许可不向外网URL发送请求\n• 不使用歧视性或攻击性语言\n• 不提供医疗、法律、金融领域的专业建议',
  },
  { id: 'sonnet', avatar: 'C', name: 'Claude Sonnet 4.6', role: '编程助手 · 日常编码', model: 'Claude Sonnet 4.6', avatarPath: './avatars/claude-sonnet.png', memDir: './mio-harness/memories/', prompt: '', examples: '', prohibitions: '' },
  { id: 'deepseek', avatar: 'D', name: 'DeepSeek V4', role: '算法专家 · 深度推理', model: 'DeepSeek V4 Pro', avatarPath: './avatars/deepseek.png', memDir: './mio-harness/memories/', prompt: '', examples: '', prohibitions: '' },
  { id: 'gpt4o', avatar: 'G', name: 'GPT-4o', role: '多模态处理 · 创意辅助', model: 'GPT-4o', avatarPath: './avatars/gpt4o.png', memDir: './mio-harness/memories/', prompt: '', examples: '', prohibitions: '' },
  { id: 'gemini', avatar: 'G', name: 'Gemini 2.5', role: '长上下文 · 代码审查', model: 'Gemini 2.5 Pro', avatarPath: './avatars/gemini.png', memDir: './mio-harness/memories/', prompt: '', examples: '', prohibitions: '' },
]

const tools: { icon: () => JSX.Element; name: string; status: string; desc: string }[] = [
  { icon: () => <BookOpen size={13} />, name: '读取文件', status: '已启用', desc: '读取项目文件内容' },
  { icon: () => <Pencil size={13} />, name: '写入文件', status: '已启用', desc: '修改项目文件' },
  { icon: () => <Search size={13} />, name: '代码搜索', status: '已启用', desc: '搜索代码片段' },
  { icon: () => <Terminal size={13} />, name: '执行命令', status: '已启用', desc: '运行终端命令' },
  { icon: () => <Globe size={13} />, name: '网络搜索', status: '已启用', desc: '搜索互联网信息' },
  { icon: () => <FileText size={13} />, name: '添加记忆', status: '已启用', desc: '写入长期记忆' },
  { icon: () => <ClipboardList size={13} />, name: '搜索记忆', status: '已启用', desc: '检索历史记忆' },
  { icon: () => <Palette size={13} />, name: '生成图像', status: '已启用', desc: '调用图像生成' },
]

const inputBase: Record<string, string> = { background: 'rgba(0,0,0,0.40)', border: '1px solid rgba(255,255,255,0.06)', 'border-radius': '4px', padding: '10px 14px', color: 'var(--text-primary)', 'font-size': '13px', 'font-family': 'inherit', outline: 'none' }
const labelStyle: Record<string, string> = { 'font-size': '12px', color: 'var(--text-muted)', 'font-weight': '500' }

export default function CharacterView() {
  const [activeId, setActiveId] = createSignal(agents[0].id)
  const active = () => agents.find((a) => a.id === activeId())!

  return (
    <div class="glass-panel-full" style={{ display: 'flex' }}>
      <div class="bracket-tr"><div class="bracket-h" /><div class="bracket-v" /></div>

      {/* Agent List */}
      <div style={{ width: '340px', 'flex-shrink': '0', display: 'flex', 'flex-direction': 'column', 'border-right': '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', 'align-items': 'center', padding: '12px 16px', height: '54px', 'font-family': '"Noto Serif SC", serif', 'font-size': '15px', 'font-weight': '600', background: 'rgb(var(--top-bar-tint-rgb))', 'border-bottom': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0' }}>角色管理</div>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', padding: '8px 16px', height: '40px', 'border-bottom': '1px solid rgba(255,255,255,0.03)' }}>
          <div style={{ display: 'flex', 'align-items': 'center', gap: '6px', 'font-size': '13px', color: 'var(--text-muted)' }}><Search size={14} /> 搜索角色名...</div>
        </div>
        <div style={{ flex: '1', 'overflow-y': 'auto' }}>
          <For each={agents}>{(a) => (
            <div {...kbd(() => setActiveId(a.id))} onClick={() => setActiveId(a.id)} style={{ display: 'flex', 'align-items': 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', 'border-left': activeId() === a.id ? '3px solid var(--accent)' : '3px solid transparent', background: activeId() === a.id ? 'rgba(255,255,255,0.03)' : 'transparent', transition: 'background 0.12s' }}>
              <div style={{ width: '36px', height: '36px', 'border-radius': '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-family': '"JetBrains Mono", monospace', 'font-size': '14px', 'font-weight': 'bold', color: 'var(--text-primary)', 'flex-shrink': '0' }}>{a.avatar}</div>
              <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
                <div style={{ 'font-size': '13px', 'font-weight': '500', color: 'var(--text-primary)' }}>{a.name}</div>
                <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>{a.role}</div>
              </div>
            </div>
          )}</For>
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', 'min-width': '0' }}>
        <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '12px 16px', height: '54px', background: 'rgb(var(--top-bar-tint-rgb))', 'border-bottom': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0' }}>
          <div style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '16px', 'font-weight': '600' }}>{active().name} — 设置</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ padding: '6px 14px', 'border-radius': '4px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)', 'font-size': '12px', cursor: 'pointer', 'font-family': 'inherit' }}>重置</button>
            <button style={{ padding: '6px 14px', 'border-radius': '4px', background: `rgba(${accentRgb()},0.15)`, border: `1px solid rgba(${accentRgb()},0.20)`, color: 'var(--accent)', 'font-size': '12px', cursor: 'pointer', 'font-family': 'inherit' }}>保存</button>
          </div>
        </div>

        <div style={{ flex: '1', 'overflow-y': 'auto', padding: '24px 32px', display: 'flex', 'flex-direction': 'column', gap: '24px' }}>
          {/* Name */}
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
            <div style={labelStyle}>角色名字</div>
            <input value={active().name} style={{ ...inputBase, width: '100%' }} />
          </div>
          {/* Avatar */}
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
            <div style={labelStyle}>头像图片</div>
            <input value={active().avatarPath} style={{ ...inputBase, width: '100%' }} />
          </div>
          {/* Prompt */}
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
            <div style={labelStyle}>提示词</div>
            <textarea rows={4} value={active().prompt} style={{ ...inputBase, resize: 'vertical', 'line-height': '1.6', width: '100%', 'min-height': '80px' }} placeholder="提示词内容..." />
            <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>系统级提示词，定义角色的基础行为和人格</div>
          </div>
          {/* Examples */}
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
            <div style={labelStyle}>对话示例</div>
            <textarea rows={5} value={active().examples} style={{ ...inputBase, resize: 'vertical', 'line-height': '1.6', width: '100%', 'min-height': '100px' }} placeholder="对话示例..." />
          </div>
          {/* Prohibitions */}
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
            <div style={labelStyle}>禁止事项</div>
            <textarea rows={4} value={active().prohibitions} style={{ ...inputBase, resize: 'vertical', 'line-height': '1.6', width: '100%', 'min-height': '80px' }} placeholder="每行一项..." />
          </div>
          {/* Two cols */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
              <div style={labelStyle}>使用模型</div>
              <input value={active().model} style={{ ...inputBase, width: '100%' }} />
            </div>
            <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
              <div style={labelStyle}>记忆目录</div>
              <input value={active().memDir} style={{ ...inputBase, width: '100%', 'font-family': '"JetBrains Mono", monospace' }} />
            </div>
          </div>
          {/* Toggles */}
          <ToggleRow label="共享记忆" desc="与其他角色共享上下文记忆" initialOn />
          <ToggleRow label="使用全局记忆" desc="接入系统级记忆存储" initialOn={false} />
          {/* Tool Grid */}
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
            <div style={labelStyle}>工具配置</div>
            <div style={{ display: 'grid', 'grid-template-columns': 'repeat(3, 1fr)', gap: '10px' }}>
              <For each={tools}>{(tool) => (
                <div style={{ padding: '12px', background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.04)', 'border-radius': '6px', display: 'flex', 'flex-direction': 'column', gap: '6px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between' }}>
                    <span style={{ 'font-size': '12px', 'font-weight': '500', display: 'flex', 'align-items': 'center', gap: '5px' }}>{tool.icon()} {tool.name}</span>
                    <span style={{ 'font-size': '10px', padding: '2px 6px', 'border-radius': '3px', background: 'rgba(91,140,90,0.10)', color: 'var(--success)' }}>{tool.status}</span>
                  </div>
                  <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>{tool.desc}</div>
                </div>
              )}</For>
            </div>
          </div>
          {/* MCP */}
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
            <div style={labelStyle}>MCP 配置</div>
            <ToggleRow label="Pencil 设计工具" desc="UI/UX 设计协作" initialOn />
          </div>
        </div>
      </div>
    </div>
  )
}
