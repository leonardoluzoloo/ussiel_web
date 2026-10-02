from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import re
from urllib.parse import quote_plus
from dotenv import load_dotenv

# Carrega variáveis do .env na raiz do projeto ou na pasta backend
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./novatech.db")

# 1. Tratamento automático de senhas com caracteres especiais como '@'
# Exemplo comum: senha terminando com @ gera '@@' na connection string
if "@@" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("@@", "%40@")

# Regex para garantir codificação correta de senhas com caracteres reservados na URL
match = re.match(r'^(postgres(?:ql)?(?:\+psycopg2)?://)([^:]+):(.+)@([^@]+)$', DATABASE_URL)
if match:
    proto, user, pwd, host_part = match.groups()
    if "@" in pwd:
        encoded_pwd = quote_plus(pwd)
        DATABASE_URL = f"{proto}{user}:{encoded_pwd}@{host_part}"

# 2. Ajuste automático de compatibilidade para Supabase PostgreSQL
# SQLAlchemy exige 'postgresql://' ou 'postgresql+psycopg2://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

connect_args = {}
engine_kwargs = {}

if "sqlite" in DATABASE_URL:
    connect_args["check_same_thread"] = False
else:
    # Configurações otimizadas para Supabase (PgBouncer e conexões remotas seguras)
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
