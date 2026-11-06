# VesteBem - Loja de Roupas (MVP - Etapa 4)

Aplicação web completa para a loja de roupas **VesteBem**, desenvolvida com arquitetura monorepo integrando frontend e backend em TypeScript com persistência em banco SQLite local.

Nesta Etapa 4, foram implementadas as funcionalidades completas de **Perfil, Endereço de Entrega, Segurança de Acesso e Integração de Envio aos Pedidos**:
1. **Dados Pessoais na Minha Conta**:
   - Consulta e atualização do próprio nome, CPF e telefone pelo usuário autenticado.
   - O CPF é restrito exclusivamente ao cliente e **nunca** é exposto em consultas de funcionários ou relatórios de envio.
2. **Endereço de Entrega do Cliente**:
   - Cadastro e atualização de endereço completo contendo: destinatário, CEP, logradouro, número, complemento (opcional), bairro, cidade e estado (UF).
   - Validações de integridade no frontend e backend.
3. **Alteração Segura de Senha**:
   - Alteração mediante confirmação obrigatória da senha atual e validação da nova credencial (mínimo de 6 caracteres).
   - Senhas criptografadas com `bcrypt` (12 rounds) que nunca aparecem nas respostas da API.
   - Após alteração, sessões futuras exigem a nova senha e rejeitam a anterior.
4. **Integração de Entrega aos Pedidos**:
   - O cliente deve possuir endereço cadastrado e confirmar sua utilização para fechar um pedido.
   - Cada pedido armazena uma cópia congelada do destinatário, telefone de contato e endereço completo no momento da compra.
   - Alterações posteriores no perfil ou no endereço da conta não modificam os dados de pedidos passados.
   - Retrocompatibilidade: pedidos anteriores à Etapa 4 permanecem legíveis, com indicação explícita de que não possuem informações de entrega registradas.
   - Funcionários podem consultar destinatário, telefone e endereço na tela de detalhes do pedido para realização do envio, sem acesso ao CPF do cliente.
5. **Carga de Dados de Demonstração (Seed)**:
   - Clientes de demonstração com CPF fictício, telefone fictício e endereço de entrega pré-cadastrado.
   - Mais de 16 produtos e pedidos de demonstração.
   - Script rigorosamente idempotente (`npm run seed`).

---

## 1. Requisitos do Ambiente e Versões Utilizadas

- **Node.js**: v24 LTS (`v24.16.0` testado)
- **npm**: v11 (`11.8.0` testado)
- **TypeScript**: `5.8.2` (com `strict: true` no frontend e no backend)
- **Frontend**:
  - `React`: `19.3.1`
  - `React DOM`: `19.3.1`
  - `Vite`: `8.3.6`
  - `@vitejs/plugin-react`: `6.2.1`
- **Backend**:
  - `Express`: `5.3.0`
  - `better-sqlite3`: `13.0.3` (SQLite local em arquivo)
  - `bcrypt`: `6.0.0`
  - `jsonwebtoken`: `9.0.3`
  - `cookie-parser`: `1.4.7`
  - `cors`: `2.8.6`
  - `zod`: `3.25.7`

---

## 2. Estrutura do Repositório

```text
mvp-2/
├── package.json              # Scripts orquestradores da raiz
├── package-lock.json         # Lockfile raiz
├── .gitignore
├── README.md
├── data/
│   └── vestebem.sqlite       # Banco de dados local SQLite
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json         # strict: true, NodeNext
│   ├── .env.example
│   └── src/
│       ├── config.ts
│       ├── app.ts
│       ├── server.ts
│       ├── types/
│       │   ├── user.ts
│       │   ├── order.ts
│       │   └── product.ts
│       ├── db/
│       │   ├── connection.ts
│       │   ├── migrate.ts
│       │   ├── runMigrationsCli.ts
│       │   └── seed.ts
│       ├── middleware/
│       │   └── authMiddleware.ts
│       ├── routes/
│       │   ├── authRoutes.ts
│       │   ├── orderRoutes.ts
│       │   └── productRoutes.ts
│       └── services/
│           ├── userService.ts
│           ├── orderService.ts
│           └── productService.ts
└── frontend/
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json         # strict: true
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── types.ts
        ├── index.css
        ├── components/
        │   ├── Header.tsx
        │   └── OrderStatusBadge.tsx
        ├── context/
        │   └── AuthContext.tsx
        ├── pages/
        │   ├── CatalogPage.tsx
        │   ├── ProductDetailsPage.tsx
        │   ├── LoginPage.tsx
        │   ├── RegisterPage.tsx
        │   ├── AccountPage.tsx
        │   ├── NewOrderPage.tsx
        │   ├── MyOrdersPage.tsx
        │   ├── OrderDetailsPage.tsx
        │   ├── EmployeeOrdersPage.tsx
        │   └── EmployeeProductsPage.tsx
        └── services/
            └── api.ts
```

---

## 3. Comandos para Instalação, Banco, Demonstração, Build e Execução

### 3.1. Instalação das Dependências

Para instalar as dependências de todo o projeto:

```bash
# Na raiz do projeto:
npm --prefix backend install
npm --prefix frontend install
```

### 3.2. Inicialização do Banco de Dados (Migrations)

O banco de dados SQLite é versionado através de migrações (`001`, `002`, `003` e `004`):

```bash
# Na raiz:
npm run init:db

# Ou dentro da pasta backend:
cd backend
npm run db:migrate
```

O arquivo de banco é mantido em `data/vestebem.sqlite`.

### 3.3. Carga de Dados Fictícios de Demonstração (Seed)

Para popular o banco com usuários fictícios contendo dados de entrega, catálogo com 16 produtos e pedidos de demonstração:

```bash
# Na raiz:
npm run seed

# Ou dentro da pasta backend:
cd backend
npm run db:seed
```

O comando é idempotente: pode ser executado repetidamente sem gerar dados duplicados.

#### Credenciais de Demonstração

| Perfil | Nome | E-mail | Senha Padrão | Dados Pré-cadastrados |
| :--- | :--- | :--- | :--- | :--- |
| **Cliente 1** | Carlos Oliveira | `carlos@cliente.com` | `vestebem123` | CPF `000.111.222-33`, Tel `(11) 98765-4321`, Av. Paulista, 1578 - SP |
| **Cliente 2** | Ana Pereira | `ana@cliente.com` | `vestebem123` | CPF `444.555.666-77`, Tel `(21) 99876-5432`, Av. Atlântica, 2000 - RJ |
| **Funcionário** | Mariana Silva | `mariana@vestebem.com` | `vestebem123` | Acesso à gestão de pedidos, consulta de dados de envio e produtos |

### 3.4. Verificação de Tipos (TypeScript Strict)

Para rodar a verificação estrita de tipos em ambos os projetos:

```bash
# Na raiz:
npm run typecheck

# Ou individualmente:
npm run typecheck:backend
npm run typecheck:frontend
```

### 3.5. Geração do Build

Para compilar o backend e gerar os pacotes de produção do frontend com Vite:

```bash
# Na raiz:
npm run build

# Ou individualmente:
npm run build:backend
npm run build:frontend
```

### 3.6. Execução em Modo de Desenvolvimento

Abra dois terminais:

**Terminal 1 (Backend - porta 3001):**
```bash
npm run dev:backend
# Ou: cd backend && npm run dev
```

**Terminal 2 (Frontend - porta 5173):**
```bash
npm run dev:frontend
# Ou: cd frontend && npm run dev
```

Acesse o sistema no navegador em: `http://localhost:5173`

### 3.7. Execução em Produção

Após rodar `npm run build`:

```bash
# Na raiz:
npm start

# Ou dentro da pasta backend:
cd backend
npm start
```

---

## 4. Decisões de Implementação

1. **Evolução do Banco (Migração 004)**:
   - Adicionadas as colunas `cpf` e `phone` à tabela `users`.
   - Criada a tabela `user_addresses` para gerenciar o endereço de entrega do cliente.
   - Adicionados à tabela `orders` os campos: `has_delivery_info`, `delivery_recipient`, `delivery_phone`, `delivery_zip_code`, `delivery_street`, `delivery_number`, `delivery_complement`, `delivery_neighborhood`, `delivery_city` e `delivery_state`.
   - O banco pode ser evoluído de qualquer etapa anterior sem perda de registros ou inicializado do zero em uma nova instalação.
2. **Privacidade e Proteção do CPF**:
   - O CPF é retornado unicamente nas rotas `/api/auth/me` e `/api/auth/profile` para o próprio cliente autenticado.
   - Em nenhuma consulta de pedidos (`GET /api/orders/all` ou `GET /api/orders/:id`) o CPF é exposto, garantindo que funcionários visualizem apenas os dados indispensáveis ao despacho (destinatário, telefone e endereço).
3. **Congelamento e Imutabilidade dos Dados de Envio**:
   - Ao confirmar o pedido, os dados de entrega atuais são copiados atomicamente para os registros do pedido no banco de dados.
   - Modificações subsequentes na conta ou no endereço do cliente não afetam os pedidos anteriores.
4. **Validação Obrigatória de Endereço no Fechamento**:
   - Um cliente sem endereço cadastrado é alertado e orientado a cadastrá-lo antes de prosseguir com a compra.
   - A finalização do pedido exige confirmação expressa (`confirmDelivery: true`).
5. **Segurança na Alteração de Senha**:
   - Validação da senha atual via `bcrypt.compare`.
   - Bloqueio de senhas curtas (mínimo de 6 caracteres).
   - Invalidação de logins futuros com a senha anterior.
   - Respostas do backend nunca incluem senhas ou hashes.

---

## 5. Verificações Executadas e Eventuais Limitações

### Verificações Executadas com Sucesso:
- [x] **Migração de Banco de Dados**: Aplicação da migração `004_add_profile_address_and_order_delivery` sem apagar os registros existentes.
- [x] **Carga Idempotente de Demonstração (`npm run seed`)**: Inserção de dados fictícios de CPF, telefone e endereço para Carlos e Ana; teste de idempotência comprovou ausência de duplicidade.
- [x] **Verificação Estrita de Tipos (`npm run typecheck`)**: Compilação sem nenhum erro (`strict: true`) no frontend e no backend.
- [x] **Build de Produção (`npm run build`)**: Geração bem-sucedida de pacotes Vite e compilação do TypeScript do backend.
- [x] **Consulta e Alteração de Dados Pessoais**: Atualização com sucesso do nome, CPF e telefone de cliente autenticado.
- [x] **Cadastro e Atualização de Endereço**: Registro e edição de endereço completo de entrega.
- [x] **Alteração de Senha**:
  - Tentativa com senha atual incorreta bloqueada com erro 400.
  - Alteração bem-sucedida com senha atual correta e nova credencial.
  - Rejeição de login subsequente com a senha antiga (HTTP 401).
  - Sucesso no login utilizando a nova senha.
- [x] **Criação de Pedido com Entrega**: Fechamento de pedido com validação de endereço e confirmação de uso.
- [x] **Imutabilidade dos Dados de Envio**: Atualização do endereço da conta do cliente após fechar o pedido e confirmação de que os dados do pedido anterior mantiveram-se inalterados.
- [x] **Acesso do Funcionário**:
  - Consulta aos dados necessários ao despacho (destinatário, telefone e endereço) na tela de detalhes do pedido.
  - Verificação de que o CPF do cliente **não** é exibido para o funcionário.
- [x] **Retrocompatibilidade de Pedidos Antigos**: Verificação de que pedidos criados nas etapas anteriores são identificados como sem dados de entrega (`has_delivery_info: false`), mantendo seus itens e valores intactos.
- [x] **Persistência pós-reinicialização**: Dados de usuários, produtos, endereços e pedidos permanecem íntegros no arquivo SQLite local.

### Limitações Desta Etapa:
- Conforme as instruções do pedido, não foram adicionados gateways de pagamento externos, armazenamento de cartões de crédito ou serviços de envio de e-mails.
