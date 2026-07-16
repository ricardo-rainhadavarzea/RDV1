import { useState } from 'react'
import { criarProduto } from './produtosApi'

const VAZIO = { codigo: '', nome: '', unidade: 'UN', preco_unitario: '', grupo: '', secao: '' }

export default function ProdutoForm({ onCriado }) {
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  function setCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro(null)

    if (!form.codigo.trim() || !form.nome.trim()) {
      setErro('Código e nome são obrigatórios.')
      return
    }
    const preco = parseFloat(String(form.preco_unitario).replace(',', '.'))
    if (Number.isNaN(preco)) {
      setErro('Preço inválido.')
      return
    }

    setSalvando(true)
    try {
      await criarProduto({
        codigo: form.codigo,
        nome: form.nome.trim(),
        unidade: form.unidade,
        preco_unitario: preco,
        grupo: form.grupo.trim() || null,
        secao: form.secao.trim() || null,
      })
      setForm(VAZIO)
      onCriado?.()
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="card">
      <h3>Cadastrar produto novo</h3>
      <form onSubmit={handleSubmit} className="form-produto">
        <div className="campo">
          <label>Código</label>
          <input value={form.codigo} onChange={(e) => setCampo('codigo', e.target.value)} />
        </div>
        <div className="campo">
          <label>Nome</label>
          <input value={form.nome} onChange={(e) => setCampo('nome', e.target.value)} />
        </div>
        <div className="campo">
          <label>Unidade</label>
          <select value={form.unidade} onChange={(e) => setCampo('unidade', e.target.value)}>
            <option value="UN">UN</option>
            <option value="KG">KG</option>
            <option value="LT">LT</option>
          </select>
        </div>
        <div className="campo">
          <label>Preço unitário</label>
          <input value={form.preco_unitario} onChange={(e) => setCampo('preco_unitario', e.target.value)} />
        </div>
        <div className="campo">
          <label>Grupo</label>
          <input value={form.grupo} onChange={(e) => setCampo('grupo', e.target.value)} />
        </div>
        <div className="campo">
          <label>Seção (setor)</label>
          <input value={form.secao} onChange={(e) => setCampo('secao', e.target.value)} />
        </div>

        {erro && <p className="erro">{erro}</p>}

        <button type="submit" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Cadastrar produto'}
        </button>
      </form>
    </div>
  )
}
