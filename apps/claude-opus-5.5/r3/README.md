# VesteBem — Etapa 4: conta do cliente e entrega

Aplicação web da loja de roupas VesteBem, em português brasileiro, com frontend React e backend Express sobre um banco SQLite local.

| Etapa | O que foi implementado |
|---|---|
| 1 | Cadastro, login, "Minha conta" e sair. |
| 2 | Perfis **cliente** e **funcionário**; pedidos com status; "Meus pedidos"; painel de pedidos. |
| 3 | Catálogo público com pesquisa, filtros, ordenação e 12 produtos por página; página do produto; painel de produtos; pedidos montados a partir do catálogo. |
| 4 | "Minha conta" com nome, CPF, telefone, endereço de entrega e alteração de senha. O pedido exige endereço confirmado e guarda uma **cópia** dos dados de entrega. |

## Requisitos e versões

| Item | Versão usada |
|---|---|
| Node.js | 24 LTS (testado com 24.16.0); é necessário ≥ 24 |
| npm | 11.8.0 |
| TypeScript | 5.9.3 (`strict: true` no frontend e no backend) |
| React / React DOM | 19.3.1 |
| Vite | 8.3.6 (+ @vitejs/plugin-react 6.2.1) |
| React Router | 7.18.5 |
| Express | 5.x |
| SQLite | módulo nativo `node:sqlite` do Node 24 (arquivo local) |

Não há dependências nativas para compilar nem serviços externos de autenticação, banco, CEP ou hospedagem. Nenhuma dependência foi adicionada nesta etapa.

## Como executar o sistema completo

Na raiz do repositório:

```bash
npm run install:all   # 1. instala as dependências do backend e do frontend
npm run db:seed       # 2. cria o banco (aplica as migrations) e os dados de demonstração
npm run build         # 3. compila backend e frontend
npm start             # 4. abre em http://localhost:3000
```

Depois, entre com uma das contas de demonstração listadas abaixo.

### Todos os comandos

| Comando | O que faz |
|---|---|
| `npm run install:all` | Instala as dependências do backend e do frontend. |
| `npm run db:migrate` | Cria ou atualiza `backend/data/vestebem.db`, aplicando só as migrations pendentes. |
| `npm run db:seed` | Prepara os dados fictícios de demonstração. Pode ser repetido. |
| `npm run dev` | Desenvolvimento: API em http://localhost:3000 e interface em http://localhost:5173. Encerre com Ctrl+C. |
| `npm run typecheck` | Verificação de tipos do backend e do frontend, incluindo os testes. |
| `npm run build` | Gera `backend/dist` e `frontend/dist`. |
| `npm start` | Produção: API e interface compilada em http://localhost:3000. |
| `npm test` | Testes de integração: API, migrations, seed e persistência. |

O servidor e o `db:seed` aplicam as migrations pendentes ao iniciar.

Variáveis de ambiente opcionais:

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | 3000 | Porta do servidor. |
| `DB_PATH` | `backend/data/vestebem.db` | Caminho do arquivo do banco. |
| `COOKIE_SECURE` | — | Defina como `true` ao servir via HTTPS. |

**Banco de uma etapa anterior:** basta rodar `npm run db:migrate` (ou iniciar o servidor) e, se quiser os dados de demonstração novos, `npm run db:seed`. Nenhum registro é apagado.

## Dados de demonstração (todos fictícios)

`npm run db:seed` cria 18 produtos e as contas abaixo. Todas usam a senha `demo1234`.

| Perfil | E-mail | CPF | Telefone | Endereço | Pedidos |
|---|---|---|---|---|---|
| Cliente | `ana@demo.vestebem` | 123.456.789-09 | (11) 90000-0001 | Rua Fictícia das Flores, 100, Apto 12 — São Paulo/SP | 2 |
| Cliente | `bruno@demo.vestebem` | 987.654.321-00 | (21) 90000-0002 | Avenida Imaginária, 2000 — Rio de Janeiro/RJ | 2 |
| Cliente | `daniela@demo.vestebem` | — | — | **sem endereço** | 0 |
| Funcionário | `carlos@demo.vestebem` | — | (31) 90000-0003 | — | — |

- **Nomes e endereços:** levam "(demo)" ou nomes como "Rua Fictícia" e "Avenida Imaginária". Os CEPs são genéricos (`01000-000`, `20000-000`).
- **CPFs:** são os números de exemplo amplamente usados em documentação (`123.456.789-09`, `987.654.321-00`). Eles têm dígitos verificadores válidos, para passar na validação, mas não identificam pessoas destes dados.
- **Telefones:** usam a série `9 0000-000x`.
- **Pedidos:** os da Ana e do Bruno são criados já com a cópia da entrega.

**O que dá para experimentar:**
- Com a **Daniela**, a finalização do pedido fica bloqueada até ela cadastrar endereço e telefone em "Minha conta".
- Com a **Ana**:
  - alterar nome, CPF, telefone e endereço;
  - fazer um pedido confirmando o endereço;
  - mudar o endereço e ver que o pedido anterior não muda;
  - trocar a senha.
- Com o **Carlos**, ver os dados de entrega nos detalhes de cada pedido, sem CPF.

**Execução repetida não duplica nada:**

| Registro | Identificado por | O que acontece se já existe |
|---|---|---|
| Produto | nome + tamanho | Nada. |
| Conta | e-mail | Nada é recriado. Só são **preenchidos os dados ausentes**: CPF (se vazio e não usado por outra conta), telefone (se vazio) e endereço (se não houver). |

Valores alterados pelo usuário nunca são sobrescritos. Num banco de etapa anterior, o seed completa CPF, telefone e endereço das contas de demonstração e cria a Daniela. Os pedidos antigos continuam sem dados de entrega.

Para voltar ao estado inicial, apague a pasta `backend/data/` e rode `npm run db:seed`. Se você trocou a senha de uma conta de demonstração, o seed não a restaura. **Não use essas credenciais em produção.**

## Banco de dados

### Tabelas

- **`users`:**
  - colunas: `id`, `name`, `email` (`UNIQUE`, `COLLATE NOCASE`), `password_hash`, `role` (`cliente` ou `funcionario`), `created_at`;
  - novas nesta etapa: `cpf` (11 dígitos ou `NULL`, único quando preenchido) e `phone` (10–11 dígitos ou `NULL`).
- `sessions`: `token_hash` (`UNIQUE`), `user_id` → `users(id)` com `ON DELETE CASCADE`, `expires_at`.
- **`addresses`** *(nova)*:
  - `user_id` é a chave primária, ou seja, um endereço por usuário, e referencia `users(id)` com `ON DELETE CASCADE`;
  - demais colunas: `recipient`, `cep` (8 dígitos), `street`, `number`, `complement` (opcional), `district`, `city`, `updated_at`;
  - `state` só aceita as 27 UFs (restrição `CHECK`).
- `products`: `id`, `name`, `description`, `category`, `size`, `price_cents` (`>= 0`), `stock` (inteiro `>= 0`).
- **`orders`:**
  - colunas: `id`, `customer_id`, `status`, `total_cents`, `created_at`, `updated_at`;
  - novas nesta etapa: `ship_recipient`, `ship_phone`, `ship_cep`, `ship_street`, `ship_number`, `ship_complement`, `ship_district`, `ship_city`, `ship_state`. São a **cópia** da entrega e ficam `NULL` nos pedidos anteriores.
- `order_items`: `product_id` (opcional), `description` (nome na compra), `quantity`, `unit_price_cents` (preço na compra).

### Migrations

| Arquivo | Conteúdo |
|---|---|
| `001_init.sql` | Usuários e sessões. |
| `002_roles_and_orders.sql` | Perfis e pedidos. |
| `003_products.sql` | Catálogo e vínculo dos itens com produtos. |
| `004_profile_address_shipping.sql` | Dados pessoais, endereço e cópia da entrega. |

A `004` só usa `ALTER TABLE ... ADD COLUMN` e `CREATE TABLE`/`INDEX`; nenhuma tabela é recriada. O executor aplica cada arquivo numa transação e valida as chaves estrangeiras antes do `COMMIT`.

## Regras e API

### Conta (sempre do usuário da sessão)

| Rota | Função |
|---|---|
| `GET /api/account` | Nome, e-mail, perfil, CPF, telefone e endereço. Nunca inclui a senha. |
| `PUT /api/account/profile` | Recebe `{ name, cpf, phone }`. E-mail e perfil não podem ser alterados; campos extras são ignorados. |
| `PUT /api/account/address` | Recebe o endereço completo. Cria ou atualiza o único endereço do usuário. |
| `PUT /api/account/password` | Recebe `{ currentPassword, newPassword }` e responde 204 sem corpo. |

- Nenhuma rota recebe o id de um usuário. Por isso, cada pessoa só lê e altera os próprios dados; um visitante recebe 401.
- **Validações:**
  - **CPF:** dígitos verificadores corretos, sem sequências repetidas como `111.111.111-11`, e único entre contas.
  - **Telefone:** DDD mais 8 dígitos (fixo) ou 9 dígitos começando com 9 (celular).
  - **CEP:** 8 dígitos.
  - **Estado:** uma das 27 UFs.
  - **Campos obrigatórios:** têm limite de tamanho; o complemento é opcional.
  - A interface aceita máscara, como `123.456.789-09` ou `(11) 90000-0001`, mas o banco guarda só os dígitos.
- CPF e telefone podem ser apagados, enviando o campo vazio.
- **Troca de senha:**
  - exige a senha atual correta; a nova precisa ter 8–128 caracteres e ser diferente da atual;
  - depois da troca, o login aceita só a nova senha;
  - as **outras sessões da conta são encerradas**, e a sessão atual continua ativa.

### Pedidos e entrega

`POST /api/orders` recebe `{ items: [{ productId, quantity }], confirmShipping: true }`.

- **Para finalizar, o cliente precisa:**
  - ter um endereço cadastrado;
  - ter um telefone na conta, já que o pedido guarda o telefone de contato;
  - enviar `confirmShipping: true`, que corresponde à caixa "Confirmo a entrega neste endereço". Qualquer outro valor é recusado.
- **Cópia da entrega:** o servidor copia o destinatário, o telefone e o endereço **atuais** para dentro do pedido. Alterações posteriores na conta não mudam pedidos já feitos.
- **Detalhes do pedido** (`GET /api/orders/:id`): o dono e os funcionários recebem `shipping` com destinatário, telefone e endereço. Em pedidos anteriores a esta etapa, `shipping` vem `null`, e a tela mostra "Este pedido não possui informações de entrega registradas".
- **CPF fora dos pedidos:** as consultas de pedidos nunca leem a coluna `cpf`. Os funcionários veem só o nome e o e-mail do cliente e os dados de entrega.
- As demais regras continuam iguais (preço do catálogo, total no servidor, cliente vê só os próprios pedidos, funcionário altera o status).

## Decisões de implementação

### Etapa 4

- **Telefone:** fica nos dados pessoais da conta e é copiado para o pedido. O destinatário fica no endereço, porque pode ser outra pessoa.
- **Um endereço por cliente**, como pedido ("um endereço de entrega"), cadastrado e atualizado no mesmo formulário.
- **Confirmação do endereço:** a tela de novo pedido mostra o endereço e o telefone atuais e uma caixa de confirmação. O botão "Criar pedido" só é habilitado depois de marcá-la. O backend também exige a confirmação.
- **Cópia em colunas da tabela `orders`**, em vez de referência ao endereço, para que mudanças futuras na conta não alterem os pedidos.
- **CPF:** é opcional para fazer pedidos, porque o pedido não o exige. Ele é visível só para o próprio usuário, e o painel do funcionário não o mostra. O funcionário tem a mesma página "Minha conta".
- **Sem consulta automática de CEP**, para não usar integrações externas. O usuário preenche o endereço manualmente.
- **Encerramento de outras sessões na troca de senha:** é uma medida de segurança comum. A sessão em uso continua ativa, para não forçar um novo login.
- **"Minha conta"** tem três formulários independentes (dados pessoais, endereço, senha), cada um com suas mensagens de sucesso e erro. Alterar o nome atualiza o cabeçalho na hora.
- **`scripts/dev.mjs`:** no Windows, ao ser encerrado, agora derruba a árvore inteira de processos com `taskkill /T`. Antes, um `node --watch` órfão podia continuar rodando; veja "Verificações".

### Etapas anteriores (mantidas)

- **Catálogo:**
  - a pesquisa usa parâmetros vinculados e ignora acentos e maiúsculas, com a função SQL `fold()`;
  - os filtros são combinados com E;
  - cada produto tem um tamanho;
  - o estoque é conferido no pedido, sem reserva nem baixa;
  - não há exclusão de produtos.
- **Pedidos:** os itens guardam o nome e o preço da compra. Pedido de outro cliente devolve 404. Funcionário não cria pedidos. O status pode ser alterado livremente.
- **Funcionários** só são criados pelo seed ou com acesso direto ao banco. O cadastro público cria apenas clientes.
- **Sessões:** cookie `HttpOnly` com `SameSite=Lax` e validade de 7 dias; o banco guarda só o hash do token.
- **Senhas:** guardadas com `scrypt`.
- **Valores:** em centavos inteiros.
- **Versões e lockfiles:** foi usado o TypeScript 5.9 em vez da 7.x. Há um `package-lock.json` por pacote.

## Verificações executadas (Windows 11, Node 24.16.0)

### Comandos

- `npm run typecheck`: OK, sem erros.
- `npm run build`: OK.
- `npm test`: os **8 testes passaram**.

### Testes automatizados

- **CPF:** dígitos verificadores válidos e inválidos.
- **Minha conta:**
  - visitante recebe 401 em todas as rotas de conta;
  - são recusados CPF inválido, telefone inválido e nome vazio;
  - `role` e `email` enviados são ignorados;
  - CPF repetido em outra conta é recusado;
  - endereço: são recusados CEP e UF inválidos e logradouro vazio; complemento vazio vira nulo; a atualização não duplica o endereço;
  - Bob não vê os dados nem o CPF da Ana;
  - troca de senha: são recusadas senha atual errada, nova curta e nova igual à atual; a troca devolve 204 sem corpo; a sessão atual continua e a outra é encerrada; a senha antiga é rejeitada e a nova aceita no login;
  - **após "reiniciar"**, ou seja, fechar o banco e abrir um servidor novo sobre o mesmo arquivo, CPF, telefone, endereço e nova senha continuavam valendo.
- **Seed:**
  - cria 2 endereços e 4 pedidos com entrega;
  - a segunda execução não muda nenhuma contagem;
  - não sobrescreve um endereço alterado;
  - a Daniela fica sem CPF, telefone e endereço.
- **Pedidos:**
  - sem endereço, sem telefone ou sem confirmação (inclusive `confirmShipping: "sim"`), o pedido é recusado com 400;
  - a cópia da entrega corresponde ao endereço e telefone do momento da compra;
  - depois de mudar endereço, nome e telefone na conta, o pedido continua igual;
  - as respostas de pedidos ao funcionário não contêm o CPF nem a palavra "cpf".
- **Migrations:** sobre bancos das etapas 1 e 2, todos os dados são preservados e os pedidos antigos ficam com `ship_recipient` nulo.
- As regras de catálogo e de conta das etapas 1–3 continuam passando.

### Atualização ponta a ponta de um banco da etapa 3

Usei o banco da verificação anterior, que tem um pedido da etapa 2 com item manual.

1. **Seed:** rodei `npm run db:seed` duas vezes. A primeira aplicou a `004`, completou CPF, telefone e endereço da Ana e do Bruno, o telefone do Carlos, e criou a Daniela. A segunda não fez nada.
2. **`npm start` com testes via `curl`:**
   - a Daniela foi bloqueada com a mensagem pedindo endereço (400);
   - a Ana foi bloqueada sem confirmação (400) e conseguiu pedir confirmando (201);
   - depois, a Ana mudou o endereço;
   - o Carlos viu, nos detalhes do pedido novo, a entrega com o endereço **antigo**, sem CPF na resposta;
   - o pedido legado mostrou o item e o total originais, com `shipping: null`;
   - a troca de senha da Ana foi recusada com a senha atual errada (400) e aceita com a correta (204).
3. **Após reiniciar o servidor:**
   - a senha antiga foi recusada (401) e a nova aceita (200);
   - CPF, telefone e endereço da Ana continuavam salvos;
   - o pedido manteve o endereço da compra;
   - `/minha-conta`, `/pedidos/novo` e `/pedidos/7` serviram a SPA (200).

### Banco vazio

`npm run db:migrate` aplicou as migrations 001–004. Em seguida, `npm run db:seed` criou 4 usuários, 2 endereços, 18 produtos e 4 pedidos com entrega.

### Modo desenvolvimento e o problema de `DB_PATH` da etapa 3

`npm run dev` com `DB_PATH` apontando para um banco de teste respondeu pelo Vite com os dados desse banco, sem criar `backend/data`. Ao encerrar, nenhum processo ficou para trás.

O problema relatado na etapa 3 foi causado pela forma como eu encerrava os testes: eu parava só o servidor e deixava processos `node --watch` órfãos. Um deles continuava rodando sem `DB_PATH`, provavelmente ocupando a porta 3000, e recriou o banco padrão vazio. Encerrei esses processos e mudei o `scripts/dev.mjs` para derrubar a árvore de processos no Windows.

### Observações sobre os testes manuais

- Ao enviar acentos com `curl -d` pelo Git Bash do Windows, os acentos chegaram corrompidos, porque o argumento usa a página de código do Windows e não UTF-8. Isso afeta só o teste manual. Os dados vindos do seed e dos testes automatizados, como "São Paulo" e "Rua Fictícia", foram gravados e lidos corretamente.
- Um teste novo travou na primeira execução, porque o `server.close()` esperava conexões keep-alive. O teste foi corrigido para encerrar essas conexões.

## Limitações

- **Não houve teste no navegador**, nem automatizado nem manual. As telas e o layout responsivo foram verificados só por typecheck e build, e a API com testes e `curl`.
- Há apenas um endereço por cliente e não há consulta automática de CEP. O CEP não é conferido contra a cidade.
- A validação de CPF confere só os dígitos verificadores; não há consulta a bases oficiais.
- Não há recuperação de senha, nem limite de tentativas de login ou de troca de senha.
- O seed não restaura dados alterados das contas de demonstração, como senha, CPF ou endereço modificados; para isso, apague `backend/data/`.
- Continuam valendo as limitações das etapas anteriores:
  - não há histórico de status nem cancelamento pelo cliente;
  - não existe tela para criar funcionários;
  - a pesquisa percorre a tabela inteira;
  - não há reserva nem baixa de estoque;
  - o seed não é atômico.
