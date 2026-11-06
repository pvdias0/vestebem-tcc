import { db } from './index.js';
import { runMigrations } from './migrate.js';
import { hashPassword } from '../services/auth.service.js';

export function seedDatabase(): void {
  // Garantir que as migrations foram executadas
  runMigrations();

  console.log('[Seed] Verificando e semeando dados de demonstração...');

  const now = new Date().toISOString();

  // Dados fictícios com CPF e endereço pré-cadastrados para os clientes de teste
  const demoUsers = [
    {
      id: 'demo-customer-1',
      name: 'Alice Santos',
      email: 'alice@vestebem.com.br',
      password: 'senhaCliente1',
      role: 'customer',
      cpf: '123.456.789-00',
      phone: '(11) 98765-4321',
      recipientName: 'Alice Santos',
      cep: '01310-100',
      street: 'Avenida Paulista',
      number: '1500',
      complement: 'Apto 101',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    },
    {
      id: 'demo-customer-2',
      name: 'Bruno Lima',
      email: 'bruno@vestebem.com.br',
      password: 'senhaCliente2',
      role: 'customer',
      cpf: '987.654.321-99',
      phone: '(21) 99887-7665',
      recipientName: 'Bruno Lima',
      cep: '22041-001',
      street: 'Avenida Atlântica',
      number: '2000',
      complement: 'Bloco B',
      neighborhood: 'Copacabana',
      city: 'Rio de Janeiro',
      state: 'RJ',
    },
    {
      id: 'demo-employee-1',
      name: 'Carlos Gerente',
      email: 'carlos@vestebem.com.br',
      password: 'senhaFuncionario1',
      role: 'employee',
      cpf: null,
      phone: '(11) 91234-5678',
      recipientName: null,
      cep: null,
      street: null,
      number: null,
      complement: null,
      neighborhood: null,
      city: null,
      state: null,
    },
  ];

  // Inserir ou atualizar os usuários de demonstração de forma idempotente
  for (const u of demoUsers) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email) as { id: string } | undefined;
    if (!existing) {
      const passwordHash = hashPassword(u.password);
      db.prepare(`
        INSERT INTO users (
          id, name, email, password_hash, role,
          cpf, phone, recipient_name, cep, street, number, complement, neighborhood, city, state,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        u.id, u.name, u.email, passwordHash, u.role,
        u.cpf, u.phone, u.recipientName, u.cep, u.street, u.number, u.complement, u.neighborhood, u.city, u.state,
        now, now
      );
      console.log(`[Seed] Usuário criado: ${u.email} (${u.role})`);
    } else {
      // Atualizar dados de perfil/endereço para usuários existentes sem sobrescrever senha
      db.prepare(`
        UPDATE users
        SET cpf = coalesce(cpf, ?),
            phone = coalesce(phone, ?),
            recipient_name = coalesce(recipient_name, ?),
            cep = coalesce(cep, ?),
            street = coalesce(street, ?),
            number = coalesce(number, ?),
            complement = coalesce(complement, ?),
            neighborhood = coalesce(neighborhood, ?),
            city = coalesce(city, ?),
            state = coalesce(state, ?)
        WHERE email = ?
      `).run(
        u.cpf, u.phone, u.recipientName, u.cep, u.street, u.number, u.complement, u.neighborhood, u.city, u.state,
        u.email
      );
      console.log(`[Seed] Usuário já existente: ${u.email}`);
    }
  }

  // 17 Produtos fictícios distribuídos entre categorias, tamanhos e preços
  const demoProducts = [
    {
      id: 'prod-001',
      name: "Vestido Floral Coleção D'Água",
      description: "Vestido fluido em viscose sustentável com estampa botânica exclusiva da Coleção D'Água. Modelagem leve e fresca para dias ensolarados.",
      category: 'Vestidos',
      size: 'M',
      price: 189.90,
      stock: 25,
    },
    {
      id: 'prod-002',
      name: 'Camiseta Básica Algodão Pima',
      description: 'Camiseta casual confeccionada em algodão Pima peruano, toque extremamente macio e corte regular.',
      category: 'Camisetas',
      size: 'G',
      price: 59.90,
      stock: 50,
    },
    {
      id: 'prod-003',
      name: 'Calça Jeans Slim Fit Azul Escuro',
      description: 'Calça jeans moderna em denim com elastano para máximo conforto e mobilidade ao longo do dia.',
      category: 'Calças',
      size: '42',
      price: 169.90,
      stock: 18,
    },
    {
      id: 'prod-004',
      name: 'Blusa de Seda Mangas Bufantes',
      description: 'Blusa feminina sofisticada em crepe de seda pura com fechamento em botões forrados.',
      category: 'Blusas',
      size: 'P',
      price: 139.90,
      stock: 12,
    },
    {
      id: 'prod-005',
      name: 'Camisa Social Linho Natural',
      description: 'Camisa masculina em fibra natural de linho puro, ideal para ambientes elegantes e informais.',
      category: 'Camisas',
      size: 'GG',
      price: 149.90,
      stock: 15,
    },
    {
      id: 'prod-006',
      name: 'Jaqueta Jeans Vintage Oversized',
      description: 'Jaqueta em jeans clássico com lavagem vintage e bolsos utilitários frontais.',
      category: 'Casacos',
      size: 'M',
      price: 229.90,
      stock: 8,
    },
    {
      id: 'prod-007',
      name: 'Saia Plissada Midi Terracota',
      description: 'Saia elegante em tecido plissado com cintura elástica alta e movimento leve.',
      category: 'Saias',
      size: 'P',
      price: 119.90,
      stock: 20,
    },
    {
      id: 'prod-008',
      name: 'Blazer Estruturado em Alfaiataria',
      description: 'Blazer clássico com corte impecável, forro acetinado e abotoamento frontal duplo.',
      category: 'Casacos',
      size: 'G',
      price: 299.90,
      stock: 7,
    },
    {
      id: 'prod-009',
      name: 'Calça Pantalona Alfaiataria Bege',
      description: 'Pantalona cintura alta com pregas frontais e bolsos faca, transmitindo elegância e frescor.',
      category: 'Calças',
      size: '38',
      price: 179.90,
      stock: 14,
    },
    {
      id: 'prod-010',
      name: 'Suéter de Tricô Canelado Marfim',
      description: 'Suéter macio em tricot canelado, gola redonda e mangas raglan para os dias mais amenos.',
      category: 'Casacos',
      size: 'M',
      price: 129.90,
      stock: 22,
    },
    {
      id: 'prod-011',
      name: 'Bermuda Chino Casual Areia',
      description: 'Bermuda casual confeccionada em sarja de algodão leve com toque aveludado.',
      category: 'Bermudas',
      size: '40',
      price: 89.90,
      stock: 30,
    },
    {
      id: 'prod-012',
      name: 'Vestido Longo Frente Única Coral',
      description: 'Vestido longo festa com amarração no pescoço e decote fluido nas costas.',
      category: 'Vestidos',
      size: 'G',
      price: 249.90,
      stock: 9,
    },
    {
      id: 'prod-013',
      name: 'Camisa Polo Casual Piquet Branco',
      description: 'Polo clássica confeccionada em malha piquet com gola estruturada e aberturas laterais.',
      category: 'Camisas',
      size: 'M',
      price: 79.90,
      stock: 40,
    },
    {
      id: 'prod-014',
      name: 'Cardigan Alongado Malha Fina',
      description: 'Cardigan versátil sem botões com caimento alongado e punhos ajustados.',
      category: 'Casacos',
      size: 'GG',
      price: 99.90,
      stock: 16,
    },
    {
      id: 'prod-015',
      name: 'Regata Canelada Gola Alta Preta',
      description: 'Regata minimalista em ribana com gola alta, essencial para compor diversos looks modernos.',
      category: 'Camisetas',
      size: 'P',
      price: 45.90,
      stock: 35,
    },
    {
      id: 'prod-016',
      name: 'Macacão Pantacourt com Cinto Amarração',
      description: 'Macacão prático e estiloso em tecido leve com cinto do mesmo tom para marcar a cintura.',
      category: 'Macacões',
      size: 'M',
      price: 199.90,
      stock: 11,
    },
    {
      id: 'prod-017',
      name: 'Top Cropped em Linho Rústico',
      description: 'Top cropped com alças largas e detalhe de lastex posterior para ajuste perfeito ao corpo.',
      category: 'Blusas',
      size: 'P',
      price: 69.90,
      stock: 25,
    },
  ];

  for (const p of demoProducts) {
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(p.id);
    if (!existing) {
      db.prepare(`
        INSERT INTO products (id, name, description, category, size, price, stock, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(p.id, p.name, p.description, p.category, p.size, p.price, p.stock, now, now);
      console.log(`[Seed] Produto criado: ${p.name}`);
    } else {
      console.log(`[Seed] Produto já existente: ${p.name}`);
    }
  }

  // Obter IDs reais dos usuários
  const alice = db.prepare('SELECT id FROM users WHERE email = ?').get('alice@vestebem.com.br') as { id: string };
  const bruno = db.prepare('SELECT id FROM users WHERE email = ?').get('bruno@vestebem.com.br') as { id: string };

  const demoOrders = [
    {
      id: 'demo-order-alice-1',
      customerId: alice.id,
      status: 'recebido',
      shipping: {
        recipientName: 'Alice Santos',
        phone: '(11) 98765-4321',
        cep: '01310-100',
        street: 'Avenida Paulista',
        number: '1500',
        complement: 'Apto 101',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      },
      items: [
        { productId: 'prod-002', productName: 'Camiseta Básica Algodão Pima', description: 'Camiseta Básica Algodão Pima', quantity: 2, unitPrice: 59.90 },
        { productId: 'prod-003', productName: 'Calça Jeans Slim Fit Azul Escuro', description: 'Calça Jeans Slim Fit Azul Escuro', quantity: 1, unitPrice: 169.90 },
      ],
    },
    {
      id: 'demo-order-alice-2',
      customerId: alice.id,
      status: 'em preparação',
      shipping: {
        recipientName: 'Alice Santos',
        phone: '(11) 98765-4321',
        cep: '01310-100',
        street: 'Avenida Paulista',
        number: '1500',
        complement: 'Apto 101',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      },
      items: [
        { productId: 'prod-001', productName: "Vestido Floral Coleção D'Água", description: "Vestido Floral Coleção D'Água", quantity: 1, unitPrice: 189.90 },
      ],
    },
    {
      id: 'demo-order-bruno-1',
      customerId: bruno.id,
      status: 'enviado',
      shipping: {
        recipientName: 'Bruno Lima',
        phone: '(21) 99887-7665',
        cep: '22041-001',
        street: 'Avenida Atlântica',
        number: '2000',
        complement: 'Bloco B',
        neighborhood: 'Copacabana',
        city: 'Rio de Janeiro',
        state: 'RJ',
      },
      items: [
        { productId: 'prod-005', productName: 'Camisa Social Linho Natural', description: 'Camisa Social Linho Natural', quantity: 1, unitPrice: 149.90 },
        { productId: 'prod-011', productName: 'Bermuda Chino Casual Areia', description: 'Bermuda Chino Casual Areia', quantity: 1, unitPrice: 89.90 },
      ],
    },
  ];

  for (const dOrder of demoOrders) {
    const existingOrder = db.prepare('SELECT id FROM orders WHERE id = ?').get(dOrder.id);
    if (!existingOrder) {
      let totalAmount = 0;
      for (const item of dOrder.items) {
        totalAmount += Math.round(item.quantity * item.unitPrice * 100) / 100;
      }
      totalAmount = Math.round(totalAmount * 100) / 100;

      db.prepare(`
        INSERT INTO orders (
          id, customer_id, total_amount, status,
          shipping_recipient, shipping_phone, shipping_cep, shipping_street,
          shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        dOrder.id,
        dOrder.customerId,
        totalAmount,
        dOrder.status,
        dOrder.shipping.recipientName,
        dOrder.shipping.phone,
        dOrder.shipping.cep,
        dOrder.shipping.street,
        dOrder.shipping.number,
        dOrder.shipping.complement,
        dOrder.shipping.neighborhood,
        dOrder.shipping.city,
        dOrder.shipping.state,
        now,
        now
      );

      for (let i = 0; i < dOrder.items.length; i++) {
        const item = dOrder.items[i];
        const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
        const itemId = `${dOrder.id}-item-${i + 1}`;

        db.prepare(`
          INSERT INTO order_items (id, order_id, product_id, product_name, description, quantity, unit_price, subtotal, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(itemId, dOrder.id, item.productId, item.productName, item.description, item.quantity, item.unitPrice, subtotal, now);
      }

      console.log(`[Seed] Pedido de demonstração criado: ${dOrder.id} (Status: ${dOrder.status})`);
    } else {
      // Atualizar dados de entrega do pedido se estavam vazios
      db.prepare(`
        UPDATE orders
        SET shipping_recipient = coalesce(shipping_recipient, ?),
            shipping_phone = coalesce(shipping_phone, ?),
            shipping_cep = coalesce(shipping_cep, ?),
            shipping_street = coalesce(shipping_street, ?),
            shipping_number = coalesce(shipping_number, ?),
            shipping_complement = coalesce(shipping_complement, ?),
            shipping_neighborhood = coalesce(shipping_neighborhood, ?),
            shipping_city = coalesce(shipping_city, ?),
            shipping_state = coalesce(shipping_state, ?)
        WHERE id = ?
      `).run(
        dOrder.shipping.recipientName,
        dOrder.shipping.phone,
        dOrder.shipping.cep,
        dOrder.shipping.street,
        dOrder.shipping.number,
        dOrder.shipping.complement,
        dOrder.shipping.neighborhood,
        dOrder.shipping.city,
        dOrder.shipping.state,
        dOrder.id
      );
      console.log(`[Seed] Pedido já existente: ${dOrder.id}`);
    }
  }

  console.log('[Seed] Semeação finalizada com sucesso!');
}

seedDatabase();
