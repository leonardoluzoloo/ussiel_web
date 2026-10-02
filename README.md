# NovaTech Angola | Plataforma de E-Commerce Premium de Tecnologia

Plataforma de comércio eletrônico completa, moderna, ultra-rápida e pronta para produção, desenvolvida com padrão visual de grande varejista global adaptada para o mercado de tecnologia e eletrônicos em Angola (Luanda e províncias).

---

## 🚀 Destaques da Plataforma

1. **Identidade Visual Premium**:
   - Paleta de cores tecnológica e profissional: Azul elétrico (`#2563eb`), fundo escuro elegante (`#0b0f19`, `#0f172a`), superfícies limpas (`#ffffff`, `#f8fafc`) e toques vibrantes em coral e esmeralda.
   - Tipografia moderna com **Inter** e **Plus Jakarta Sans**.
   - Precificação e moeda em Kwanzas Angolanos (**Kz**), com formatação real (ex: `Kz 2.798.750`).

2. **Navegação & Header**:
   - Faixa superior informativa com avisos de entregas em Luanda, WhatsApp direto e rastreamento.
   - Barra de busca inteligente com **autocomplete em tempo real**, pesquisas recentes clicáveis, categorias populares e visualização instantânea de miniaturas de produtos.
   - **Mega Menu** organizado por departamentos (Smartphones, Computadores, Gaming, TV, Áudio, Smartwatches, Periféricos, Redes) com contadores de itens e box promocional.
   - Contadores reativos em tempo real para **Carrinho 🛒** e **Favoritos ❤️**.

3. **Experiência do Carrinho (Mini Cart & Página Dedicada)**:
   - **Drawer lateral (Mini Cart)** acessível de qualquer página.
   - **Barra de progresso de Frete Grátis** ("Faltam Kz XX para você ganhar Frete Grátis em Luanda!").
   - Modificadores instantâneos de quantidade `[-] 1 [+]` e remoção com feedback.
   - Sistema de **Cupons Promocionais** instantâneos (ex: `TECH10` para 10% OFF, `NOVATECH50` para Kz 50.000 OFF, `FRETEGRATIS`).
   - Persistência com `localStorage` em tempo real.

4. **Catálogo & Filtros Dinâmicos**:
   - Sidebar responsiva com filtros dinâmicos: Faixa de Preço (slider interativo), Marcas com contagem de produtos, Avaliação mínima, Apenas em Stock, Apenas em Promoção.
   - Ordenação dinâmica (Menor Preço, Maior Preço, Mais Relevantes, Novidades, Melhor Avaliados).

5. **Página de Produto (PDP) de Alto Nível**:
   - Galeria de imagens interativa com miniaturas e **zoom dinâmico** ao passar o mouse.
   - Seletores de variantes em tempo real: **Cores** (com preview em swatches coloridos) e **Armazenamento** (128GB, 256GB, 512GB, 1TB).
   - Selo de disponibilidade em estoque e cálculo de parcelamento simulado.
   - Botões: *Adicionar ao Carrinho* (com microinteração e toast), *Comprar Agora* (direto para checkout) e *Favoritar ❤️*.
   - Abas ricas: **Descrição Completa**, **Ficha Técnica Detalhada**, **Avaliações Verificadas** (com formulário interativo de envio de review) e **Políticas de Entrega**.
   - Seções de recomendação: *"Você Também Pode Gostar"* e *"Quem Comprou Este, Também Comprou"*.

6. **Checkout Seguro em Etapas (Angola)**:
   - Permite compra como visitante ou com conta de cliente.
   - 4 etapas claras: Identificação → Endereço em Angola (Luanda e Províncias) → Método de Entrega (Normal 24-48h, Expresso Mesmo Dia, Levantamento no Showroom) → Método de Pagamento.
   - Métodos de Pagamento Angolanos: **Multicaixa Express**, **Transferência Bancária (IBAN BAI/BFA/BIC)**, **Referência Multicaixa** e **Pagamento na Entrega (TPA)**.
   - Tela de confirmação com geração de código único de pedido (ex: `#NV-2026-8941`), resumo fiscal e **timeline gráfica de status com 6 etapas**.

7. **Área do Cliente ("Minha Conta")**:
   - Dashboard com dados do usuário, histórico completo de encomendas com **timeline visual de rastreamento**, lista de produtos favoritos e endereços salvos.

8. **Painel Administrativo Completo (`#/admin`)**:
   - Métricas em tempo real: Faturamento Total (Kz), Pedidos Recebidos, Total de Produtos e Estoque.
   - Tabela de Encomendas com dropdown para **alterar o status do pedido em tempo real** (Recebido → Confirmado → Em Preparação → Enviado → Em Trânsito → Entregue).
   - Gestão de Inventário de Produtos: Adicionar novos produtos via formulário, editar quantidade em estoque diretamente na tabela e excluir produtos.
   - Gerenciamento de Cupons de desconto ativos.

9. **Experiência Mobile First**:
   - Menu hambúrguer lateral com drawer sanfonado.
   - Scroll horizontal de categorias estilo app.
   - **Bottom Navigation Bar fixa** (`Início`, `Categorias`, `Favoritos`, `Carrinho`, `Conta`) com badges dinâmicos.
   - Botão flutuante do **WhatsApp** com badge pulsante e suporte conversacional rápido sem bloquear o carrinho.

10. **Backend Python FastAPI (`backend/`)**:
    - Arquitetura limpa com modelos SQLAlchemy para 20 entidades, validação Pydantic, rotas RESTful para produtos, pedidos, cupons, autenticação e documentação interativa OpenAPI/Swagger UI em `/docs`.

---

## 🛠️ Como Executar o Projeto

### Frontend (Vite)
```bash
# Instalar dependências (já instaladas)
npm install

# Iniciar servidor local
npm run dev

# Compilar para produção
npm run build
```
O frontend estará acessível em: **`http://localhost:5173/`**

### Backend (Python FastAPI)
```bash
# Instalar dependências
pip install -r backend/requirements.txt

# (Opcional) Popular banco de dados SQLite/PostgreSQL
python -m backend.seed

# Iniciar servidor FastAPI
uvicorn backend.main:app --reload --port 8000
```
- Swagger UI interativo: **`http://localhost:8000/docs`**
- API Health Check: **`http://localhost:8000/`**

---

## 🏷️ Cupons de Teste Pré-Configurados
- `TECH10`: 10% de desconto imediato em todo o carrinho.
- `NOVATECH50`: Kz 50.000 de desconto em compras.
- `FRETEGRATIS`: Isenção total de frete para qualquer província.
