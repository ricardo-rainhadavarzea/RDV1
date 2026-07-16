function formatarReal(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function UsoInternoPorSetor({ resultado }) {
  return (
    <div className="card ranking-uso-interno">
      <h4>Ranking de uso interno por setor</h4>

      {resultado.setores.length === 0 ? (
        <p className="carrinho-vazio">Sem lançamentos de uso interno nesse período.</p>
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
