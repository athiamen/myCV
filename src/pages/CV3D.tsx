import { useEffect, useRef, useState } from 'react'
import ForceGraph3D from '3d-force-graph'
import cvTtl from '../data/cv.ttl?raw'
type Node = { id: string; name?: string; group?: string }
type Link = { source: string; target: string; predicate?: string }

function parseTtl(ttl: string) {
  const cleaned = ttl.replace(/#.*$/gm, '')
  const blocks = cleaned.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean)
  const triplesBySubject: Record<string, Array<{ predicate: string; objects: string[] }>> = {}

  for (const block of blocks) {
    const tb = block.trim()
    // Ignorer les directives Turtle (ex: @prefix, PREFIX) qui ne sont pas des triples
    if (tb.startsWith('@') || /^@prefix\b/i.test(tb) || /^PREFIX\b/i.test(tb)) continue

    const m = block.match(/^([^\s]+)\s+(.*)$/s)
    if (!m) continue
    const subject = m[1]
    const rest = m[2]
    
    const splitTopLevel = (s: string, sep: string) => {
      const parts: string[] = []
      let buf = ''
      let inQuote = false
      let quoteChar = ''
      let depthParen = 0
      let depthBracket = 0
      let depthBrace = 0
      for (let i = 0; i < s.length; i++) {
        const ch = s[i]
        if ((ch === '"' || ch === "'") && s[i-1] !== '\\') {
          if (!inQuote) { inQuote = true; quoteChar = ch }
          else if (quoteChar === ch) { inQuote = false; quoteChar = '' }
        }
        if (!inQuote) {
          if (ch === '(') depthParen++
          else if (ch === ')') depthParen = Math.max(0, depthParen-1)
          else if (ch === '[') depthBracket++
          else if (ch === ']') depthBracket = Math.max(0, depthBracket-1)
          else if (ch === '{') depthBrace++
          else if (ch === '}') depthBrace = Math.max(0, depthBrace-1)
        }
        if (ch === sep && !inQuote && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
          parts.push(buf)
          buf = ''
        } else {
          buf += ch
        }
      }
      if (buf.trim()) parts.push(buf)
      return parts.map(p => p.trim()).filter(Boolean)
    }

    const parts = splitTopLevel(rest, ';')
    triplesBySubject[subject] = []
    for (let part of parts) {
      part = part.replace(/\.$/, '').trim()
      const pMatch = part.match(/^([^\s]+)\s+(.*)$/s)
      if (!pMatch) continue
      const predicate = pMatch[1]
      let objectsRaw = pMatch[2].trim()
      const objects: string[] = []

      if (objectsRaw.startsWith('(')) {
        const inner = objectsRaw.replace(/^\(|\)$/g, '').trim()
        const tokenRe = /\"(?:[^\"\\]|\\.)*\"(?:@[a-zA-Z\-]+)?|'(?:[^'\\]|\\.)*'|[^\s]+/gs
        let mTok: RegExpExecArray | null
        while ((mTok = tokenRe.exec(inner)) !== null) {
          objects.push(mTok[0].trim())
        }
      } else {
        const partsObj = splitTopLevel(objectsRaw, ',')
        for (let o of partsObj) objects.push(o.trim())
      }

      triplesBySubject[subject].push({ predicate, objects })
    }
  }

  const nodesMap = new Map<string, Node>()
  const links: Link[] = []
  const blankNodeMap = new Map<string, string>()

  const addNode = (id: string, name?: string, group?: string) => {
    if (!nodesMap.has(id)) nodesMap.set(id, { id, name, group })
    else {
      const node = nodesMap.get(id)!
      if (name) node.name = node.name || name
      if (group) node.group = node.group || group
    }
  }

  const triplesFlat: Array<{ s: string; p: string; o: string }> = []
  for (const [s, triples] of Object.entries(triplesBySubject)) {
    for (const t of triples) {
      for (const o of t.objects) {
        triplesFlat.push({ s, p: t.predicate, o })
      }
    }
  }

  for (const { s, p, o } of triplesFlat) {
    addNode(s, undefined, 'entity')
    if (p.includes('schema:name') && o.startsWith('"')) {
      const lit = o.match(/^"([^\"]+)"/s)
      if (lit) addNode(s, lit[1], 'entity')
    }
  }

  let blankNodeCounter = 0
  for (const { s, p, o } of triplesFlat) {
    if (o.startsWith('[')) {
      const bnId = `_:bn${blankNodeCounter++}`
      blankNodeMap.set(o, bnId)
      
      const nameMatch = o.match(/schema:name\s+"([^\"]+)"/s)
      const name = nameMatch ? nameMatch[1] : undefined
      addNode(bnId, name, 'blank')
      links.push({ source: s, target: bnId, predicate: p })

      const innerTriples = o.slice(1, -1).trim()
      const innerParts = innerTriples.split(';').map(x => x.trim()).filter(Boolean)
      for (const innerPart of innerParts) {
        const iPMatch = innerPart.match(/^([^\s]+)\s+(.*)$/s)
        if (!iPMatch) continue
        const iPred = iPMatch[1]
        const iObj = iPMatch[2].trim()
        
        if (iObj.startsWith('"')) {
          const lit = iObj.match(/^"([^\"]+)"/s)
          if (lit && lit[1]) {
            const litId = `_:lit${blankNodeCounter++}`
            addNode(litId, lit[1], 'literal')
            links.push({ source: bnId, target: litId, predicate: iPred })
          }
        } else {
          addNode(iObj, undefined, 'entity')
          links.push({ source: bnId, target: iObj, predicate: iPred })
        }
      }
    } else if (o.startsWith('"')) {
      const lit = o.match(/^"([^\"]+)"/s)
      if (lit && lit[1]) {
        const litId = `_:lit${blankNodeCounter++}`
        addNode(litId, lit[1], 'literal')
        links.push({ source: s, target: litId, predicate: p })
      }
    } else if (o.startsWith('(')) {
      const listId = `_:list${blankNodeCounter++}`
      addNode(listId, 'List', 'collection')
      links.push({ source: s, target: listId, predicate: p })

      const inner = o.slice(1, -1).trim()
      const tokenRe = /\"(?:[^\"\\]|\\.)*\"(?:@[a-zA-Z\-]+)?|'(?:[^'\\]|\\.)*'|[^\s]+/gs
      let mTok: RegExpExecArray | null
      let itemIndex = 0
      while ((mTok = tokenRe.exec(inner)) !== null) {
        const item = mTok[0].trim()
        if (item.startsWith('"')) {
          const lit = item.match(/^"([^\"]+)"/s)
          if (lit && lit[1]) {
            const litId = `_:lit${blankNodeCounter++}`
            addNode(litId, lit[1], 'literal')
            links.push({ source: listId, target: litId, predicate: `item${itemIndex++}` })
          }
        } else {
          addNode(item, undefined, 'entity')
          links.push({ source: listId, target: item, predicate: `item${itemIndex++}` })
        }
      }
    } else {
      addNode(o, undefined, 'entity')
      links.push({ source: s, target: o, predicate: p })
    }
  }

  for (const node of nodesMap.values()) {
    if (!node.name) {
      const id = node.id
      if (id.startsWith('_:')) {
        node.name = 'blank'
      } else {
        const m = id.match(/[:#\/]?([^:\/\#]+)$/)
        node.name = m ? m[1] : id
      }
    }
  }

  return { nodes: Array.from(nodesMap.values()), links }
}

export default function CV3D() {
  const ref = useRef<HTMLDivElement | null>(null)
  const fgRef = useRef<any>(null)
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] } | null>(null)

  useEffect(() => {
    const parsed = parseTtl(cvTtl)
    setGraphData(parsed)
  }, [])

  useEffect(() => {
    if (!ref.current || !graphData) return
    
    const Graph = (ForceGraph3D as any)()(ref.current)
      .graphData(graphData as any)
      // set 3D scene background to white so the force-graph canvas is light
      .backgroundColor('#ffffff')
      .nodeLabel((node: any) => `${node.name || node.id}`)
      .nodeColor((node: any) => {
        if (node.group === 'entity') return 'gray'
        if (node.group === 'literal') return '#10b981'
        if (node.group === 'blank') return 'gray.4'
        if (node.group === 'collection') return '#8b5cf6'
        return '#6b7280'
      })
      .nodeVal((node: any) => {
        if (node.group === 'entity') return 8
        if (node.group === 'collection') return 6
        return 4
      })
      .linkColor(() => 'rgba(160, 7, 7, 1)')
      .linkDirectionalParticles(1)
      .linkDirectionalParticleWidth(1)
      .linkLabel((link: any) => link.predicate || '')
      .linkWidth(1)
      .onNodeClick((node: any) => {
        const distance = 40
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)
        Graph.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
          { x: node.x, y: node.y, z: node.z },
          3000
        )
      })
      .onLinkClick((link: any) => {
        const node = link.target || link.source
        if (!node) return
        const distance = 40
        const nx = node.x ?? 0
        const ny = node.y ?? 0
        const nz = node.z ?? 0
        const distRatio = 1 + distance / Math.hypot(nx, ny, nz)
        Graph.cameraPosition(
          { x: nx * distRatio, y: ny * distRatio, z: nz * distRatio },
          { x: nx, y: ny, z: nz },
          1500
        )
      })

    fgRef.current = Graph

    return () => {
      if (fgRef.current && fgRef.current._destructor) fgRef.current._destructor()
    }
  }, [graphData])

  return (
      <div className="flex-1" ref={ref} />
  )
}