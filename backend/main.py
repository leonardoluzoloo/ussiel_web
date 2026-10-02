from fastapi import FastAPI, Depends, HTTPException, status, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import os
from datetime import datetime

from .database import engine, Base, get_db
from . import models, schemas
from .security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    get_current_user_optional,
    get_current_admin
)

# Cria tabelas no banco de dados configurado (PostgreSQL Supabase ou SQLite)
try:
    Base.metadata.create_all(bind=engine)
    print("[OK] Banco de dados conectado e tabelas sincronizadas com sucesso.")
except Exception as e:
    print("\n" + "=" * 75)
    print("[AVISO] Falha de conexão inicial com o banco de dados:")
    print(f"Erro: {e}")
    print("\nDICA SUPABASE (IPv4 / IPv6):")
    print("O host 'db.[ref].supabase.co' só suporta IPv6. Se a sua conexão for IPv4,")
    print("acesse o painel do Supabase -> Project Settings -> Database -> Connection string,")
    print("clique na aba 'Connection pooling' (porta 6543 ou 5432) e copie a URI fornecida.")
    print("=" * 75 + "\n")

app = FastAPI(
    title="NovaTech Angola - E-Commerce API",
    description="API RESTful de Alta Performance para E-Commerce Real em Angola (compatível com Supabase PostgreSQL).",
    version="2.0.0"
)

# Configuração de CORS para permitir requisições do frontend
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
origins = [
    FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["Health"])
def health_check():
    return {
        "status": "online",
        "service": "NovaTech Angola E-Commerce Backend",
        "version": "2.0.0",
        "database": "connected",
        "docs_url": "/docs"
    }

# ===================================================================
# 1. AUTENTICAÇÃO & USUÁRIOS
# ===================================================================
@app.post("/api/auth/register", response_model=schemas.Token, tags=["Auth"])
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user_in.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este e-mail já está cadastrado. Por favor, inicie sessão."
        )

    hashed_pw = get_password_hash(user_in.password)
    new_user = models.User(
        name=user_in.name,
        email=user_in.email.lower(),
        hashed_password=hashed_pw,
        phone=user_in.phone,
        role="customer",
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(data={"sub": new_user.email, "role": new_user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": new_user
    }

@app.post("/api/auth/login", response_model=schemas.Token, tags=["Auth"])
def login(login_in: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == login_in.email.lower()).first()
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos. Verifique suas credenciais.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta conta de usuário está desativada."
        )

    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@app.post("/api/auth/google", response_model=schemas.Token, tags=["Auth"])
def google_auth(google_in: schemas.GoogleAuthRequest, db: Session = Depends(get_db)):
    email = None
    name = "Usuário Google"

    # Se um Google ID Token JWT for fornecido, decodifica a parte do payload
    if google_in.credential:
        try:
            import base64
            import json
            parts = google_in.credential.split(".")
            if len(parts) >= 2:
                payload_b64 = parts[1]
                payload_b64 += "=" * (-len(payload_b64) % 4)
                payload_json = base64.urlsafe_b64decode(payload_b64.encode("utf-8")).decode("utf-8")
                payload = json.loads(payload_json)
                email = payload.get("email")
                name = payload.get("name") or name
        except Exception as e:
            print("Aviso ao decodificar token do Google:", e)

    if not email and google_in.email:
        email = str(google_in.email).lower()
        name = google_in.name or name

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível identificar o e-mail da conta Google."
        )

    email = email.lower()
    user = db.query(models.User).filter(models.User.email == email).first()

    admin_count = db.query(models.User).filter(models.User.role == "admin").count()
    is_first_admin = (admin_count == 0) and (google_in.is_admin_setup is True)

    if not user:
        user = models.User(
            name=name,
            email=email,
            hashed_password=get_password_hash(uuid.uuid4().hex),
            role="admin" if is_first_admin else "customer",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif is_first_admin and user.role != "admin":
        user.role = "admin"
        db.commit()
        db.refresh(user)

    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@app.get("/api/auth/me", response_model=schemas.UserResponse, tags=["Auth"])
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.put("/api/auth/profile", response_model=schemas.UserResponse, tags=["Auth"])
def update_profile(
    user_update: schemas.UserBase,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.name = user_update.name
    current_user.phone = user_update.phone
    db.commit()
    db.refresh(current_user)
    return current_user

# ===================================================================
# 2. ENDEREÇOS DO CLIENTE
# ===================================================================
@app.get("/api/addresses", response_model=List[schemas.AddressResponse], tags=["Addresses"])
def get_my_addresses(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Address).filter(models.Address.user_id == current_user.id).all()

@app.post("/api/addresses", response_model=schemas.AddressResponse, tags=["Addresses"])
def add_address(
    addr_in: schemas.AddressCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if addr_in.is_default:
        db.query(models.Address).filter(models.Address.user_id == current_user.id).update({"is_default": False})

    new_addr = models.Address(user_id=current_user.id, **addr_in.dict())
    db.add(new_addr)
    db.commit()
    db.refresh(new_addr)
    return new_addr

# ===================================================================
# 3. CATEGORIAS
# ===================================================================
@app.get("/api/categories", response_model=List[schemas.CategoryResponse], tags=["Categories"])
def get_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).all()

# ===================================================================
# 4. PRODUTOS & CATÁLOGO
# ===================================================================
@app.get("/api/products", response_model=List[schemas.ProductResponse], tags=["Products"])
def get_products(
    category: Optional[str] = None,
    brand: Optional[str] = None,
    search: Optional[str] = None,
    is_deal: Optional[bool] = None,
    is_featured: Optional[bool] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: Optional[str] = "relevant", # relevant, price_asc, price_desc, rating
    db: Session = Depends(get_db)
):
    query = db.query(models.Product).filter(models.Product.is_active == True)

    if category:
        cat = db.query(models.Category).filter(models.Category.slug == category).first()
        if cat:
            query = query.filter(models.Product.category_id == cat.id)

    if brand:
        query = query.filter(models.Product.brand.ilike(f"%{brand}%"))

    if search:
        s = f"%{search}%"
        query = query.filter(
            (models.Product.name.ilike(s)) |
            (models.Product.brand.ilike(s)) |
            (models.Product.sku.ilike(s)) |
            (models.Product.description.ilike(s))
        )

    if is_deal is not None:
        query = query.filter(models.Product.is_deal == is_deal)

    if is_featured is not None:
        query = query.filter(models.Product.is_featured == is_featured)

    if min_price is not None:
        query = query.filter(models.Product.price >= min_price)

    if max_price is not None:
        query = query.filter(models.Product.price <= max_price)

    if sort_by == "price_asc":
        query = query.order_by(models.Product.price.asc())
    elif sort_by == "price_desc":
        query = query.order_by(models.Product.price.desc())
    elif sort_by == "rating":
        query = query.order_by(models.Product.rating.desc())
    else:
        query = query.order_by(models.Product.id.asc())

    return query.all()

@app.get("/api/products/{slug}", response_model=schemas.ProductResponse, tags=["Products"])
def get_product_by_slug(slug: str, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.slug == slug, models.Product.is_active == True).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return product

# ===================================================================
# 5. CUPONS
# ===================================================================
@app.get("/api/coupons/validate/{code}", response_model=schemas.CouponResponse, tags=["Coupons"])
def validate_coupon(code: str, db: Session = Depends(get_db)):
    clean_code = code.strip().upper()
    coupon = db.query(models.Coupon).filter(
        models.Coupon.code == clean_code,
        models.Coupon.is_active == True
    ).first()

    if not coupon:
        raise HTTPException(status_code=404, detail="Cupom inválido ou expirado.")

    if coupon.expires_at and coupon.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Este cupom já expirou.")

    return coupon

# ===================================================================
# 6. PEDIDOS & CHECKOUT
# ===================================================================
@app.post("/api/orders", response_model=schemas.OrderResponse, tags=["Orders"])
def create_order(
    order_in: schemas.OrderCreate,
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    if not order_in.items:
        raise HTTPException(status_code=400, detail="O pedido deve conter pelo menos um item.")

    # Validação e reserva de estoque
    for item in order_in.items:
        if item.product_id:
            product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
            if product:
                if product.stock < item.quantity:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Estoque insuficiente para o produto '{product.name}'. Apenas {product.stock} disponíveis."
                    )
                # Baixa atômica de estoque
                product.stock -= item.quantity

    # Código único com padrão angolano (#NV-2026-XXXXX)
    order_code = f"NV-2026-{uuid.uuid4().hex[:5].upper()}"

    new_order = models.Order(
        order_code=order_code,
        user_id=current_user.id if current_user else None,
        customer_name=order_in.customer_name,
        customer_email=order_in.customer_email.lower(),
        customer_phone=order_in.customer_phone,
        customer_whatsapp=order_in.customer_whatsapp,
        shipping_address=order_in.shipping_address,
        shipping_method=order_in.shipping_method,
        shipping_price=order_in.shipping_price,
        payment_method=order_in.payment_method,
        payment_status="pending",
        payment_details=order_in.payment_details or {},
        subtotal=order_in.subtotal,
        discount=order_in.discount,
        total=order_in.total,
        status="received"
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    # Inserção de itens do pedido
    for item in order_in.items:
        order_item = models.OrderItem(
            order_id=new_order.id,
            product_id=item.product_id,
            product_sku=item.product_sku,
            product_name=item.product_name,
            product_image=item.product_image,
            selected_variant=item.selected_variant or {},
            unit_price=item.unit_price,
            quantity=item.quantity,
            total_price=item.unit_price * item.quantity
        )
        db.add(order_item)

    db.commit()
    db.refresh(new_order)
    return new_order

@app.get("/api/orders/my-orders", response_model=List[schemas.OrderResponse], tags=["Orders"])
def get_my_orders(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    orders = db.query(models.Order).filter(
        (models.Order.user_id == current_user.id) | (models.Order.customer_email == current_user.email)
    ).order_by(models.Order.created_at.desc()).all()
    return orders

@app.get("/api/orders/track/{order_code}", response_model=schemas.OrderResponse, tags=["Orders"])
def track_order(order_code: str, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.order_code == order_code.strip()).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado com este código.")
    return order

# ===================================================================
# 7. ADMINISTRAÇÃO & PRIMEIRO ACESSO
# ===================================================================
@app.get("/api/admin/status", response_model=schemas.AdminStatusResponse, tags=["Admin"])
def get_admin_system_status(db: Session = Depends(get_db)):
    """Verifica se já existe pelo menos um administrador configurado no banco de dados."""
    admin_count = db.query(models.User).filter(models.User.role == "admin").count()
    return {
        "has_admin": admin_count > 0,
        "total_admins": admin_count
    }

@app.post("/api/admin/setup", response_model=schemas.Token, tags=["Admin"])
def setup_first_admin(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    """Permite cadastrar o primeiro administrador (Dono da Loja) diretamente pela página do Admin."""
    admin_count = db.query(models.User).filter(models.User.role == "admin").count()
    if admin_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O sistema já possui um Administrador configurado. Por favor, utilize a tela de Login."
        )

    # Verifica se já existe conta de cliente com esse email para promover
    existing_user = db.query(models.User).filter(models.User.email == user_in.email.lower()).first()
    if existing_user:
        existing_user.name = user_in.name
        existing_user.role = "admin"
        existing_user.hashed_password = get_password_hash(user_in.password)
        if user_in.phone:
            existing_user.phone = user_in.phone
        admin_user = existing_user
    else:
        hashed_pw = get_password_hash(user_in.password)
        admin_user = models.User(
            name=user_in.name,
            email=user_in.email.lower(),
            hashed_password=hashed_pw,
            phone=user_in.phone,
            role="admin",
            is_active=True
        )
        db.add(admin_user)

    db.commit()
    db.refresh(admin_user)

    access_token = create_access_token(data={"sub": admin_user.email, "role": "admin"})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": admin_user
    }

@app.get("/api/admin/stats", response_model=schemas.AdminStatsResponse, tags=["Admin"])
def get_admin_stats(
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    total_sales = db.query(models.Order).with_entities(models.Order.total).all()
    total_revenue = sum([s[0] for s in total_sales]) if total_sales else 0.0

    total_orders = db.query(models.Order).count()
    total_products = db.query(models.Product).count()
    total_categories = db.query(models.Category).count()
    recent_orders = db.query(models.Order).order_by(models.Order.created_at.desc()).limit(10).all()

    return {
        "total_sales": total_revenue,
        "total_orders": total_orders,
        "total_products": total_products,
        "total_categories": total_categories,
        "recent_orders": recent_orders
    }

@app.get("/api/admin/orders", response_model=List[schemas.OrderResponse], tags=["Admin"])
def get_all_admin_orders(
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return db.query(models.Order).order_by(models.Order.created_at.desc()).all()

@app.patch("/api/admin/orders/{order_id}/status", response_model=schemas.OrderResponse, tags=["Admin"])
def update_order_status(
    order_id: int,
    status_in: schemas.OrderStatusUpdate,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")

    valid_statuses = ["received", "confirmed", "preparing", "shipped", "in_transit", "delivered", "cancelled"]
    if status_in.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido. Permitidos: {', '.join(valid_statuses)}")

    order.status = status_in.status
    if status_in.status == "confirmed":
        order.payment_status = "paid"
    elif status_in.status == "cancelled":
        order.payment_status = "cancelled"

    db.commit()
    db.refresh(order)
    return order

@app.post("/api/admin/products", response_model=schemas.ProductResponse, tags=["Admin"])
def create_product(
    prod_in: schemas.ProductCreate,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(models.Product).filter(models.Product.sku == prod_in.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail="Já existe um produto com este SKU.")

    product = models.Product(**prod_in.dict())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@app.put("/api/admin/products/{product_id}", response_model=schemas.ProductResponse, tags=["Admin"])
def update_product(
    product_id: int,
    prod_in: schemas.ProductUpdate,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")

    for field, value in prod_in.dict(exclude_unset=True).items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product

@app.delete("/api/admin/products/{product_id}", tags=["Admin"])
def delete_product(
    product_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")

    db.delete(product)
    db.commit()
    return {"message": "Produto excluído com sucesso do catálogo."}

# ===================================================================
# 8. NEWSLETTER & MARKETING
# ===================================================================
@app.post("/api/newsletter", tags=["Marketing"])
def subscribe_newsletter(email: str = Query(...), db: Session = Depends(get_db)):
    clean_email = email.strip().lower()
    existing = db.query(models.NewsletterSubscriber).filter(models.NewsletterSubscriber.email == clean_email).first()
    if not existing:
        sub = models.NewsletterSubscriber(email=clean_email)
        db.add(sub)
        db.commit()
    return {
        "success": True,
        "message": "Inscrição realizada com sucesso! Use o cupom NOVATECH50 para Kz 50.000 OFF em compras acima de Kz 500.000."
    }
