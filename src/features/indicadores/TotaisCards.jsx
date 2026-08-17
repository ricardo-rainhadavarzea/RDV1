function formatarReal(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function TotaisCards({ totais, percentualGeral, detalhesCarregados }) {
  function valorPercentualGeral() {
    if (!detalhesCarregados) return 'clique em Carregar'
    return percentualGeral == null ? 'sem dados de venda' : `${percentualGeral.toFixed(1)}%`
  }

  const cards = [
    {
      label: '% Desperdício Geral',
      valor: valorPercentualGeral(),
    },
    { label: 'Desperdício', valor: formatarReal(totais.desperdicio) },
    { label: 'Saldo líquido Buffet (Ida − Volta)', valor: formatarReal(totais.saldoBuffet) },
    { label: 'Uso Interno', valor: formatarReal(totais.usoInterno) },
  ]

  return (
    <div className="totais-cards">
      {cards.map((c) => (
        <div className="stat-tile" key={c.label}>
          <div className="stat-tile-label">{c.label}</div>
          <div className="stat-tile-valor">{c.valor}</div>
        </div>
      ))}
    </div>
  )
}
