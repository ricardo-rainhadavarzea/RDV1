/**
 * Normaliza texto pra comparar cabeçalhos de CSV: sem acento, minúsculo, sem
 * espaço/pontuação. Símbolos como "%" e "R$" viram palavra ("pct"/"real")
 * antes de descartar pontuação — senão um cabeçalho que é só "%" normaliza
 * pra string vazia e nunca bate com nada.
 */
export function normalizeHeader(h) {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/%/g, 'pct')
    .replace(/r\$/g, 'real')
    .replace(/[^a-z0-9]/g, '')
}

/** Dado o array de cabeçalhos do CSV e um dicionário { campoInterno: [aliases] }, monta { campoInterno: cabecalhoOriginal } */
export function mapHeaders(rawHeaders, aliasesByField) {
  const normalized = rawHeaders.map((h) => ({ raw: h, norm: normalizeHeader(h) }))
  const map = {}
  for (const [field, aliases] of Object.entries(aliasesByField)) {
    const aliasesNorm = aliases.map(normalizeHeader)
    const found = normalized.find((h) => aliasesNorm.includes(h.norm))
    if (found) map[field] = found.raw
  }
  return map
}

/**
 * Preenche com zeros à esquerda até 13 dígitos, mas só quando o código é
 * puramente numérico (é o caso das etiquetas de balança). Alguns produtos do
 * cadastro (ex: linha "Floriterra") usam código alfanumérico como
 * "00000000FT001" — esses são mantidos como estão, sem mexer nos caracteres,
 * senão dois produtos diferentes colidiriam no mesmo código numérico.
 */
export function padCodigo(codigo) {
  const raw = String(codigo).trim()
  if (/^\d+$/.test(raw)) {
    return raw.padStart(13, '0')
  }
  return raw
}

/**
 * Aceita tanto formato brasileiro com milhar (1.234,56) quanto decimal
 * simples com ponto (18.60).
 */
export function parseNumeroBR(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'number') return value
  const raw = String(value).trim()
  if (raw.includes(',')) {
    const cleaned = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
    const n = parseFloat(cleaned)
    return Number.isNaN(n) ? 0 : n
  }
  const cleaned = raw.replace(/[^\d.-]/g, '')
  const n = parseFloat(cleaned)
  return Number.isNaN(n) ? 0 : n
}
