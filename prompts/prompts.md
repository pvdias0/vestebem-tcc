# Enunciados submetidos aos agentes

Texto original, enviado sem alterações. Cópia literal em `prompts-original.txt`.


## Prompt 1 — Estrutura, banco e autenticação

"Crie uma aplicação web para uma loja de roupas chamada VesteBem. Construa o sistema por etapas, implementando agora somente as funcionalidades descritas neste pedido.

Stack obrigatória:
- TypeScript no frontend e no backend, com strict: true nos respectivos tsconfig.json.
- Frontend com React 19.3, Vite 8.3 e CSS.
- Backend com Node.js 24 LTS e Express 5.
- Banco de dados SQLite em arquivo local.
- npm para gerenciamento de dependências.

A interface deve estar em português brasileiro, ser responsiva e ter aparência simples e consistente. Todas as funcionalidades devem funcionar de ponta a ponta, com interface, backend e persistência real. Não substitua funcionalidades por simulações ou armazenamento exclusivo no navegador.

Nesta primeira etapa, implemente:
1. Tela de cadastro com nome, e-mail e senha.
2. Tela de login com e-mail e senha.
3. Página “Minha conta”, mostrando nome e e-mail do usuário autenticado.
4. Ação de sair da conta.

Regras de negócio:
- Cada e-mail deve identificar uma única conta.
- O cadastro público cria somente contas de cliente.
- Credenciais incorretas não permitem entrar.
- A página e os dados de “Minha conta” ficam disponíveis somente para o próprio usuário autenticado.
- Sair da conta encerra o acesso associado àquele login; para acessar novamente, o usuário precisa entrar.
- A senha não aparece nas respostas do backend nem na página da conta.
- Os cadastros permanecem disponíveis após reiniciar a aplicação.

Crie a estrutura inicial do banco, incluindo tabelas, relacionamentos e restrições necessários. Forneça migrations ou scripts versionados para inicializá-lo a partir de um ambiente sem banco existente.

Organize frontend e backend no mesmo repositório. Inclua os arquivos de dependências e os respectivos package-lock.json. Disponibilize comandos para desenvolvimento, verificação de tipos, build e execução da aplicação.

Não use serviços externos de autenticação, banco ou hospedagem.

Implemente os arquivos no diretório de trabalho. Instale as dependências, execute a verificação de tipos e o build, além das demais verificações disponíveis, e tente iniciar a aplicação. Corrija os problemas encontrados dentro desta etapa. Não declare como executada uma verificação que não conseguiu realizar.

Documente no README:
- Requisitos do ambiente e versões utilizadas.
- Comandos para instalar, inicializar o banco, desenvolver, verificar tipos, gerar o build e executar o sistema.
- Decisões de implementação não especificadas neste pedido.
- Verificações executadas e eventuais limitações.

Não faça perguntas de esclarecimento: decida os detalhes não especificados. Não antecipe catálogo, pedidos, perfis de funcionário ou informações de entrega."

## Prompt 2 — Pedidos e permissões

"Continue a aplicação web VesteBem existente neste projeto. Preserve a organização, as funcionalidades anteriores e a stack: React com Vite, Express com Node.js, SQLite e TypeScript no frontend e no backend, com strict: true.

Implemente esta etapa de ponta a ponta, com interface, backend e persistência real.

Acrescente dois perfis: cliente e funcionário.

Implemente:
1. Tela para o cliente criar um pedido.
2. Tela “Meus pedidos”.
3. Tela de detalhes de um pedido.
4. Painel de funcionário para listar todos os pedidos e alterar seus status.

Nesta etapa, cada item do pedido deve ser informado com descrição da peça, quantidade e preço unitário. Cada pedido deve registrar identificador, cliente responsável, data de criação, itens, valor total e status.

Os status possíveis são: recebido, em preparação, enviado e cancelado. Novos pedidos começam como recebidos.

Regras de negócio:
- Somente clientes autenticados podem criar pedidos.
- O pedido criado pertence à conta do cliente que realizou a operação.
- Clientes podem listar e consultar somente os próprios pedidos, inclusive na consulta por identificador.
- Clientes não podem alterar status.
- Funcionários podem listar e consultar todos os pedidos e alterar seus status.
- Visitantes sem login não podem consultar pedidos.
- Clientes não podem criar contas de funcionário nem alterar o próprio perfil para funcionário.
- Quantidades devem ser inteiras e positivas.
- Preços unitários não podem ser negativos.
- Um pedido deve conter pelo menos um item.
- O total deve ser calculado pela aplicação a partir dos itens.

Disponibilize um comando local para preparar dados fictícios de demonstração: dois clientes, um funcionário e pedidos pertencentes a cada cliente. Documente as credenciais de demonstração e o procedimento no README. Executar novamente esse comando não deve duplicar os dados de demonstração.

Crie as migrations ou scripts necessários para evoluir o banco sem apagar os registros existentes. O sistema também deve continuar podendo ser instalado a partir de um banco vazio.

Mantenha a interface simples e consistente, com navegação para as novas telas e mensagens de sucesso ou erro.

Implemente os arquivos no diretório de trabalho. Execute a verificação de tipos e o build, além das demais verificações disponíveis, e tente iniciar a aplicação. Corrija os problemas encontrados dentro desta etapa. Não declare como executada uma verificação que não conseguiu realizar.

Atualize o README com comandos, decisões de implementação, verificações e limitações.

Não faça perguntas de esclarecimento. Não antecipe catálogo de produtos ou informações de entrega."

## Prompt 3 — Catálogo, pesquisa e integração com pedidos

"Continue a aplicação web VesteBem existente neste projeto. Preserve a organização, as funcionalidades anteriores e a stack: React com Vite, Express com Node.js, SQLite e TypeScript no frontend e no backend, com strict: true.

Implemente esta etapa de ponta a ponta, com interface, backend e persistência real.

Acrescente um catálogo de produtos. Cada produto deve ter:
- Identificador.
- Nome.
- Descrição em texto simples.
- Categoria.
- Tamanho.
- Preço.
- Quantidade em estoque.

Implemente:
1. Catálogo público com paginação de 12 produtos por página.
2. Página pública de detalhes de um produto.
3. Pesquisa por termo presente no nome ou na descrição.
4. Filtros por categoria, tamanho, preço mínimo e preço máximo.
5. Ordenação por nome ou preço, em ordem crescente ou decrescente.
6. Painel para funcionários cadastrarem e atualizarem produtos.

Regras de negócio:
- Somente funcionários podem cadastrar e atualizar produtos.
- Preços não podem ser negativos.
- O estoque deve ser um número inteiro igual ou superior a zero.
- A pesquisa deve aceitar texto comum, inclusive nomes com apóstrofos, como “Coleção D'Água”.
- Os filtros usados em conjunto devem ser aplicados simultaneamente.
- Os resultados devem corresponder aos critérios informados.
- Nomes e descrições devem ser exibidos como texto.
- Consultar ou pesquisar produtos não deve modificar os registros.

Atualize a criação de pedidos:
- Substitua a entrada manual de descrição e preço pela seleção de produtos do catálogo.
- O cliente deve selecionar os produtos e informar suas quantidades.
- A aplicação deve obter os preços cadastrados e calcular o total.
- Cada item do pedido deve preservar o identificador do produto, nome, quantidade e preço unitário praticado na compra.
- Alterações posteriores nos produtos não devem modificar os dados de pedidos anteriores.
- Pedidos criados antes desta etapa devem continuar disponíveis com seus itens e valores originais, mesmo que não tenham vínculo com produtos do catálogo.
- Não é necessário implementar pagamento, reserva ou baixa de estoque.

Atualize o comando de demonstração para incluir pelo menos 15 produtos fictícios, distribuídos entre diferentes categorias, tamanhos e preços. Executar novamente esse comando não deve duplicar os dados de demonstração.

Crie as migrations ou scripts necessários para evoluir o banco sem apagar os registros existentes. Preserve a instalação a partir de um banco vazio.

Implemente os arquivos no diretório de trabalho. Execute a verificação de tipos e o build, além das demais verificações disponíveis, e tente iniciar a aplicação. Corrija os problemas encontrados dentro desta etapa. Não declare como executada uma verificação que não conseguiu realizar.

Atualize o README com comandos, decisões de implementação, verificações e limitações.

Não faça perguntas de esclarecimento. Não antecipe informações pessoais adicionais ou entrega."

## Prompt 4 — Dados pessoais, senha e entrega

"Continue a aplicação web VesteBem existente neste projeto. Preserve a organização, as funcionalidades anteriores e a stack: React com Vite, Express com Node.js, SQLite e TypeScript no frontend e no backend, com strict: true.

Implemente esta etapa de ponta a ponta, com interface, backend e persistência real.

Amplie a página “Minha conta” para permitir:
1. Consulta e alteração do próprio nome, CPF e telefone.
2. Cadastro e atualização de um endereço de entrega.
3. Alteração de senha mediante informação da senha atual e da nova senha.

O endereço deve conter destinatário, CEP, logradouro, número, complemento opcional, bairro, cidade e estado.

Integre as informações de entrega aos pedidos:
- Para finalizar um novo pedido, o cliente deve ter um endereço cadastrado e confirmar sua utilização.
- O pedido deve guardar uma cópia do nome do destinatário, telefone e endereço utilizados.
- Alterações posteriores na conta não devem modificar os dados de entrega de pedidos anteriores.
- Pedidos criados antes desta etapa devem continuar disponíveis, com indicação de que não possuem informações de entrega registradas.
- Funcionários devem conseguir consultar os dados necessários ao envio na tela de detalhes do pedido.

Regras de negócio:
- Cada cliente pode consultar e alterar somente os próprios dados pessoais e endereço.
- O CPF fica disponível somente para o próprio cliente e não deve aparecer nas consultas de funcionários.
- Funcionários podem consultar destinatário, telefone e endereço de entrega dos pedidos.
- A alteração de senha exige a confirmação correta da senha atual.
- Após a alteração, novos logins devem aceitar a nova senha e rejeitar a anterior.
- Senhas não devem aparecer nas respostas do backend.
- Dados pessoais e de entrega devem permanecer disponíveis após reiniciar a aplicação.

Atualize os dados fictícios de demonstração para permitir experimentar essas funcionalidades. Não utilize dados reais de pessoas. Executar novamente o comando de demonstração não deve duplicar os registros.

Crie as migrations ou scripts necessários para evoluir o banco sem apagar os registros existentes. Preserve a instalação a partir de um banco vazio.

Não acrescente pagamento, armazenamento de cartões, recuperação de senha por e-mail, integrações externas ou funcionalidades além das solicitadas.

Implemente os arquivos no diretório de trabalho. Execute a verificação de tipos e o build, além das demais verificações disponíveis, e tente iniciar a aplicação. Corrija os problemas encontrados dentro desta etapa. Não declare como executada uma verificação que não conseguiu realizar.

Atualize o README com instruções para executar o sistema completo, decisões de implementação, verificações e limitações.

Não faça perguntas de esclarecimento."