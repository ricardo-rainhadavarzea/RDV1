/**
 * Etiquetas da balança: 13 dígitos numéricos no formato "20 CCCCC VVVVV D"
 * - 20    = prefixo fixo
 * - CCCCC = 5 dígitos = código do produto (padded até 13 dígitos pra bater com produtos.codigo)
 * - VVVVV = 5 dígitos = valor total em R$, com 2 casas decimais implícitas
 * - D     = dígito verificador (ignorado)
 *
 * Exemplo: "2000178008509" -> produto "0000000000178", valor R$8,50
 */
export function decodeEtiqueta(digits) {
  if (!/^\d{13}$/.test(digits)) return null
  if (digits.slice(0, 2) !== '20') return null

  const codigoProduto = digits.slice(2, 7).padStart(13, '0')
  const valor = parseInt(digits.slice(7, 12), 10) / 100

  return { codigoProduto, valor }
}
