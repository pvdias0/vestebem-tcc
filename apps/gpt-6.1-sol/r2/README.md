# VesteBem

## Conta e entrega

O build desta etapa iniciou em `http://localhost:3003` usando `PORT=3003`, evitando conflito com servidores anteriores. Foram verificados HTTP 200 na interface e catálogo e HTTP 401 na conta sem autenticação. A mensagem de console ainda informa a porta padrão; use a porta definida em `PORT`.

Na área “Minha conta”, clientes podem salvar nome, CPF e telefone, e cadastrar ou atualizar seu único endereço de entrega. O e-mail permanece somente para consulta. A troca de senha exige a senha atual e uma nova de 8 a 128 caracteres; as sessões já existentes permanecem válidas. CPF e telefone são opcionais no perfil, mas telefone e endereço são obrigatórios para criar pedidos. CPF aceita 11 dígitos (com ou sem máscara); a aplicação verifica formato, sem validar dígitos verificadores ou consultar serviços externos. Telefones aceitam 10 a 13 dígitos. CEP exige 8 dígitos e estado exige UF brasileira. Número aceita texto, incluindo “s/n”. Complemento é opcional.

Para finalizar um pedido, selecione os produtos e quantidades, clique em “Carregar endereço da minha conta” e confirme os dados apresentados. Se modificar a conta em outra aba, recarregue os dados de entrega: a API rejeita confirmação desatualizada. A API obtém os dados da conta autenticada, nunca de outro identificador enviado pelo cliente, e salva uma cópia no pedido. Nome do destinatário, telefone e endereço ficam disponíveis nos detalhes para o dono do pedido e funcionários. CPF não é copiado nem disponibilizado aos funcionários. Pedidos anteriores mostram que não possuem informações de entrega registradas.

Instalação e execução completa, com Node 24 LTS e npm:

```sh
npm ci
npm run db:init
npm run db:demo
npm run dev
```

Desenvolvimento: acesse o endereço do Vite (normalmente http://localhost:5173). Para executar o build local: `npm run typecheck`, `npm test`, `npm run build` e `npm start`; então acesse http://localhost:3000. Use `npm.cmd` no PowerShell se a política local bloquear `npm.ps1`. O banco é `backend/data/vestebem.sqlite`; preserve essa pasta entre execuções. A migration 004 adiciona perfis, endereços e snapshot de entrega opcional, sem apagar usuários, produtos ou pedidos. Todas as migrations também funcionam em banco vazio.

O seed mantém os dois clientes, funcionária e produtos já documentados. Acrescenta CPF `00000000000`, telefone `11000000000` e endereço explicitamente fictício aos clientes que ainda não têm esses registros. São placeholders de demonstração, sem validade cadastral ou postal; não representam pessoas reais. Repetir o seed não duplica nem sobrescreve perfis ou endereços editados. Os pedidos de demonstração anteriores permanecem úteis para verificar a ausência de entrega; crie um novo pela interface para experimentar o snapshot.

Verificações desta etapa: typecheck e build nos dois pacotes; teste HTTP integrado com SQLite em memória cobrindo atualização própria, acesso anônimo negado, CPF ausente da resposta da funcionária, bloqueio de edição por funcionária, entrega preservada após alteração de endereço/telefone, senha atual incorreta, login aceitando a nova senha e rejeitando a antiga. A migration foi aplicada ao arquivo local e o seed executado duas vezes. Não houve inspeção visual em navegador nem teste automatizado de reinício nesta etapa. Persistência usa as tabelas locais e não armazenamento de navegador. As observações abaixo descrevem as etapas anteriores e suas respectivas verificações.

## Etapa de catálogo

O servidor compilado desta etapa iniciou em `http://localhost:3002` (variável `PORT=3002` para evitar conflito com execuções anteriores). Foram confirmados HTTP 200 na interface, no catálogo e nos detalhes do produto; o catálogo local retornou 18 produtos, com 12 na primeira página.

O catálogo é público e aparece antes da área de conta. Permite pesquisar nome/descrição, combinar categoria, tamanho e preços mínimo/máximo, ordenar por nome ou preço nos dois sentidos e navegar em páginas de 12 produtos. “Ver produto” abre os detalhes públicos. Funcionários autenticados têm ações para cadastrar e atualizar produtos. Campos de nome e descrição são renderizados como texto pelo React, sem interpretação de HTML.

Os comandos de instalação, desenvolvimento, verificação e execução permanecem os mesmos. Execute `npm run db:init` para aplicar a migration 003 ao banco existente (também aplicada na inicialização). Execute `npm run db:demo` para adicionar 18 produtos entre Casual, Jeans e Festa, tamanhos P/M/G e preços variados, incluindo “Coleção D'Água”. As credenciais abaixo continuam válidas. O seed usa chaves únicas e não duplica produtos nem redefine suas alterações ao ser repetido.

A migration adiciona `products` e um vínculo opcional `order_items.product_id`, sem remover registros. Pedidos antigos mantêm descrição, preço e total e aparecem como itens anteriores ao catálogo. Novos pedidos aceitam somente identificador de produto e quantidade: a API busca nome/preço atuais, calcula o total e grava uma cópia dos valores no item. Preço, descrição e total enviados pelo cliente não determinam a compra. Alterações futuras do produto não afetam essa cópia. Não há reserva, baixa de estoque ou pagamento; estoque zero não impede pedidos nesta etapa.

Produtos exigem nome (até 200 caracteres), descrição em texto simples (até 5000, podendo ser vazia), categoria (até 100), tamanho (até 30), preço não negativo com até duas casas e estoque inteiro não negativo. Valores monetários são persistidos em centavos e devem caber em inteiros seguros do JavaScript. Atualização é integral via PUT; não há exclusão. A busca usa substring literal parametrizada, inclusive apóstrofos, `%` e `_`. Categoria e tamanho correspondem exatamente ao texto informado. A comparação sem diferenciação de maiúsculas usa `lower` do SQLite, com limitações para caracteres Unicode fora de ASCII. Filtros de preço são inclusivos. Empates na ordenação são resolvidos por identificador. As consultas públicas usam somente SELECT.

Verificações desta etapa: typecheck e build de frontend/backend; teste HTTP integrado em banco vazio cobrindo paginação (12 + 4 produtos), pesquisa com apóstrofo e texto semelhante a SQL, filtros simultâneos, ordenação por preço, parâmetros inválidos, permissões, preço/estoque inválidos, snapshot de compra e item legado. A migration foi aplicada ao banco local e o seed executado duas vezes. Não foi realizada inspeção visual no navegador. A seleção de produtos em pedidos oferece busca e paginação; o total definitivo aparece nos detalhes após a criação.

## Etapa de pedidos

Clientes autenticados encontram “Meus pedidos” e “Criar pedido” dentro da área da conta. Funcionários encontram o painel com todos os pedidos. “Ver detalhes” mostra itens, cliente, data, status e total. Funcionários alteram o status no seletor dos detalhes, com confirmação ou erro na tela.

Execute `npm run db:demo` após `npm ci` para preparar dois clientes e um funcionário, com um pedido para cada cliente. Credenciais locais (senha de todos: `VesteBem123!`):

| Perfil | E-mail |
| --- | --- |
| Cliente Ana | ana@vestebem.demo |
| Cliente Bruno | bruno@vestebem.demo |
| Funcionária Carla | carla@vestebem.demo |

O comando é transacional e pode ser repetido: não duplica usuários nem pedidos e não redefine senhas ou status. Endereços já cadastrados são preservados, inclusive seu perfil. Use esses endereços reservados em um banco de demonstração. Funcionários são preparados exclusivamente por operação local; o cadastro público continua criando clientes.

A migration 002 preserva usuários e sessões, cria a relação `roles` (fonte das permissões) e as tabelas `orders` e `order_items`. A coluna de perfil da primeira migration permanece por compatibilidade; as permissões são lidas da relação `roles`. Novos usuários recebem automaticamente o papel cliente por trigger. Ambas as migrations são aplicadas em banco vazio e somente as pendentes em banco existente.

O servidor compilado desta etapa foi iniciado com `PORT=3001` para não interferir em outra execução local; a consulta anônima a `/api/orders` respondeu 401. A mensagem de inicialização ainda exibe a porta padrão 3000; para porta personalizada use o valor de `PORT` no navegador.

Preços são armazenados em centavos inteiros, com até duas casas decimais na entrada. A API calcula o total, ignora cliente/status/total enviados no cadastro e grava pedido e itens na mesma transação. São aceitos de 1 a 100 itens, descrições até 200 caracteres e totais dentro do intervalo inteiro seguro do JavaScript. Datas são UTC e apresentadas no fuso do navegador. Não há restrições de transição entre os quatro status, pois nenhuma foi solicitada. Pedidos alheios retornam 404 para clientes, inclusive por identificador. Não há endpoint público de alteração de perfil.

Nesta etapa passaram typecheck, build e teste HTTP integrado com SQLite: isolamento entre clientes, bloqueio a visitantes, quantidades/preços inválidos, total calculado, status inicial, proibição de alterações por cliente e de criação por funcionário, consulta e alteração por funcionário. A migration foi aplicada ao banco local existente; o comando demo foi executado duas vezes. Não houve inspeção visual automatizada no navegador.

Primeira etapa: cadastro público de clientes, login, Minha conta e logout. Interface em português, responsiva, React e CSS; API Express e SQLite local, sem serviços externos.

## Ambiente

Versões usadas: Node.js 24.16.0 LTS, npm 11.8.0, TypeScript 5.9.3, React e React DOM 19.3.1, Vite 8.3.6 e Express 5.3.0. Frontend e backend usam `strict: true`. SQLite é fornecido pelo módulo `node:sqlite` do Node 24.

## Comandos

Na raiz do repositório:

```sh
npm ci
npm run db:init
npm run dev
npm run typecheck
npm test
npm run build
npm start
```

No PowerShell com scripts bloqueados, use `npm.cmd` em lugar de `npm`. Desenvolvimento: abra o endereço exibido pelo Vite (normalmente http://localhost:5173); a API roda em http://localhost:3000. Após o build, `npm start` serve a interface e a API em http://localhost:3000. Encerre com Ctrl+C. O lock da raiz coordena os workspaces; cada pacote também contém seu próprio package-lock.json.

## Persistência e decisões

O banco é `backend/data/vestebem.sqlite`, independente do diretório de execução. A migration versionada `backend/migrations/001_initial.sql` é aplicada transacionalmente pelo comando de inicialização e automaticamente ao iniciar a API. Não apague a pasta data ao reiniciar. `DB_PATH` permite selecionar outro arquivo; seu diretório deve existir.

E-mails são normalizados para minúsculas e têm restrição UNIQUE. Cadastro exige nome até 100 caracteres, e-mail até 254 e senha de 8 a 128. O papel é sempre cliente, imposto também pelo banco. Senhas usam scrypt com salt aleatório; respostas selecionam explicitamente os campos públicos.

Sessões duram 24 horas, com token aleatório em cookie HttpOnly e SameSite Strict; somente seu hash fica no banco. Logout exclui a sessão no servidor. Cada login tem sua própria sessão. A conta é consultada pelo vínculo da sessão, sem aceitar identificador de usuário do cliente. Sessões e usuários sobrevivem ao reinício. Requisições de escrita verificam Origin quando presente. Não há recuperação de senha, catálogo, pedidos ou outros perfis nesta etapa.

O servidor escuta apenas a interface local. `PORT` altera a porta; ajuste também o proxy do Vite se mudar a porta da API. `NODE_ENV=production` exige HTTPS para o cookie Secure, através de um proxy HTTPS local configurado separadamente. Para execução HTTP local use o comando start sem essa variável.

## Verificações

Executados com sucesso: instalação (auditoria sem vulnerabilidades), typecheck nos dois pacotes, build nos dois pacotes, inicialização do banco e teste de integração real via HTTP com SQLite em memória. O teste cobre acesso anônimo negado, cadastro, e-mail duplicado, senha incorreta, login, dados públicos da conta e invalidação da sessão após logout. O servidor compilado iniciou e respondeu HTTP 200 na interface e 401 na conta anônima.

Não foi realizada inspeção visual em navegador nem teste automatizado de reinício com banco em arquivo. Persistência em arquivo é a configuração padrão. O teste não substitui uma revisão de segurança para exposição pública: limitação de tentativas de login e operação HTTPS pública ficam fora desta entrega local.
