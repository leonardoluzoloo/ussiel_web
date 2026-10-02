from .database import engine, SessionLocal, Base
from . import models
from .security import get_password_hash
import os

def seed():
    # Cria as tabelas caso ainda não existam no banco configurado (Postgres Supabase ou SQLite)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("--- INICIANDO SEED DO BANCO DE DADOS (NOVATECH ANGOLA) ---")

        # 1. CATEGORIAS
        categories_data = [
            {"slug": "smartphones", "name": "Smartphones", "icon_name": "smartphone", "description": "Smartphones topo de gama em Luanda"},
            {"slug": "computadores", "name": "Computadores", "icon_name": "laptop", "description": "Laptops e Desktops profissionais"},
            {"slug": "gaming", "name": "Gaming & Consoles", "icon_name": "gamepad", "description": "Consoles e setup gamer"},
            {"slug": "televisoes", "name": "Televisões & Vídeo", "icon_name": "tv", "description": "Smart TVs 4K e OLED"},
            {"slug": "audio", "name": "Áudio & Auscultadores", "icon_name": "headphones", "description": "Fones e caixas Bluetooth"},
            {"slug": "smartwatches", "name": "Smartwatches", "icon_name": "watch", "description": "Relógios inteligentes e wearables"},
            {"slug": "redes", "name": "Redes & Armazenamento", "icon_name": "server", "description": "SSDs e Roteadores"},
            {"slug": "perifericos", "name": "Periféricos", "icon_name": "cpu", "description": "Teclados e mouses"}
        ]

        category_map = {}
        for cat_info in categories_data:
            cat = db.query(models.Category).filter(models.Category.slug == cat_info["slug"]).first()
            if not cat:
                cat = models.Category(**cat_info)
                db.add(cat)
                db.commit()
                db.refresh(cat)
                print(f"[OK] Categoria criada: {cat.name}")
            category_map[cat.slug] = cat.id

        # 2. CUPONS
        coupons_data = [
            {"code": "TECH10", "discount_type": "percent", "discount_value": 10.0, "min_order_value": 0.0, "is_active": True},
            {"code": "NOVATECH50", "discount_type": "fixed", "discount_value": 50000.0, "min_order_value": 500000.0, "is_active": True},
            {"code": "FRETEGRATIS", "discount_type": "free_shipping", "discount_value": 0.0, "min_order_value": 0.0, "is_active": True},
        ]
        for c_info in coupons_data:
            existing_coupon = db.query(models.Coupon).filter(models.Coupon.code == c_info["code"]).first()
            if not existing_coupon:
                db.add(models.Coupon(**c_info))
                print(f"[OK] Cupom criado: {c_info['code']}")
        db.commit()

        # 3. USUÁRIOS (ADMIN E CLIENTE DEMO)
        admin_email = os.getenv("ADMIN_EMAIL", "admin@novatech.co.ao")
        admin_pass = os.getenv("ADMIN_PASSWORD", "AdminNovaTech2026!")
        admin_user = db.query(models.User).filter(models.User.email == admin_email).first()
        if not admin_user:
            admin_user = models.User(
                name="Administrador NovaTech",
                email=admin_email,
                hashed_password=get_password_hash(admin_pass),
                phone="+244 923 179 192",
                role="admin",
                is_active=True
            )
            db.add(admin_user)
            print(f"[OK] Usuario Administrador criado com sucesso: {admin_email}")

        # Cliente de Teste
        demo_email = "cliente@novatech.co.ao"
        demo_user = db.query(models.User).filter(models.User.email == demo_email).first()
        if not demo_user:
            demo_user = models.User(
                name="Mateus Domingos",
                email=demo_email,
                hashed_password=get_password_hash("ClienteNovaTech2026!"),
                phone="+244 923 888 777",
                role="customer",
                is_active=True
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)

            # Endereço padrão para o cliente
            default_addr = models.Address(
                user_id=demo_user.id,
                province="Luanda",
                city="Talatona",
                neighborhood="Morro Bento",
                street="Avenida Principal",
                number="124",
                reference="Próximo ao Belas Shopping",
                is_default=True
            )
            db.add(default_addr)
            print(f"[OK] Usuario Cliente criado com sucesso: {demo_email}")
        db.commit()

        # 4. PRODUTOS DO CATÁLOGO
        products_data = [
            {
                "sku": "NV-APL-IP16PM-256",
                "name": "Apple iPhone 16 Pro Max 256GB Titânio Preto",
                "slug": "apple-iphone-16-pro-max-256gb",
                "category_slug": "smartphones",
                "brand": "Apple",
                "old_price": 3100000.0,
                "price": 2798750.0,
                "stock": 12,
                "is_featured": True,
                "is_deal": True,
                "image": "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=85",
                "gallery": [
                    "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=85",
                    "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=85",
                    "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=85"
                ],
                "variants": {
                    "colors": [
                        {"name": "Titânio Preto", "hex": "#212023"},
                        {"name": "Titânio Natural", "hex": "#9d9890"},
                        {"name": "Titânio Branco", "hex": "#f2f1ed"},
                        {"name": "Titânio Deserto", "hex": "#c5a78d"}
                    ],
                    "storage": ["256GB", "512GB", "1TB"],
                    "storagePrices": {"256GB": 2798750, "512GB": 3190000, "1TB": 3650000}
                },
                "specs": {
                    "Tela": '6.9" Super Retina XDR OLED com ProMotion 120Hz',
                    "Processador": "Apple A18 Pro (3nm de 2ª geração)",
                    "Câmeras Traseiras": "48 MP Principal + 48 MP Ultra-Angular + 12 MP Teleobjetiva 5x",
                    "Câmera Frontal": "12 MP TrueDepth com Autofoco",
                    "Armazenamento": "256GB NVMe",
                    "Bateria": "Até 33 horas de reprodução de vídeo contínua",
                    "Conectividade": "5G Ultra Wideband, Wi-Fi 7, Bluetooth 5.3, USB-C 3.2",
                    "Garantia": "12 meses oficial Apple / NovaTech Angola"
                },
                "badges": ["OFERTA", "NOVO"],
                "rating": 5.0,
                "review_count": 34,
                "description": "O iPhone 16 Pro Max traz o poderoso chip A18 Pro, estrutura em titânio aeroespacial mais leve e resistente, botão de Controle da Câmera para cliques instantâneos, e gravação em 4K a 120 qps Dolby Vision. A maior tela já vista em um iPhone com bateria que dura o dia inteiro."
            },
            {
                "sku": "NV-SAM-S24U-512",
                "name": "Samsung Galaxy S24 Ultra 512GB Titânio Cinza com Galaxy AI",
                "slug": "samsung-galaxy-s24-ultra-512gb",
                "category_slug": "smartphones",
                "brand": "Samsung",
                "old_price": 2500000.0,
                "price": 2250000.0,
                "stock": 8,
                "is_featured": True,
                "is_deal": True,
                "image": "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=85",
                "gallery": [
                    "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=85",
                    "https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=800&q=85"
                ],
                "variants": {
                    "colors": [
                        {"name": "Titânio Cinza", "hex": "#63666a"},
                        {"name": "Titânio Preto", "hex": "#2b2c2f"},
                        {"name": "Titânio Violeta", "hex": "#584f70"}
                    ],
                    "storage": ["256GB", "512GB", "1TB"],
                    "storagePrices": {"256GB": 1990000, "512GB": 2250000, "1TB": 2590000}
                },
                "specs": {
                    "Tela": '6.8" Dynamic AMOLED 2X QHD+ 120Hz com Gorilla Armor antirreflexo',
                    "Processador": "Snapdragon 8 Gen 3 for Galaxy",
                    "Memória RAM": "12GB LPDDR5X",
                    "Câmeras": "200 MP + 50 MP (5x) + 12 MP + 10 MP (3x)",
                    "S Pen": "Integrada no chassi com baixa latência",
                    "Bateria": "5.000 mAh com carregamento rápido 45W"
                },
                "badges": ["OFERTA"],
                "rating": 4.9,
                "review_count": 28,
                "description": "Com inteligência artificial nativa Galaxy AI, o Galaxy S24 Ultra traduz chamadas em tempo real, pesquisa qualquer coisa circulando na tela e captura fotos noturnas impecáveis com o sensor de 200MP e zoom óptico 5x."
            },
            {
                "sku": "NV-APL-MBP16-M3M",
                "name": 'Apple MacBook Pro 16" M3 Max 36GB RAM 1TB SSD Space Black',
                "slug": "apple-macbook-pro-16-m3-max-36gb",
                "category_slug": "computadores",
                "brand": "Apple",
                "old_price": 5390000.0,
                "price": 4850000.0,
                "stock": 5,
                "is_featured": True,
                "is_deal": False,
                "image": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=85",
                "gallery": [
                    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=85",
                    "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=85"
                ],
                "variants": {
                    "colors": [
                        {"name": "Space Black", "hex": "#242527"},
                        {"name": "Silver", "hex": "#e2e4e6"}
                    ],
                    "storage": ["1TB SSD", "2TB SSD", "4TB SSD"],
                    "storagePrices": {"1TB SSD": 4850000, "2TB SSD": 5590000, "4TB SSD": 6890000}
                },
                "specs": {
                    "Processador": "Apple M3 Max (14 núcleos CPU, 30 núcleos GPU)",
                    "Memória Unificada": "36GB rápida de alta largura de banda",
                    "Armazenamento": "1TB SSD super-rápido",
                    "Tela": '16.2" Liquid Retina XDR (3456 x 2234) 120Hz ProMotion',
                    "Portas": "3x Thunderbolt 4 (USB-C), HDMI, MagSafe 3, Slot SDXC",
                    "Autonomia": "Até 22 horas de bateria contínua"
                },
                "badges": ["TOP PERFORMER"],
                "rating": 5.0,
                "review_count": 19,
                "description": "A máquina definitiva para edição de vídeo 8K, renderização 3D e desenvolvimento de inteligência artificial. Equipado com chip M3 Max com CPU de 14 núcleos e GPU de 30 núcleos."
            },
            {
                "sku": "NV-DEL-XPS15-I9",
                "name": "Dell XPS 15 9530 OLED Intel Core i9-13900H 32GB 1TB RTX 4070",
                "slug": "dell-xps-15-oled-core-i9-rtx4070",
                "category_slug": "computadores",
                "brand": "Dell",
                "old_price": 3800000.0,
                "price": 3390000.0,
                "stock": 4,
                "is_featured": True,
                "is_deal": False,
                "image": "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=85",
                "gallery": [
                    "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=85"
                ],
                "variants": {
                    "colors": [{"name": "Platinum Silver / Preto Fibra de Carbono", "hex": "#262626"}],
                    "storage": ["1TB SSD", "2TB SSD"],
                    "storagePrices": {"1TB SSD": 3390000, "2TB SSD": 3890000}
                },
                "specs": {
                    "Processador": "Intel Core i9-13900H (14 núcleos, até 5.4 GHz)",
                    "Placa Gráfica": "NVIDIA GeForce RTX 4070 8GB GDDR6",
                    "Memória RAM": "32GB DDR5 4800MHz",
                    "Tela": '15.6" OLED 3.5K (3456 x 2160) Touch InfinittyEdge',
                    "Sistema Operacional": "Windows 11 Pro Original"
                },
                "badges": ["OFERTA"],
                "rating": 4.8,
                "review_count": 15,
                "description": "Design refinado em alumínio usinado CNC com apoio para mãos em fibra de carbono aeroespacial. Desempenho profissional para engenharia, arquitetura e criação digital."
            },
            {
                "sku": "NV-SON-PS5S-1TB",
                "name": "Console Sony PlayStation 5 Slim 1TB + 2 Comandos DualSense",
                "slug": "sony-playstation-5-slim-1tb-bundle",
                "category_slug": "gaming",
                "brand": "Sony",
                "old_price": 990000.0,
                "price": 890000.0,
                "stock": 15,
                "is_featured": True,
                "is_deal": True,
                "image": "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=85",
                "gallery": [
                    "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=85",
                    "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=85"
                ],
                "variants": {
                    "colors": [{"name": "Branco Glacier", "hex": "#ffffff"}],
                    "storage": ["1TB SSD", "2TB SSD"],
                    "storagePrices": {"1TB SSD": 890000, "2TB SSD": 1090000}
                },
                "specs": {
                    "Armazenamento": "SSD personalizado de 1TB (expansível com M.2)",
                    "Resolução Suportada": "Até 4K a 120Hz e suporte a saída 8K",
                    "Tecnologia Gráfica": "Ray Tracing acelerado por hardware",
                    "Inclui": "Console PS5 Slim, 2 Comandos DualSense, Cabos HDMI 2.1 e Energia"
                },
                "badges": ["MAIS VENDIDO", "OFERTA"],
                "rating": 4.9,
                "review_count": 52,
                "description": "Experimente carregamentos quase instantâneos com o SSD de alta velocidade, imersão profunda com resposta tátil, gatilhos adaptáveis e áudio em 3D. Acompanha 2 comandos sem fio DualSense oficiais."
            },
            {
                "sku": "NV-MSF-XSX-1TB",
                "name": "Console Microsoft Xbox Series X 1TB 4K 120FPS Preto Fosco",
                "slug": "microsoft-xbox-series-x-1tb",
                "category_slug": "gaming",
                "brand": "Microsoft",
                "old_price": 950000.0,
                "price": 865000.0,
                "stock": 7,
                "is_featured": True,
                "is_deal": False,
                "image": "https://images.unsplash.com/photo-1621259182978-fbf93132d53d?auto=format&fit=crop&w=800&q=85",
                "gallery": [
                    "https://images.unsplash.com/photo-1621259182978-fbf93132d53d?auto=format&fit=crop&w=800&q=85"
                ],
                "variants": {
                    "colors": [{"name": "Preto Fosco", "hex": "#18181b"}],
                    "storage": ["1TB SSD", "2TB SSD"],
                    "storagePrices": {"1TB SSD": 865000, "2TB SSD": 1050000}
                },
                "specs": {
                    "Poder de Processamento": "12 Teraflops de potência gráfica RDNA 2",
                    "Armazenamento": "1TB NVMe SSD Customizado",
                    "Taxa de Atualização": "Até 120 quadros por segundo com HDR",
                    "Quick Resume": "Alterne entre múltiplos jogos instantaneamente"
                },
                "badges": ["OFERTA"],
                "rating": 4.8,
                "review_count": 22,
                "description": "O Xbox mais rápido e potente de todos os tempos. Jogue milhares de títulos através de quatro gerações de consoles com tempos de inicialização ultrarrápidos e gráficos em 4K nativo."
            },
            {
                "sku": "NV-LGE-OLED65G3",
                "name": 'Smart TV LG OLED evo 65" 4K 120Hz Dolby Vision G3 Gallery Design',
                "slug": "smart-tv-lg-oled-65-g3-4k",
                "category_slug": "televisoes",
                "brand": "LG",
                "old_price": 3400000.0,
                "price": 2950000.0,
                "stock": 6,
                "is_featured": True,
                "is_deal": False,
                "image": "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=85",
                "gallery": [
                    "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=85"
                ],
                "variants": {
                    "colors": [{"name": "Preto / Moldura Zero", "hex": "#0f172a"}],
                    "storage": ["65 Polegadas"]
                },
                "specs": {
                    "Tamanho da Tela": "65 Polegadas OLED evo 4K (3840 x 2160)",
                    "Taxa de Atualização": "120Hz nativo, VRR, NVIDIA G-Sync, AMD FreeSync",
                    "Processador": "α9 AI 4K Gen6 com inteligência de som e imagem",
                    "Áudio": "60W 4.2 canais com Dolby Atmos",
                    "Conexões": "4x HDMI 2.1 completos"
                },
                "badges": ["PREMIUM CINEMA"],
                "rating": 5.0,
                "review_count": 16,
                "description": "Pretos perfeitos, contraste infinito e brilho até 70% maior com a tecnologia Brightness Booster Max. Design Gallery ultra-fino para montagem nivelada à parede como uma obra de arte."
            },
            {
                "sku": "NV-SNY-WH1000XM5",
                "name": "Auscultadores Sony WH-1000XM5 Noise Cancelling Bluetooth",
                "slug": "sony-wh-1000xm5-noise-cancelling",
                "category_slug": "audio",
                "brand": "Sony",
                "old_price": 650000.0,
                "price": 580000.0,
                "stock": 14,
                "is_featured": True,
                "is_deal": True,
                "image": "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=85",
                "gallery": [
                    "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=85"
                ],
                "variants": {
                    "colors": [
                        {"name": "Preto Meia-Noite", "hex": "#18181b"},
                        {"name": "Prata Platina", "hex": "#e2e4e6"},
                        {"name": "Azul Marinho Noturno", "hex": "#1e3a8a"}
                    ]
                },
                "specs": {
                    "Cancelamento Ativo": "Tecnologia Auto NC Optimizer com 8 microfones",
                    "Drivers": "30mm especialmente projetados com fibra de carbono",
                    "Bateria": "Até 30 horas de reprodução contínua (3 min = 3h de carga)",
                    "Conexão": "Bluetooth 5.2 Multiponto (conecta 2 aparelhos ao mesmo tempo)"
                },
                "badges": ["OFERTA", "NOVO"],
                "rating": 4.9,
                "review_count": 41,
                "description": "Com dois processadores e 8 microfones dedicados, o WH-1000XM5 redefine o silêncio. Áudio em alta resolução sem fio (Hi-Res Audio Wireless e LDAC) e até 30 horas de autonomia com carga ultra-rápida."
            },
            {
                "sku": "NV-APL-WULTRA2-49",
                "name": "Apple Watch Ultra 2 GPS + Cellular 49mm Caixa Titânio",
                "slug": "apple-watch-ultra-2-49mm-titanio",
                "category_slug": "smartwatches",
                "brand": "Apple",
                "old_price": 1490000.0,
                "price": 1350000.0,
                "stock": 9,
                "is_featured": True,
                "is_deal": False,
                "image": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=85",
                "gallery": [
                    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=85"
                ],
                "variants": {
                    "colors": [
                        {"name": "Titânio Natural / Laranja Ocean", "hex": "#f97316"},
                        {"name": "Titânio / Bracelete Alpine Azul", "hex": "#3b82f6"}
                    ]
                },
                "specs": {
                    "Caixa": "49mm Titânio aeroespacial resistente a impactos",
                    "Brilho da Tela": "Até 3000 nits (legível sob o sol mais forte)",
                    "Resistência à Água": "100m para mergulho recreativo e esportes náuticos",
                    "Bateria": "Até 36 horas em uso normal e até 72 horas em modo de poupança"
                },
                "badges": ["PREMIUM"],
                "rating": 5.0,
                "review_count": 23,
                "description": "O relógio desportivo mais robusto e capaz. Caixa de titânio aeroespacial de 49mm resistente à corrosão, tela Retina de 3000 nits e GPS de dupla frequência para máxima precisão."
            },
            {
                "sku": "NV-JBL-BOOMBOX3-WF",
                "name": "Coluna Portátil JBL Boombox 3 Wi-Fi & Bluetooth com Dolby Atmos",
                "slug": "jbl-boombox-3-wifi-dolby-atmos",
                "category_slug": "audio",
                "brand": "JBL",
                "old_price": 620000.0,
                "price": 540000.0,
                "stock": 11,
                "is_featured": False,
                "is_deal": False,
                "image": "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=85",
                "gallery": [
                    "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=85",
                    "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=85"
                ],
                "variants": {
                    "colors": [{"name": "Preto Pro Sound", "hex": "#18181b"}]
                },
                "specs": {
                    "Potência": "180W RMS (modo AC) com subwoofer integrado",
                    "Bateria": "Até 24 horas ininterruptas de festa",
                    "Proteção": "Classificação IP67 à prova d’água e poeira",
                    "Powerbank Embutido": "Carregue seu telemóvel enquanto escuta música"
                },
                "badges": ["OFERTA"],
                "rating": 4.8,
                "review_count": 37,
                "description": "Som estrondoso com os graves mais profundos já reproduzidos em uma caixa portátil da JBL. Conectividade Wi-Fi para transmissão em alta fidelidade e Dolby Atmos 3D."
            },
            {
                "sku": "NV-LOG-MXM3S-GR",
                "name": "Rato Sem Fio Logitech MX Master 3S Darkfield 8000 DPI Silencioso",
                "slug": "logitech-mx-master-3s-mouse",
                "category_slug": "perifericos",
                "brand": "Logitech",
                "old_price": 170000.0,
                "price": 145000.0,
                "stock": 25,
                "is_featured": False,
                "is_deal": False,
                "image": "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=85",
                "gallery": [
                    "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=85"
                ],
                "variants": {
                    "colors": [
                        {"name": "Grafite Escuro", "hex": "#27272a"},
                        {"name": "Cinza Claro", "hex": "#e4e4e7"}
                    ]
                },
                "specs": {
                    "Sensor": "Darkfield de alta precisão 8000 DPI configurável",
                    "Conexão": "Bluetooth Low Energy + Receptor Logi Bolt USB",
                    "Bateria": "Até 70 dias com carga total (1 min = 3h de uso)",
                    "Compatibilidade": "Windows, macOS, Linux, iPadOS, Android"
                },
                "badges": ["MAIS VENDIDO"],
                "rating": 4.9,
                "review_count": 45,
                "description": "O ícone remasterizado da produtividade. Cliques 90% mais silenciosos, sensor óptico de 8000 DPI que funciona em qualquer superfície (inclusive vidro) e rolagem eletromagnética MagSpeed de 1000 linhas por segundo."
            },
            {
                "sku": "NV-SDK-EXT2TB-NVME",
                "name": "SSD Externo SanDisk Extreme Pro 2TB NVMe USB 3.2 Gen 2x2 2000MB/s",
                "slug": "sandisk-extreme-pro-2tb-nvme",
                "category_slug": "redes",
                "brand": "SanDisk",
                "old_price": 340000.0,
                "price": 290000.0,
                "stock": 18,
                "is_featured": False,
                "is_deal": False,
                "image": "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=800&q=85",
                "gallery": [
                    "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=800&q=85"
                ],
                "variants": {
                    "storage": ["1TB", "2TB", "4TB"],
                    "storagePrices": {"1TB": 175000, "2TB": 290000, "4TB": 540000}
                },
                "specs": {
                    "Velocidade": "Até 2000 MB/s Leitura e Escrita",
                    "Interface": "USB 3.2 Gen 2x2 (compatível com Type-C)",
                    "Resistência": "Proteção contra quedas de até 3 metros e classificação IP65",
                    "Criptografia": "Hardware AES de 256 bits protegida por senha"
                },
                "badges": ["OFERTA"],
                "rating": 4.9,
                "review_count": 31,
                "description": "Velocidade de estado sólido NVMe ultrarrápida de até 2000MB/s de leitura e gravação em um drive portátil reforçado e resistente para suportar qualquer aventura ou fluxo de trabalho profissional."
            }
        ]

        for p_info in products_data:
            cat_slug = p_info.pop("category_slug")
            cat_id = category_map.get(cat_slug)
            existing_p = db.query(models.Product).filter(models.Product.sku == p_info["sku"]).first()
            if not existing_p:
                product = models.Product(category_id=cat_id, **p_info)
                db.add(product)
                print(f"[OK] Produto cadastrado: {product.name} (Estoque: {product.stock} un.)")
        db.commit()

        print("--- BANCO DE DADOS POPULADO COM SUCESSO! ---")
        print(f"Total Categorias: {db.query(models.Category).count()}")
        print(f"Total Produtos: {db.query(models.Product).count()}")
        print(f"Total Cupons: {db.query(models.Coupon).count()}")
        print(f"Total Usuários: {db.query(models.User).count()}")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
