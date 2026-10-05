import uuid
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Text, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

def generate_uuid_str():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), default=generate_uuid_str, unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    phone = Column(String(30), nullable=True)
    role = Column(String(20), default="customer") # 'customer' ou 'admin'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    addresses = relationship("Address", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user")
    reviews = relationship("Review", back_populates="user")

class Address(Base):
    __tablename__ = "addresses"
    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), default=generate_uuid_str, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    province = Column(String(50), default="Luanda")
    city = Column(String(50), nullable=False)
    neighborhood = Column(String(100), nullable=False)
    street = Column(String(150), nullable=False)
    number = Column(String(30), nullable=True)
    reference = Column(String(200), nullable=True)
    is_default = Column(Boolean, default=False)

    user = relationship("User", back_populates="addresses")

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), default=generate_uuid_str, unique=True, index=True, nullable=False)
    slug = Column(String(60), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    icon_name = Column(String(50), default="package")

    products = relationship("Product", back_populates="category_rel")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), default=generate_uuid_str, unique=True, index=True, nullable=False)
    sku = Column(String(50), unique=True, index=True, nullable=False)
    slug = Column(String(150), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    brand = Column(String(60), index=True, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"))
    old_price = Column(Float, nullable=True)
    price = Column(Float, nullable=False)
    stock = Column(Integer, default=10)
    stock_min = Column(Integer, default=2)
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    is_deal = Column(Boolean, default=False)
    image = Column(String(500), nullable=False)
    gallery = Column(JSON, default=list) # Lista de URLs de imagens
    variants = Column(JSON, default=dict) # Cores, armazenamentos, deltas de preço
    specs = Column(JSON, default=dict) # Ficha técnica estruturada
    badges = Column(JSON, default=list) # ['OFERTA', 'NOVO', etc.]
    rating = Column(Float, default=5.0)
    review_count = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    category_rel = relationship("Category", back_populates="products")
    reviews = relationship("Review", back_populates="product", cascade="all, delete-orphan")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), default=generate_uuid_str, unique=True, index=True, nullable=False)
    order_code = Column(String(50), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    customer_name = Column(String(100), nullable=False)
    customer_email = Column(String(150), nullable=False)
    customer_phone = Column(String(30), nullable=False)
    customer_whatsapp = Column(String(30), nullable=True)
    shipping_address = Column(Text, nullable=False) # JSON ou Texto formatado
    shipping_method = Column(String(50), default="normal") # normal, express, pickup
    shipping_price = Column(Float, default=0.0)
    payment_method = Column(String(50), nullable=False) # multicaixa_express, transfer, reference, cod
    payment_status = Column(String(50), default="pending") # pending, paid, failed, under_review
    payment_details = Column(JSON, default=dict) # Detalhes adicionais do pagamento
    subtotal = Column(Float, nullable=False)
    discount = Column(Float, default=0.0)
    total = Column(Float, nullable=False)
    status = Column(String(30), default="received") # received, confirmed, preparing, shipped, in_transit, delivered, cancelled
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), default=generate_uuid_str, unique=True, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    product_sku = Column(String(50), nullable=True)
    product_name = Column(String(200), nullable=False)
    product_image = Column(String(500), nullable=True)
    selected_variant = Column(JSON, default=dict)
    unit_price = Column(Float, nullable=False)
    quantity = Column(Integer, default=1)
    total_price = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")

class Coupon(Base):
    __tablename__ = "coupons"
    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), default=generate_uuid_str, unique=True, index=True, nullable=False)
    code = Column(String(40), unique=True, index=True, nullable=False)
    discount_type = Column(String(20), default="percent") # percent, fixed, free_shipping
    discount_value = Column(Float, default=10.0)
    min_order_value = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime, nullable=True)

class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), default=generate_uuid_str, unique=True, index=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    author_name = Column(String(100), nullable=False)
    rating = Column(Float, default=5.0)
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="reviews")
    user = relationship("User", back_populates="reviews")

class NewsletterSubscriber(Base):
    __tablename__ = "newsletter_subscribers"
    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), default=generate_uuid_str, unique=True, index=True, nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

