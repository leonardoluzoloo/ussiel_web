# NovaTech Angola - Backend API (FastAPI + SQLAlchemy)

Backend moderno, rápido e escalável para a plataforma de comércio eletrônico **NovaTech Angola**.

## Tecnologias
- **Linguagem**: Python 3.11+
- **Framework Web**: FastAPI
- **ORM**: SQLAlchemy
- **Banco de Dados**: SQLite (padrão zero-configuração) ou PostgreSQL (via `DATABASE_URL`)
- **Validação**: Pydantic v2
- **Documentação Interativa**: OpenAPI / Swagger UI

## Como Executar o Backend

1. Crie ou ative um ambiente virtual Python:
```bash
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
```

2. Instale as dependências:
```bash
pip install -r backend/requirements.txt
```

3. (Opcional) Popule o banco com dados iniciais:
```bash
python -m backend.seed
```

4. Inicie o servidor FastAPI com live-reload:
```bash
uvicorn backend.main:app --reload --port 8000
```

5. Acesse a documentação interativa da API:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/](http://localhost:8000/)

## Rotas Principais
- `GET /api/products`: Lista e filtra produtos por categoria, marca ou pesquisa.
- `GET /api/products/{slug}`: Detalhes de um produto específico.
- `GET /api/categories`: Lista todas as categorias e subcategorias.
- `POST /api/orders`: Cria novo pedido com validação de itens e pagamento.
- `GET /api/orders/track/{order_code}`: Rastreia pedido e retorna timeline de status.
- `GET /api/coupons/validate/{code}`: Valida cupons promocionais (ex: `TECH10`).
- `POST /api/newsletter`: Registra e-mail na newsletter e gera cupom.
