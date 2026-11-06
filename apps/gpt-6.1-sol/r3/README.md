# VesteBem

Aplicação local com cadastro, login, Minha conta, logout, catálogo público, pedidos de clientes e painéis de funcionários para produtos e pedidos. Minha conta permite atualizar dados pessoais, endereço e senha; os pedidos preservam uma cópia dos dados de entrega confirmados. Interface em português brasileiro com React/CSS responsivo, API Express e SQLite em arquivo.

## Ambiente e comandos

Versões utilizadas: Node.js **24.16.0** (24 LTS), npm **11.8.0**, TypeScript **5.9.3**, React/React DOM **19.3.1**, Vite **8.3.6**, Express **5.3.0**. Frontend e backend têm `strict: true`. Os três `package-lock.json` fixam as dependências. SQLite usa `node:sqlite`, nativo no Node 24, sem servidor externo; algumas versões podem emitir aviso de recurso experimental.

Execute na raiz:

```sh
npm ci
npm run install:all
npm run db:init
npm run dev
```

Desenvolvimento: **http://localhost:5173**; Vite encaminha `/api` à porta 3000. No PowerShell com scripts bloqueados, use `npm.cmd` em lugar de `npm`.

```sh
npm run typecheck
npm test
npm run build
npm start
```

Após o build, `npm start` serve interface e API em **http://localhost:3000**. Gere novo build após alterações. Não execute produção e desenvolvimento simultaneamente na mesma porta. Encerre com Ctrl+C.

## Demonstração

```sh
npm run db:demo
```

O comando aplica migrations e prepara dois clientes, um funcionário, um pedido para cada cliente e **16 produtos**. Os produtos variam entre categorias Básicos/Casual/Social/Inverno, tamanhos P/M/G/GG e preços de zero a R$ 169,90, incluindo `Coleção D'Água` e um produto com estoque zero. Senha de todas as contas: **`VesteBem@2026`**.

Os clientes recebem CPF, telefone e endereço explicitamente fictícios: CPFs `00000000000`/`11111111111`, telefone `00000000000`, CEP `00000000`, Rua Fictícia de Demonstração e Cidade de Demonstração. Esses dados não representam pessoas ou destinos reais. Não utilize para envios. CPF/telefone/CEP não são verificados em serviços externos.

| Perfil | E-mail |
| --- | --- |
| Cliente Ana | `ana@demo.vestebem.local` |
| Cliente Bruno | `bruno@demo.vestebem.local` |
| Funcionária Fernanda | `funcionario@demo.vestebem.local` |

Execute antes ou depois de iniciar o servidor. Clientes criam pedidos selecionando produtos; a funcionária consulta todos, altera status e gerencia produtos. O comando é transacional e idempotente: não duplica contas, pedidos ou produtos, não redefine senhas, não restaura status nem sobrescreve produtos editados. Pedidos e produtos fictícios possuem chaves únicas reservadas. Pedidos de demonstração anteriores ao catálogo são mantidos como estavam; numa instalação nova, os pedidos fictícios usam produtos. Os e-mails são reservados para demonstração; uma conta já existente com mesmo e-mail e perfil é preservada com sua senha atual. Se o perfil diferir, o comando falha sem aplicar alterações.

Nesta etapa, o comando também complementa os clientes de demonstração existentes com dados pessoais e endereço uma única vez, registrando a execução em `demo_profile_seeds`. Execuções posteriores preservam as alterações feitas em Minha conta, inclusive senhas. Pedidos já existentes não recebem dados de entrega retroativamente. Em banco vazio, os dois pedidos fictícios já incluem entrega; no banco de uma etapa anterior, crie um novo pedido para experimentar o registro de entrega.

### Experimentar a conta e a entrega

1. Entre como cliente e acesse **Minha conta**. Altere nome, CPF e telefone em **Salvar dados pessoais** e preencha o endereço em **Salvar endereço**.
2. Em **Criar pedido**, selecione os produtos e quantidades, confira destinatário, telefone e endereço e marque a confirmação de uso desses dados. Sem endereço, telefone ou confirmação não é possível finalizar.
3. Abra os detalhes do pedido, altere depois os dados em Minha conta e volte ao pedido: a entrega original permanece registrada. Funcionários consultam a mesma cópia nos detalhes, sem acesso ao CPF.
4. Em **Alterar senha**, informe a senha atual, a nova senha e sua confirmação. Após o sucesso, todos os logins dessa conta são encerrados. Entre novamente com a nova senha; a anterior deixa de funcionar. O comando de demonstração não restaura senhas.

## Banco e evolução

O banco padrão é `backend/data/vestebem.sqlite`, independentemente do diretório de execução. Preserve o diretório para manter os registros. Reiniciar ou gerar build não apaga dados.

- `001_initial.sql` cria usuários e sessões da primeira etapa.
- `002_orders.sql` amplia os perfis para `customer` e `employee`, preservando usuários, identificadores, hashes, datas e sessões. Adiciona pedidos e itens com índices, chaves estrangeiras e restrições.
- `003_catalog.sql` cria produtos e acrescenta a chave estrangeira opcional `order_items.product_id`. Não altera itens ou valores anteriores; esses itens continuam disponíveis com vínculo nulo.
- `004_profile_delivery.sql` acrescenta CPF, telefone e versão de entrega em usuários, cria um endereço por conta com chave estrangeira e uma cópia de entrega por pedido em `order_delivery`. Preserva todos os registros anteriores. Pedidos antigos ficam sem linha de entrega e a interface informa **“Este pedido não possui informações de entrega registradas.”**.
- `migrations` registra scripts aplicados. Cada migration é transacional; `npm run db:init` pode ser repetido e funciona com banco vazio. O servidor também aplica migrations ao iniciar.
- `orders` contém identificador sequencial, cliente, criação em UTC, status e total em centavos. `order_items` mantém o nome praticado na compra na coluna `description`, além de produto, quantidade e preço unitário em centavos. A API apresenta esse nome também como `name` e o vínculo como `productId` (nulo para itens antigos). Pedido, leitura dos preços e gravação dos itens ocorrem na mesma transação; consultas de pedidos não dependem de joins com produtos para recuperar nome ou preço.

## Decisões e regras

- Cadastro público sempre cria **cliente**, ignorando qualquer papel fornecido. Não existe endpoint de promoção ou alteração de papel de acesso. O funcionário de demonstração é provisionado pelo comando local.
- E-mails normalizados para minúsculas, com unicidade sem distinção de caixa. Nome: 2–100 caracteres; e-mail: até 254; senha: 8–128. Cadastro não faz login automático.
- Senhas usam scrypt com salt aleatório e comparação de tempo constante. Respostas não incluem senha ou hash. Consultas SQL usam parâmetros.
- Sessões duram 24 horas em cookie HttpOnly/SameSite=Strict; o banco guarda SHA-256 do token aleatório de 256 bits. Logout revoga a sessão no servidor e limpa o cookie. Outros logins permanecem ativos. Não há autenticação em localStorage.
- Os clientes atualizam nome, CPF, telefone e endereço exclusivamente por rotas da própria sessão, sem identificador de usuário no caminho. IDs ou papéis enviados no corpo não são usados para escolher outra conta. Funcionários não acessam essas rotas pessoais, nem há consulta de CPF de outro cliente. `/api/me` mantém apenas nome, e-mail e papel; CPF é retornado exclusivamente pelo perfil do próprio cliente.
- Nome continua obrigatório (2–100 caracteres). CPF e telefone são opcionais na conta, mas o telefone é obrigatório para finalizar pedido. CPF aceita 11 dígitos, com pontos/hífen opcionais; telefone nacional com DDD aceita 10 ou 11 dígitos, com espaços, pontos, parênteses e hífen. São persistidos somente dígitos; campo vazio vira nulo. A validação do CPF é estrutural, sem verificação de dígitos verificadores, titularidade ou unicidade, permitindo dados fictícios de demonstração. Não há alteração de e-mail nesta etapa.
- Cada cliente possui um endereço: destinatário (2–100), CEP (8 dígitos, hífen opcional), logradouro (1–200), número (1–30, aceita `S/N`), complemento opcional (até 100), bairro/cidade (1–100) e UF brasileira válida. Todos os campos de texto são tratados como texto simples. Não há busca de CEP ou integração externa.
- Para finalizar, o cliente deve confirmar explicitamente os dados atuais. A API exige `confirmDelivery: true` e `deliveryVersion` correspondente ao perfil consultado. Alterações em dados pessoais ou endereço incrementam a versão; uma confirmação desatualizada retorna 409. O botão **Atualizar dados de entrega** recarrega a versão e desmarca a confirmação. Endereço ou telefone ausentes retornam 400. O servidor lê exclusivamente os dados da própria conta e ignora qualquer endereço/telefone/CPF enviados na criação do pedido.
- A cópia imutável de entrega contém destinatário, telefone, CEP, logradouro, número, complemento, bairro, cidade e UF. É gravada na mesma transação do pedido e dos itens. Alterar dados da conta não altera essa cópia. O CPF nunca é copiado para pedidos; listagens/detalhes de funcionários não incluem CPF. Pedidos antigos retornam `delivery: null`.
- Troca de senha está disponível a usuários autenticados, inclusive funcionários, com senha atual correta e nova senha de 8–128 caracteres. A interface pede confirmação da nova senha. O backend usa scrypt e comparação de tempo constante, impede sobrescrita concorrente de uma troca de senha e revoga todas as sessões da conta em uma transação após o sucesso. Senhas/hashes não são retornados por nenhum endpoint. Tentativas de troca usam o mesmo limitador de autenticação.
- Clientes criam e consultam somente os próprios pedidos. O cliente é obtido da sessão; cliente responsável, status inicial e total fornecidos no corpo não controlam a criação. Funcionários consultam todos e alteram status, mas não criam pedidos.
- Visitantes recebem 401; operações incompatíveis com o perfil recebem 403. Pedidos inexistentes ou pertencentes a outro cliente recebem 404.
- Status na interface: **Recebido**, **Em preparação**, **Enviado**, **Cancelado**. API/banco: `received`, `preparing`, `sent`, `cancelled`. Novos pedidos começam recebidos. Como não foram especificadas transições restritas, funcionários podem escolher qualquer um dos quatro status, inclusive reverter alterações.
- Pedido: 1–50 produtos distintos; quantidade inteira entre 1 e 10.000; total máximo R$ 1 bilhão. O cliente envia apenas `productId` e `quantity`. Descrições, nomes e preços enviados na criação são ignorados: o servidor utiliza os dados atuais do produto. Entrada manual de peças e preços foi removida da criação. Cada item preserva identificador, nome, quantidade e preço praticado, mesmo após atualização do produto.
- O catálogo aceita produtos com estoque zero e pedidos não verificam disponibilidade, não reservam e não baixam estoque nesta etapa. Estoque é informativo. Não há exclusão de produtos.
- Produtos: nome obrigatório de até 200 caracteres; descrição de texto simples até 5.000; categoria até 80; tamanho até 30; preço inteiro em centavos entre zero e R$ 1.000.000,00; estoque inteiro entre zero e 1 bilhão. Validação ocorre no backend e há restrições SQLite. Categoria e tamanho são textos livres definidos pelo funcionário. Cada tamanho corresponde a um registro de produto.
- Formulários de preço aceitam reais com vírgula ou ponto, até duas casas decimais, sem separador de milhar. A API de produtos recebe `priceCents` inteiro. O backend calcula os totais dos pedidos em centavos; o navegador mostra uma estimativa e informa que o preço será confirmado na criação. Valores monetários persistidos não usam ponto flutuante.
- `/` e `/catalogo` são públicos, com **12 produtos por página**; `/produtos/:id` mostra detalhes públicos. A pesquisa procura uma substring literal em nome ou descrição, ignorando caixa e acentos (normalização Unicode). Apóstrofos, `%`, `_` e trechos parecidos com SQL são texto comum. Os parâmetros são vinculados às consultas, sem interpolação de texto do usuário.
- Categoria e tamanho são filtros de igualdade exata; preços mínimo e máximo são inclusivos. Todos os critérios são combinados com `AND`. Intervalos inválidos recebem 400. A ordenação aceita apenas nome/preço crescente/decrescente; empates usam o identificador. Nomes usam a collation SQLite `NOCASE`; a ordenação não implementa collation linguística brasileira. Página fora dos resultados retorna lista vazia com contagem correta. A consulta não altera produtos.
- Pesquisa, filtros, ordenação e página ficam na URL, funcionando ao recarregar e navegar pelo histórico. A nova pesquisa reinicia na página 1. Nomes e descrições são interpolados pelo React como texto, sem HTML ou Markdown executável.
- Navegação preserva Minha conta, Meus pedidos, Criar pedido e Painel de pedidos, e acrescenta Catálogo e Gerenciar produtos para funcionários. `/gestao-produtos` permite cadastrar e editar todos os campos. A API exige funcionário independentemente da interface. Detalhes funcionam com links diretos e recarga; há mensagens de carregamento, sucesso, erro e listas vazias.
- Cadastro/login possuem limite de 30 tentativas por IP a cada 15 minutos. Há headers de segurança e validação de Origin nas mutações. Não há serviços, fontes ou imagens externos.

### API

| Método e rota | Operação |
| --- | --- |
| `POST /api/register` | Cadastro público de cliente |
| `POST /api/login` | Iniciar sessão |
| `GET /api/me` | Nome, e-mail e perfil da sessão |
| `GET /api/me/profile` | Cliente consulta seus dados pessoais e endereço |
| `PUT /api/me/profile` | Cliente atualiza nome, CPF e telefone próprios |
| `PUT /api/me/address` | Cliente cadastra ou substitui seu endereço |
| `POST /api/me/password` | Alterar senha atual e encerrar todas as sessões |
| `POST /api/logout` | Revogar sessão |
| `POST /api/orders` | Criar pedido do cliente autenticado |
| `GET /api/orders` | Listar pedidos permitidos para a sessão |
| `GET /api/orders/:id` | Consultar pedido e itens |
| `PATCH /api/orders/:id/status` | Funcionário altera status |
| `GET /api/products` | Catálogo público paginado, pesquisa, filtros e ordenação |
| `GET /api/products/options` | Categorias e tamanhos existentes para os filtros |
| `GET /api/products/:id` | Detalhes públicos do produto |
| `POST /api/products` | Funcionário cadastra produto |
| `PUT /api/products/:id` | Funcionário atualiza todos os campos do produto |

Criação de pedido: `{"items":[{"productId":1,"quantity":2}],"confirmDelivery":true,"deliveryVersion":1}` (use a versão retornada por `/api/me/profile`). Alteração de status: `{"status":"preparing"}`. Produto: `{"name":"Camiseta","description":"Algodão macio.","category":"Básicos","size":"M","priceCents":4990,"stock":10}`.

Dados pessoais: `{"name":"Cliente Fictício","cpf":"00000000000","phone":"00000000000"}`. Endereço: `{"recipient":"Pessoa Fictícia","postalCode":"00000000","street":"Rua Inventada","number":"1","complement":"","neighborhood":"Bairro Fictício","city":"Cidade Inventada","state":"SP"}`. Senha: corpo com `currentPassword` e `newPassword`; a confirmação digitada na interface não é persistida.

Consulta de exemplo: `/api/products?q=algodao&category=Básicos&size=M&minPriceCents=1000&maxPriceCents=9000&sort=price_asc&page=1`. Parâmetros opcionais: `q`, `category`, `size`, `minPriceCents`, `maxPriceCents`, `sort` (`name_asc`, `name_desc`, `price_asc`, `price_desc`) e `page` (inteiro positivo). A resposta contém `items`, `page`, `pageSize: 12`, `total` e `totalPages`. Parâmetros textuais repetidos ou numéricos inválidos recebem 400. O seletor de produtos nos pedidos também usa pesquisa e paginação da API.

Variáveis opcionais: `DATABASE_PATH` (caminhos relativos usam o diretório de execução), `PORT` (3000), `APP_ORIGIN` (`http://localhost:5173`) e `COOKIE_SECURE=true` (cookie apenas por HTTPS). O servidor escuta em `127.0.0.1`, com HTTP local por padrão. Ao utilizar outra origem/porta, configure `APP_ORIGIN` conforme a URL do navegador.

## Verificações desta etapa

- `npm run typecheck`: passou no frontend e backend.
- `npm run build`: passou nos dois projetos.
- `npm test`: passaram os **quatro testes de integração**, com HTTP real e SQLite temporário. Mantêm a cobertura de autenticação, pedidos e catálogo. O novo teste cobre migração do esquema anterior com pedido sem entrega, validações de dados/endereço, acesso somente à própria conta, bloqueio de funcionário ao CPF, ausência de CPF nos pedidos, confirmação ausente/desatualizada, endereço ou telefone ausentes, cópia de entrega sem confiar no corpo, preservação após editar a conta, demonstração idempotente, senha atual incorreta, revogação das sessões, recusa da senha antiga, aceitação da nova e persistência de perfil/endereço/entrega após fechar e recriar banco e servidor. A instalação vazia é coberta pelos testes anteriores atualizados para exigir confirmação de entrega.
- `npm run db:init`: passou no banco local. `npm run db:demo` executado duas vezes, sem duplicar contas, endereços ou os 16 produtos. Os pedidos existentes foram preservados.
- `npm start`: versão compilada reiniciada na porta 3000. Conferência HTTP: Minha conta 200; perfil do cliente 200 com endereço, telefone e CPF próprios; consulta de perfil pessoal por funcionário 403; detalhes de pedido antigo preservados, com entrega nula e sem CPF. Consulta SQLite confirmou dois endereços fictícios, 16 produtos e nenhuma violação de chave estrangeira.
- `npm run test:e2e`: passaram **três testes no Microsoft Edge**. Mantêm os fluxos anteriores de catálogo, permissões e pedidos. O novo fluxo cadastra cliente fictício, verifica bloqueio sem endereço, salva nome/CPF/telefone/endereço, recarrega a conta, confirma entrega no pedido, altera a conta e verifica a entrega anterior pelo funcionário sem CPF, mostra pedido legado sem entrega, rejeita senha atual incorreta, altera senha, rejeita login antigo e entra com a nova senha. Não houve falha da aplicação nesta execução; um teste anterior da API precisou receber a nova confirmação de entrega para continuar verificando produto inválido.

Para repetir o teste de navegador, instale Microsoft Edge e execute:

```sh
npm run build
npm run test:e2e
```

O teste inicia e encerra a API no próprio processo, na porta 3101, e usa o banco isolado `test-results/browser.sqlite`, sem utilizar o banco padrão. A porta deve estar livre. O frontend é servido do build. Não é preciso baixar navegadores com Playwright quando Edge está instalado. Resultados e traces de falhas não são versionados.

Limitações: sem inspeção visual manual ou testes em outros navegadores. As listagens de pedidos permanecem sem paginação; o catálogo é paginado. Sem recuperação de senha, verificação de e-mail, edição de pedidos, histórico de mudanças, reserva ou baixa de estoque. Não há pagamento, cartões ou integrações externas. CPF, telefone e CEP têm validação local de formato, sem confirmar existência/titularidade. Alterações simultâneas de dados pessoais/endereço, status e produtos seguem a última gravação; a versão de entrega impede finalizar com confirmação anterior a uma alteração da conta. Os testes de migração usam arquivos com os esquemas das etapas anteriores; a versão compilada também foi iniciada separadamente. SQLite mantém os dados pessoais em arquivo local sem criptografia adicional; o acesso ao arquivo depende das permissões do ambiente.
