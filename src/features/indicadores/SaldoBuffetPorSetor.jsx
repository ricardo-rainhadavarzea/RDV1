function formatarReal(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function SaldoBuffetPorSetor({ resultado }) {
  return (
    <div className="card ranking-buffet">
      <h4>Saldo do Buffet por setor (Ida − Volta)</h4>
      <p className="campo-ajuda">O que foi pro buffet e não voltou — indica o que foi consumido de fato.</p>

      {resultado.setores.length === 0 ? (
        <p className="carrinho-vazio">Sem lançamentos de buffet nesse período.</p>
      ) : (
        resultado.setores.map((setor) => (
          <div key={setor.secao} className="setor-bloco">
            <h5>
              {setor.secao} — {formatarReal(setor.totalSaldoValor)}
            </h5>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Ida</th>
                  <th>Volta</th>
                  <th>Saldo (qtd)</th>
                  <th>Saldo (R$)</th>
                </tr>
              </thead>
              <tbody>
                {setor.produtos.map((p) => (
                  <tr key={p.codigo}>
                    <td>{p.nome}</td>
                    <td>
                      {p.qtdIda.toFixed(3)} {p.unidade}
                    </td>
                    <td>
                      {p.qtdVolta.toFixed(3)} {p.unidade}
                    </td>
                    <td>
                      {p.saldoQuantidade.toFixed(3)} {p.unidade}
                    </td>
                    <td>{formatarReal(p.saldoValor)}</td>
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
