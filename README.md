# Rainha da Várzea — Sistema de Indicadores

Camada de inteligência sobre as operações de desperdício, buffet e uso interno da
padaria. Não é ERP, não controla estoque ou produção — só registra movimentações
e transforma em indicadores confiáveis, com data automática.

## Stack

- **Frontend**: React + Vite
- **Banco de dados**: Supabase (Postgres gerenciado)
- **Hospedagem**: Vercel (deploy automático a partir do GitHub)

## Configurar o banco (Supabase)

1. Crie uma conta em [supabase.com](https://supabase.com) (dá pra usar login do GitHub)
2. Crie um novo projeto (escolha uma senha de banco forte e guarde — raramente precisa dela no dia a dia)
3. No painel do projeto, vá em **SQL Editor > New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e rode
4. Em **Project Settings > API**, copie:
   - **Project URL** → cole em `VITE_SUPABASE_URL`
   - **anon public key** → cole em `VITE_SUPABASE_ANON_KEY`

## Rodar localmente

```bash
npm install
cp .env.example .env   # depois edite .env com as credenciais do seu projeto Supabase
npm run dev
```

## Estrutura

```
src/
  lib/supabaseClient.js       # conexão com o Supabase
  features/
    produtos/                 # cadastro de produtos (importação CSV, busca, edição)
supabase/
  schema.sql                  # schema do banco (rodar no SQL Editor do Supabase)
```

## Senha de acesso à área de Gestão

Definida na variável `VITE_GESTAO_SENHA` (`.env`). Padrão de desenvolvimento: `rainha123`.

**Atenção**: esse é um gate simples do lado do cliente, não é autenticação real —
qualquer pessoa com acesso ao código-fonte publicado consegue ver a senha. Serve
pra evitar acesso casual à área de Gestão, não pra proteger dados sensíveis. Se
isso for uma preocupação, podemos trocar por autenticação real do Supabase depois.
