/**
 * File Handler 安全边界测试 —— 验证 resolveSafe 路径解析与逃逸防护
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { resolveSafe } from '../bridge/handlers/file.ts'

describe('File Security — resolveSafe', () => {
  it('相对路径基于 PROJECT_ROOT 解析', () => {
    const r = resolveSafe('bridge/protocol.ts')
    assert.ok(r.includes('protocol.ts'), `应解析到 protocol.ts, 实际: ${r}`)
  })

  it('绝对路径存在时直接放行', () => {
    const r = resolveSafe(process.cwd() + '/package.json')
    assert.ok(r.includes('package.json'))
  })

  it('".." 路径逃逸被阻止', () => {
    assert.throws(() => resolveSafe('../package.json'), /out of bounds/)
  })

  it('嵌套 ".." 路径逃逸被阻止', () => {
    assert.throws(() => resolveSafe('foo/../../package.json'), /out of bounds/)
  })

  it('"." 解析为 PROJECT_ROOT', () => {
    const r = resolveSafe('.')
    assert.ok(r.length > 0)
  })

  it('不存在的绝对路径抛出错误', () => {
    assert.throws(() => resolveSafe('C:/nonexistent/path/file.txt'), /not found/i)
  })
})
