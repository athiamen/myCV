const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', 'src', 'data', 'cv.ttl')
const txt = fs.readFileSync(file, 'utf8')

const m = txt.match(/schema:itemListElement\s*\(([^)]+)\)/s)
if (!m) {
  console.error('itemListElement block not found')
  process.exit(1)
}
const inner = m[1].trim()
console.log('inner block:')
console.log(inner)

const tokenRe = /"(?:[^"\\]|\\.)*"(?:@[a-zA-Z\-]+)?|'(?:[^'\\]|\\.)*'|[^\s]+/gs
let match
const tokens = []
while ((match = tokenRe.exec(inner)) !== null) {
  tokens.push(match[0].trim())
}
console.log('\nExtracted tokens:')
for (const t of tokens) console.log('-', t)

console.log('\nTotal tokens:', tokens.length)
