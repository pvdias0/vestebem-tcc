# VesteBem

Loja com catálogo público, cadastro de cliente, login, Minha conta, dados pessoais, endereço, alteração de senha e pedidos. Clientes selecionam produtos e confirmam os dados de entrega. Funcionários gerenciam produtos, consultam pedidos e suas informações de envio, e alteram status. Interface em português, React e CSS responsivo; API Express com persistência SQLite em arquivo. Nenhum serviço externo é necessário.

## Ambiente

Node.js **24 LTS** (utilizado: **24.16.0**), npm **11.8.0**, React/React DOM **19.3.1**, Vite **8.3.5**, Express **5.3.0** e TypeScript **5.9.3**. Frontend e backend usam `strict: true`. As versões resolvidas estão nos três `package-lock.json` versionados. O SQLite é o módulo `node:sqlite` incluído no Node 24; algumas versões do Node podem emitir aviso de recurso experimental.

## Instalação e comandos

Execute na raiz do repositório:

```sh
npm ci
npm run install:all
npm run db:init
npm run db:demo
npm run dev
```

Abra **http://localhost:5173**. O frontend encaminha `/api` para o backend em `127.0.0.1:3001`. O comando de desenvolvimento inicia os dois processos e encerra o conjunto se um deles falhar. Não execute desenvolvimento e produção simultaneamente na mesma porta.

`db:demo` é opcional: prepara as contas, endereços fictícios e produtos descritos abaixo. Para experimentar o sistema completo, entre como cliente, consulte/edite Minha conta, selecione produtos em Criar pedido e confirme a entrega. Entre como funcionário para gerenciar produtos, consultar o envio nos detalhes e alterar status.

```sh
npm run typecheck
npm test
npm run build
```

Para executar o build:

```sh
npm start
```

Abra **http://localhost:3001**. O Express serve o frontend compilado e a API na mesma origem. Encerre com Ctrl+C. O build deve ser gerado antes da execução de produção.

Configuração opcional por variáveis de ambiente:

- `DATABASE_PATH`: caminho do arquivo SQLite; padrão `backend/data/vestebem.sqlite`, independente do diretório de execução. Caminhos relativos fornecidos são relativos ao processo.
- `PORT`: porta do backend; padrão `3001`. Ao mudar no desenvolvimento, ajuste também o proxy em `frontend/vite.config.ts`.
- `APP_ORIGIN`: restringe as requisições de escrita do navegador à origem informada. Por padrão, permite `http://localhost:5173` e `http://localhost:3001` (ou a porta configurada), atendendo desenvolvimento e produção local sem configuração adicional.
- `COOKIE_SECURE=true`: habilita cookie exclusivo de HTTPS, para execução atrás de infraestrutura HTTPS. Para o ambiente HTTP local, deixe desativado.

Exemplo de produção no PowerShell:

```powershell
$env:APP_ORIGIN = 'http://localhost:3001'
npm start
```

Use o mesmo nome de host na URL e em `APP_ORIGIN` (localhost e 127.0.0.1 são origens diferentes).

## Banco e decisões

`backend/migrations/001_initial.sql` cria `users` e `sessions`. A migration `002_orders_and_roles.sql` evolui a restrição de perfil para `customer` ou `employee` e cria `orders` e `order_items`, com chaves estrangeiras, índices e restrições de valores. A reconstrução de `users` preserva identificadores, dados, hashes e sessões existentes dentro de uma transação. Funciona tanto sobre a etapa anterior quanto a partir de banco vazio.

A migration `003_catalog.sql` acrescenta `products` e a chave estrangeira opcional `order_items.product_id`. Ela não reescreve itens nem valores anteriores: pedidos antigos mantêm vínculo nulo, texto e preço originais. `004_profile_delivery.sql` cria `customer_profiles`, um endereço por usuário (`addresses`) e uma cópia de entrega por pedido (`order_deliveries`), sem preencher retroativamente os pedidos antigos. `005_demo_tracking.sql` registra a preparação inicial dos perfis fictícios para não sobrescrever suas edições. As cinco migrations podem ser aplicadas desde um banco vazio, sem scripts manuais adicionais.

A tabela `migrations` registra os scripts aplicados em ordem e com transação individual. `db:init` é idempotente e a inicialização do servidor também aplica migrations pendentes. O arquivo do banco e seus auxiliares não entram no controle de versão. Preserve a pasta `backend/data` ao reiniciar ou atualizar. Para atualizar uma instalação existente, encerre o servidor, execute `npm run db:init` e `npm run build`, e inicie novamente.

O nome aceita 2 a 100 caracteres após remover espaços nas extremidades. E-mails são normalizados para minúsculas e senhas aceitam 8 a 128 caracteres, sem remover espaços. O backend nunca aceita a escolha de papel pelo cliente. Cadastro concluído leva ao login, sem autenticação automática.

Senhas usam scrypt com salt aleatório individual. Somente o hash é armazenado. A API devolve apenas id, nome, e-mail e perfil da conta. Tokens de sessão aleatórios de 256 bits são enviados em cookie HttpOnly e SameSite=Lax; o banco guarda somente seu SHA-256. As sessões têm duração fixa de sete dias, persistem entre reinícios e são removidas no logout. Cada login mantém sua própria sessão: sair revoga somente aquela sessão. Sessões expiradas são recusadas e limpas no próximo login. Não há armazenamento de autenticação no localStorage.

`GET /api/me` determina o usuário exclusivamente pela sessão: não recebe id de usuário. As rotas públicas incluem `/`, `/produtos`, `/produtos/:id`, `/login` e `/cadastro`; `/minha-conta` só exibe dados depois da validação da API. O HTML da aplicação é público; os dados da conta são privados e não são incluídos no HTML estático. As respostas da API usam `Cache-Control: no-store`.

Requisições de escrita exigem JSON (até 64 KB) e validam o cabeçalho Origin quando presente. Helmet aplica cabeçalhos de proteção. Cadastro e login compartilham limite de 30 tentativas por IP a cada 15 minutos; alteração de senha tem limite de 15 tentativas por IP nesse intervalo. Os contadores são locais ao processo e reiniciam com ele. O servidor escuta apenas na interface local. Não há pagamento, cartões, recuperação de senha ou integração externa.

## Minha conta e entrega

Clientes podem consultar e salvar nome, CPF e telefone em **Minha conta**, e cadastrar/atualizar um único endereço de entrega. E-mail e perfil continuam sem edição. A API identifica sempre a conta pela sessão e não aceita um identificador de outro usuário como destino. O CPF aparece somente no endpoint privado do próprio cliente, nunca em login, `/api/me`, listas, detalhes de pedidos ou respostas para funcionários. Funcionários mantêm a consulta da própria conta e podem alterar a própria senha; os formulários pessoais e de endereço são exclusivos de clientes.

- `GET /api/me/profile`: retorna `{ profile: { name, email, cpf, phone, address, deliveryVersion } }` exclusivamente ao próprio cliente autenticado.
- `PATCH /api/me/profile`: recebe `{ "name": "Cliente Exemplo", "cpf": "00000000000", "phone": "00000000000" }`. Atualiza somente nome, CPF e telefone da sessão.
- `PUT /api/me/address`: recebe `{ "recipient": "Destinatário Exemplo", "postalCode": "00000000", "street": "Rua Fictícia", "number": "s/n", "complement": "", "district": "Bairro Exemplo", "city": "Cidade Exemplo", "state": "SP" }`.
- `POST /api/me/password`: recebe `{ "currentPassword": "senha atual", "newPassword": "nova senha" }`. Disponível a ambos os perfis, sempre para a própria sessão.

Nome: de 2 a 100 caracteres. CPF e telefone podem ser deixados em branco; para finalizar um pedido, é necessário telefone com DDD (10 ou 11 dígitos). O CPF exige 11 dígitos quando informado; não há validação de dígitos verificadores nem consulta de identidade. CPF, telefone e CEP aceitam pontuação de formatação e são persistidos apenas com dígitos. A validação é de formato, sem consulta externa. CPF não tem restrição de unicidade nesta etapa.

Endereço exige destinatário (2–100 caracteres), CEP de 8 dígitos, logradouro (até 200), número (texto de até 30, permitindo `s/n`), bairro e cidade (até 100) e UF brasileira válida. Complemento é opcional (até 100). Campos textuais são aparados nas extremidades e exibidos como texto. Não há busca de CEP nem validação postal externa.

A troca de senha verifica a senha atual com scrypt e exige uma senha diferente de 8 a 128 caracteres. A interface também pede confirmação da nova senha. A atualização usa comparação do hash anterior para evitar alterações simultâneas com credenciais obsoletas. Após sucesso, **todas as sessões da conta são revogadas**, incluindo a atual, e a interface encaminha ao login. A senha anterior deixa de autenticar; nenhuma senha ou hash é devolvido pela API.

Para finalizar um pedido, a interface carrega e exibe destinatário, telefone e endereço e exige marcar sua confirmação. O backend recebe `confirmDelivery: true` e a `deliveryVersion` retornada pelo perfil; compara essa versão ao conteúdo atual. Se endereço ou telefone mudar entre a consulta e a finalização, retorna 409 e exige recarregar/conferir a entrega. Perfil incompleto retorna 400. CPF não é exigido para comprar e não é copiado para o pedido.

A cópia da entrega é gravada na mesma transação do pedido e seus itens. `GET /api/orders/:id` retorna `delivery` com destinatário, telefone e endereço da compra, acessível somente ao dono ou a funcionários. Alterar nome, telefone ou endereço na conta não altera essa cópia. Pedidos antigos retornam `delivery: null` e a interface mostra “Este pedido não possui informações de entrega registradas”. Não há atualização retroativa nem edição da entrega de pedidos concluídos.

## Catálogo público e gestão

Abra `/` ou `/produtos` sem login. A listagem exibe **12 produtos por página**, com detalhes em `/produtos/:id`. Pesquisa, filtros e ordenação são aplicados pelo backend; os parâmetros ficam na URL da listagem para permitir recarregá-la ou compartilhá-la. Alterar os critérios pela pesquisa volta para a primeira página. A página além do fim retorna lista vazia.

Funcionários acessam **Gerenciar produtos** na navegação da conta (`/funcionario/produtos`), cadastram em `/funcionario/produtos/novo` e editam um produto por identificador. Nome, descrição, categoria, tamanho, preço e estoque são obrigatórios. Cada registro corresponde a um tamanho; uma peça em tamanhos diferentes pode ser cadastrada em registros separados. Categoria e tamanho são textos livres aparados nas extremidades; os filtros usam igualdade exata e suas opções vêm do banco.

API:

- `GET /api/products`: público. Parâmetros opcionais: `q`, `category`, `size`, `minPriceCents`, `maxPriceCents`, `page` e `sort`. Responde com `products`, `total`, `page`, `pageSize` e `totalPages`.
- `GET /api/products/filters`: categorias e tamanhos existentes.
- `GET /api/products/:id`: detalhes públicos.
- `POST /api/products` e `PUT /api/products/:id`: somente funcionários. Recebem `{ "name": "Camiseta", "description": "Algodão macio", "category": "Camisetas", "size": "M", "priceCents": 5990, "stock": 10 }`. A atualização substitui todos esses campos, preservando o identificador.

`sort` aceita `name_asc` (padrão), `name_desc`, `price_asc` e `price_desc`, com desempate pelo identificador. A busca procura um trecho literal no nome **ou** na descrição, ignorando maiúsculas e acentos; apóstrofos, `%` e `_` são caracteres comuns, não comandos nem curingas. Todos os filtros são combinados com AND, e os limites de preço são inclusivos. A implementação usa parâmetros SQL para os valores e uma lista fechada de ordenações. Consultas inválidas retornam 400; consultas e pesquisas não escrevem nos registros.

Nomes e descrições são renderizados como texto pelo React, sem interpretação de HTML. Limites: nome até 200 caracteres, descrição até 4.000, categoria até 80, tamanho até 30; todos não vazios após aparar espaços. Preço entre zero e R$ 1.000.000,00 (centavos inteiros); estoque inteiro entre zero e 100.000.000. Restrições SQL reforçam os limites numéricos. Os formulários monetários aceitam vírgula ou ponto com até duas casas decimais. Não há upload de fotos nem exclusão de produtos nesta etapa.

## Pedidos e perfis

Após entrar, use a navegação para Minha conta, Meus pedidos e Criar pedido. Funcionários veem Todos os pedidos; a alteração de status está nos detalhes de cada pedido. A lista pode ser recarregada por “Atualizar lista”. URLs de detalhes funcionam também após recarregar a página.

- `POST /api/orders`: exclusivo de clientes; recebe `{ "items": [{ "productId": 1, "quantity": 2 }], "confirmDelivery": true, "deliveryVersion": "versão obtida em /api/me/profile" }`. O responsável vem da sessão e o status inicial é `received`. O backend consulta produtos, preços e entrega dentro da transação. Campos enviados de nome, descrição, preço, cliente, total, perfil, endereço livre ou status não são usados. A antiga entrada manual não é mais aceita.
- `GET /api/orders`: pedidos do próprio cliente ou todos, para funcionário.
- `GET /api/orders/:id`: aplica o mesmo controle de acesso; pedidos alheios ao cliente retornam 404, assim como identificadores inexistentes.
- `PATCH /api/orders/:id/status`: exclusivo de funcionário; recebe `{ "status": "preparing" }`.

Status internos: `received` (recebido), `preparing` (em preparação), `shipped` (enviado), `cancelled` (cancelado). Como não foi especificada uma sequência de transições, funcionários podem escolher qualquer um dos quatro status, inclusive reverter. Clientes não têm endpoint para mudar perfil; o cadastro público ignora qualquer perfil enviado e mantém o padrão `customer`. Não há cadastro público de funcionário.

Cada pedido tem identificador incremental, cliente, instante UTC de criação, status, total e itens persistidos. A interface formata datas no fuso do navegador e dinheiro em reais. Preços e totais são inteiros em centavos no banco e na API para evitar arredondamentos de ponto flutuante; o formulário aceita vírgula ou ponto com até duas casas decimais. Quantidades são inteiras de 1 a 10.000, descrição contém de 1 a 200 caracteres após aparar espaços, cada preço fica entre zero e R$ 1.000.000,00. Há de 1 a 50 itens e total máximo de R$ 1.000.000.000,00 por pedido. Esses limites delimitam entrada e mantêm a aritmética exata. O backend valida tudo e calcula o total, gravando pedido e itens em transação: falhas não deixam pedidos parciais. Restrições SQL reforçam perfis, quantidades, preços, totais, status e relacionamentos; quantidade mínima de itens e igualdade do total são garantidas pela transação da aplicação.

Na criação, selecione produtos no catálogo integrado e ajuste suas quantidades. Cada produto aparece uma única vez no pedido (para repetir, aumente a quantidade). O nome do produto é copiado para `order_items.description`, junto ao identificador (`productId` na API), quantidade e preço unitário praticado. Os detalhes do pedido leem esses valores históricos, sem buscar o nome/preço atual do produto. O total mostrado durante a seleção é estimado; vale o preço cadastrado no instante da confirmação no servidor. Pedidos antigos continuam visíveis e recebem a indicação “Item anterior ao catálogo”.

Não há pagamento, reserva, validação de disponibilidade ou baixa de estoque: inclusive produtos com estoque zero podem ser selecionados, e criar pedidos não altera estoque. As únicas informações pessoais adicionais são as solicitadas para Minha conta e entrega.

## Demonstração local

```sh
npm run db:demo
```

O comando aplica migrations pendentes e prepara estas contas fictícias:

| Perfil | Nome | E-mail | Senha inicial |
| --- | --- | --- | --- |
| Cliente | Ana Demo | ana@demo.vestebem.test | VesteBem2026! |
| Cliente | Bruno Demo | bruno@demo.vestebem.test | VesteBem2026! |
| Funcionário | Carla Demo | carla@demo.vestebem.test | VesteBem2026! |

Cria um pedido com dois itens para cada cliente e **16 produtos** distribuídos entre quatro categorias, quatro tamanhos e diferentes preços, incluindo “Coleção D'Água” e um produto sem estoque. Os pedidos fictícios anteriores permanecem como exemplos de itens sem vínculo com o catálogo. Entre com Ana ou Bruno e escolha Criar pedido para testar pedidos com produtos; com Carla, use Gerenciar produtos para cadastrar e atualizar o catálogo.

Ana e Bruno recebem CPF sintético (`00000000000` e `11111111111`), telefone `00000000000`, CEP `00000000` e endereço explicitamente fictício na “Rua Fictícia de Demonstração”, “Cidade Exemplo”. Esses valores não representam dados reais nem endereços utilizáveis. Os pedidos antigos permanecem sem entrega para demonstrar a compatibilidade. Para testar envio, crie um novo pedido como cliente e confirme o endereço; consulte-o como Carla. Para testar a senha, altere-a em Minha conta e use a nova no próximo login; repetir `db:demo` não restaura a senha inicial.

Pode executar novamente: e-mail único, chaves de demonstração, endereço e perfil com chave primária do usuário evitam duplicação. O registro em `demo_data` evita restaurar CPF, telefone ou endereço depois de editados (inclusive quando apagados dos campos opcionais). O comando não redefine senhas, status, produtos editados ou dados já existentes; se encontrar um e-mail reservado com perfil diferente, falha e desfaz a operação, sem promover contas. Os dados são opcionais e destinados à demonstração local. Não há comando público para promoção de usuários.

## Verificações

Executados com sucesso neste ambiente:

- Instalação npm na raiz, backend e frontend, gerando os respectivos locks; auditorias da instalação reportaram zero vulnerabilidades.
- Nesta etapa: `npm run db:init`, `npm run db:demo` duas vezes, `npm run typecheck`, `npm run build` e `npm test` (seis testes de integração aprovados). Não houve novas dependências; os locks existentes foram mantidos.
- Teste de integração HTTP contra SQLite temporário: validação, duplicidade de e-mail, papel fixo, credenciais incorretas, origem inválida, cookie, ausência de senha na resposta, isolamento entre dois usuários, revogação no logout, expiração e login após fechar e reabrir o banco. O teste não altera o banco de desenvolvimento.
- Migração de banco da etapa anterior preservando contas e sessões; demonstração idempotente; isolamento de pedidos por conta e por identificador; bloqueio de visitantes e operações não permitidas a cada perfil; tentativa de promover cliente; validações de itens e limites; preço zero; cálculo de total sem confiar no cliente; todos os status; rollback em falha de item e persistência ao reabrir SQLite.
- Catálogo: 12 produtos por página, ausência de duplicação entre páginas, detalhes públicos, pesquisa por descrição, apóstrofos e caracteres SQL tratados literalmente, filtros simultâneos e faixas inclusivas, quatro ordenações, validações de preço e estoque, autorização de cadastro e atualização, GET sem alteração de registros, preços definidos pelo servidor e histórico inalterado após atualização do produto. Migração real de banco da etapa de pedidos preservando seus itens, valores e sessões; demonstração repetida mantém 16 produtos.
- Conta/entrega: isolamento entre clientes, bloqueio de perfil privado para funcionário, CPF ausente nas consultas de funcionário e em pedidos, atualização e validação de dados, pedido bloqueado sem endereço/telefone ou confirmação, detecção de entrega desatualizada, cópia de entrega independente das edições posteriores, senha atual incorreta, senha nova inválida/igual à atual, nova senha aceita e antiga recusada, revogação de todas as sessões, demonstração sem sobrescrever edições e persistência ao fechar/reabrir o arquivo SQLite.
- Inicialização de produção com `npm start`; smoke HTTP com `node scripts/smoke.mjs`: páginas de conta e pedidos retornam 200, APIs retornam 401 sem autenticação e as três contas de demonstração entram e consultam pedidos reais com os perfis esperados. O Vite previamente iniciado continuou atendendo o frontend e o proxy na porta 5173.

Como já havia servidores nas portas anteriores, a execução do build desta etapa foi iniciada com `PORT=3003` (no PowerShell: `$env:PORT = 3003; npm start`). `node scripts/smoke.mjs http://localhost:3003` verifica o HTML compilado, catálogo e acesso ao perfil/endereço fictício do próprio cliente, além da recusa ao funcionário. Para executar somente a configuração padrão após encerrar os outros servidores, use os comandos normais de instalação e execução acima. O smoke pressupõe as credenciais iniciais de demonstração; se você as alterou, use os testes de integração, que criam banco temporário independente.

Durante a verificação local, o comando de demonstração inicialmente identificou a ausência da tabela de controle em um banco já migrado pelo processo de desenvolvimento. A migration adicional `005_demo_tracking.sql` corrigiu essa evolução sem apagar registros; os comandos de inicialização e demonstração foram repetidos com sucesso.

O script smoke requer os servidores nas portas padrão e `npm run db:demo` executado. A tentativa de conectar o navegador automatizado falhou no ambiente (`missing field sandboxPolicy`); por isso não foi realizada validação visual nem navegação automatizada em navegador. Os testes de integração e smoke validam HTTP e banco reais. Não há script de lint configurado. Os comandos de build e tipos verificam o código de produção; os testes TypeScript são executados pelo tsx.

Limitações: a lista de pedidos continua sem paginação; o catálogo possui paginação de 12 itens. Sem atualização automática entre usuários (recarregue para buscar alterações), histórico de status, edição ou exclusão de pedido, exclusão de produto e cadastro de funcionários pela interface. Não há carrinho persistente: a seleção não enviada é descartada ao sair da tela ou recarregar. Não houve validação visual em navegador nesta etapa; a falha de conexão com o navegador citada acima ocorreu na etapa anterior.
