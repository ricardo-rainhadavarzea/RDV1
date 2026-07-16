function formatarReal(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function RankingPorSetor({ resultado }) {
  return (
    <div className="card ranking-desperdicio">
      <h4>Ranking de desperdício por setor</h4>

      {!resultado.temVendasDoPeriodo && (
        <p className="erro">
          Sem dados de venda importados pra esse período exato — a % de desperdício não pôde ser calculada. Mostrando
          só quantidade e valor.
        </p>
      )}

      {resultado.setores.length === 0 ? (
        <p className="carrinho-vazio">Sem lançamentos de desperdício nesse período.</p>
      ) : (
        resultado.setores.map((setor) => (
          <div key={setor.secao} className="setor-bloco">
            <h5>
              {setor.secao} — {formatarReal(setor.totalValor)}
            </h5>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Quantidade</th>
                  <th>Valor</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {setor.produtos.map((p) => (
                  <tr key={p.codigo}>
                    <td>{p.nome}</td>
                    <td>
                      {p.quantidade.toFixed(3)} {p.unidade}
                    </td>
                    <td>{formatarReal(p.valor)}</td>
                    <td>{p.percentual == null ? 'sem dados de venda' : `${p.percentual.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  )
}
