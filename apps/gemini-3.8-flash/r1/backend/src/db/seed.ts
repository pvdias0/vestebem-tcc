import bcrypt from 'bcryptjs';
import { getDatabase, runMigrations } from './index';

export function seedDemoData(): void {
  // Garante que o schema está em dia antes de inserir
  runMigrations();

  const db = getDatabase();
  const saltRounds = 10;

  console.log('[Seed] Preparando dados de demonstração...');

  // 1. Usuários de Demonstração (com dados fictícios de CPF, telefone e endereço completo)
  const demoUsers = [
    {
      name: 'Carlos Oliveira (Cliente)',
      email: 'cliente1@vestebem.com',
      password: 'cliente123',
      role: 'customer',
      cpf: '111.222.333-44',
      phone: '(11) 98765-4321',
      recipient_name: 'Carlos Oliveira',
      cep: '01310-100',
      street: 'Avenida Paulista',
      number: '1000',
      complement: 'Apto 42',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP'
    },
    {
      name: 'Mariana Souza (Cliente)',
      email: 'cliente2@vestebem.com',
      password: 'cliente123',
      role: 'customer',
      cpf: '555.666.777-88',
      phone: '(21) 99887-1122',
      recipient_name: 'Mariana Souza',
      cep: '22041-001',
      street: 'Avenida Atlântica',
      number: '500',
      complement: 'Bloco B',
      neighborhood: 'Copacabana',
      city: 'Rio de Janeiro',
      state: 'RJ'
    },
    {
      name: 'Fernanda Lima (Funcionária)',
      email: 'funcionario@vestebem.com',
      password: 'admin123',
      role: 'employee',
      cpf: null,
      phone: '(11) 91234-5678',
      recipient_name: null,
      cep: null,
      street: null,
      number: null,
      complement: null,
      neighborhood: null,
      city: null,
      state: null
    }
  ];

  const checkUserStmt = db.prepare('SELECT id, role FROM users WHERE email = ?');
  const insertUserStmt = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, cpf, phone, recipient_name, cep, street, number, complement, neighborhood, city, state)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateUserStmt = db.prepare(`
    UPDATE users
    SET cpf = COALESCE(cpf, ?),
        phone = COALESCE(phone, ?),
        recipient_name = COALESCE(recipient_name, ?),
        cep = COALESCE(cep, ?),
        street = COALESCE(street, ?),
        number = COALESCE(number, ?),
        complement = COALESCE(complement, ?),
        neighborhood = COALESCE(neighborhood, ?),
        city = COALESCE(city, ?),
        state = COALESCE(state, ?)
    WHERE id = ?
  `);

  const createdUserIds: Record<string, number> = {};

  for (const u of demoUsers) {
    const existing = checkUserStmt.get(u.email) as { id: number; role: string } | undefined;
    if (!existing) {
      const hash = bcrypt.hashSync(u.password, saltRounds);
      const res = insertUserStmt.run(
        u.name,
        u.email,
        hash,
        u.role,
        u.cpf,
        u.phone,
        u.recipient_name,
        u.cep,
        u.street,
        u.number,
        u.complement,
        u.neighborhood,
        u.city,
        u.state
      );
      const id = Number(res.lastInsertRowid);
      createdUserIds[u.email] = id;
      console.log(`[Seed] Usuário criado: ${u.name} (${u.email}) - Perfil: ${u.role}`);
    } else {
      createdUserIds[u.email] = existing.id;
      // Atualiza campos de endereço e perfil se ainda estiverem nulos
      updateUserStmt.run(
        u.cpf,
        u.phone,
        u.recipient_name,
        u.cep,
        u.street,
        u.number,
        u.complement,
        u.neighborhood,
        u.city,
        u.state,
        existing.id
      );
      console.log(`[Seed] Usuário já existe: ${u.email} (ID: ${existing.id}) - dados atualizados.`);
    }
  }

  // 2. Produtos de Demonstração
  const demoProducts = [
    {
      name: "Vestido Floral Coleção D'Água",
      description: "Vestido midi confeccionado em tecido leve e fluido, com estampa botânica inspirada nas fontes naturais.",
      category: 'Vestidos',
      size: 'M',
      price: 219.90,
      stock_quantity: 15
    },
    {
      name: 'Camiseta Básica de Algodão Pima',
      description: 'Camiseta de alta durabilidade e toque suave, confeccionada com 100% de algodão nobre.',
      category: 'Camisetas',
      size: 'G',
      price: 79.90,
      stock_quantity: 40
    },
    {
      name: 'Camiseta Básica Slim Preta',
      description: 'Modelagem ajustada ao corpo, acabamento reforçado nas golas e mangas.',
      category: 'Camisetas',
      size: 'P',
      price: 69.90,
      stock_quantity: 25
    },
    {
      name: 'Camisa Social Manga Longa Branca',
      description: 'Camisa clássica em tricoline acetinada, corte regular ideal para ocasiões formais e trabalho.',
      category: 'Camisas',
      size: 'GG',
      price: 189.00,
      stock_quantity: 20
    },
    {
      name: 'Camisa Linho Casual Bege',
      description: 'Camisa fresca em linho puro, respirável para dias quentes de verão e passeios à tarde.',
      category: 'Camisas',
      size: 'M',
      price: 229.50,
      stock_quantity: 18
    },
    {
      name: 'Calça Jeans Skinny Lavagem Escura',
      description: 'Jeans com elastano proporcionando máximo conforto, cintura média com costura contrastante.',
      category: 'Calças',
      size: '40',
      price: 199.90,
      stock_quantity: 30
    },
    {
      name: 'Calça Alfaiataria Reta Cinza',
      description: 'Calça com vinco frontal bem marcado, bolsos faca e acabamento premium sofisticado.',
      category: 'Calças',
      size: '42',
      price: 249.00,
      stock_quantity: 12
    },
    {
      name: 'Jaqueta Jeans Trucker Vintage',
      description: 'Jaqueta clássica denim estruturada com bolsos frontais e botões metálicos envelhecidos.',
      category: 'Casacos',
      size: 'G',
      price: 289.90,
      stock_quantity: 10
    },
    {
      name: 'Blazer Estruturado Navy Blue',
      description: 'Blazer alfaiatado com forro acetinado, fechamento frontal de dois botões elegantes.',
      category: 'Casacos',
      size: 'M',
      price: 349.00,
      stock_quantity: 8
    },
    {
      name: 'Saia Midi Plissada Verde Oliva',
      description: 'Saia elegante com caimento impecável e cós elástico confortável para o dia a dia.',
      category: 'Saias',
      size: 'P',
      price: 159.90,
      stock_quantity: 22
    },
    {
      name: 'Shorts Jeans Desfiado Verão',
      description: 'Shorts casual com lavagem moderna e barra desfiada despojada.',
      category: 'Shorts',
      size: '38',
      price: 119.90,
      stock_quantity: 35
    },
    {
      name: 'Suéter de Tricô Canelado Gola V',
      description: 'Tricô macio e quentinho confeccionado em ponto canelado para meia estação.',
      category: 'Casacos',
      size: 'GG',
      price: 179.90,
      stock_quantity: 16
    },
    {
      name: 'Polo Piquet Clássica Vermelha',
      description: 'Polo clássica confeccionada em piquet encorpado de algodão com peitilho de dois botões.',
      category: 'Camisetas',
      size: 'M',
      price: 129.90,
      stock_quantity: 28
    },
    {
      name: 'Bermuda Chino Sarja Areia',
      description: 'Bermuda confortável com bolsos faca, perfeita para momentos casuais e fins de semana.',
      category: 'Shorts',
      size: '44',
      price: 139.90,
      stock_quantity: 14
    },
    {
      name: 'Vestido Longo Envelope Coral',
      description: 'Vestido longo de transpasse ajustável, decote em V e tecido suave ao toque.',
      category: 'Vestidos',
      size: 'G',
      price: 259.90,
      stock_quantity: 11
    },
    {
      name: 'Cardigã Longo Algodão Mescla',
      description: 'Cardigã aberto sem fecho, corte alongado aconchegante para compor sobreposições.',
      category: 'Casacos',
      size: 'U',
      price: 169.90,
      stock_quantity: 19
    }
  ];

  const checkProductStmt = db.prepare('SELECT id FROM products WHERE name = ? AND size = ?');
  const insertProductStmt = db.prepare(`
    INSERT INTO products (name, description, category, size, price, stock_quantity)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const p of demoProducts) {
    const existing = checkProductStmt.get(p.name, p.size);
    if (!existing) {
      insertProductStmt.run(p.name, p.description, p.category, p.size, p.price, p.stock_quantity);
      console.log(`[Seed] Produto criado: ${p.name} [Tam: ${p.size}]`);
    }
  }

  // 3. Pedidos de Demonstração para cada cliente
  const checkOrdersStmt = db.prepare('SELECT COUNT(*) as count FROM orders WHERE customer_id = ?');

  const insertOrderStmt = db.prepare(`
    INSERT INTO orders (
      customer_id,
      total_amount,
      status,
      delivery_recipient_name,
      delivery_phone,
      delivery_cep,
      delivery_street,
      delivery_number,
      delivery_complement,
      delivery_neighborhood,
      delivery_city,
      delivery_state
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItemStmt = db.prepare(`
    INSERT INTO order_items (order_id, product_id, description, quantity, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const cliente1Id = createdUserIds['cliente1@vestebem.com'];
  const cliente2Id = createdUserIds['cliente2@vestebem.com'];

  const prodPima = db.prepare('SELECT id, price, name, size FROM products WHERE name LIKE ?').get('%Pima%') as { id: number; price: number; name: string; size: string } | undefined;
  const prodDagua = db.prepare('SELECT id, price, name, size FROM products WHERE name LIKE ?').get("%D'Água%") as { id: number; price: number; name: string; size: string } | undefined;

  // Se o cliente 1 não tem pedidos, insere com snapshot de entrega
  const countC1 = (checkOrdersStmt.get(cliente1Id) as { count: number }).count;
  if (countC1 === 0) {
    const p1Items = [
      {
        product_id: prodPima?.id || null,
        description: prodPima ? `${prodPima.name} (Tam: ${prodPima.size})` : 'Camiseta de Algodão Pima Preta (M)',
        quantity: 2,
        unit_price: prodPima ? prodPima.price : 89.90
      }
    ];
    const p1Total = p1Items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);
    const p1Res = insertOrderStmt.run(
      cliente1Id,
      Number(p1Total.toFixed(2)),
      'recebido',
      'Carlos Oliveira',
      '(11) 98765-4321',
      '01310-100',
      'Avenida Paulista',
      '1000',
      'Apto 42',
      'Bela Vista',
      'São Paulo',
      'SP'
    );
    const p1Id = Number(p1Res.lastInsertRowid);
    for (const it of p1Items) {
      insertItemStmt.run(p1Id, it.product_id, it.description, it.quantity, it.unit_price, Number((it.quantity * it.unit_price).toFixed(2)));
    }

    console.log(`[Seed] Inserido pedido inicial com entrega para cliente1@vestebem.com.`);
  } else {
    console.log(`[Seed] cliente1@vestebem.com já possui ${countC1} pedidos cadastrados. Ignorando duplicação.`);
  }

  const countC2 = (checkOrdersStmt.get(cliente2Id) as { count: number }).count;
  if (countC2 === 0) {
    const p3Items = [
      {
        product_id: prodDagua?.id || null,
        description: prodDagua ? `${prodDagua.name} (Tam: ${prodDagua.size})` : "Vestido Floral Coleção D'Água (Tam: M)",
        quantity: 1,
        unit_price: prodDagua ? prodDagua.price : 219.90
      }
    ];
    const p3Total = p3Items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);
    const p3Res = insertOrderStmt.run(
      cliente2Id,
      Number(p3Total.toFixed(2)),
      'enviado',
      'Mariana Souza',
      '(21) 99887-1122',
      '22041-001',
      'Avenida Atlântica',
      '500',
      'Bloco B',
      'Copacabana',
      'Rio de Janeiro',
      'RJ'
    );
    const p3Id = Number(p3Res.lastInsertRowid);
    for (const it of p3Items) {
      insertItemStmt.run(p3Id, it.product_id, it.description, it.quantity, it.unit_price, Number((it.quantity * it.unit_price).toFixed(2)));
    }

    console.log(`[Seed] Inserido pedido inicial com entrega para cliente2@vestebem.com.`);
  } else {
    console.log(`[Seed] cliente2@vestebem.com já possui ${countC2} pedidos cadastrados. Ignorando duplicação.`);
  }

  console.log('[Seed] Carga de demonstração finalizada com sucesso!');
}

if (require.main === module) {
  try {
    seedDemoData();
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Erro ao carregar dados de demonstração:', err);
    process.exit(1);
  }
}
