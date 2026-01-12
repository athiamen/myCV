const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', 'src', 'data', 'cv.ttl')
const txt = fs.readFileSync(file, 'utf8')

const idx = txt.indexOf('schema:itemListElement')
if (idx === -1) {
  console.error('itemListElement block not found')
  process.exit(1)
}
const parenStart = txt.indexOf('(', idx)
if (parenStart === -1) {
  console.error('Opening ( not found after itemListElement')
  process.exit(1)
}
// find matching closing parenthesis
let depth = 0
let i = parenStart
for (; i < txt.length; i++) {
  const ch = txt[i]
  if (ch === '(') depth++
  else if (ch === ')') {
    depth--
    if (depth === 0) break
  }
}
if (i >= txt.length) {
  console.error('Matching closing parenthesis not found')
  process.exit(1)
}
const inner = txt.slice(parenStart + 1, i).trim()
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
