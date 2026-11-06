import bcrypt from 'bcrypt';
import { db } from './connection.js';
import { runMigrations } from './migrate.js';

const SALT_ROUNDS = 12;

export const demoProducts = [
  {
    name: "Camisa Linho Coleção D'Água",
    description: "Camisa confeccionada em puro linho leve, fresca e sofisticada da edição especial Coleção D'Água.",
    category: 'Camisas',
    size: 'M',
    price: 189.9,
    stock_quantity: 25,
  },
  {
    name: 'Camisa Social Slim Azul Marinho',
    description: 'Camisa social de corte slim fit em algodão egípcio com caimento impecável.',
    category: 'Camisas',
    size: 'G',
    price: 159.9,
    stock_quantity: 30,
  },
  {
    name: 'Camiseta Básica Algodão Pima Preta',
    description: 'Camiseta de alta durabilidade com toque macio e acabamento premium para o dia a dia.',
    category: 'Camisetas',
    size: 'M',
    price: 69.9,
    stock_quantity: 50,
  },
  {
    name: 'Camiseta Básica Algodão Pima Branca',
    description: 'Camiseta clássica com gola redonda e tecido respirável que não desbota.',
    category: 'Camisetas',
    size: 'P',
    price: 69.9,
    stock_quantity: 45,
  },
  {
    name: 'Calça Jeans Tradicional Reta',
    description: 'Calça jeans masculina corte reto com lavagem média e bolsos funcionais.',
    category: 'Calças',
    size: '42',
    price: 199.9,
    stock_quantity: 20,
  },
  {
    name: 'Calça Alfaiataria Chino Areia',
    description: 'Calça chino elegante em sarja de algodão com elastano para máximo conforto.',
    category: 'Calças',
    size: '40',
    price: 219.9,
    stock_quantity: 15,
  },
  {
    name: 'Vestido Midi Floral Tropical',
    description: 'Vestido fluido midi com estampa botânica vibrante, decote suave e faixa para amarração.',
    category: 'Vestidos',
    size: 'M',
    price: 269.9,
    stock_quantity: 18,
  },
  {
    name: 'Vestido Longo Noite Elegance',
    description: 'Vestido clássico para eventos noturnos, tecido acetinado com drapeado nas costas.',
    category: 'Vestidos',
    size: 'G',
    price: 349.9,
    stock_quantity: 10,
  },
  {
    name: 'Bermuda Sarja Confort Caqui',
    description: 'Bermuda casual versátil com fechamento por botão e passantes para cinto.',
    category: 'Bermudas',
    size: '42',
    price: 119.9,
    stock_quantity: 35,
  },
  {
    name: 'Jaqueta Jeans Vintage Oversized',
    description: 'Jaqueta unissex com botões de metal fosco, bolsos frontais e estilo atemporal.',
    category: 'Casacos & Jaquetas',
    size: 'G',
    price: 289.9,
    stock_quantity: 12,
  },
  {
    name: 'Blazer Estruturado Cinza Chumbo',
    description: 'Blazer forrado com modelagem moderna perfeito para composições de trabalho e eventos.',
    category: 'Casacos & Jaquetas',
    size: 'M',
    price: 399.9,
    stock_quantity: 8,
  },
  {
    name: 'Saia Plissada Midi Verde Oliva',
    description: 'Saia feminina com pregas bem vincadas e elástico na cintura para ajuste prático.',
    category: 'Saias',
    size: 'P',
    price: 149.9,
    stock_quantity: 22,
  },
  {
    name: 'Blusa Crepe Manga Bufante Branca',
    description: 'Blusa feminina delicada com mangas românticas e acabamento perolado.',
    category: 'Blusas',
    size: 'M',
    price: 129.9,
    stock_quantity: 28,
  },
  {
    name: 'Suéter Tricô Gola Careca Bordô',
    description: 'Suéter de tricotagem encorpada e macia para dias mais frescos.',
    category: 'Casacos & Jaquetas',
    size: 'GG',
    price: 179.9,
    stock_quantity: 16,
  },
  {
    name: 'Polo Piquet Algodão Azul Céu',
    description: 'Camisa polo com peitilho de dois botões e gola canelada em piquet puro algodão.',
    category: 'Camisas',
    size: 'P',
    price: 99.9,
    stock_quantity: 40,
  },
  {
    name: 'Regata Canelada Ribana Off-White',
    description: 'Regata com malha canelada elástica ideal para sobreposições de meia-estação.',
    category: 'Camisetas',
    size: 'U',
    price: 49.9,
    stock_quantity: 60,
  },
];

export async function seedDemoData(): Promise<void> {
  runMigrations();

  console.log('Iniciando carga de dados fictícios de demonstração...');

  const passwordHash = await bcrypt.hash('vestebem123', SALT_ROUNDS);

  const demoUsers = [
    {
      name: 'Carlos Oliveira (Cliente)',
      email: 'carlos@cliente.com',
      role: 'customer',
      cpf: '000.111.222-33',
      phone: '(11) 98765-4321',
      address: {
        recipient: 'Carlos Oliveira',
        zip_code: '01310-100',
        street: 'Avenida Paulista',
        number: '1578',
        complement: 'Apto 101',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      },
    },
    {
      name: 'Ana Pereira (Cliente)',
      email: 'ana@cliente.com',
      role: 'customer',
      cpf: '444.555.666-77',
      phone: '(21) 99876-5432',
      address: {
        recipient: 'Ana Pereira',
        zip_code: '22041-001',
        street: 'Avenida Atlântica',
        number: '2000',
        complement: 'Bloco B',
        neighborhood: 'Copacabana',
        city: 'Rio de Janeiro',
        state: 'RJ',
      },
    },
    {
      name: 'Mariana Silva (Funcionária)',
      email: 'mariana@vestebem.com',
      role: 'employee',
      cpf: null,
      phone: '(11) 91234-5678',
      address: null,
    },
  ];

  const transaction = db.transaction(() => {
    // 1. Cadastrar ou atualizar usuários com CPF, telefone e endereço
    const userMap = new Map<string, number>();

    for (const demoUser of demoUsers) {
      const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(demoUser.email) as { id: number } | undefined;

      let userId: number;
      if (!existingUser) {
        const insertUser = db.prepare(`
          INSERT INTO users (name, email, password_hash, role, cpf, phone)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const res = insertUser.run(demoUser.name, demoUser.email, passwordHash, demoUser.role, demoUser.cpf, demoUser.phone);
        userId = Number(res.lastInsertRowid);
        console.log(`Usuário criado: ${demoUser.email} (Perfil: ${demoUser.role})`);
      } else {
        userId = existingUser.id;
        db.prepare('UPDATE users SET role = ?, cpf = COALESCE(cpf, ?), phone = COALESCE(phone, ?) WHERE id = ?')
          .run(demoUser.role, demoUser.cpf, demoUser.phone, userId);
        console.log(`Usuário já existente atualizado: ${demoUser.email} (ID: ${userId})`);
      }
      userMap.set(demoUser.email, userId);

      // Cadastrar endereço de entrega se houver
      if (demoUser.address) {
        const existingAddr = db.prepare('SELECT id FROM user_addresses WHERE user_id = ?').get(userId);
        if (!existingAddr) {
          db.prepare(`
            INSERT INTO user_addresses (user_id, recipient, zip_code, street, number, complement, neighborhood, city, state)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            userId,
            demoUser.address.recipient,
            demoUser.address.zip_code,
            demoUser.address.street,
            demoUser.address.number,
            demoUser.address.complement,
            demoUser.address.neighborhood,
            demoUser.address.city,
            demoUser.address.state
          );
          console.log(`Endereço de entrega registrado para ${demoUser.email}`);
        }
      }
    }

    // 2. Cadastrar produtos fictícios do catálogo
    const productMap = new Map<string, number>();

    for (const p of demoProducts) {
      const existingProduct = db.prepare('SELECT id FROM products WHERE name = ?').get(p.name) as { id: number } | undefined;

      let prodId: number;
      if (!existingProduct) {
        const insertProd = db.prepare(`
          INSERT INTO products (name, description, category, size, price, stock_quantity)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const res = insertProd.run(p.name, p.description, p.category, p.size, p.price, p.stock_quantity);
        prodId = Number(res.lastInsertRowid);
        console.log(`Produto cadastrado no catálogo: ${p.name} (R$ ${p.price.toFixed(2)})`);
      } else {
        prodId = existingProduct.id;
      }
      productMap.set(p.name, prodId);
    }
  });

  transaction();
  console.log('Carga de dados de demonstração concluída com sucesso!');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Erro ao executar seed:', err);
      process.exit(1);
    });
}
