/**
 * 意图分类测试 —— 验证 18 条正则规则正确路由 chat/agent
 *
 * 从 pa-mio/index.ts 中提取的 AGENT_PATTERNS 逻辑。
 * 独立测试，不依赖 Pi SDK。
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'

// ── 从 pa-mio 照搬的分类逻辑（不 import，避免 Pi 依赖）─────────

const AGENT_PATTERNS: RegExp[] = [
  // 文件操作
  /(?:打开|查看|读取|帮我看看|看下)(?:一下)?(?:这个)?(?:文件|代码|目录|项目)/,
  /(?:修改|编辑|改|重写|重构)(?:一下)?(?:这个)?(?:文件|代码|脚本|函数|类|模块)/,
  /(?:创建|新建|写|生成|帮我写|帮我生成)(?:一个|个)?(?:文件|脚本|代码|函数|类|模块|测试|程序)/,
  /(?:删除|移除|重命名|移动)(?:这个)?(?:文件|目录|文件夹)/,
  // 搜索和信息检索
  /(?:搜索|查找|找一下|帮我搜|帮我查|帮我找)(?:一下)?(?:这个)?(?:文件|代码|项目|仓库|目录|记忆|bug|错误)/,
  /(?:检查|看看|查一下|查下)(?:这个)?(?:代码|文件|项目|仓库|错误|bug)/,
  /(?:分析|审查|review)(?:一下)?(?:这个)?(?:代码|文件|项目|架构)/,
  // 命令执行
  /(?:运行|执行|跑一下)(?:这个)?(?:脚本|命令|测试|程序)/,
  /(?:npm|pnpm|yarn|git|docker|tsx|node)\s/,
  /(?:提交|commit|推送|push|合并|merge|回滚|revert)\s/,
  /(?:启动|重启|停止|关闭)(?:服务|服务器|进程)/,
  // 记忆操作
  /(?:记住|记下来|保存|存一下)(?:这个|这些)?/,
  /(?:之前|上次|以前|还记得|回忆)(?:那个|这个|我说的|我们讨论的)/,
  /(?:查|搜|搜索)(?:一下)?(?:我的)?记忆/,
  // 任务型关键词
  /(?:帮我)(?:写|改|查|搜|调试|编译|构建|部署|推送|提交)/,
  /(?:怎么|如何)(?:修|改|写|编译|调试|配置|部署)/,
  /^(?:fix|feat|refactor|chore|docs|style|test)\b/,
]

function classifyIntent(userMessage: string): 'chat' | 'agent' {
  const cleaned = userMessage.trim()
  if (!cleaned) return 'chat'
  for (const pattern of AGENT_PATTERNS) {
    if (pattern.test(cleaned)) return 'agent'
  }
  return 'chat'
}

// ── 测试 ──────────────────────────────────────────────────

describe('意图分类 — chat 模式（闲聊）', () => {
  const chatMessages = [
    '你好',
    '今天天气不错',
    '哈哈你说的对',
    '嗯嗯知道了',
    '晚安',
    '谢谢你',
    '最近怎么样',
    '有什么好玩的吗',
    '推荐个电影',
    'hhh',
    '摸摸',
    '草了 这也太搞笑了',
    '我在想吃什么好呢',
    '有点困了',
    '这个想法真有意思',
    '你叫什么名字',
    '说个好听的',
    '好累啊今天',
  ]

  for (const msg of chatMessages) {
    it(`"${msg}" → chat`, () => {
      assert.strictEqual(classifyIntent(msg), 'chat')
    })
  }
})

describe('意图分类 — agent 模式（文件操作）', () => {
  const agentMessages = [
    { msg: '帮我看看这个文件', desc: '查看文件' },
    { msg: '读取一下这个文件', desc: '读取文件' },
    { msg: '修改这个文件', desc: '修改文件' },
    { msg: '重写这个模块', desc: '重写模块' },
    { msg: '创建一个文件', desc: '创建文件' },
    { msg: '帮我写个脚本', desc: '写脚本' },
    { msg: '删除这个目录', desc: '删除目录' },
    { msg: '重构一下这个模块', desc: '重构模块' },
    { msg: '重命名这个文件夹', desc: '重命名' },
  ]

  for (const { msg, desc } of agentMessages) {
    it(`"${msg}" (${desc}) → agent`, () => {
      assert.strictEqual(classifyIntent(msg), 'agent')
    })
  }
})

describe('意图分类 — agent 模式（搜索/检索）', () => {
  const agentMessages = [
    { msg: '搜索一下这个项目', desc: '搜索' },
    { msg: '帮我找一下代码', desc: '帮我找' },
    { msg: '查找文件', desc: '查找' },
    { msg: '查一下代码看看有什么问题', desc: '检查代码' },
    { msg: '分析一下这个项目的架构', desc: '分析架构' },
    { msg: 'review这个文件', desc: 'review' },
  ]

  for (const { msg, desc } of agentMessages) {
    it(`"${msg}" (${desc}) → agent`, () => {
      assert.strictEqual(classifyIntent(msg), 'agent')
    })
  }
})

describe('意图分类 — agent 模式（命令执行）', () => {
  const agentMessages = [
    { msg: '运行 npm install', desc: 'npm' },
    { msg: 'git status', desc: 'git' },
    { msg: 'docker compose up', desc: 'docker' },
    { msg: '执行这个测试', desc: '执行测试' },
    { msg: 'commit 代码', desc: '提交' },
    { msg: '合并 master', desc: '合并' },
    { msg: '启动服务', desc: '启动' },
    { msg: '停止进程', desc: '停止' },
  ]

  for (const { msg, desc } of agentMessages) {
    it(`"${msg}" (${desc}) → agent`, () => {
      assert.strictEqual(classifyIntent(msg), 'agent')
    })
  }
})

describe('意图分类 — agent 模式（记忆操作）', () => {
  const agentMessages = [
    { msg: '记住这件事', desc: '记住' },
    { msg: '记下来：Mirror 喜欢 TypeScript', desc: '记下来' },
    { msg: '之前我们讨论的那个问题', desc: '之前' },
    { msg: '上次我们讨论的那个问题', desc: '上次' },
    { msg: '查一下我的记忆', desc: '查记忆' },
    { msg: '搜索记忆里的项目偏好', desc: '搜索记忆' },
  ]

  for (const { msg, desc } of agentMessages) {
    it(`"${msg}" (${desc}) → agent`, () => {
      assert.strictEqual(classifyIntent(msg), 'agent')
    })
  }
})

describe('意图分类 — agent 模式（帮我/怎么做）', () => {
  const agentMessages = [
    { msg: '帮我写个函数', desc: '帮我写' },
    { msg: '帮我查个东西', desc: '帮我查' },
    { msg: '帮我调试一下这个 bug', desc: '帮我调试' },
    { msg: '怎么修这个错误', desc: '怎么修' },
    { msg: '如何配置 vite', desc: '如何配置' },
    { msg: 'feat: 添加新功能', desc: 'feat 前缀' },
    { msg: 'fix: 修复登录 bug', desc: 'fix 前缀' },
    { msg: 'refactor: 重构模块', desc: 'refactor 前缀' },
  ]

  for (const { msg, desc } of agentMessages) {
    it(`"${msg}" (${desc}) → agent`, () => {
      assert.strictEqual(classifyIntent(msg), 'agent')
    })
  }
})

describe('意图分类 — 边界情况', () => {
  it('空字符串 → chat', () => {
    assert.strictEqual(classifyIntent(''), 'chat')
  })

  it('纯空格 → chat', () => {
    assert.strictEqual(classifyIntent('   '), 'chat')
  })

  it('包含 "查看" 但不是文件操作', () => {
    // "看看" 不在 agent pattern 中 → chat
    assert.strictEqual(classifyIntent('看看'), 'chat')
  })

  it('修改 作为日常生活用语', () => {
    // "修改" + "文件" 才是 agent。单独 "修改" 不触发
    // Wait: pattern /(?:修改|编辑|改|重写|重构)(?:一下)?(?:这个)?(?:文件|代码|脚本|函数|类|模块)/
    // "修改" must be followed by optional "一下"  then optional "这个" then one of the targets
    // So "修改一下我的心情" does NOT match since "我的心情" is not in the target list
    // But "修改文件" would match
    assert.strictEqual(classifyIntent('我想修改一下发型'), 'chat', '"修改" 无文件目标 → chat')
    assert.strictEqual(classifyIntent('修改文件'), 'agent', '"修改文件" → agent')
  })
})

describe('意图分类 — 攻击/对抗样本', () => {
  it('包含文件操作关键词触发 agent', () => {
    // "查看"+"文件" 触发 agent（设计取舍：宁可多走 agent 路径，不可少走）
    assert.strictEqual(classifyIntent('查看文件管理器里的内容'), 'agent')
  })

  it('假装闲聊但实际请求操作', () => {
    // 包含"帮我查" → agent
    assert.strictEqual(classifyIntent('能不能帮我查一下'), 'agent')
  })

  it('仅"看"不触发 agent（需完整模式匹配）', () => {
    // "看了" 不在模式中（模式只有 "打开|查看|读取|帮我看看|看下"）
    assert.strictEqual(classifyIntent('我刚才看了个电影'), 'chat')
  })
})
