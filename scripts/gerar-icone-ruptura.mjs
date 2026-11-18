// Gera ruptura-192.png e ruptura-512.png (quadrado verde com um "check" branco), sem dependências.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (tipo, dados) => {
  const t = Buffer.from(tipo)
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length)
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, dados])))
  return Buffer.concat([len, t, dados, c])
}
const distSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
function icone(tam) {
  const raw = Buffer.alloc((tam * 3 + 1) * tam)
  const esp = tam * 0.07
  for (let y = 0; y < tam; y++) {
    raw[y * (tam * 3 + 1)] = 0
    for (let x = 0; x < tam; x++) {
      const d = Math.min(
        distSeg(x, y, tam * 0.27, tam * 0.52, tam * 0.44, tam * 0.69),
        distSeg(x, y, tam * 0.44, tam * 0.69, tam * 0.74, tam * 0.33),
      )
      const branco = d < esp
      const o = y * (tam * 3 + 1) + 1 + x * 3
      raw[o] = branco ? 255 : 15
      raw[o + 1] = branco ? 255 : 122
      raw[o + 2] = branco ? 255 : 74
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(tam, 0); ihdr.writeUInt32BE(tam, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}
writeFileSync('public/ruptura-192.png', icone(192))
writeFileSync('public/ruptura-512.png', icone(512))
console.log('Ícones gerados em public/')
