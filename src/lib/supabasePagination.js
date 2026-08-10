const TAMANHO_PAGINA_SUPABASE = 1000

/**
 * O Supabase/PostgREST limita cada resposta a 1000 linhas por padrão — sem
 * paginação explícita, uma consulta com mais de 1000 linhas (ex: vendas de
 * uma semana cheia, ou o cadastro de produtos inteiro) vem silenciosamente
 * truncada, sem erro. `construirQuery` deve retornar um builder NOVO do
 * Supabase a cada chamada (não reaproveitar o mesmo, já que uma query já
 * executada não pode ser reexecutada com `.range()` diferente).
 */
export async function buscarTodasLinhas(construirQuery) {
  let todas = []
  let pagina = 0
  while (true) {
    const inicio = pagina * TAMANHO_PAGINA_SUPABASE
    const { data, error } = await construirQuery().range(inicio, inicio + TAMANHO_PAGINA_SUPABASE - 1)
    if (error) throw error
    todas = todas.concat(data)
    if (data.length < TAMANHO_PAGINA_SUPABASE) break
    pagina++
  }
  return todas
}
