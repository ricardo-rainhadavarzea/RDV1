import { useState } from 'react'
import ProdutosImport from './ProdutosImport'
import ProdutosList from './ProdutosList'
import ProdutoForm from './ProdutoForm'

export default function ProdutosPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const atualizar = () => setRefreshKey((k) => k + 1)

  return (
    <div className="produtos-page">
      <ProdutosImport onImportado={atualizar} />
      <ProdutoForm onCriado={atualizar} />
      <ProdutosList refreshKey={refreshKey} />
    </div>
  )
}
