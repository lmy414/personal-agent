import { execSync } from 'node:child_process'

const vendorPattern = /vendor[/\\]pi[/\\]/

let output = ''
try {
  output = execSync('npx tsc --noEmit 2>&1', {
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 10 * 1024 * 1024,
  })
} catch (err) {
  output = err.stdout || err.stderr || ''
  if (typeof output !== 'string') output = output.toString()
}

process.stdout.write(output)

const realErrors = output
  .split('\n')
  .filter((l) => l.includes('error TS') && !vendorPattern.test(l))

if (realErrors.length > 0) {
  process.exit(1)
}
