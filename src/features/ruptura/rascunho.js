import { hojeRecife } from './rupturaLib'

// Rascunho da checagem em andamento, guardado no aparelho a cada resposta.
// { data, turno, operador, clientId, itens: [{codigo, nome, secao}], respostas: [true|false|null] }

const CHAVE = 'rdv:ruptura:rascunho'

export function carregarRascunho() {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return null
    const r = JSON.parse(bruto)
    if (r.data !== hojeRecife()) {
      localStorage.removeItem(CHAVE) // progresso de outro dia é descartado
      return null
    }
    return r
  } catch {
    return null
  }
}

export function salvarRascunho(r) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(r))
  } catch {
    // sem armazenamento: segue sem salvar
  }
}

export function limparRascunho() {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // ignora
  }
}
