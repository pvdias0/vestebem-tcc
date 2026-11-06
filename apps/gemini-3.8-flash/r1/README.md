# VesteBem - Aplicação Web de E-commerce de Roupas

Aplicação web desenvolvida para a loja de roupas **VesteBem**. O sistema conta com autenticação por perfis (`customer` e `employee`), catálogo público de produtos com pesquisa, filtros simultâneos, ordenação e paginação, gestão de peças por funcionários, gestão de perfil (dados pessoais, CPF, telefone, endereço de entrega e alteração de senha), criação de pedidos com congelamento (*snapshot*) de dados de entrega e itens, e persistência real em banco de dados SQLite local.

---

## 1. Requisitos do Ambiente e Versões Utilizadas

- **Sistema Operacional**: Windows, Linux ou macOS
- **Node.js**: v24 LTS (`v24.16.0` testado)
- **npm**: v11 (`11.8.0` testado)
- **Frontend**:
  - React `19.3.1`
  - React DOM `19.3.1`
  - Vite `8.3.5`
  - TypeScript `5.8.0` (com `strict: true` em [frontend/tsconfig.json](file:///D:/Users/Pvito/Downloads/TCC/gemini-3.8/mvp/frontend/tsconfig.json))
- **Backend**:
  - Express `5.3.0`
  - Node.js SQLite nativo (`node:sqlite` DatabaseSync)
  - Bcrypt.js `3.0.3` (para hash e validação de senhas com salt)
  - JsonWebToken `9.0.2` (autenticação JWT via cookies HTTP-only e Authorization headers)
  - Cookie-Parser `1.4.7` e Cors `2.8.5`
  - TypeScript `5.8.0` (com `strict: true` em [backend/tsconfig.json](file:///D:/Users/Pvito/Downloads/TCC/gemini-3.8/mvp/backend/tsconfig.json))
- **Banco de Dados**: SQLite em arquivo local (`backend/database.sqlite`), gerenciado via migrações versionadas na tabela `schema_migrations`.

---

## 2. Estrutura do Repositório

```
mvp/
├── package.json               # Scripts centrais da raiz
├── package-lock.json          # Lockfile da raiz
├── README.md                  # Documentação do projeto
├── backend/
│   ├── package.json           # Dependências e scripts do backend
│   ├── package-lock.json      # Lockfile do backend
│   ├── tsconfig.json          # Configuração TypeScript (strict: true)
│   ├── database.sqlite        # Arquivo local do banco SQLite
│   └── src/
│       ├── server.ts          # Inicialização e middlewares Express 5
│       ├── types.ts           # Interfaces e tipos do TypeScript
│       ├── db/
│       │   ├── index.ts       # Conexão SQLite e motor de migrações (001 a 004)
│       │   ├── migrate.ts     # Script de execução de migrações
│       │   └── seed.ts        # Script de dados de demonstração (16 produtos + usuários com CPF/endereço + pedidos)
│       ├── controllers/
│       │   ├── authController.ts     # Login, cadastro, dados pessoais, endereço e alteração de senha
│       │   ├── productController.ts  # Catálogo público, pesquisa, filtros, paginação, cadastro e edição
│       │   └── orderController.ts    # Criação via catálogo com snapshot de entrega, listagem e status
│       ├── middleware/
│       │   ├── auth.ts        # Middleware de proteção JWT de rotas
│       │   └── roles.ts       # Controle de acesso por perfil (customer / employee)
│       └── routes/
│           ├── authRoutes.ts     # Rotas /api/auth
│           ├── productRoutes.ts  # Rotas /api/products
│           └── orderRoutes.ts    # Rotas /api/orders
└── frontend/
    ├── package.json           # Dependências e scripts do frontend
    ├── package-lock.json      # Lockfile do frontend
    ├── tsconfig.json          # Configuração TypeScript (strict: true)
    ├── vite.config.ts         # Configuração Vite 8.3 com proxy para backend
    ├── index.html             # Ponto de entrada HTML em pt-BR
    └── src/
        ├── main.tsx                  # Ponto de montagem React 19.3
        ├── App.tsx                   # Componente central, navegação e controle de telas
        ├── index.css                 # Estilização CSS responsiva e consistente
        ├── types.ts                  # Definições de tipos do frontend
        ├── api.ts                    # Cliente HTTP para comunicação com a API
        ├── RegisterForm.tsx          # Formulário de cadastro de cliente
        ├── LoginForm.tsx             # Formulário de login
        ├── AccountPage.tsx           # Tela "Minha conta" (dados pessoais, endereço, senha e logout)
        ├── ProductCatalogView.tsx    # Catálogo público (12 itens/página, busca, filtros, ordenação)
        ├── ProductDetailView.tsx     # Página pública de detalhes de um produto
        ├── EmployeeProductsView.tsx  # Painel de funcionário para cadastrar e editar produtos
        ├── CreateOrderView.tsx       # Tela para cliente criar pedido com confirmação de endereço
        ├── OrderListView.tsx         # Tela "Meus pedidos" do cliente
        ├── OrderDetailView.tsx       # Tela de detalhes do pedido (itens e endereço para envio)
        └── EmployeeOrdersView.tsx    # Painel de funcionário para listar e gerenciar pedidos
```

---

## 3. Instruções para Executar o Sistema Completo

Execute os comandos a partir da raiz do repositório:

### 3.1 Instalar Dependências
```bash
npm run install:all
```

### 3.2 Inicializar o Banco de Dados (Migrations)
Executa as migrações versionadas (001, 002, 003 e 004) sem apagar dados pré-existentes:
```bash
npm run db:migrate
```

### 3.3 Carregar Dados de Demonstração (Seed)
Popula o banco com clientes, funcionário, dados fictícios de CPF, telefone e endereço completo de entrega, produtos variados do catálogo e pedidos de teste:
```bash
npm run db:seed
```
*(Execuções repetidas são totalmente idempotentes e não duplicam registros)*

### 3.4 Verificação de Tipos (TypeScript Strict)
```bash
npm run typecheck
```
*(Executa a checagem no backend e no frontend com `strict: true`)*

### 3.5 Gerar o Build de Produção
```bash
npm run build
```
*(Gera os artefatos compilados em `backend/dist` e os bundles otimizados em `frontend/dist`)*

### 3.6 Executar em Modo de Desenvolvimento
- **Terminal 1 (Backend)**:
  ```bash
  npm run dev:backend
  ```
  *(Servidor rodando em `http://localhost:3000`)*
- **Terminal 2 (Frontend)**:
  ```bash
  npm run dev:frontend
  ```
  *(Aplicação rodando em `http://localhost:5173` com proxy automático para a API)*

### 3.7 Executar em Produção
Após rodar `npm run build`:
- **Backend**: `npm run start:backend`
- **Frontend**: `npm run start:frontend`

---

## 4. Credenciais de Demonstração

Após rodar `npm run db:seed`, utilize as seguintes contas para testar todas as funcionalidades:

| Perfil | Nome | E-mail | Senha | Dados Iniciais de Demonstração | Capacidades |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cliente 1** | Carlos Oliveira | `cliente1@vestebem.com` | `cliente123` | CPF: `111.222.333-44`<br>Tel: `(11) 98765-4321`<br>Endereço: Av. Paulista, 1000, Apto 42, Bela Vista, São Paulo/SP (CEP 01310-100) | Altera dados pessoais, endereço e senha; cria pedidos confirmando endereço de entrega; consulta apenas seus pedidos |
| **Cliente 2** | Mariana Souza | `cliente2@vestebem.com` | `cliente123` | CPF: `555.666.777-88`<br>Tel: `(21) 99887-1122`<br>Endereço: Av. Atlântica, 500, Bloco B, Copacabana, Rio de Janeiro/RJ (CEP 22041-001) | Altera dados pessoais, endereço e senha; cria pedidos; consulta apenas seus pedidos |
| **Funcionário** | Fernanda Lima | `funcionario@vestebem.com` | `admin123` | Tel: `(11) 91234-5678` | Cadastra e edita produtos do catálogo; visualiza todos os pedidos com destinatário, telefone e endereço de entrega (sem acesso a CPF dos clientes); atualiza status |

---

## 5. Regras de Negócio e Decisões de Implementação

1. **Gestão de Perfil na Página "Minha Conta"**:
   - Abas organizadas em: *Visão Geral*, *Dados Pessoais*, *Endereço de Entrega* e *Alterar Senha*.
   - **Privacidade do CPF**: O CPF é mantido estritamente para o próprio cliente autenticado e **nunca** é exposto ou retornado em consultas de funcionários ou em pedidos.
   - **Alteração de Senha**: Exige a validação da senha atual via `bcrypt.compareSync`. Havendo correspondência, o hash da nova senha é gerado com salt e atualizado. Novos logins passam a exigir a nova credencial e rejeitam a anterior. A senha nunca é retornada em respostas do backend.
   - **Endereço de Entrega Completo**: Destinatário, CEP, logradouro, número, complemento (opcional), bairro, cidade e estado.
2. **Integração de Entrega aos Pedidos**:
   - Para finalizar um pedido, o cliente precisa ter um endereço completo cadastrado e confirmar a sua utilização via checkbox.
   - O pedido grava um **snapshot permanente** dos dados de entrega (`delivery_recipient_name`, `delivery_phone`, `delivery_cep`, `delivery_street`, `delivery_number`, `delivery_complement`, `delivery_neighborhood`, `delivery_city`, `delivery_state`).
   - Alterações posteriores de endereço ou nome na conta do cliente não afetam os pedidos já realizados.
   - **Retrocompatibilidade**: Pedidos gerados em etapas anteriores sem endereço continuam totalmente funcionais, exibindo a indicação amigável de que foram gerados sem dados de entrega registrados.
   - **Visão do Funcionário**: Na tela de detalhes do pedido, os funcionários visualizam os dados essenciais para o envio (destinatário, telefone e endereço completo), sem acesso a dados confidenciais do cliente como CPF.
3. **Evolução do Banco e Migrações**:
   - A migração `004_user_profile_and_order_delivery` adiciona de forma idempotente as colunas na tabela `users` e `orders` sem recriar ou perder dados existentes.
   - Todos os dados pessoais, de catálogo e de pedidos persistem no arquivo local `backend/database.sqlite` e permanecem íntegros entre reinicializações.

---

## 6. Verificações Executadas e Validações

Todas as seguintes verificações foram executadas e validadas com sucesso:
- **Verificação de Tipos**: `npm run typecheck` passou em 100% dos arquivos com `strict: true` ativado tanto no frontend quanto no backend.
- **Build de Produção**: `npm run build` compilou os módulos TypeScript do backend e gerou os bundles otimizados do frontend com Vite 8.3 sem erros.
- **Migrações e Carga de Demonstração**:
  - `npm run db:migrate` aplicou todas as migrações (001 a 004).
  - `npm run db:seed` cadastrou usuários com CPF e endereços fictícios, 16 produtos e pedidos com entrega. A reexecução confirmou a ausência de duplicidade.
- **Validações de Ponta a Ponta**:
  - Atualização de nome, CPF e telefone do cliente via `PUT /api/auth/profile/personal`.
  - Atualização de endereço de entrega via `PUT /api/auth/profile/address`.
  - Bloqueio de alteração de senha com senha atual incorreta (HTTP 400).
  - Alteração de senha com sucesso: login com senha antiga rejeitado (HTTP 401) e login com nova senha aceito (HTTP 200).
  - Bloqueio na finalização de pedido se o cliente não tiver endereço ou não confirmar o uso do endereço (HTTP 400).
  - Criação de pedido com confirmação de endereço: gravação exata do snapshot de entrega.
  - Alteração do endereço na conta após a compra e verificação de que o pedido anterior manteve o endereço original congelado.
  - Consulta do pedido pelo funcionário: visualização dos dados de entrega (destinatário, telefone e endereço) e confirmação de que o CPF do cliente não é exposto.
  - Consulta de pedidos antigos: exibição correta da indicação de pedido sem dados de entrega.
  - Persistência física dos dados em `backend/database.sqlite` confirmada.
