# VesteBem - Aplicação Web (Etapa 4: Perfil, Endereço de Entrega e Pedidos Integrados)

Aplicação web completa para a loja de roupas **VesteBem**, desenvolvida em TypeScript de ponta a ponta (frontend e backend), com banco de dados SQLite persistente em arquivo local.

---

## 1. Requisitos do Ambiente e Versões Utilizadas

- **Node.js**: v24 LTS (verificado na v24.16.0)
- **NPM**: v11 (verificado na v11.8.0)
- **TypeScript**: v5.7.3 com `strict: true` ativo no frontend e backend
- **Frontend**:
  - React 19.3 (`react@19.3.1`, `react-dom@19.3.1`)
  - Vite 8.3 (`vite@8.3.6`, `@vitejs/plugin-react@6.2.1`)
  - CSS nativo e responsivo
- **Backend**:
  - Express 5 (`express@5.0.1`)
  - Módulo nativo `node:sqlite` (`DatabaseSync` do Node.js v24 com SQLite 3.53.0)
  - Criptografia nativa com `node:crypto` (`scrypt` para hashing de senhas e `sha256` para tokens)
  - `cookie-parser@1.4.7` e `cors@2.8.5`

---

## 2. Estrutura do Repositório

```text
mvp-3/
├── backend/
│   ├── data/
│   │   └── vestebem.sqlite       # Arquivo de persistência do SQLite
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   │   ├── 001_initial_schema.sql          # Schema inicial (users, sessions)
│   │   │   │   ├── 002_orders_and_roles.sql        # Perfis, orders e order_items
│   │   │   │   ├── 003_products_and_order_items.sql # Catálogo de produtos e vínculo com itens
│   │   │   │   └── 004_user_profile_and_shipping.sql# Dados pessoais, endereço e entrega nos pedidos
│   │   │   ├── index.ts          # Conexão com SQLite via node:sqlite
│   │   │   ├── migrate.ts        # Executor de migrations versionadas
│   │   │   └── seed.ts           # Script de dados de demonstração (idempotente)
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts# Proteção de rotas e verificação de perfil (RBAC)
│   │   ├── routes/
│   │   │   ├── auth.routes.ts    # Endpoints (/register, /login, /me, /profile, /address, /password, /logout)
│   │   │   ├── order.routes.ts   # Endpoints de pedidos (/orders, /orders/my, /orders/:id)
│   │   │   └── product.routes.ts # Endpoints de produtos (/products, /products/:id)
│   │   ├── services/
│   │   │   ├── auth.service.ts   # Hashing scrypt seguro e geração de tokens
│   │   │   ├── order.service.ts  # Regras de cálculo, endereço de envio e status
│   │   │   ├── product.service.ts# Catálogo, paginação, busca e filtros
│   │   │   └── user.service.ts   # Dados pessoais, endereços, senhas e sessões
│   │   └── server.ts             # Servidor Express 5 e arquivos estáticos
│   ├── package.json
│   ├── package-lock.json
│   └── tsconfig.json             # strict: true
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Navbar.tsx        # Navegação contextual (Catálogo, Pedidos, Painel, Conta)
│   │   ├── context/
│   │   │   └── AuthContext.tsx   # Estado global de autenticação com refreshUser
│   │   ├── pages/
│   │   │   ├── AccountPage.tsx          # Gestão de nome, CPF, telefone, endereço e troca de senha
│   │   │   ├── CatalogPage.tsx          # Catálogo público com 12 itens/pág, busca e filtros
│   │   │   ├── CreateOrderPage.tsx      # Criação de pedidos com validação e confirmação de entrega
│   │   │   ├── EmployeeOrdersPage.tsx   # Painel de pedidos para funcionários
│   │   │   ├── EmployeeProductsPage.tsx # Painel de cadastro e edição de produtos
│   │   │   ├── LoginPage.tsx            # Tela de login
│   │   │   ├── MyOrdersPage.tsx         # Tela "Meus pedidos" para clientes
│   │   │   ├── OrderDetailsPage.tsx     # Detalhes de um pedido e dados de entrega
│   │   │   ├── ProductDetailsPage.tsx   # Página pública de detalhes de uma peça
│   │   │   └── RegisterPage.tsx         # Cadastro público (restrito a cliente)
│   │   ├── services/
│   │   │   └── api.ts            # Comunicação HTTP tipada com a API
│   │   ├── App.tsx               # Roteamento e orquestração de telas
│   │   ├── index.css             # Estilos responsivos em CSS
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json             # strict: true
│   └── tsconfig.node.json
├── package.json                  # Scripts orquestradores na raiz
└── README.md
```

---

## 3. Comandos Disponíveis

Todos os comandos podem ser executados a partir do diretório raiz do projeto:

### 3.1 Instalar Dependências
```bash
npm run install:all
```

### 3.2 Inicializar ou Evoluir o Banco de Dados (Migrations)
```bash
npm run db:migrate
```
*Aplica as migrations versionadas contidas em `backend/src/db/migrations/` registrando cada execução na tabela `schema_migrations`. Caso o banco esteja vazio, ele é criado do zero; caso já exista, aplica a migração 004 sem perda de dados existentes.*

### 3.3 Carregar Dados de Demonstração (Seed)
```bash
npm run db:seed
```
*Prepara dados de demonstração com dois clientes (com CPF, telefone e endereço fictícios), um funcionário, pedidos com dados de entrega e 17 produtos do catálogo. Execuções repetidas são totalmente idempotentes e não duplicam registros.*

### 3.4 Verificação de Tipos (TypeScript Strict)
```bash
npm run typecheck
```
*Executa `tsc --noEmit` no backend e no frontend.*

### 3.5 Build da Aplicação
```bash
npm run build
```
*Compila o backend em `backend/dist` e o frontend em `frontend/dist`.*

### 3.6 Execução em Modo de Desenvolvimento
- **Backend (Porta 3001)**:
  ```bash
  npm run dev:backend
  ```
- **Frontend (Porta 5173)**:
  ```bash
  npm run dev:frontend
  ```

### 3.7 Execução em Produção
Após executar `npm run build`:
```bash
npm run start
```
*Inicia o servidor Node.js compilado (`backend/dist/server.js`) na porta 3001, servindo os endpoints da API `/api/*` e o frontend React compilado (`frontend/dist`) na raiz `/`.*

---

## 4. Credenciais e Dados de Demonstração

Ao rodar o comando `npm run db:seed`, os seguintes dados fictícios ficam disponíveis para teste:

### Usuários de Demonstração:
| Perfil | Nome | E-mail | Senha | CPF Fictício | Telefone Fictício | Endereço de Entrega Fictício |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Cliente** | Alice Santos | `alice@vestebem.com.br` | `senhaCliente1` | `123.456.789-00` | (11) 98765-4321 | Av. Paulista, 1500, Apto 101, Bela Vista - São Paulo/SP (CEP 01310-100) |
| **Cliente** | Bruno Lima | `bruno@vestebem.com.br` | `senhaCliente2` | `987.654.321-99` | (21) 99887-7665 | Av. Atlântica, 2000, Bloco B, Copacabana - Rio de Janeiro/RJ (CEP 22041-001) |
| **Funcionário** | Carlos Gerente | `carlos@vestebem.com.br` | `senhaFuncionario1` | *(Não aplicável)* | (11) 91234-5678 | *(Acesso a pedidos e produtos)* |

*(Nenhum dado pessoal de pessoas reais é utilizado).*

---

## 5. Decisões de Implementação

1. **Gestão de Perfil na Minha Conta**:
   - **Dados Pessoais**: O cliente pode consultar e alterar seu próprio nome, CPF e telefone (`PUT /api/auth/profile`).
   - **Privacidade do CPF**: O CPF é protegido com rigor. Ele fica disponível estritamente na consulta do próprio usuário autenticado (`/api/auth/me`). Não é exposto para outros clientes nem para funcionários nas consultas de pedidos ou clientes.
   - **Endereço de Entrega**: O formulário solicita destinatário, CEP, logradouro, número, complemento (opcional), bairro, cidade e estado (`PUT /api/auth/address`).
   - **Alteração Segura de Senha**: A rota `POST /api/auth/password` exige a confirmação da senha atual. Apenas com a senha atual correta a nova senha é aceita (com hash criptográfico seguro `scrypt` e salt aleatório). O sistema rejeita logins futuros com a senha anterior e aceita imediatamente a nova senha. As senhas nunca trafegam em respostas do backend.
2. **Integração de Entrega com Pedidos**:
   - Para finalizar um pedido, o cliente precisa ter um endereço cadastrado previamente e confirmar seu uso através de uma caixa de seleção explícita. Se não tiver endereço cadastrado, o sistema alerta e direciona para a tela Minha Conta.
   - O pedido grava um snapshot imutável com cópia exata do nome do destinatário, telefone, CEP, logradouro, número, complemento, bairro, cidade e estado no momento exato da compra.
   - Alterações posteriores feitas na página Minha Conta **não afetam** pedidos criados anteriormente.
   - Pedidos criados antes desta etapa continuam disponíveis e exibem nota explicativa indicando que foram criados antes da implementação de entrega.
   - Funcionários conseguem visualizar o destinatário, telefone e endereço completo do pedido na tela de detalhes do pedido para realização do envio.
3. **Persistência e Migrations**:
   - A migration `004_user_profile_and_shipping.sql` adicionou as colunas de dados pessoais/endereço à tabela `users` e as colunas de snapshot de entrega à tabela `orders`. A aplicação funciona perfeitamente ao ser iniciada do zero ou evoluindo bancos existentes.

---

## 6. Verificações Executadas e Limitações

### Verificações Executadas com Sucesso:
- [x] **Migrations do banco de dados**: Execução com sucesso das migrações `001`, `002`, `003` e `004`.
- [x] **Idempotência do Seed**: `npm run db:seed` executa sem duplicar produtos, usuários ou pedidos ao ser executado repetidamente.
- [x] **Verificação estrita de tipos**: `npm run typecheck` executado com aprovação total (0 erros) com `strict: true` no frontend e no backend.
- [x] **Build de produção**: `npm run build` gerando os bundles compilados do backend e do frontend React 19 + Vite 8.
- [x] **Testes End-to-End automatizados**:
  - Consulta e atualização de dados pessoais (nome, CPF, telefone).
  - Consulta e atualização do endereço de entrega.
  - Bloqueio de finalização de pedido se o cliente não tiver endereço de entrega cadastrado (HTTP 400).
  - Bloqueio se o cliente não confirmar o uso do endereço (HTTP 400).
  - Gravação do snapshot de entrega no pedido.
  - Comprovação da imutabilidade: alteração de endereço no perfil do usuário não modifica o endereço gravado em pedidos anteriores.
  - Consulta do pedido por funcionário contendo destinatário, telefone e endereço, com CPF do cliente estritamente protegido.
  - Alteração de senha rejeitando senha atual incorreta (HTTP 401).
  - Alteração de senha bem-sucedida, rejeição da senha antiga no login seguinte e aceitação imediata da nova senha.
- [x] **Execução real do servidor**: Servidor Node.js testado em execução real servindo a API `/api/health` e os assets estáticos do frontend.

### Limitações e Escopo:
- Conforme solicitado, não foram incluídos pagamento, armazenamento de cartões, recuperação de senha por e-mail ou integrações externas.
