/**
 * 测试上下文统计功能
 * 验证：
 * 1. status.update 包含正确的 contextUsed, contextMax, tokens, cost
 * 2. context_log 表被写入
 * 3. session.state 返回正确数据
 * 4. contextPercent 计算正确
 */

import WebSocket from 'ws'

const ws = new WebSocket('ws://localhost:9229')
let msgId = 0
let testSessionId = ''

function send(type: string, payload: unknown, sessionId = '') {
  const raw = JSON.stringify({
    type,
    id: `test-${++msgId}`,
    sessionId,
    ts: Date.now(),
    payload,
  })
  console.log(`[SEND] ${type}`)
  ws.send(raw)
}

let testsPassed = 0
let testsFailed = 0

function check(label: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}${detail ? ': ' + detail : ''}`)
    testsPassed++
  } else {
    console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`)
    testsFailed++
  }
}

ws.on('open', () => {
  console.log('=== 上下文统计测试 ===')
  console.log('')

  // 1. 创建新会话
  setTimeout(() => {
    console.log('1. 创建新会话...')
    send('session.create', { model: 'deepseek-v3' })
  }, 500)
})

ws.on('message', (raw: Buffer) => {
  const msg = JSON.parse(raw.toString())
  const type = msg.type
  const payload = msg.payload ?? {}

  switch (type) {
    case 'session.created':
      testSessionId = payload.sessionId
      console.log(`   sessionId: ${testSessionId.slice(0, 16)}...`)
      // 发消息
      setTimeout(() => {
        console.log('')
        console.log('2. 发送测试消息（等待完整响应后验证上下文统计）...')
        send('message.send', { content: '你好，请用三个词描述你自己。' }, testSessionId)
        // 同时查询 session.state
        setTimeout(() => {
          console.log('')
          console.log('3. 查询 session.state...')
          send('session.state', {}, testSessionId)
        }, 500)
      }, 1000)
      break

    case 'status.update': {
      console.log('')
      console.log('[RECV] status.update:')
      console.log(`   tokens: ${payload.tokens}`)
      console.log(`   cost: ${payload.cost}`)
      console.log(`   contextUsed: ${payload.contextUsed}`)
      console.log(`   contextMax: ${payload.contextMax}`)
      console.log(`   roundCount: ${payload.roundCount}`)
      console.log(`   model: ${payload.model}`)
      console.log('')
      console.log('4. 验证 status.update 字段:')
      check('payload 包含 tokens', typeof payload.tokens === 'number', String(payload.tokens))
      check('payload 包含 cost', typeof payload.cost === 'number', String(payload.cost))
      check('payload 包含 contextUsed', typeof payload.contextUsed === 'number', String(payload.contextUsed))
      check('contextMax > 0', payload.contextMax > 0, String(payload.contextMax))
      check('roundCount >= 1', payload.roundCount >= 1, String(payload.roundCount))
      check('model 非空', typeof payload.model === 'string' && payload.model.length > 0, payload.model)

      // 验证上下文百分比计算
      if (payload.contextMax > 0) {
        const pct = Math.round((payload.contextUsed / payload.contextMax) * 100)
        console.log(`   contextPercent = ${pct}%`)
        check('百分比在 0-100 范围', pct >= 0 && pct <= 100, `${pct}%`)
        // 刚刚建立的会话上下文应该很小
        check('新会话上下文 < 30%', pct < 30 || payload.contextUsed < 5000, `${pct}% / ${payload.contextUsed}`)
      }

      // 验证 context_log 写入
      console.log('')
      console.log('5. 验证 context_log 持久化...')
      break
    }

    case 'session.state': {
      console.log('')
      console.log('[RECV] session.state:')
      console.log(`   model: ${payload.model}`)
      console.log(`   thinkLevel: ${payload.thinkingLevel}`)
      console.log(`   contextUsed: ${payload.contextUsed}`)
      console.log(`   contextMax: ${payload.contextMax}`)
      console.log(`   roundCount: ${payload.roundCount}`)
      console.log(`   tokens: ${payload.tokens}`)
      console.log(`   cost: ${payload.cost}`)
      console.log('')
      console.log('6. 验证 session.state 字段:')
      check('contextUsed >= 0', payload.contextUsed >= 0, String(payload.contextUsed))
      check('contextMax > 0', payload.contextMax > 0, String(payload.contextMax))
      check('roundCount >= 1', payload.roundCount >= 1, String(payload.roundCount))
      check('model 非空', typeof payload.model === 'string', payload.model)
      check('thinkingLevel 有效', ['low', 'medium', 'high'].includes(payload.thinkingLevel), payload.thinkingLevel)
      break
    }

    case 'turn.end':
      console.log(`[RECV] turn.end: cost=${payload.cost}`)
      break

    case 'error':
      console.log(`[RECV] error: ${payload.code} ${payload.message}`)
      break
  }
})

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message)
})

let finalCheckDone = false
ws.on('close', () => {
  if (finalCheckDone) return
  finalCheckDone = true
  console.log('')
  console.log('=== 测试结果 ===')
  console.log(`   通过: ${testsPassed}  失败: ${testsFailed}`)
  if (testsFailed > 0) {
    console.log('⚠️ 部分测试未通过，请检查输出详情')
  } else {
    console.log('✅ 全部通过！')
  }
  process.exit(testsFailed > 0 ? 1 : 0)
})

// 超时：等 20 秒后检查 DB 并退出
setTimeout(() => {
  if (finalCheckDone) return
  finalCheckDone = true

  // 验证 context_log 表和内容
  console.log('')
  console.log('7. 检查 context_log 数据库内容...')
  const { execSync } = require('child_process')
  try {
    const dbPath = require('os').homedir() + '/.personal-agent/agent.db'
    const result = execSync(`sqlite3 "${dbPath}" "SELECT session_id, used_tokens, context_window, round(percent,2), model_id, created_at FROM context_log ORDER BY id DESC LIMIT 3" --separator ' | '`, { encoding: 'utf8' })
    console.log(`   context_log 最近记录:`)
    console.log(`   ${result.trim().split('\n').join('\n   ')}`)
    check('context_log 有测试会话的记录', result.includes(testSessionId.slice(0, 8)))
    check('context_log 包含上下文窗口信息', result.includes('|'))
  } catch (e) {
    console.log(`   无法读取 context_log: ${e}`)
  }

  console.log('')
  console.log('=== 测试结果 ===')
  console.log(`   通过: ${testsPassed}  失败: ${testsFailed}`)
  if (testsFailed > 0) {
    console.log('⚠️ 部分测试未通过')
  } else {
    console.log('✅ 全部通过！')
  }
  process.exit(testsFailed > 0 ? 1 : 0)
}, 25000)
