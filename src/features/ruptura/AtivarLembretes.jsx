import { useEffect, useState } from 'react'
import { ativarLembretes, desativarLembretes, estadoLembretes } from './lembretes'

/** Cartão na tela inicial da Ruptura: liga/desliga os lembretes de hora do turno neste aparelho. */
export default function AtivarLembretes() {
  const [estado, setEstado] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    estadoLembretes().then(setEstado, () => setEstado('nao_suportado'))
  }, [])

  async function ligar() {
    setErro(null)
    setOcupado(true)
    try {
      await ativarLembretes()
      setEstado('ativo')
    } catch (e) {
      if (e.message === 'permissao_negada') setEstado(Notification.permission === 'denied' ? 'bloqueado' : 'inativo')
      else setErro('Não consegui ativar agora. Confira a internet e tente de novo.')
    } finally {
      setOcupado(false)
    }
  }

  async function desligar() {
    setErro(null)
    setOcupado(true)
    try {
      await desativarLembretes()
      setEstado('inativo')
    } catch {
      setErro('Não consegui desativar agora. Tente de novo.')
    } finally {
      setOcupado(false)
    }
  }

  if (!estado) return null

  return (
    <div className="rup-lembretes">
      {estado === 'ativo' && (
        <>
          <p>🔔 Lembretes ativos neste aparelho: você será avisado na hora de cada turno.</p>
          <button onClick={desligar} disabled={ocupado}>
            Desativar lembretes
          </button>
        </>
      )}
      {estado === 'inativo' && (
        <>
          <p>Receba um aviso no celular na hora de cada turno.</p>
          <button onClick={ligar} disabled={ocupado}>
            {ocupado ? 'Aguarde…' : '🔔 Ativar lembretes'}
          </button>
        </>
      )}
      {estado === 'bloqueado' && (
        <p>
          As notificações estão bloqueadas neste aparelho. Para receber lembretes, libere as notificações deste app nas
          configurações do celular/navegador.
        </p>
      )}
      {estado === 'ios_instalar' && (
        <p>
          No iPhone, os lembretes só funcionam com o app instalado na tela inicial (Safari › Compartilhar › Adicionar à
          Tela de Início). Instale, abra pelo ícone e ative aqui.
        </p>
      )}
      {estado === 'nao_suportado' && <p>Este aparelho ou navegador não suporta lembretes por notificação.</p>}
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}
