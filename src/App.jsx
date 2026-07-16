import { useState } from 'react'
import ProdutosPage from './features/produtos/ProdutosPage'
import './App.css'

const SENHA_GESTAO = import.meta.env.VITE_GESTAO_SENHA || 'rainha123'

function TelaOperacao() {
  return (
    <div className="card">
      <h2>Lançamento</h2>
      <p>Tela de lançamento (carrinho de bipagem) ainda não implementada nesta etapa.</p>
    </div>
  )
}

function TelaGestao() {
  return (
    <div>
      <h2>Gestão</h2>
      <ProdutosPage />
    </div>
  )
}

function LoginGestao({ onEntrar, onCancelar }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (senha === SENHA_GESTAO) {
      onEntrar()
    } else {
      setErro(true)
    }
  }

  return (
    <div className="card login-card">
      <h2>Acesso Gestão</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => {
            setSenha(e.target.value)
            setErro(false)
          }}
          autoFocus
        />
        {erro && <p className="erro">Senha incorreta.</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit">Entrar</button>
          <button type="button" onClick={onCancelar}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

function App() {
  const [view, setView] = useState('operacao') // operacao | login | gestao

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>Rainha da Várzea — Indicadores</h1>
        {view === 'gestao' ? (
          <button onClick={() => setView('operacao')}>Voltar pra Operação</button>
        ) : (
          view === 'operacao' && <button onClick={() => setView('login')}>Gestão</button>
        )}
      </header>

      <main>
        {view === 'operacao' && <TelaOperacao />}
        {view === 'login' && (
          <LoginGestao onEntrar={() => setView('gestao')} onCancelar={() => setView('operacao')} />
        )}
        {view === 'gestao' && <TelaGestao />}
      </main>
    </div>
  )
}

export default App
