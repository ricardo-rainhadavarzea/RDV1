function formatarReal(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function TotaisCards({ totais, percentualGeral }) {
  const cards = [
    {
      label: '% Desperdício Geral',
      valor: percentualGeral == null ? 'sem dados de venda' : `${percentualGeral.toFixed(1)}%`,
    },
    { label: 'Desperdício', valor: formatarReal(totais.desperdicio) },
    { label: 'Buffet Ida', valor: formatarReal(totais.buffetIda) },
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
