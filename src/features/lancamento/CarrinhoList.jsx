export default function CarrinhoList({ itens, onRemover }) {
  if (itens.length === 0) {
    return <p className="carrinho-vazio">Nenhum item lançado ainda.</p>
  }

  const totalValor = itens.reduce((soma, item) => soma + item.valor, 0)

  return (
    <div className="carrinho-list">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Qtd</th>
            <th>Valor</th>
            <th>Origem</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, i) => (
            <tr key={i}>
              <td>{item.nome}</td>
              <td>
                {item.quantidade.toFixed(3)} {item.unidade}
              </td>
              <td>R$ {item.valor.toFixed(2)}</td>
              <td>{item.origem === 'bipagem' ? 'Bipado' : 'Manual'}</td>
              <td>
                <button onClick={() => onRemover(i)}>Remover</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="carrinho-totais">
        <strong>{itens.length}</strong> itens — <strong>R$ {totalValor.toFixed(2)}</strong>
      </p>
    </div>
  )
}
