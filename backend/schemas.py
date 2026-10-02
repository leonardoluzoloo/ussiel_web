from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

# ===================================================================
# AUTH & USER SCHEMAS
# ===================================================================
class UserBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Senha com no mínimo 6 caracteres")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = None
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    google_id: Optional[str] = None
    is_admin_setup: Optional[bool] = False

class AdminStatusResponse(BaseModel):
    has_admin: bool
    total_admins: int

# ===================================================================
# ADDRESS SCHEMAS
# ===================================================================
class AddressBase(BaseModel):
    province: str = "Luanda"
    city: str
    neighborhood: str
    street: str
    number: Optional[str] = None
    reference: Optional[str] = None
    is_default: bool = False

class AddressCreate(AddressBase):
    pass

class AddressResponse(AddressBase):
    id: int
    user_id: Optional[int] = None
    class Config:
        from_attributes = True

# ===================================================================
# CATEGORY SCHEMAS
# ===================================================================
class CategoryResponse(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str] = None
    icon_name: str
    class Config:
        from_attributes = True

# ===================================================================
# PRODUCT SCHEMAS
# ===================================================================
class ProductBase(BaseModel):
    name: str
    brand: str
    price: float
    old_price: Optional[float] = None
    stock: int = 10
    image: str
    description: Optional[str] = None
    gallery: Optional[List[str]] = []
    variants: Optional[Dict[str, Any]] = {}
    specs: Optional[Dict[str, str]] = {}
    badges: Optional[List[str]] = []
    rating: Optional[float] = 5.0
    review_count: Optional[int] = 0

class ProductCreate(ProductBase):
    category_id: int
    sku: str
    slug: str
    is_active: bool = True
    is_featured: bool = False
    is_deal: bool = False

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    price: Optional[float] = None
    old_price: Optional[float] = None
    stock: Optional[int] = None
    image: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_deal: Optional[bool] = None

class ProductResponse(ProductBase):
    id: int
    sku: str
    slug: str
    category_id: int
    is_active: bool
    is_featured: bool
    is_deal: bool
    created_at: datetime
    class Config:
        from_attributes = True

# ===================================================================
# ORDER SCHEMAS
# ===================================================================
class OrderItemCreate(BaseModel):
    product_id: Optional[int] = None
    product_sku: Optional[str] = None
    product_name: str
    product_image: Optional[str] = None
    selected_variant: Optional[Dict[str, Any]] = {}
    unit_price: float
    quantity: int = 1

class OrderItemResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    product_sku: Optional[str] = None
    product_name: str
    product_image: Optional[str] = None
    selected_variant: Optional[Dict[str, Any]] = {}
    unit_price: float
    quantity: int
    total_price: float
    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    customer_name: str
    customer_email: EmailStr
    customer_phone: str
    customer_whatsapp: Optional[str] = None
    shipping_address: str # Pode ser JSON em string ou endereço formatado
    shipping_method: str = "normal"
    payment_method: str
    payment_details: Optional[Dict[str, Any]] = {}
    items: List[OrderItemCreate]
    subtotal: float
    discount: float = 0.0
    shipping_price: float = 0.0
    total: float

class OrderStatusUpdate(BaseModel):
    status: str

class OrderResponse(BaseModel):
    id: int
    order_code: str
    user_id: Optional[int] = None
    customer_name: str
    customer_email: str
    customer_phone: str
    customer_whatsapp: Optional[str] = None
    shipping_address: str
    shipping_method: str
    shipping_price: float
    payment_method: str
    payment_status: str
    payment_details: Optional[Dict[str, Any]] = {}
    subtotal: float
    discount: float
    total: float
    status: str
    created_at: datetime
    items: Optional[List[OrderItemResponse]] = []
    class Config:
        from_attributes = True

# ===================================================================
# COUPON SCHEMAS
# ===================================================================
class CouponResponse(BaseModel):
    code: str
    discount_type: str
    discount_value: float
    min_order_value: float
    is_active: bool
    class Config:
        from_attributes = True

# ===================================================================
# ADMIN STATS SCHEMA
# ===================================================================
class AdminStatsResponse(BaseModel):
    total_sales: float
    total_orders: int
    total_products: int
    total_categories: int
    recent_orders: List[OrderResponse]
