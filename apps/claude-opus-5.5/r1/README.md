# VesteBem — Etapa 4 (dados pessoais, endereço e entrega)

Aplicação web da loja de roupas VesteBem.

- **Etapa 1:** cadastro, login, "Minha conta" e sair da conta.
- **Etapa 2:** perfis cliente/funcionário, criação de pedidos pelo cliente, "Meus pedidos", detalhes do pedido e painel do funcionário para listar todos os pedidos e alterar status.
- **Etapa 3:** catálogo público de produtos (paginação de 12, pesquisa, filtros, ordenação e página de detalhes), painel para funcionários cadastrarem e atualizarem produtos, e pedidos montados a partir do catálogo.
- **Etapa 4:** "Minha conta" ampliada (nome, CPF e telefone; endereço de entrega; alteração de senha) e pedidos com cópia dos dados de entrega confirmados pelo cliente.

## Executar o sistema completo (do zero)

```bash
npm run install:all   # dependências do backend e do frontend
npm run db:seed       # cria o banco (backend/data/vestebem.db), aplica migrations e dados de demonstração
npm run build         # compila backend e frontend
npm start             # http://localhost:3000
```

Para desenvolvimento, use `npm run dev` (frontend em http://localhost:5173). As credenciais de demonstração estão na seção "Dados de demonstração".

## Requisitos e versões utilizadas

| Item | Versão |
|---|---|
| Node.js | 24 LTS (testado com 24.16.0) — usa o módulo nativo `node:sqlite` |
| npm | 11 (testado com 11.8.0) |
| TypeScript | 7.0.2 (`strict: true` no frontend e no backend) |
| React / React DOM | 19.3.1 |
| Vite | 8.3.6 (+ `@vitejs/plugin-react` 6.2.1) |
| Express | 5.3.0 |
| SQLite | embutido no Node.js (`node:sqlite`), arquivo local |

Nenhum serviço externo é usado. As etapas 2 e 3 não adicionaram dependências.

## Estrutura

```
package.json          scripts de conveniência (sem dependências)
scripts/dev.mjs       inicia backend e frontend juntos em modo dev
backend/              API Express + SQLite (package.json + package-lock.json próprios)
  migrations/         scripts SQL versionados
    001_criar_usuarios_e_sessoes.sql
    002_perfis_e_pedidos.sql
    003_catalogo_produtos.sql
    004_dados_pessoais_e_entrega.sql
  src/
    app.ts            rotas da API e controle de acesso
    conta.ts          validação/gravação de dados pessoais (CPF, telefone) e endereço; dados de entrega
    pedidos.ts        validação, cálculo do total e consultas de pedidos
    produtos.ts       validação, pesquisa/filtros/ordenação/paginação e gravação de produtos
    db.ts             conexão e executor de migrations
    seed-demo.ts      dados de demonstração (seed-cli.ts = comando)
  test/               testes de integração (contas, pedidos, catálogo, migrations, seed)
  data/vestebem.db    banco (criado automaticamente; ignorado no git)
frontend/             React + Vite (package.json + package-lock.json próprios)
  src/App.tsx         layout, navegação e roteamento por perfil
  src/conta.tsx       cadastro, login e "Minha conta" (dados pessoais, endereço, senha)
  src/pedidos.tsx     novo pedido (seleção do catálogo), "Meus pedidos", detalhes e painel de pedidos
  src/catalogo.tsx    catálogo, detalhes do produto, painel e formulário de produtos
```

## Comandos (executar na raiz)

```bash
npm run install:all   # instala dependências (npm ci em backend/ e frontend/)
npm run db:migrate    # cria/atualiza o banco aplicando as migrations pendentes
npm run db:seed       # aplica migrations e cria os dados de demonstração (idempotente)
npm run dev           # desenvolvimento: API em :3000 e Vite em http://localhost:5173 (proxy /api)
npm run typecheck     # verificação de tipos (backend, testes e frontend)
npm run build         # compila o backend (backend/dist) e o frontend (frontend/dist)
npm start             # produção: http://localhost:3000 (API + frontend compilado)
npm test              # testes de integração do backend
```

Variáveis de ambiente opcionais: `PORT` (padrão 3000), `DB_PATH` (padrão `backend/data/vestebem.db`) e `COOKIE_SECURE=true`, que marca o cookie como `Secure` (use quando o site estiver atrás de HTTPS).

O servidor aplica as migrations pendentes ao iniciar, portanto `npm run db:migrate` é opcional.

### Atualizando um banco de etapa anterior

Basta executar `npm run db:migrate` (ou iniciar o servidor). As migrations pendentes são aplicadas sem apagar registros:
- **002**: mantém usuários e sessões; os usuários existentes continuam como `cliente`.
- **003**: cria a tabela `produtos` e adiciona `itens_pedido.produto_id`, que fica `NULL` nos itens antigos. Os pedidos anteriores continuam com o nome, a quantidade e o preço originais.
- **004**: só adiciona colunas e tabelas.
  - `usuarios` ganha `cpf` e `telefone`, que ficam `NULL` nas contas existentes.
  - É criada a tabela `enderecos`.
  - `pedidos` ganha as colunas `entrega_*`, que ficam `NULL` nos pedidos existentes. Esses pedidos são exibidos como "sem informações de entrega registradas".

Depois disso, `npm run db:seed` pode ser executado para acrescentar os produtos de demonstração.

## Dados de demonstração

Procedimento:

```bash
npm run install:all
npm run db:seed      # pode ser executado novamente sem duplicar nada
npm run build
npm start            # acesse http://localhost:3000
```

| Perfil | E-mail | Senha |
|---|---|---|
| Cliente | `cliente1@vestebem.demo` | `demo1234` |
| Cliente | `cliente2@vestebem.demo` | `demo1234` |
| Cliente sem endereço | `cliente3@vestebem.demo` | `demo1234` |
| Funcionário | `funcionario@vestebem.demo` | `demo1234` |

Todos os dados pessoais de demonstração são **fictícios**:
- nomes marcados com "(demo)" e e-mails no domínio `.demo`;
- telefones no padrão `(DD) 90000-000N`;
- endereços inventados, como "Rua Fictícia das Flores" e "Avenida Imaginária";
- CPFs gerados a partir das bases `900000001` e `900000002`, com dígitos verificadores calculados para passar na validação.

Como experimentar:
- `cliente1` e `cliente2` já têm CPF, telefone e endereço, e seus pedidos de demonstração guardam os dados de entrega.
- `cliente3` não tem endereço nem telefone. Use essa conta para ver o bloqueio ao finalizar um pedido e para cadastrar os dados em "Minha conta".
- O funcionário tem só telefone; funcionários não cadastram endereço.

Nas reexecuções, as contas demo existentes recebem apenas os dados que estiverem vazios. Uma alteração feita pelo usuário (CPF, telefone, endereço ou senha) nunca é sobrescrita, e nada é duplicado.

O seed cria **18 produtos fictícios** em 7 categorias:
- Camisetas, Calças, Bermudas, Vestidos, Saias, Casacos e Acessórios;
- tamanhos P, M, G, GG, 38, 40, 42 e Único;
- preços de R$ 15,90 a R$ 259,90;
- dois produtos sem estoque;
- dois produtos da "Coleção D'Água", para testar a pesquisa com apóstrofo.

Cada cliente recebe 2 pedidos fictícios com itens do catálogo e status variados.

Nada é duplicado ao executar de novo:
- **Produtos**: identificados pelo nome. Um produto demo que já existe não é alterado nem duplicado, mesmo que um funcionário o tenha editado. Se um produto demo for renomeado, a próxima execução cria um novo com o nome original.
- **Contas e pedidos**: a idempotência funciona pelo e-mail: se a conta demo já existe, ela e seus pedidos são mantidos como estão, sem recriação, duplicação ou redefinição de senha. Os pedidos de demonstração só são criados junto com a conta demo. Para recriar do zero, apague `backend/data/` e execute `npm run db:seed` de novo.

## Decisões de implementação

### Etapa 1
- **SQLite via `node:sqlite`** (nativo do Node 24): evita dependências com compilação nativa.
- **Migrations**: arquivos `.sql` numerados, aplicados em ordem e registrados em `schema_migrations`. Cada um roda em uma transação.
- **E-mail**: único (`UNIQUE COLLATE NOCASE`) e normalizado para minúsculas.
- **Senha**: de 8 a 128 caracteres, guardada com `scrypt` (salt por usuário) e nunca retornada pela API. A mensagem de erro do login é genérica, e o tempo de resposta é equalizado para e-mails inexistentes.
- **Sessão**: token aleatório em cookie `HttpOnly` e `SameSite=Strict`, válido por 7 dias. O banco guarda só o hash SHA-256 do token. Sair apaga aquela sessão no banco.
- **CSRF**: além de `SameSite=Strict`, as mutações exigem `Content-Type: application/json`.

### Etapa 2
- **Perfis**: a coluna `usuarios.perfil` aceita `cliente` ou `funcionario`. Como o SQLite não altera `CHECK` diretamente, a migration 002 recria a tabela `usuarios` copiando todos os registros, seguindo o procedimento recomendado pelo SQLite.
  - O executor de migrations desliga `foreign_keys` durante cada migration. Isso evita que o `DROP TABLE` dispare `ON DELETE CASCADE` nas sessões.
  - Antes do `COMMIT`, o executor roda `PRAGMA foreign_key_check`.
- **Criação de funcionários**: o cadastro público sempre grava `cliente` e ignora qualquer `perfil` enviado. Não existe endpoint para mudar o perfil. Funcionários só são criados por comando local (hoje, o seed). Uma tela de gestão de funcionários não fazia parte desta etapa.
- **Pedidos**: tabela `pedidos` com `id`, `cliente_id` (FK `ON DELETE RESTRICT`), `status`, `total_centavos`, `criado_em` e `atualizado_em`. Tabela `itens_pedido` com `descricao`, `quantidade` e `preco_unitario_centavos` (FK `ON DELETE CASCADE`).
  - Restrições `CHECK` no banco reforçam as regras: status válido, quantidade inteira maior que 0 e preço inteiro maior ou igual a 0.
- **Dinheiro em centavos (inteiros)**: evita erros de ponto flutuante.
  - A API recebe `precoUnitario` como texto ou número (`"19,90"`, `"19.9"`, `19.9`), com no máximo 2 casas decimais.
  - A conversão para centavos é exata, sem uso de float.
- **Total**: calculado no backend como a soma de quantidade × preço unitário, e gravado no pedido. Qualquer total, cliente ou status enviado pelo navegador é ignorado. A prévia exibida no formulário é apenas informativa.
- **Limites adicionais**:
  - descrição de 1 a 200 caracteres;
  - quantidade até 10.000;
  - preço até R$ 1.000.000,00;
  - até 100 itens por pedido.
- **Status**: códigos `recebido`, `em_preparacao`, `enviado` e `cancelado`, exibidos como "Recebido", "Em preparação", "Enviado" e "Cancelado".
  - Novos pedidos sempre começam como `recebido`.
  - O funcionário pode definir qualquer um dos quatro status, sem fluxo obrigatório de transição, porque o pedido não especificava um.
  - Cada alteração atualiza `atualizado_em`.
- **Controle de acesso** (no backend; o frontend apenas reflete):
  - Visitante: 401 em todas as rotas de pedidos.
  - Cliente: cria pedidos e lista/consulta apenas os seus. Um pedido de outro cliente responde **404**, para não revelar que ele existe. Alterar status responde 403.
  - Funcionário: lista e consulta todos os pedidos, filtra por status e altera status. Criar pedido responde 403, porque pedidos pertencem a clientes.
- **API nova**:
  - `GET /api/pedidos[?status=]`
  - `POST /api/pedidos` com corpo `{ itens: [{ descricao, quantidade, precoUnitario }] }` (formato da etapa 2; **substituído na etapa 3** por `{ itens: [{ produtoId, quantidade }] }`)
  - `GET /api/pedidos/:id`
  - `PATCH /api/pedidos/:id/status` com corpo `{ status }`
  - `GET /api/minha-conta` passou a incluir `perfil`.
  - Erros de validação retornam `campos` com chaves como `itens.0.quantidade`.
- **Rotas do frontend**:
  - Cliente: `/meus-pedidos` (início), `/pedidos/novo` e `/pedidos/:id`.
  - Funcionário: `/painel` (início, com filtro por status) e `/pedidos/:id`, onde também altera o status.
  - Ambos: `/minha-conta`.
  - O menu muda conforme o perfil. Rotas de outro perfil redirecionam para o início do perfil.
  - Mensagens de sucesso aparecem ao criar pedido, alterar status e sair. Mensagens de erro aparecem em validação, permissão e falha de conexão.
- **Listas**: ordenadas da data de criação mais recente para a mais antiga. A coluna "Peças" soma as quantidades. Não há paginação nesta etapa.

### Etapa 3
- **Tabela `produtos`**: `id`, `nome` (1–120), `descricao` (texto simples, até 2000), `categoria` (1–50), `tamanho` (1–20, gravado em maiúsculas), `preco_centavos` e `estoque`, além de `criado_em` e `atualizado_em`.
  - `CHECK` no banco garante que o preço seja inteiro maior ou igual a 0 e que o estoque seja inteiro maior ou igual a 0. A API valida as mesmas regras e responde 400 com mensagens por campo.
  - O preço aceita `"59,90"`, `"59.9"` ou um número, com no máximo 2 casas decimais.
- **Categoria e tamanho são texto livre**, não listas fixas. Os filtros e as sugestões do formulário (`datalist`) usam os valores já cadastrados (`GET /api/produtos/filtros`). O filtro compara sem diferenciar maiúsculas.
- **Pesquisa**:
  - O termo é procurado no nome **ou** na descrição.
  - Não diferencia maiúsculas nem acentos ("colecao d'agua" encontra "Coleção D'Água"). Para isso, uma função `normalizar()` é registrada no SQLite (`db.function`).
  - O termo é sempre enviado como parâmetro da consulta preparada, então apóstrofos e textos como `'; DROP TABLE` são tratados como texto comum.
  - `%` e `_` são escapados para não funcionarem como curingas.
  - O termo é limitado a 100 caracteres.
- **Filtros**: pesquisa, categoria, tamanho, preço mínimo e preço máximo podem ser combinados, e todos são aplicados juntos (AND).
  - Valores inválidos respondem 400: preço negativo ou não numérico, mínimo maior que o máximo, ordenação desconhecida ou página menor que 1.
- **Ordenação**: por nome ou preço, crescente ou decrescente.
  - O campo de ordenação vem de uma lista fechada; nunca se usa texto do usuário no `ORDER BY`.
  - Empates no preço são desempatados por nome; empates no nome, por id. Assim a paginação fica estável.
- **Paginação**: 12 produtos por página. Uma página além da última devolve uma lista vazia.
- **Somente leitura**: `GET /api/produtos`, `GET /api/produtos/:id` e `GET /api/produtos/filtros` são públicos e apenas executam `SELECT`.
- **Escrita**: `POST /api/produtos` e `PUT /api/produtos/:id` exigem funcionário (visitante recebe 401; cliente, 403). Não há exclusão de produtos nesta etapa.
- **Exibição como texto**: nomes e descrições são renderizados pelo React como texto, sem `dangerouslySetInnerHTML`, então HTML digitado aparece literalmente. As quebras de linha da descrição são preservadas com CSS (`white-space: pre-line`).
- **URL do catálogo**: filtros, ordenação e página ficam na URL (por exemplo `/catalogo?q=jeans&ordem=preco&direcao=desc&pagina=2`). Assim é possível compartilhar o link e voltar com o botão do navegador.
- **Pedidos a partir do catálogo**:
  - A API passa a receber `{ itens: [{ produtoId, quantidade }] }`. O backend busca nome e preço atuais do produto e calcula o total. Nome, preço ou total enviados pelo navegador são ignorados.
  - Cada item grava `produto_id`, nome (coluna `descricao`, mantida da etapa 2), quantidade e preço unitário praticado na compra. Como nome e preço ficam copiados no item, alterar o produto depois não muda os pedidos.
  - `produto_id` usa `ON DELETE SET NULL`, por precaução.
  - Itens repetidos do mesmo produto são somados.
- **Estoque nos pedidos**: não há reserva nem baixa de estoque. Mesmo assim, o pedido é recusado (400) se a quantidade, somada por produto, passar do estoque atual, ou se o produto estiver sem estoque. A interface também desabilita produtos sem estoque.
- **Pedidos antigos**: itens sem `produto_id` (criados antes desta etapa) aparecem normalmente, com nome, quantidade e preço originais. Itens com produto têm link para a página do produto.
- **Interface**:
  - Rotas novas: `/catalogo` (início para visitantes; "/" leva ao catálogo para visitante), `/produtos/:id`, `/painel/produtos`, `/painel/produtos/novo` e `/painel/produtos/:id/editar`.
  - O menu ganhou "Catálogo" para todos e "Produtos" para funcionários.
  - Na página do produto, o cliente vê "Pedir este produto", que abre `/pedidos/novo?produto=ID` com o item já adicionado.
  - Em "Novo pedido", o cliente pesquisa no catálogo, adiciona produtos e informa as quantidades. A tela mostra o total estimado.

### Etapa 4
- **Formato dos dados**: CPF, telefone e CEP são guardados só com dígitos. A interface aceita e exibe esses dados formatados (`000.000.000-00`, `(00) 00000-0000`, `00000-000`).
  - **CPF**: validado pelos dígitos verificadores; sequências repetidas são recusadas. É opcional, porque as contas antigas não o possuem, e é único entre contas (índice único parcial).
  - **Telefone**: DDD válido + 8 ou 9 dígitos. É opcional na conta, mas **obrigatório para finalizar um pedido**, porque o pedido precisa guardar um telefone de entrega.
- **Endereço**: um por usuário (tabela `enderecos`, chave primária `usuario_id`). Campos:
  - destinatário, CEP (8 dígitos), logradouro, número e bairro;
  - complemento (opcional);
  - cidade;
  - estado, escolhido entre as 27 UFs.

  Para endereço sem número, use "s/n". Restrições `CHECK` no banco repetem as regras da API. Funcionários não cadastram endereço (a API responde 403), porque não fazem pedidos.
- **Rotas da conta**:
  - `GET /api/minha-conta` passou a incluir `cpf`, `telefone` e `endereco`.
  - Novas rotas: `PUT /api/minha-conta/dados`, `PUT /api/minha-conta/endereco` e `PUT /api/minha-conta/senha`.
  - As rotas **não recebem id**: sempre operam sobre o usuário da sessão, então é impossível ler ou alterar dados de outra conta.
  - Campos como `perfil` e `email` enviados no corpo são ignorados. O e-mail não pode ser alterado nesta etapa, porque o pedido não incluía isso.
- **Privacidade do CPF**: o CPF é retornado **somente** em `/api/minha-conta` e `/api/minha-conta/dados`, para o próprio usuário. As consultas de pedidos (lista e detalhe, inclusive para funcionários) selecionam colunas explícitas e nunca incluem o CPF. Os testes verificam isso.
- **Senha**:
  - A troca exige a senha atual correta (400 se incorreta) e uma nova senha de 8 a 128 caracteres, diferente da atual.
  - A confirmação da nova senha é feita na interface.
  - Depois da troca, o hash é substituído. As **outras sessões da conta são encerradas**, enquanto a sessão atual continua ativa.
  - A resposta é 204, sem corpo.
- **Entrega nos pedidos**:
  - `POST /api/pedidos` passou a exigir `confirmarEndereco: true`.
  - Se o cliente não tiver endereço ou telefone, responde 400 com `campos.endereco` e/ou `campos.telefone`.
  - O backend copia destinatário, telefone (da conta), CEP, logradouro, número, complemento, bairro, cidade e UF para as colunas `entrega_*` do pedido. Assim, alterações posteriores na conta não afetam pedidos já feitos.
  - O destinatário guardado é o do endereço, não o nome da conta.
- **Detalhe do pedido** (`entrega` na API e seção "Entrega" na tela): visível para o cliente dono e para funcionários. Pedidos anteriores têm `entrega: null` e mostram a indicação de que não há informações de entrega registradas.
- **Interface**:
  - "Minha conta" tem quatro blocos: resumo e sair, dados pessoais, endereço (clientes) e alterar senha. Cada bloco mostra suas mensagens de sucesso e erro por campo.
  - "Novo pedido" ganhou o passo **3. Entrega**: mostra o endereço e o telefone, ou um aviso com link para "Minha conta" se faltar algo. A caixa "Confirmo a entrega neste endereço" precisa estar marcada para enviar.

## Verificações executadas

Executadas neste ambiente (Windows 11, Node 24.16.0, npm 11.8.0).

**Etapa 1** (registro anterior):
- Instalação das dependências.
- Typecheck e build.
- Migration a partir de banco vazio.
- Teste de integração.
- Roteiro HTTP contra `npm start`, com reinício do servidor para confirmar a persistência.

**Etapa 2**:
- `npm run typecheck`: sem erros.
- `npm run build`: sucesso.
- `npm test`: 4 testes aprovados, 0 falhas.
  - **Teste da etapa 1**: atualizado para incluir `perfil` na resposta.
  - **Regras de pedidos**:
    - visitante recebe 401;
    - o total enviado pelo cliente é ignorado e o servidor calcula 3 × 19,90 + 1 × 0,00 = R$ 59,70;
    - o pedido começa como `recebido` e pertence a quem o criou;
    - são rejeitados: lista vazia, quantidade 0, fracionária ou negativa, preço negativo ou com 3 casas, e descrição vazia;
    - funcionário recebe 403 ao criar pedido;
    - um cliente vê só os próprios pedidos e recebe 404 no pedido de outro;
    - cliente recebe 403 ao alterar status;
    - funcionário vê todos, recebe 400 com status inválido e 404 com pedido inexistente, e altera o status com sucesso (o cliente vê a mudança);
    - o cadastro com `perfil: "funcionario"` cria um cliente.
  - **Seed idempotente**: executado 2 vezes, resulta em 3 usuários e 4 pedidos.
  - **Migration 002 sobre um banco da etapa 1**: usuário e sessão preservados, `foreign_key_check` limpo, e a FK de `sessoes` continua sendo aplicada.
- `npm run db:seed` executado duas vezes sobre um banco vazio. A 1ª execução criou 3 contas e 4 pedidos; a 2ª informou que as contas já existiam e não criou nada.
- `npm start` (build de produção) com roteiro HTTP:
  - login do cliente e do funcionário;
  - criação de pedido (201);
  - cliente lista 3 pedidos e funcionário lista 5;
  - cliente recebe 403 e funcionário recebe 200 ao alterar o status;
  - visitante recebe 401;
  - as rotas do frontend `/painel`, `/meus-pedidos`, `/pedidos/5` e `/pedidos/novo` são servidas (200).
- Depois das verificações, o banco local de teste (`backend/data/`) foi removido. O ambiente fica pronto para instalação a partir de banco vazio.

**Etapa 3**:
- `npm run typecheck` (backend, testes e frontend): sem erros.
- `npm run build`: sucesso.
- `npm test`: **6 testes aprovados, 0 falhas**.
  - **Testes de etapas anteriores**: continuam passando, adaptados ao novo formato de itens.
  - **Regras de pedidos**:
    - preço, nome e total vêm do catálogo, e valores enviados pelo navegador são ignorados;
    - o item guarda `produtoId`, nome, quantidade e preço;
    - são rejeitados: produto inexistente ou ausente, produto sem estoque, quantidade acima do estoque (inclusive somando itens repetidos) e quantidade 0, fracionária ou negativa;
    - depois que um funcionário altera nome e preço do produto, o pedido mantém nome, preço e total originais.
  - **Migration 003 sobre um banco da etapa 2**: um pedido com item manual continua com o total, o status e o item originais, com `produtoId: null`.
  - **Catálogo**:
    - 12 por página, com a página 2 completando o total sem repetir produtos;
    - a pesquisa "Coleção D'Água" e "colecao d'agua" retornam exatamente os 2 produtos;
    - um termo presente só na descrição é encontrado;
    - `'; DROP TABLE produtos; --` retorna 0 resultados, e `100%` e `_` são tratados como literais;
    - os filtros combinados (categoria + tamanho + faixa de preço, e categoria + pesquisa) retornam só produtos que atendem a todos os critérios;
    - a ordenação por preço decrescente e por nome crescente foi conferida;
    - parâmetros inválidos retornam 400;
    - detalhe 200 e inexistente 404;
    - um **snapshot da tabela `produtos` antes e depois de todas as consultas é idêntico**, confirmando que consultar não altera registros;
    - criar produto: visitante 401, cliente 403 e funcionário 201;
    - HTML no nome é armazenado como texto;
    - preço negativo ou com 3 casas, estoque negativo, fracionário ou não numérico, e nome vazio retornam 400;
    - atualização com preço 0 e estoque 0 é aceita; produto inexistente retorna 404.
  - **Seed executado 2 vezes**: 18 produtos, 3 usuários e 4 pedidos.
- **Atualização de banco real**: criei em disco um banco no formato da etapa 2 (migrations 001 e 002), com um cliente e um pedido manual.
  - `npm run db:migrate` aplicou só a `003_catalogo_produtos.sql`. O item antigo ficou intacto, com `produto_id` `NULL`.
  - `npm run db:seed` executado 2 vezes: a 1ª criou 18 produtos, 3 contas e 4 pedidos; a 2ª informou "0 criado(s), 18 já existente(s)" e contas mantidas. Totais finais: 18 produtos, 4 usuários e 5 pedidos.
- **`npm start` (build de produção), roteiro HTTP sobre esse banco**:
  - o pedido antigo aparece com o item original;
  - catálogo com 18 produtos, 12 na página 1 de 2;
  - a pesquisa "Coleção D'Água" ordenada por preço decrescente traz os 2 produtos na ordem certa;
  - o filtro Casacos + M + preço máximo 300 traz só a "Jaqueta Jeans Clássica";
  - o cliente cria um pedido (201, total calculado pelo catálogo) e recebe 403 ao criar produto;
  - o funcionário altera nome e preço do produto (200), e o pedido mantém nome, preço e total;
  - as rotas do frontend `/catalogo?q=jeans`, `/produtos/3`, `/painel/produtos` e `/painel/produtos/3/editar` respondem 200.
- O banco de teste (`backend/data/`) foi removido ao final.

**Etapa 4**:
- `npm run typecheck`: sem erros.
- `npm run build`: sucesso.
- `npm test`: **10 testes aprovados, 0 falhas**.
  - **Testes anteriores**: continuam passando, com os ajustes de `confirmarEndereco`, da nova conta demo e da migration 004.
  - **Validação de CPF**: dígitos verificadores corretos e incorretos, e sequências repetidas.
  - **Dados pessoais, endereço, entrega e privacidade**:
    - visitante recebe 401 nas três rotas novas;
    - `/minha-conta` traz o CPF ao próprio usuário e nunca a senha;
    - CPF inválido, sequência repetida, CPF de outra conta, telefone inválido e nome vazio retornam 400;
    - `perfil` e `email` enviados são ignorados;
    - pedido sem endereço retorna 400 com `campos.endereco`;
    - CEP, UF, logradouro, número ou destinatário inválidos retornam 400; funcionário recebe 403 ao gravar endereço;
    - pedido sem confirmação, ou com confirmação diferente de `true`, retorna 400;
    - com confirmação, o pedido (201) guarda a entrega completa;
    - depois de mudar endereço, nome e telefone da conta, o pedido mantém a entrega original;
    - o funcionário vê a entrega, mas nenhuma resposta de pedidos (lista e todos os detalhes) contém "cpf" nem os números de CPF;
    - os dados do cliente 1 seguem intactos.
  - **Senha**:
    - senha atual errada, nova curta ou igual à atual retornam 400;
    - a troca responde 204 sem corpo;
    - o login com a senha antiga é recusado (401) e com a nova é aceito;
    - a sessão atual continua e a outra sessão da mesma conta é encerrada.
  - **Persistência com banco em arquivo**: depois de fechar e reabrir o banco com um novo servidor, nome, CPF, endereço e a entrega do pedido continuam lá.
- **Atualização de banco real**: criei em disco um banco no formato da etapa 3 (migrations 001–003), com um pedido antigo.
  - `npm run db:migrate` aplicou só a `004_dados_pessoais_e_entrega.sql`.
  - `npm run db:seed` executado 2 vezes: a 1ª criou 18 produtos, 4 contas e 4 pedidos; a 2ª não criou nada.
- **`npm start` (build de produção), roteiro HTTP sobre esse banco**:
  - o pedido antigo retorna `entrega: null`;
  - `cliente3` sem endereço recebe 400 (faltam endereço e telefone);
  - dados e endereço são salvos (200);
  - sem confirmação, 400; com confirmação, 201 e entrega copiada;
  - a mudança de endereço não altera o pedido;
  - o funcionário vê a entrega sem CPF;
  - a troca de senha com senha errada dá 400 e a correta dá 204;
  - **depois de reiniciar o servidor**: senha antiga 401 e nova 200; nome, CPF, telefone e endereço persistidos; pedido com a entrega original;
  - as rotas `/minha-conta` e `/pedidos/novo` do frontend respondem 200.
- O banco de teste foi removido ao final.

## Limitações

- A interface não foi testada em um navegador real nem em dispositivos móveis. A responsividade usa CSS, com tabelas que viram cartões em telas até 480px, mas não foi verificada visualmente.
- `npm run dev` (Vite + `tsx watch`) não foi executado; foram verificados build e execução de produção.
- Não há tela nem comando dedicado para criar funcionários além do seed de demonstração.
- Há um único endereço de entrega por cliente. Para entregar em outro local, é preciso alterar o endereço antes de finalizar o pedido.
- Não há consulta automática de CEP, porque integrações externas não fazem parte do pedido. O CEP é validado apenas pelo formato.
- Não há alteração de e-mail, recuperação de senha nem limite de tentativas na troca de senha.
- O CPF fica em texto no banco local, sem criptografia em repouso; a proteção é feita pelo controle de acesso da API.
- Não há exclusão de produtos, imagens, variações (vários tamanhos no mesmo produto) nem baixa ou reserva de estoque. O estoque só é usado para validar a quantidade no momento do pedido.
- Em "Novo pedido", a lista de escolha mostra a primeira página (12) do resultado da pesquisa; para outros produtos é preciso refinar a busca. Também é possível partir da página do produto.
- A pesquisa usa `LIKE` sobre a função `normalizar()`, sem índice de texto completo. Isso é adequado para um catálogo pequeno e médio, mas não foi medido com grandes volumes.
- Não há paginação nas listas de pedidos, nem histórico de mudanças de status (só a data da última atualização).
- Não há limite de tentativas de login, recuperação de senha nem confirmação de e-mail.
- Não há linter configurado; as verificações disponíveis são tipos, build e testes de integração.
- `node:sqlite` pode emitir aviso de recurso experimental em algumas versões do Node 24.
