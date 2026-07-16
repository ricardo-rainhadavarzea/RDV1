function formatarReal(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function TotaisCards({ totais }) {
  const cards = [
    { label: 'Desperdício', valor: totais.desperdicio },
    { label: 'Buffet Ida', valor: totais.buffetIda },
    { label: 'Saldo líquido Buffet (Ida − Volta)', valor: totais.saldoBuffet },
    { label: 'Uso Interno', valor: totais.usoInterno },
  ]

  return (
    <div className="totais-cards">
      {cards.map((c) => (
        <div className="stat-tile" key={c.label}>
          <div className="stat-tile-label">{c.label}</div>
          <div className="stat-tile-valor">{formatarReal(c.valor)}</div>
        </div>
      ))}
    </div>
  )
}
