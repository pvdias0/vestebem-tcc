# VesteBem

Aplicação web da loja de roupas VesteBem.

- **Etapa 1:** cadastro, login, Minha conta e sair da conta.
- **Etapa 2:** perfis de cliente e funcionário, criação de pedidos, Meus pedidos, detalhes do pedido e painel de pedidos para funcionários.
- **Etapa 3:** catálogo público de produtos (pesquisa, filtros, ordenação, paginação de 12 itens e página de detalhes), painel de produtos para funcionários e pedidos montados a partir do catálogo.
- **Etapa 4:** dados pessoais (nome, CPF, telefone), endereço de entrega e alteração de senha em "Minha conta". Os pedidos passam a guardar uma cópia dos dados de entrega confirmados pelo cliente.

## Requisitos e versões

| Item | Versão usada |
|---|---|
| Node.js | 24.16.0 (24 LTS; obrigatório ≥ 24 por causa do `node:sqlite`) |
| npm | 11.8.0 |
| TypeScript | 5.9 (`strict: true` no frontend e no backend) |
| React / React DOM | 19.3 |
| React Router | 7 |
| Vite | 8.3 (`@vitejs/plugin-react` 6) |
| Express | 5.3 |
| SQLite | embutido no Node (`node:sqlite`), arquivo local |

Nenhum serviço externo é usado.

## Estrutura

```
package.json                    scripts que coordenam tudo (+ concurrently para o modo dev)
backend/
  migrations/001_initial.sql            users, sessions
  migrations/002_roles_and_orders.sql   perfil funcionário, orders, order_items
  migrations/003_products.sql           products; order_items.product_id
  migrations/004_account_and_shipping.sql  users.cpf/phone, addresses, orders.shipping_*
  src/db.ts                    conexão SQLite e executor de migrations
  src/migrate-cli.ts           comando de inicialização/atualização do banco
  src/seed.ts                  dados de demonstração (idempotente)
  src/auth.ts                  hash de senha (scrypt) e tokens de sessão
  src/app.ts                   rotas de autenticação e montagem da API
  src/orders.ts                rotas, validação e regras de pedidos
  src/products.ts              catálogo: pesquisa, filtros, cadastro e edição
  src/account.ts               Minha conta: dados pessoais, endereço e senha
  src/server.ts                ponto de entrada (também serve o frontend compilado)
  src/*.test.ts, testutil.ts   testes de integração da API
frontend/
  src/pages/                   telas de conta, catálogo, produtos e pedidos
  src/components.tsx           proteção de rotas por perfil, selo de status, mensagens
  src/format.ts                formatação de moeda, data, CPF, CEP e telefone; rótulos dos status
```

Cada pasta (raiz, `backend`, `frontend`) tem seu próprio `package.json` e `package-lock.json`.

## Comandos (rodar na raiz)

| Ação | Comando |
|---|---|
| Instalar dependências | `npm run install:all` (ou `npm ci` em cada pasta) |
| Inicializar/atualizar o banco | `npm run db:migrate` |
| Preparar dados de demonstração | `npm run db:seed` |
| Desenvolvimento (API :3001 + Vite :5173) | `npm run dev` → abrir http://localhost:5173 |
| Verificar tipos | `npm run typecheck` (inclui os arquivos de teste do backend) |
| Testes da API | `npm test` |
| Build de produção | `npm run build` |
| Executar o build | `npm start` → abrir http://localhost:3001 |

O banco fica em `backend/data/vestebem.db`. O servidor também aplica as migrations pendentes ao iniciar.

Variáveis de ambiente (opcionais): `PORT` (padrão 3001), `DATABASE_PATH`, `STATIC_DIR`, `COOKIE_SECURE=true` (use quando servir por HTTPS).

### Executar o sistema completo (passo a passo)

1. Instale o Node.js 24 e, na raiz do projeto, rode `npm run install:all`.
2. Rode `npm run db:seed` para criar o banco e os dados de demonstração. Pode pular este passo; nesse caso o banco é criado vazio ao iniciar.
3. Escolha o modo:
   - **Desenvolvimento:** `npm run dev` e abra http://localhost:5173.
   - **Produção local:** `npm run build`, depois `npm start`, e abra http://localhost:3001.
4. Entre com uma das contas de demonstração abaixo.
   - Como **cliente**, você pode usar "Minha conta", o catálogo, "Novo pedido" (com a confirmação do endereço) e "Meus pedidos".
   - Como **funcionário**, você pode usar o painel de pedidos (com os dados de entrega) e o painel de produtos.

### Atualizando um banco de etapas anteriores

Basta rodar `npm run db:migrate` ou iniciar o servidor. As migrations pendentes são aplicadas sem apagar dados:

- **`002`:** recria a tabela `users` para aceitar o novo perfil, copiando todos os registros. Usuários e sessões existentes são preservados, e as contas antigas continuam como clientes.
- **`003`:** cria `products` e acrescenta a coluna `order_items.product_id`, que pode ficar vazia. Os pedidos antigos, com descrição e preço digitados manualmente, continuam com os mesmos itens e valores. Eles ficam com `productId: null` e a tela de detalhes indica "item sem vínculo com o catálogo".
- **`004`:** só acrescenta colunas (`users.cpf`, `users.phone`, `orders.shipping_*`, todas opcionais) e a tabela `addresses`. Os pedidos anteriores ficam com os dados de entrega vazios (`shipping: null`) e a tela de detalhes indica "Este pedido não possui informações de entrega registradas".

## Dados de demonstração

```
npm run db:seed
```

O comando aplica as migrations se necessário e prepara estas contas:

| Perfil | E-mail | Senha |
|---|---|---|
| Funcionário | `funcionario@vestebem.demo` | `demo1234` |
| Cliente | `carla@vestebem.demo` | `demo1234` |
| Cliente | `bruno@vestebem.demo` | `demo1234` |

Também são criados **18 produtos** em 7 categorias, com tamanhos variados (P, M, G, GG, 38, 40, 42, ÚNICO) e preços de R$ 15,00 a R$ 279,00. Há um produto esgotado e dois da "Coleção D'Água", que servem para testar a pesquisa com apóstrofo.

Os clientes demo também têm dados pessoais e de entrega. **Todos são fictícios:** os CPFs são gerados a partir de sequências (`123456789` e `987654321`) só para passar na validação dos dígitos verificadores, e os endereços são inventados.

| Cliente | CPF | Telefone | Endereço |
|---|---|---|---|
| Carla | 123.456.789-09 | (11) 99000-0001 | Rua Fictícia das Flores, 100, Apto 12 — Bairro Exemplo — São Paulo/SP — 01000-000 |
| Bruno | 987.654.321-00 | (21) 3000-0002 | Avenida Imaginária, S/N — Centro Demo — Rio de Janeiro/RJ — 20000-000 |

O funcionário demo não tem CPF, telefone nem endereço.

Cada cliente recebe 2 pedidos de exemplo, feitos com produtos do catálogo, com status variados e com cópia dos dados de entrega.

Rodar o comando de novo **não duplica nada**:

- as contas são identificadas pelo e-mail e atualizadas, o que restaura nome, perfil, senha, CPF, telefone e endereço de demonstração. O endereço é único por usuário, então é atualizado em vez de duplicado;
- os produtos são identificados por **nome + tamanho** e só são inseridos se não existirem, então edições feitas por funcionários não são sobrescritas;
- os pedidos de exemplo só são criados quando o cliente demo ainda não tem nenhum pedido.

Os dados de demonstração são fictícios; não use o seed em produção.

## API

| Método | Rota | Quem pode | Descrição |
|---|---|---|---|
| POST | `/api/auth/register` | visitante | `{name, email, password}` → cria **sempre** um cliente e já faz o login |
| POST | `/api/auth/login` | visitante | `{email, password}` → 200 ou 401 |
| POST | `/api/auth/logout` | autenticado | encerra a sessão atual (204) |
| GET | `/api/me` | autenticado | `{id, name, email, role}` |
| GET | `/api/products` | público | parâmetros `q`, `categoria`, `tamanho`, `precoMin`, `precoMax` (em reais, ex. `49,90`), `ordem` (`nome_asc` \| `nome_desc` \| `preco_asc` \| `preco_desc`) e `pagina`. Responde `{products, page, pageSize: 12, total, totalPages}`. Parâmetro inválido → 400 |
| GET | `/api/products/filters` | público | categorias e tamanhos existentes, para montar os filtros |
| GET | `/api/products/:id` | público | detalhes do produto |
| POST | `/api/products` | funcionário | `{name, description, category, size, priceCents, stock}` → 201 |
| PUT | `/api/products/:id` | funcionário | atualiza todos os campos acima |
| GET | `/api/account` | autenticado | `{user, profile: {name, cpf, phone}, address}` da **própria** conta |
| PUT | `/api/account/profile` | autenticado | `{name, cpf, phone}`. CPF e telefone são opcionais (vazio apaga). CPF inválido → 400, CPF de outra conta → 409 |
| PUT | `/api/account/address` | autenticado | `{recipient, cep, street, number, complement?, district, city, state}` → cadastra ou atualiza |
| PUT | `/api/account/password` | autenticado | `{currentPassword, newPassword}`. Senha atual errada → 400 |
| POST | `/api/orders` | cliente | `{items: [{productId, quantity}], confirmShipping: true, addressUpdatedAt}` → 201 com o pedido (inclui `shipping`) |
| GET | `/api/orders[?status=]` | cliente / funcionário | o cliente recebe só os próprios pedidos; o funcionário recebe todos |
| GET | `/api/orders/:id` | cliente (dono) / funcionário | detalhes com itens e `shipping` (destinatário, telefone e endereço; `null` em pedidos antigos); para outro cliente responde 404 |
| PATCH | `/api/orders/:id/status` | funcionário | `{status}` → altera o status |

Códigos de erro:

- **401:** visitante sem login.
- **403:** perfil sem permissão (cliente tentando alterar status ou funcionário tentando criar pedido).
- **400:** dados inválidos, com a mensagem em português.

Os status aceitos pela API são `recebido`, `em_preparacao`, `enviado` e `cancelado`. Na interface eles aparecem como Recebido, Em preparação, Enviado e Cancelado.

## Telas

| Rota | Perfil | Conteúdo |
|---|---|---|
| `/` | público | catálogo com pesquisa, filtros, ordenação e paginação. Os critérios ficam na URL, então a busca pode ser compartilhada ou recarregada |
| `/produtos/:id` | público | detalhes do produto. O cliente tem um botão para adicioná-lo a um novo pedido |
| `/painel/produtos` | funcionário | lista paginada com os mesmos filtros e links para editar |
| `/painel/produtos/novo`, `/painel/produtos/:id/editar` | funcionário | formulário de produto |
| `/entrar`, `/cadastro` | visitante | login e cadastro |
| `/minha-conta` | autenticado | dados pessoais (nome, CPF, telefone), endereço de entrega (clientes), alteração de senha e botão de sair |
| `/pedidos/novo` | cliente | busca no catálogo, quantidades, total estimado, endereço de entrega e caixa "Confirmo o envio para este endereço" |
| `/meus-pedidos` | cliente | lista dos próprios pedidos |
| `/pedidos/:id` | dono ou funcionário | itens, subtotais, total, status e **dados de entrega**; o funcionário também altera o status aqui |
| `/painel/pedidos` | funcionário | todos os pedidos, filtro por status e alteração de status na própria linha |

O menu muda conforme o perfil. Depois de entrar, o cliente vai para o catálogo e o funcionário para o painel de pedidos. As ações mostram mensagens de sucesso e de erro.

## Decisões de implementação

### Banco

- **Etapa 1:**
  - `users.email` é `UNIQUE COLLATE NOCASE` e o e-mail é normalizado para minúsculas, então cada e-mail identifica uma única conta.
  - `sessions` tem FK para `users` com `ON DELETE CASCADE`.
- **Etapa 2 (migration `002`):**
  - `users.role` passou a ter `CHECK (role IN ('customer','employee'))`.
  - `orders` tem `customer_id` como FK para `users` com `ON DELETE RESTRICT`, além de `status` com CHECK, `total_cents`, `created_at` e `updated_at`.
  - `order_items` tem FK para `orders` com `ON DELETE CASCADE`. Os CHECKs garantem quantidade inteira maior que 0 e preço inteiro maior ou igual a 0, como proteção extra além da validação da API.
- **Valores em centavos (inteiros)** no banco e na API, para evitar erros de arredondamento. O frontend aceita preços como `49,90`, `49.90` ou `1.234,56` e converte para centavos.
- **Total calculado no servidor** (soma de quantidade × preço) e gravado no pedido. Se o cliente enviar `totalCents`, `customerId` ou `status`, esses campos são ignorados: o pedido sempre pertence ao usuário da sessão e começa como `recebido`.
- **Pedido e itens são gravados numa única transação.**
- **Migrations:**
  - São arquivos `.sql` numerados, aplicados em ordem, cada um numa transação.
  - Durante cada migration, `foreign_keys` fica desligado e um `PRAGMA foreign_key_check` é executado ao final. Isso é necessário para recriar `users` sem disparar o `CASCADE`, que apagaria as sessões.
  - Nenhuma migration apaga dados.

### Catálogo (etapa 3)

- **Produtos:**
  - Categoria e tamanho são **texto livre**, com sugestões dos valores já cadastrados. O tamanho é gravado em maiúsculas.
  - Os filtros da interface listam os valores existentes, vindos de `/api/products/filters`.
  - Preço em centavos, de 0 a R$ 1.000.000,00. Estoque inteiro de 0 a 1.000.000. O banco também tem CHECKs.
- **Pesquisa:**
  - O termo é normalizado: minúsculas, sem acentos e com espaços compactados.
  - Cada palavra precisa aparecer no nome ou na descrição. Por isso `colecao d'agua` encontra "Coleção D'Água".
  - A busca usa uma coluna derivada `search_text`, mantida pela aplicação em cada cadastro e edição.
  - O valor vai sempre como parâmetro de consulta, e os curingas `%`, `_` e `\` são escapados. Apóstrofos, aspas e símbolos são tratados como texto comum.
- **Filtros combinados:** todos os critérios usam `AND`. A comparação de categoria e tamanho ignora maiúsculas.
- **Erros de parâmetro:** preço mínimo maior que o máximo, valores inválidos, ordenação ou página inválidas respondem 400 com a mensagem.
- **Ordenação:**
  - Por nome, usando o nome normalizado (coluna `sort_name`).
  - Por preço, com desempate pelo nome.
- **Paginação:** página além da última devolve lista vazia, com `total` e `totalPages` corretos.
- **Leitura não modifica dados:** as rotas GET só fazem SELECT. Um teste compara a tabela inteira antes e depois das consultas.
- **Texto simples:** nomes e descrições são exibidos pelo React como texto (escapado), nunca como HTML. As quebras de linha da descrição são preservadas via CSS.
- **Produtos não são excluídos** nesta etapa, apenas cadastrados e editados. A FK `order_items.product_id` usa `ON DELETE SET NULL` por segurança.

### Pedidos a partir do catálogo (etapa 3)

- **O cliente envia só `{productId, quantity}`.** O servidor busca nome e preço atuais no catálogo e calcula o total. Preço ou total enviados pelo cliente são ignorados.
- **Snapshot:** cada item grava `product_id`, nome (coluna `description`), quantidade e preço praticado (`unit_price_cents`). Editar o produto depois não altera pedidos já feitos, e um teste cobre isso.
- **Produto repetido** no mesmo pedido tem as quantidades somadas.
- **Estoque:** não há reserva nem baixa. Mesmo assim, o pedido é recusado se o produto está esgotado ou se a quantidade passa do estoque atual, com a mensagem correspondente.

### Conta e entrega (etapa 4)

- **Formato dos dados:**
  - CPF, telefone e CEP são guardados só com dígitos. A interface aceita e exibe máscaras (`000.000.000-00`, `(00) 00000-0000`, `00000-000`).
  - O CPF é validado pelos dígitos verificadores, e sequências repetidas são recusadas.
  - CPF é único entre contas (índice único parcial).
  - Telefone tem 10 ou 11 dígitos, com DDD.
  - Estado é uma das 27 UFs.
  - CPF e telefone são **opcionais** na conta. O telefone passa a ser obrigatório só para finalizar um pedido, porque faz parte da cópia de entrega.
- **Endereço:**
  - Um endereço por usuário (tabela `addresses`, com chave `user_id`).
  - O formulário de endereço aparece só para clientes. Funcionários editam nome, CPF, telefone e senha.
- **Isolamento:**
  - As rotas `/api/account/*` não recebem id: sempre operam sobre o usuário da sessão. Por isso, ninguém consulta ou altera dados de outra conta.
  - O CPF só sai em `GET`/`PUT /api/account` da própria conta. Ele não aparece em `/api/me`, nos pedidos, nas listas do funcionário nem em nenhuma outra resposta.
- **Finalizar pedido:**
  - O servidor exige endereço cadastrado, telefone e `confirmShipping: true`.
  - A tela também envia `addressUpdatedAt`, a versão do endereço que o cliente viu. Se o endereço mudou depois disso (por exemplo, em outra aba), o servidor responde **409** e pede nova confirmação.
- **Cópia da entrega:** os dados de entrega são copiados para colunas `shipping_*` do próprio pedido (destinatário, telefone, CEP, logradouro, número, complemento, bairro, cidade e UF). Alterar a conta ou o endereço depois não muda pedidos anteriores.
- **Funcionários** veem os dados de entrega na tela de detalhes de qualquer pedido. A lista do painel também mostra nome e e-mail do cliente, mas nunca o CPF.
- **Alteração de senha:**
  - Exige a senha atual correta. A nova senha precisa ter de 8 a 128 caracteres e ser diferente da atual.
  - A nova senha passa a valer imediatamente: logins novos aceitam a nova e rejeitam a antiga.
  - A sessão atual continua ativa, e as **demais sessões da conta são encerradas**.
  - Nenhuma resposta contém senha ou hash.

### Regras de acesso

- Clientes só veem os próprios pedidos. Um pedido de outra pessoa responde **404**, e não 403, para não revelar que ele existe.
- Funcionários não criam pedidos, porque o pedido precisa pertencer a um cliente.
- **Contas de funcionário** não podem ser criadas pelo cadastro público nem por nenhuma rota da API. Nesta etapa, elas só existem pelo seed de demonstração ou por alteração direta no banco (`UPDATE users SET role='employee' WHERE email=...`).
- **Mudança de status:** o funcionário pode escolher qualquer um dos 4 status, inclusive voltar um status. Nenhum fluxo obrigatório foi definido, e a data da última mudança fica em `updated_at`.

### Limites de validação

- 1 a 50 itens por pedido.
- Quantidade de 1 a 10.000 por item, limitada também ao estoque atual.
- Produto: nome com até 120 caracteres, descrição com até 2000, categoria com até 60 e tamanho com até 20.
- Preço de R$ 0,00 a R$ 1.000.000,00. Preço zero é permitido, por exemplo para brindes.

### Mantido da etapa 1

- Senhas guardadas com scrypt e salt.
- Sessão no servidor com cookie `HttpOnly`/`SameSite=Lax` e validade de 7 dias; no banco fica só o hash do token.
- Sair apaga a sessão no banco.
- Mensagem genérica de login inválido.
- O Express serve `frontend/dist` em produção, e o Vite repassa `/api` em desenvolvimento.

## Verificações executadas

Todas foram feitas em Windows 11 com Node 24.16.0, nesta etapa:

- `npm run typecheck`: sem erros no frontend, no backend e nos testes do backend.
- `npm run build`: o backend compilou com `tsc` e o frontend com `tsc` + `vite build`.
- `npm test`: **8 testes, todos passaram.**
  - **Autenticação (etapa 1):** cadastro, e-mail duplicado, credenciais erradas, `/api/me` e logout.
  - **Pedidos (etapas 2 e 3):**
    - validações de itens;
    - preço vem do catálogo;
    - cópia de nome e preço do item;
    - isolamento entre clientes e permissões de status;
    - seed idempotente.
    - Nesta etapa, o pedido de teste também envia a confirmação de entrega.
  - **Migrations:**
    - `002` preserva usuários e sessões;
    - num banco da etapa 2 com pedido manual, `003` e `004` mantêm o pedido com valores originais, `productId: null` e `shipping: null`.
  - **Catálogo e produtos (etapa 3):** paginação, pesquisa com apóstrofo e acentos, filtros combinados, ordenações, leitura sem alterar dados, permissões e validações.
  - **CPF:** dígitos verificadores, com CPF errado e sequência repetida recusados.
  - **Minha conta e entrega:**
    - visitante 401 em todas as rotas de conta;
    - conta nova sem endereço não consegue finalizar pedido;
    - validações de nome, CPF e telefone, e CPF duplicado em outra conta dá 409;
    - máscaras aceitas e gravadas só com dígitos;
    - `/api/me` sem CPF;
    - validações de cada campo do endereço;
    - pedido sem confirmação dá 400, e com versão do endereço desatualizada dá 409;
    - pedido confirmado grava a cópia de entrega;
    - **alterar endereço e telefone depois não muda o pedido**;
    - funcionário vê a entrega, mas o CPF não aparece no detalhe nem na lista;
    - cada cliente vê só os próprios dados;
    - troca de senha:
      - senha atual errada é recusada, e nova senha curta também;
      - a resposta não contém senha nem hash;
      - a sessão atual continua e as outras sessões são encerradas;
      - login com a senha antiga dá 401 e com a nova dá 200;
    - pedidos demo têm entrega;
    - seed repetido não duplica endereços.
  - **Persistência em arquivo:** dados alterados (endereço, CPF) continuam lá ao fechar e reabrir o banco.
- **Atualização real de banco:** um arquivo SQLite foi montado no formato da etapa 3 (migrations 001 a 003, um usuário e um pedido manual de R$ 37,00).
  - O `npm run db:seed` aplicou a `004` e criou 3 contas, 18 produtos, 4 pedidos e 2 endereços.
  - Rodar de novo criou 0 produtos e 0 pedidos, e continuaram 2 endereços.
  - Com o servidor de produção (`node backend/dist/server.js`), via HTTP:
    - a conta da Carla mostrou CPF, telefone e endereço;
    - pedido sem confirmação deu 400;
    - pedido confirmado gravou a entrega;
    - o endereço foi alterado;
    - o funcionário viu a entrega de um pedido demo, sem o CPF na resposta;
    - o pedido antigo continuou com total 3700 e `shipping: null`;
    - a troca de senha com a senha atual errada foi recusada e a correta funcionou.
  - **Servidor reiniciado:**
    - login com a senha antiga deu 401 e com a nova deu 200;
    - CPF e endereço alterado continuavam salvos;
    - a SPA respondeu em `/minha-conta`.
- `npm run dev`: o Vite respondeu em :5173 e o proxy chegou ao backend (`/api/account` deu 401 sem login, como esperado).

## Limitações

- **As telas não foram testadas visualmente num navegador** (nem manual, nem automaticamente). A interface foi verificada pela compilação TypeScript/Vite, e o fluxo de ponta a ponta foi testado via HTTP.
- Não há lint configurado nem testes de frontend.
- Não há tela nem comando para criar funcionários além do seed. Fora da demonstração, é preciso alterar o banco diretamente.
- **As telas das etapas 3 e 4 também não foram abertas num navegador:** catálogo, detalhes, painel de produtos, novo pedido com seleção do catálogo e confirmação de entrega, e as seções de "Minha conta".
- Não há exclusão nem desativação de produtos. Também não há imagens, variações de um mesmo modelo em vários tamanhos (cada tamanho é um produto) nem baixa ou reserva de estoque.
- A pesquisa usa `LIKE` sobre texto normalizado, sem índice de texto completo. Isso basta para o volume desta etapa.
- Não há paginação nas listas de pedidos, histórico de mudanças de status, edição ou exclusão de pedidos.
- Não há limite de tentativas de login, recuperação de senha nem confirmação de e-mail.
- **Endereço e e-mail:**
  - Há um único endereço por cliente; para enviar a outro local, o cliente altera o endereço antes de finalizar.
  - O CEP não é consultado em nenhum serviço externo, então os campos são preenchidos manualmente.
  - O e-mail da conta não pode ser alterado.
- O CPF fica guardado em texto no banco, sem criptografia em repouso. A proteção está no controle de acesso da API.
- Use `COOKIE_SECURE=true` atrás de HTTPS.
