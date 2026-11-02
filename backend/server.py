import sys
from pathlib import Path


def _pause_console():
    try:
        if sys.stdin is not None and hasattr(sys.stdin, "isatty") and sys.stdin.isatty():
            input("Press Enter to exit...")
    except Exception:
        pass


try:
    import os
    import re
    import time
    import uuid
    import secrets
    import bcrypt
    import hashlib
    import html
    import json
    import logging
    import asyncio
    from datetime import datetime, timezone, timedelta
    from typing import List, Optional, Literal
    from urllib.parse import quote, unquote, urlsplit
    from collections import defaultdict
    from contextlib import asynccontextmanager

    import jwt
    import requests
    from dotenv import load_dotenv
    from fastapi import (
        FastAPI,
        APIRouter,
        HTTPException,
        Request,
        Response,
        UploadFile,
        File,
        Depends,
        Query,
    )
    from fastapi.responses import HTMLResponse
    from starlette.middleware.cors import CORSMiddleware
    from starlette.middleware.trustedhost import TrustedHostMiddleware
    from pydantic import BaseModel, Field
    from sqlalchemy import select, func, and_, or_, delete, cast, Text
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.exc import IntegrityError

    from database import AsyncSessionLocal, engine, get_db
    from models import User, Property, Subscription, FileRecord, Office, RevokedRefreshToken

except Exception as import_error:
    print(f"[CRITICAL] Missing dependencies: {import_error}")
    print("Please install the dependencies listed in backend/requirements.txt.")
    _pause_console()
    raise SystemExit(1)


# ---------- Paths & Env ----------
ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def _critical_exit(message: str):
    try:
        logger.critical(message)
    except Exception:
        pass
    print(f"[CRITICAL] {message}")
    _pause_console()
    raise SystemExit(1)


IS_PRODUCTION = os.environ.get("ENV", "").lower() in ("production", "prod")


# ---------- JWT Config ----------
JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ.get("JWT_SECRET")

if IS_PRODUCTION and (
    not JWT_SECRET
    or len(JWT_SECRET.encode("utf-8")) < 32
    or JWT_SECRET.strip().lower().startswith(("change-me", "dev-secret"))
    or len(set(JWT_SECRET.strip())) < 8
):
    _critical_exit("CRITICAL: Set a unique JWT_SECRET of at least 32 bytes in production.")

JWT_SECRET = JWT_SECRET or "dev-secret-key-change-in-production"


# ---------- Admin Config ----------
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

if IS_PRODUCTION:
    if not ADMIN_EMAIL:
        _critical_exit("CRITICAL: ADMIN_EMAIL must be set in production!")
    if (
        not ADMIN_PASSWORD
        or len(ADMIN_PASSWORD.encode("utf-8")) < 12
        or ADMIN_PASSWORD.strip().lower().startswith(("change-me", "admin123", "password"))
    ):
        _critical_exit("CRITICAL: Set an ADMIN_PASSWORD of at least 12 bytes that is not a placeholder.")


# ---------- Storage Config ----------
STORAGE_PROVIDER = os.environ.get("STORAGE_PROVIDER", "emergent").strip().lower()
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_STORAGE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "property-images").strip()
PUBLIC_APP_URL = os.environ.get("PUBLIC_APP_URL", "http://localhost:3000").rstrip("/")
PUBLIC_API_URL = os.environ.get("PUBLIC_API_URL", "http://localhost:8000").rstrip("/")
APP_NAME = "aqari-almuyassar"
storage_keys = {}

if STORAGE_PROVIDER not in {"supabase", "emergent"}:
    _critical_exit("CRITICAL: STORAGE_PROVIDER must be 'supabase' or 'emergent'.")
if IS_PRODUCTION and STORAGE_PROVIDER == "supabase" and not all((SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET)):
    _critical_exit("CRITICAL: Supabase Storage requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.")
if IS_PRODUCTION and STORAGE_PROVIDER == "emergent" and not EMERGENT_KEY:
    _critical_exit("CRITICAL: EMERGENT_LLM_KEY is required when STORAGE_PROVIDER=emergent.")
if IS_PRODUCTION and (not PUBLIC_APP_URL.startswith("https://") or not PUBLIC_API_URL.startswith("https://")):
    _critical_exit("CRITICAL: PUBLIC_APP_URL and PUBLIC_API_URL must be HTTPS URLs in production.")


# ---------- Files Config ----------
ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_IMAGES_PER_PROPERTY = 20


# ---------- Password Config ----------
MIN_PASSWORD_LENGTH = 8
BCRYPT_MAX_BYTES = 72


# ---------- Basic Validation Regex ----------
EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
PHONE_REGEX = re.compile(r"^\+?[0-9]{7,15}$")


# ---------- Helpers ----------
def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _like_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


# ---------- Rate Limiting ----------
_rate_log: dict = defaultdict(list)
RATE_LOG_MAX_KEYS = 10000


def check_rate_limit(key: str, limit: int, window_seconds: int):
    now = time.monotonic()
    cutoff = now - window_seconds
    entries = [t for t in _rate_log.get(key, []) if t > cutoff]

    if len(entries) >= limit:
        _rate_log[key] = entries
        raise HTTPException(status_code=429, detail="محاولات كثيرة جداً، يرجى المحاولة لاحقاً")

    entries.append(now)
    _rate_log[key] = entries

    if len(_rate_log) > RATE_LOG_MAX_KEYS:
        old_keys = list(_rate_log.keys())[:1000]
        for old_key in old_keys:
            _rate_log.pop(old_key, None)


# ---------- Refresh Token Revocation ----------
def _token_fingerprint(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def _is_revoked(token: str, db: AsyncSession) -> bool:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(RevokedRefreshToken.token_hash)
        .where(
            and_(
                RevokedRefreshToken.token_hash == _token_fingerprint(token),
                RevokedRefreshToken.expires_at > now,
            )
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _revoke_refresh_token(
    token: str, db: AsyncSession, expires_at: Optional[datetime] = None
) -> bool:
    now = datetime.now(timezone.utc)
    await db.execute(
        delete(RevokedRefreshToken).where(RevokedRefreshToken.expires_at <= now)
    )
    db.add(
        RevokedRefreshToken(
            token_hash=_token_fingerprint(token),
            expires_at=expires_at or now + timedelta(days=7),
            created_at=now,
        )
    )
    try:
        await db.commit()
    except IntegrityError:
        # The primary key makes concurrent refresh attempts single-use across workers.
        await db.rollback()
        return False
    return True


# ---------- Password ----------
def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise ValueError("Password exceeds bcrypt maximum byte length")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        if len(plain.encode("utf-8")) > BCRYPT_MAX_BYTES:
            return False
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _validate_password_strength(password: str):
    if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail="كلمة المرور طويلة جداً (الحد الأقصى 72 بايت)",
        )

    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"كلمة المرور يجب أن تكون {MIN_PASSWORD_LENGTH} أحرف على الأقل",
        )


# ---------- JWT ----------
def create_access_token(user_id: str, identifier: str) -> str:
    payload = {
        "sub": user_id,
        "email": identifier,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access",
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = request.cookies.get("access_token")

    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = token.strip()

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "type"]},
        )

        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        result = await db.execute(select(User).where(User.id == user_id).limit(1))
        user = result.scalars().first()

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return user

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------- Object Storage ----------
def init_storage(provider: Optional[str] = None):
    selected_provider = (provider or STORAGE_PROVIDER).strip().lower()
    if selected_provider in storage_keys:
        return storage_keys[selected_provider]

    if selected_provider == "supabase":
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or not SUPABASE_STORAGE_BUCKET:
            logger.error("Supabase Storage configuration is incomplete")
            return None
        storage_keys[selected_provider] = SUPABASE_SERVICE_ROLE_KEY
        return SUPABASE_SERVICE_ROLE_KEY

    if selected_provider != "emergent":
        logger.error("Unknown storage provider")
        return None
    if not EMERGENT_KEY:
        logger.error("EMERGENT_LLM_KEY is required to access legacy Emergent files")
        return None

    try:
        resp = requests.post(
            f"{STORAGE_URL}/init",
            json={"emergent_key": EMERGENT_KEY},
            timeout=30,
        )
        resp.raise_for_status()
        payload = resp.json()
        key = payload.get("storage_key") if isinstance(payload, dict) else None
        if not key:
            logger.error("Legacy storage init response does not contain storage_key")
            return None
        storage_keys[selected_provider] = key
        logger.info("Legacy storage initialized")
        return key
    except requests.RequestException as e:
        logger.error("Legacy storage init failed: %s", e)
        return None
    except ValueError as e:
        logger.error("Legacy storage init returned invalid JSON: %s", e)
        return None


def _put_object_sync(path: str, data: bytes, content_type: str, provider: Optional[str] = None) -> dict:
    selected_provider = (provider or STORAGE_PROVIDER).strip().lower()
    key = init_storage(selected_provider)

    if not key:
        raise HTTPException(status_code=500, detail="Storage not initialized")

    if selected_provider == "supabase":
        try:
            response = requests.post(
                f"{SUPABASE_URL}/storage/v1/object/{quote(SUPABASE_STORAGE_BUCKET, safe='')}/{quote(path, safe='/')}",
                headers={
                    "Authorization": f"Bearer {key}",
                    "apikey": key,
                    "Content-Type": content_type,
                    "x-upsert": "false",
                },
                data=data,
                timeout=120,
            )
            response.raise_for_status()
            return {"path": path, "size": len(data)}
        except requests.RequestException as e:
            logger.error("Supabase Storage upload failed: %s", e)
            raise HTTPException(status_code=502, detail="فشل رفع الصورة إلى التخزين")

    if selected_provider != "emergent":
        raise HTTPException(status_code=500, detail="Storage provider is not configured")
    try:
        resp = requests.put(
            f"{STORAGE_URL}/objects/{quote(path, safe='/')}",
            headers={
                "X-Storage-Key": key,
                "Content-Type": content_type,
            },
            data=data,
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json()

    except requests.RequestException as e:
        logger.error(f"Storage upload failed: {e}")
        raise HTTPException(status_code=502, detail="فشل رفع الملف إلى التخزين")
    except ValueError:
        logger.error("Storage upload returned invalid JSON")
        raise HTTPException(status_code=502, detail="استجابة غير صالحة من خدمة التخزين")


def _get_object_sync(path: str, provider: Optional[str] = None) -> tuple:
    selected_provider = (provider or STORAGE_PROVIDER).strip().lower()
    key = init_storage(selected_provider)

    if not key:
        raise HTTPException(status_code=500, detail="Storage not initialized")

    if selected_provider == "supabase":
        try:
            response = requests.get(
                f"{SUPABASE_URL}/storage/v1/object/{quote(SUPABASE_STORAGE_BUCKET, safe='')}/{quote(path, safe='/')}",
                headers={"Authorization": f"Bearer {key}", "apikey": key},
                timeout=60,
            )
            response.raise_for_status()
            return response.content, response.headers.get("Content-Type", "application/octet-stream")
        except requests.RequestException as e:
            logger.error("Supabase Storage download failed: %s", e)
            raise HTTPException(status_code=404, detail="الملف غير موجود")

    if selected_provider != "emergent":
        raise HTTPException(status_code=500, detail="Storage provider is not configured")
    try:
        resp = requests.get(
            f"{STORAGE_URL}/objects/{quote(path, safe='/')}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

    except requests.RequestException as e:
        logger.error(f"Storage download failed: {e}")
        raise HTTPException(status_code=404, detail="الملف غير موجود")


def _delete_object_sync(path: str, provider: Optional[str] = None) -> bool:
    selected_provider = (provider or STORAGE_PROVIDER).strip().lower()
    key = init_storage(selected_provider)

    if not key:
        logger.warning("Storage not initialized; cannot delete object")
        return False

    if selected_provider == "supabase":
        try:
            response = requests.delete(
                f"{SUPABASE_URL}/storage/v1/object/{quote(SUPABASE_STORAGE_BUCKET, safe='')}",
                headers={"Authorization": f"Bearer {key}", "apikey": key},
                json={"prefixes": [path]},
                timeout=60,
            )
            response.raise_for_status()
            return True
        except requests.RequestException as e:
            logger.error("Supabase Storage delete failed: %s", e)
            return False

    if selected_provider != "emergent":
        logger.warning("Storage provider is not configured")
        return False
    try:
        resp = requests.delete(
            f"{STORAGE_URL}/objects/{quote(path, safe='/')}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )

        if resp.status_code == 404:
            return True

        resp.raise_for_status()
        return True

    except requests.RequestException as e:
        logger.error(f"Storage delete failed for {path}: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected storage delete error for {path}: {e}")
        return False


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    return await asyncio.to_thread(_put_object_sync, path, data, content_type)


async def get_object(path: str, provider: Optional[str] = None) -> tuple:
    return await asyncio.to_thread(_get_object_sync, path, provider)


async def delete_object(path: str, provider: Optional[str] = None) -> bool:
    return await asyncio.to_thread(_delete_object_sync, path, provider)


# ---------- Pydantic Schemas ----------
class UserRegister(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: Optional[str] = Field(default=None, max_length=254)
    phone: Optional[str] = Field(default=None, max_length=24)
    password: str = Field(min_length=1, max_length=256)
    office_name: Optional[str] = Field(default=None, max_length=100)


class UserLogin(BaseModel):
    identifier: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class UserResponse(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    office_name: Optional[str] = None
    created_at: str


PropertyStatus = Literal["available", "sold", "rented"]


class PropertyCreate(BaseModel):
    total_area: float = Field(gt=0)
    price: float = Field(ge=0)
    front_width: float = Field(ge=0)
    length: float = Field(ge=0)
    bedrooms: int = Field(ge=0)
    bathrooms: int = Field(ge=0)
    owner_name: Optional[str] = Field(default="", max_length=100)
    owner_phone: str = Field(min_length=7, max_length=20)
    whatsapp_number: Optional[str] = Field(default=None, max_length=20)
    instagram_username: Optional[str] = Field(default=None, max_length=100)
    images: Optional[List[str]] = Field(default_factory=list, max_length=MAX_IMAGES_PER_PROPERTY)
    status: PropertyStatus = "available"
    governorate: Optional[str] = Field(default=None, max_length=100)
    district: Optional[str] = Field(default=None, max_length=100)


class PropertyUpdate(BaseModel):
    total_area: Optional[float] = Field(default=None, gt=0)
    price: Optional[float] = Field(default=None, ge=0)
    front_width: Optional[float] = Field(default=None, ge=0)
    length: Optional[float] = Field(default=None, ge=0)
    bedrooms: Optional[int] = Field(default=None, ge=0)
    bathrooms: Optional[int] = Field(default=None, ge=0)
    owner_name: Optional[str] = Field(default=None, max_length=100)
    owner_phone: Optional[str] = Field(default=None, min_length=7, max_length=20)
    whatsapp_number: Optional[str] = Field(default=None, max_length=20)
    instagram_username: Optional[str] = Field(default=None, max_length=100)
    images: Optional[List[str]] = Field(default=None, max_length=MAX_IMAGES_PER_PROPERTY)
    status: Optional[PropertyStatus] = None
    governorate: Optional[str] = Field(default=None, max_length=100)
    district: Optional[str] = Field(default=None, max_length=100)


class PropertyResponse(BaseModel):
    id: str
    total_area: float
    price: float
    front_width: float
    length: float
    bedrooms: int
    bathrooms: int
    owner_name: Optional[str] = ""
    owner_phone: str
    whatsapp_number: Optional[str] = None
    instagram_username: Optional[str] = None
    images: List[str]
    public_share_token: Optional[str] = None
    public_contact_enabled: bool = False
    status: str
    agent_id: str
    agent_name: str
    created_at: str
    governorate: Optional[str] = None
    district: Optional[str] = None


class PropertyPageResponse(BaseModel):
    items: List[PropertyResponse]
    total: int
    skip: int
    limit: int


class PublicPropertyResponse(BaseModel):
    id: str
    total_area: float
    price: float
    front_width: float
    length: float
    bedrooms: int
    bathrooms: int
    images: List[str]
    status: str
    governorate: Optional[str] = None
    district: Optional[str] = None
    agent_name: str
    contact_phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    instagram_username: Optional[str] = None
    created_at: str


class PublicShareRequest(BaseModel):
    include_agent_phone: bool = False


class SubscriptionPlan(BaseModel):
    plan_type: str
    user_id: Optional[str] = None


class SubscriptionStatusResponse(BaseModel):
    has_active: bool
    days_remaining: Optional[int] = None
    end_date: Optional[str] = None
    plan_type: Optional[str] = None
    status: str


class SubscriptionResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    office_name: Optional[str] = None
    plan_type: str
    amount: int
    currency: str
    start_date: str
    end_date: str
    status: str
    created_at: str


class AdminStats(BaseModel):
    total_properties: int
    available: int
    sold: int
    rented: int
    total_offices: int
    expiring_soon: int


# ---------- Subscription Plans ----------
PLAN_PRICING = {
    "trial": {
        "amount": 0,
        "days": 30,
        "label": "تجربة مجانية - شهر كامل",
    },
    "monthly": {
        "amount": 25000,
        "days": 30,
        "label": "شهري",
    },
    "quarterly": {
        "amount": 65000,
        "days": 90,
        "label": "ربع سنوي",
    },
    "yearly": {
        "amount": 275000,
        "days": 365,
        "label": "سنوي",
    },
}

PUBLIC_PLAN_KEYS = ["trial", "monthly", "quarterly", "yearly"]


# ---------- Serializers ----------
async def user_to_response(user: User, db: AsyncSession) -> UserResponse:
    office_name = None

    if user.office_id:
        result = await db.execute(
            select(Office.office_name).where(Office.id == user.office_id).limit(1)
        )
        office_name = result.scalar_one_or_none()

    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        role=user.role,
        office_name=office_name,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


def prop_to_response(p: Property) -> PropertyResponse:
    return PropertyResponse(
        id=p.id,
        total_area=p.total_area,
        price=p.price,
        front_width=p.front_width,
        length=p.length,
        bedrooms=p.bedrooms,
        bathrooms=p.bathrooms,
        owner_name=p.owner_name or "",
        owner_phone=p.owner_phone,
        whatsapp_number=p.whatsapp_number,
        instagram_username=p.instagram_username,
        images=p.images or [],
        public_share_token=p.public_share_token,
        public_contact_enabled=p.public_contact_enabled,
        status=p.status,
        agent_id=p.agent_id,
        agent_name=p.agent_name,
        created_at=p.created_at.isoformat() if p.created_at else "",
        governorate=p.governorate,
        district=p.district,
    )


def _effective_sub_status(s: Subscription) -> str:
    if s.status == "active":
        end_dt = _ensure_utc(s.end_date)
        if end_dt and end_dt < datetime.now(timezone.utc):
            return "expired"
    return s.status


def sub_to_response(s: Subscription, status_override: Optional[str] = None) -> SubscriptionResponse:
    return SubscriptionResponse(
        id=s.id,
        user_id=s.user_id,
        user_name=s.user_name,
        office_name=s.office_name,
        plan_type=s.plan_type,
        amount=s.amount,
        currency=s.currency,
        start_date=s.start_date.isoformat() if s.start_date else "",
        end_date=s.end_date.isoformat() if s.end_date else "",
        status=status_override or s.status,
        created_at=s.created_at.isoformat() if s.created_at else "",
    )


# ---------- Admin Seed ----------
async def seed_admin():
    admin_email = ADMIN_EMAIL or "admin@aqari.com"
    admin_password = ADMIN_PASSWORD or "admin123"

    try:
        password_hash = hash_password(admin_password)
    except ValueError as e:
        logger.critical("Admin password is invalid (too long?)")
        raise RuntimeError("ADMIN_PASSWORD is invalid") from e

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == admin_email).limit(1))
        existing = result.scalars().first()

        if existing is None:
            admin = User(
                id=str(uuid.uuid4()),
                email=admin_email,
                name="المدير العام",
                role="admin",
                password_hash=password_hash,
                created_at=datetime.now(timezone.utc),
            )
            db.add(admin)
            await db.commit()
            logger.info(f"Admin created: {admin_email}")

        elif not verify_password(admin_password, existing.password_hash):
            existing.password_hash = password_hash
            await db.commit()
            logger.info("Admin password updated")

    if not IS_PRODUCTION:
        try:
            mem_dir = ROOT_DIR / "memory"
            mem_dir.mkdir(exist_ok=True)
            with open(mem_dir / "test_credentials.md", "w", encoding="utf-8") as f:
                f.write("# Test Credentials (Dev Only)\n\n## Admin Account\n")
                f.write(f"- Email: {admin_email}\n- Role: admin\n")
        except Exception as e:
            logger.warning(f"Could not write credentials file: {e}")


# ---------- Lifespan ----------
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await seed_admin()
    except Exception:
        logger.exception("Admin seeding failed; refusing to start without the database.")
        raise

    try:
        await asyncio.to_thread(init_storage)
    except Exception as e:
        logger.error(f"Storage initialization failed: {e}")

    logger.info("Application started")
    yield

    try:
        await engine.dispose()
    except Exception as e:
        logger.warning(f"Error while disposing DB engine: {e}")

    logger.info("Database connection closed")


app = FastAPI(
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)
api_router = APIRouter(prefix="/api")


# ---------- Auth Helpers ----------
def _set_cookies(response: Response, access_token: str, refresh_token: str):
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        max_age=900,
        path="/",
    )

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        max_age=604800,
        path="/",
    )


# ---------- Subscription Helpers ----------
async def get_active_subscription(user_id: str, db: AsyncSession) -> Optional[Subscription]:
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(Subscription)
        .where(
            and_(
                Subscription.user_id == user_id,
                Subscription.status == "active",
                Subscription.end_date >= now,
            )
        )
        .order_by(Subscription.end_date.desc())
        .limit(1)
    )

    sub = result.scalars().first()

    if sub:
        end_dt = _ensure_utc(sub.end_date)
        if end_dt and end_dt < now:
            return None

    return sub


async def require_active_subscription(user: User, db: AsyncSession):
    if user.role == "admin":
        return

    sub = await get_active_subscription(user.id, db)

    if not sub:
        raise HTTPException(status_code=402, detail="انتهى اشتراكك — تواصل معنا للتجديد")


# Customer CRM is isolated from the main route file to keep server.py focused.
from leads import create_leads_router

api_router.include_router(
    create_leads_router(get_current_user, get_db, require_active_subscription)
)


# ---------- Auth Routes ----------
@api_router.post("/auth/register", response_model=UserResponse)
async def register(
    request: Request,
    user: UserRegister,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    check_rate_limit(f"register:{_client_ip(request)}", limit=5, window_seconds=3600)
    _validate_password_strength(user.password)

    clean_name = user.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="الاسم مطلوب")

    clean_email = None
    if user.email and user.email.strip():
        clean_email = user.email.strip().lower()
        if not EMAIL_REGEX.match(clean_email):
            raise HTTPException(status_code=400, detail="البريد الإلكتروني غير صحيح")

    clean_phone = None
    if user.phone and user.phone.strip():
        clean_phone = re.sub(r"[\s\-()]+", "", user.phone.strip())
        if not PHONE_REGEX.match(clean_phone):
            raise HTTPException(status_code=400, detail="رقم الهاتف غير صحيح")

    if not clean_email and not clean_phone:
        raise HTTPException(status_code=400, detail="يجب إدخال البريد الإلكتروني أو رقم الهاتف")

    conds = []
    if clean_email:
        conds.append(User.email == clean_email)
    if clean_phone:
        conds.append(User.phone == clean_phone)

    result = await db.execute(select(User).where(or_(*conds)).limit(1))
    existing_user = result.scalars().first()

    if existing_user:
        raise HTTPException(status_code=400, detail="المستخدم موجود بالفعل")

    office_id = None
    clean_office_name = user.office_name.strip() if user.office_name else None

    if clean_office_name:
        if len(clean_office_name) > 100:
            raise HTTPException(status_code=400, detail="اسم المكتب طويل جداً")

        result = await db.execute(
            select(Office).where(Office.office_name == clean_office_name).limit(1)
        )
        office = result.scalars().first()

        if not office:
            office = Office(
                id=uuid.uuid4(),
                office_name=clean_office_name,
                phone_number=clean_phone or "",
            )
            db.add(office)
            await db.flush()

        office_id = office.id

    user_id = str(uuid.uuid4())

    new_user = User(
        id=user_id,
        name=clean_name,
        email=clean_email,
        phone=clean_phone,
        role="agent",
        password_hash=hash_password(user.password),
        office_id=office_id,
        created_at=datetime.now(timezone.utc),
    )

    db.add(new_user)

    # إنشاء اشتراك تجريبي مجاني لمدة 30 يومًا لكل مستخدم جديد
    trial_now = datetime.now(timezone.utc)
    trial_plan = PLAN_PRICING["trial"]

    trial_subscription = Subscription(
        id=str(uuid.uuid4()),
        user_id=user_id,
        user_name=clean_name,
        office_name=clean_office_name,
        plan_type="trial",
        amount=trial_plan["amount"],
        currency="IQD",
        start_date=trial_now,
        end_date=trial_now + timedelta(days=trial_plan["days"]),
        status="active",
        created_at=trial_now,
    )

    db.add(trial_subscription)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="المستخدم موجود بالفعل")

    await db.refresh(new_user)

    access = create_access_token(user_id, clean_email or clean_phone or "")
    refresh = create_refresh_token(user_id)

    _set_cookies(response, access, refresh)

    return await user_to_response(new_user, db)


@api_router.post("/auth/login", response_model=UserResponse)
async def login(
    request: Request,
    credentials: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    identifier = credentials.identifier.strip()

    if not identifier:
        raise HTTPException(status_code=400, detail="المعرّف مطلوب")

    if "@" in identifier:
        identifier = identifier.lower()
    else:
        identifier = re.sub(r"[\s\-()]+", "", identifier)

    ident_key = hashlib.sha256(identifier.casefold().encode("utf-8")).hexdigest()
    client_ip = _client_ip(request)
    check_rate_limit(f"login-ip:{client_ip}", limit=30, window_seconds=600)
    check_rate_limit(f"login:{client_ip}:{ident_key}", limit=5, window_seconds=600)

    result = await db.execute(
        select(User)
        .where(or_(User.email == identifier, User.phone == identifier))
        .limit(1)
    )

    user = result.scalars().first()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="البريد الإلكتروني أو كلمة المرور غير صحيحة")

    access = create_access_token(user.id, user.email or user.phone or "")
    refresh = create_refresh_token(user.id)

    _set_cookies(response, access, refresh)

    return await user_to_response(user, db)


@api_router.post("/auth/refresh", response_model=UserResponse)
async def refresh_tokens(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("refresh_token")

    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        raise HTTPException(status_code=401, detail="جلسة العمل منتهية")

    token = token.strip()

    try:
        if await _is_revoked(token, db):
            raise HTTPException(
                status_code=401,
                detail="جلسة العمل غير صالحة، يرجى تسجيل الدخول مجدداً",
            )

        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "type"]},
        )

        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="نوع التوكن غير صالح")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="توكن غير صالح")

        result = await db.execute(select(User).where(User.id == user_id).limit(1))
        user = result.scalars().first()

        if not user:
            raise HTTPException(status_code=401, detail="المستخدم غير موجود")

        token_expires_at = datetime.fromtimestamp(payload['exp'], tz=timezone.utc)
        if not await _revoke_refresh_token(token, db, token_expires_at):
            raise HTTPException(
                status_code=401,
                detail="جلسة العمل غير صالحة، يرجى تسجيل الدخول مجدداً",
            )

        new_access = create_access_token(user.id, user.email or user.phone or "")
        new_refresh = create_refresh_token(user.id)

        _set_cookies(response, new_access, new_refresh)

        return await user_to_response(user, db)

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="انتهت صلاحية جلسة العمل")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="توكن غير صالح")


@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await user_to_response(current_user, db)


@api_router.post("/auth/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_token = request.cookies.get("refresh_token")

    if refresh_token:
        try:
            payload = jwt.decode(
                refresh_token,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
                options={"require": ["sub", "exp", "type"]},
            )
            if payload.get("type") == "refresh":
                expiry = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
                await _revoke_refresh_token(refresh_token, db, expiry)
        except jwt.InvalidTokenError:
            pass

    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")

    return {"message": "تم تسجيل الخروج بنجاح"}


# ---------- Properties ----------
@api_router.post("/properties", response_model=PropertyResponse)
async def create_property(
    data: PropertyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_active_subscription(current_user, db)

    payload = data.model_dump()
    payload["images"] = payload.get("images") or []

    if len(payload["images"]) > MAX_IMAGES_PER_PROPERTY:
        raise HTTPException(
            status_code=400,
            detail=f"الحد الأقصى للصور هو {MAX_IMAGES_PER_PROPERTY}",
        )

    if any(len(img) > 2048 for img in payload["images"]):
        raise HTTPException(status_code=400, detail="مسار الصورة طويل جداً")

    prop = Property(
        id=str(uuid.uuid4()),
        **payload,
        agent_id=current_user.id,
        agent_name=current_user.name,
        created_at=datetime.now(timezone.utc),
    )

    db.add(prop)
    await db.commit()
    await db.refresh(prop)

    return prop_to_response(prop)


@api_router.get("/properties", response_model=List[PropertyResponse])
async def get_properties(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[PropertyStatus] = None,
    governorate: Optional[str] = None,
    district: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Property)
    conds = []

    if current_user.role != "admin":
        conds.append(Property.agent_id == current_user.id)

    if status:
        conds.append(Property.status == status)

    if governorate:
        conds.append(Property.governorate.ilike(f"%{_like_escape(governorate)}%", escape="\\"))

    if district:
        conds.append(Property.district.ilike(f"%{_like_escape(district)}%", escape="\\"))

    if conds:
        stmt = stmt.where(and_(*conds))

    stmt = stmt.order_by(Property.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(stmt)
    return [prop_to_response(p) for p in result.scalars().all()]


def _storage_path_from_property_image(image: object, agent_id: str) -> Optional[str]:
    if not isinstance(image, str) or not image.strip():
        return None
    raw_path = unquote(urlsplit(image.strip()).path)
    marker = "/api/files/"
    if marker in raw_path:
        raw_path = raw_path.split(marker, 1)[1]
    else:
        raw_path = raw_path.lstrip("/")
    if not raw_path or raw_path.startswith("/") or ".." in raw_path.split("/"):
        return None
    allowed_prefix = f"{APP_NAME}/properties/{agent_id}/"
    return raw_path if raw_path.startswith(allowed_prefix) else None


async def _verified_property_image_paths(prop: Property, db: AsyncSession) -> List[Optional[str]]:
    candidates = [
        _storage_path_from_property_image(image, prop.agent_id)
        for image in (prop.images or [])
    ]
    paths = list(dict.fromkeys(path for path in candidates if path))
    if not paths:
        return [None for _ in candidates]
    result = await db.execute(
        select(FileRecord.storage_path).where(
            FileRecord.storage_path.in_(paths),
            FileRecord.user_id == prop.agent_id,
            FileRecord.is_deleted.is_(False),
        )
    )
    verified = set(result.scalars().all())
    return [path if path in verified else None for path in candidates]


async def _get_property_for_share_management(
    property_id: str, current_user: User, db: AsyncSession
) -> Property:
    result = await db.execute(select(Property).where(Property.id == property_id).limit(1))
    prop = result.scalars().first()
    if not prop:
        raise HTTPException(status_code=404, detail="العقار غير موجود")
    if current_user.role != "admin" and prop.agent_id != current_user.id:
        raise HTTPException(status_code=404, detail="العقار غير موجود")
    return prop


@api_router.post("/properties/{property_id}/public-share")
async def create_or_update_public_share(
    property_id: str,
    data: PublicShareRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_active_subscription(current_user, db)
    prop = await _get_property_for_share_management(property_id, current_user, db)
    if not prop.public_share_token:
        prop.public_share_token = secrets.token_urlsafe(32)
    prop.public_contact_enabled = data.include_agent_phone
    await db.commit()
    return {
        "token": prop.public_share_token,
        "contact_phone_enabled": prop.public_contact_enabled,
    }


@api_router.delete("/properties/{property_id}/public-share")
async def revoke_public_share(
    property_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Revocation remains available after a plan expires so owners can always close public access.
    prop = await _get_property_for_share_management(property_id, current_user, db)
    prop.public_share_token = None
    prop.public_contact_enabled = False
    await db.commit()
    return {"message": "تم إيقاف رابط المشاركة"}


@api_router.get("/public/properties/{token}", response_model=PublicPropertyResponse)
async def get_public_property(
    token: str,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    check_rate_limit(f"public-property:{_client_ip(request)}", limit=120, window_seconds=60)
    result = await db.execute(
        select(Property).where(Property.public_share_token == token).limit(1)
    )
    prop = result.scalars().first()
    if not prop:
        raise HTTPException(status_code=404, detail="رابط العقار غير متاح")

    agent_result = await db.execute(
        select(User.name, User.phone).where(User.id == prop.agent_id).limit(1)
    )
    agent = agent_result.first()
    image_paths = await _verified_property_image_paths(prop, db)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return PublicPropertyResponse(
        id=prop.id,
        total_area=prop.total_area,
        price=prop.price,
        front_width=prop.front_width,
        length=prop.length,
        bedrooms=prop.bedrooms,
        bathrooms=prop.bathrooms,
        images=[
            f"/api/public/properties/{token}/images/{index}"
            for index, path in enumerate(image_paths)
            if path
        ],
        status=prop.status,
        governorate=prop.governorate,
        district=prop.district,
        agent_name=agent.name if agent else prop.agent_name,
        contact_phone=(agent.phone if agent and prop.public_contact_enabled else None),
        whatsapp_number=(prop.whatsapp_number if prop.public_contact_enabled else None),
        instagram_username=(prop.instagram_username if prop.public_contact_enabled else None),
        created_at=prop.created_at.isoformat() if prop.created_at else "",
    )


@api_router.get("/public/properties/{token}/images/{image_index}")
async def get_public_property_image(
    token: str,
    image_index: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    check_rate_limit(f"public-property:{_client_ip(request)}", limit=120, window_seconds=60)
    result = await db.execute(
        select(Property).where(Property.public_share_token == token).limit(1)
    )
    prop = result.scalars().first()
    if not prop:
        raise HTTPException(status_code=404, detail="الصورة غير متاحة")
    image_paths = await _verified_property_image_paths(prop, db)
    if image_index < 0 or image_index >= len(image_paths) or not image_paths[image_index]:
        raise HTTPException(status_code=404, detail="الصورة غير متاحة")
    storage_path = image_paths[image_index]
    file_result = await db.execute(
        select(FileRecord).where(
            FileRecord.storage_path == storage_path,
            FileRecord.user_id == prop.agent_id,
            FileRecord.is_deleted.is_(False),
        ).limit(1)
    )
    file_record = file_result.scalars().first()
    if not file_record:
        raise HTTPException(status_code=404, detail="الصورة غير متاحة")
    image_data, _ = await get_object(storage_path, file_record.storage_provider or "emergent")
    media_type = file_record.content_type or "application/octet-stream"
    if media_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=404, detail="الصورة غير متاحة")
    return Response(
        content=image_data,
        media_type=media_type,
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@api_router.get("/properties/page", response_model=PropertyPageResponse)
async def get_properties_page(
    q: Optional[str] = Query(default=None, max_length=200),
    skip: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=100),
    status: Optional[PropertyStatus] = None,
    governorate: Optional[str] = Query(default=None, max_length=100),
    district: Optional[str] = Query(default=None, max_length=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if current_user.role != "admin":
        conditions.append(Property.agent_id == current_user.id)
    if status:
        conditions.append(Property.status == status)
    if governorate and governorate.strip():
        conditions.append(Property.governorate.ilike(f"%{_like_escape(governorate.strip())}%", escape="\\"))
    if district and district.strip():
        conditions.append(Property.district.ilike(f"%{_like_escape(district.strip())}%", escape="\\"))
    if q and q.strip():
        pattern = f"%{_like_escape(q.strip())}%"
        conditions.append(or_(
            Property.governorate.ilike(pattern, escape="\\"),
            Property.district.ilike(pattern, escape="\\"),
            Property.owner_name.ilike(pattern, escape="\\"),
            Property.agent_name.ilike(pattern, escape="\\"),
            cast(Property.price, Text).ilike(pattern, escape="\\"),
            cast(Property.total_area, Text).ilike(pattern, escape="\\"),
        ))

    total_query = select(func.count(Property.id))
    rows_query = select(Property).order_by(Property.created_at.desc(), Property.id.desc()).offset(skip).limit(limit)
    if conditions:
        total_query = total_query.where(and_(*conditions))
        rows_query = rows_query.where(and_(*conditions))
    total = await db.execute(total_query)
    rows = await db.execute(rows_query)
    return PropertyPageResponse(
        items=[prop_to_response(prop) for prop in rows.scalars().all()],
        total=total.scalar_one() or 0,
        skip=skip,
        limit=limit,
    )


@api_router.get("/properties/search", response_model=List[PropertyResponse])
async def search_properties(
    query: Optional[str] = Query(default=None, min_length=1, max_length=200),
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_area: Optional[float] = None,
    max_area: Optional[float] = None,
    bedrooms: Optional[int] = None,
    status: Optional[PropertyStatus] = None,
    governorate: Optional[str] = None,
    district: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conds = []

    if current_user.role != "admin":
        conds.append(Property.agent_id == current_user.id)

    if query:
        q = f"%{_like_escape(query)}%"
        conds.append(
            or_(
                Property.district.ilike(q, escape="\\"),
                Property.governorate.ilike(q, escape="\\"),
                Property.owner_name.ilike(q, escape="\\"),
            )
        )

    if min_price is not None:
        conds.append(Property.price >= min_price)

    if max_price is not None:
        conds.append(Property.price <= max_price)

    if min_area is not None:
        conds.append(Property.total_area >= min_area)

    if max_area is not None:
        conds.append(Property.total_area <= max_area)

    if bedrooms is not None:
        conds.append(Property.bedrooms == bedrooms)

    if status:
        conds.append(Property.status == status)

    if governorate:
        conds.append(Property.governorate.ilike(f"%{_like_escape(governorate)}%", escape="\\"))

    if district:
        conds.append(Property.district.ilike(f"%{_like_escape(district)}%", escape="\\"))

    stmt = select(Property)

    if conds:
        stmt = stmt.where(and_(*conds))

    stmt = stmt.order_by(Property.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(stmt)
    return [prop_to_response(p) for p in result.scalars().all()]


@api_router.get("/properties/{property_id}", response_model=PropertyResponse)
async def get_property(
    property_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Property).where(Property.id == property_id).limit(1))
    prop = result.scalars().first()

    if not prop:
        raise HTTPException(status_code=404, detail="العقار غير موجود")

    if current_user.role != "admin" and prop.agent_id != current_user.id:
        raise HTTPException(status_code=403, detail="غير مصرح - لا يمكنك عرض هذا العقار")

    return prop_to_response(prop)


@api_router.put("/properties/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: str,
    data: PropertyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_active_subscription(current_user, db)

    result = await db.execute(select(Property).where(Property.id == property_id).limit(1))
    prop = result.scalars().first()

    if not prop:
        raise HTTPException(status_code=404, detail="العقار غير موجود")

    if current_user.role != "admin" and prop.agent_id != current_user.id:
        raise HTTPException(status_code=403, detail="غير مصرح")

    payload = data.model_dump()
    payload["images"] = payload.get("images") or []

    if len(payload["images"]) > MAX_IMAGES_PER_PROPERTY:
        raise HTTPException(
            status_code=400,
            detail=f"الحد الأقصى للصور هو {MAX_IMAGES_PER_PROPERTY}",
        )

    if any(len(img) > 2048 for img in payload["images"]):
        raise HTTPException(status_code=400, detail="مسار الصورة طويل جداً")

    for k, v in payload.items():
        setattr(prop, k, v)

    await db.commit()
    await db.refresh(prop)

    return prop_to_response(prop)


@api_router.patch("/properties/{property_id}", response_model=PropertyResponse)
async def patch_property(
    property_id: str,
    data: PropertyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_active_subscription(current_user, db)

    result = await db.execute(select(Property).where(Property.id == property_id).limit(1))
    prop = result.scalars().first()

    if not prop:
        raise HTTPException(status_code=404, detail="العقار غير موجود")

    if current_user.role != "admin" and prop.agent_id != current_user.id:
        raise HTTPException(status_code=403, detail="غير مصرح")

    payload = data.model_dump(exclude_unset=True)

    if not payload:
        return prop_to_response(prop)

    if "images" in payload:
        images = payload.get("images") or []

        if len(images) > MAX_IMAGES_PER_PROPERTY:
            raise HTTPException(
                status_code=400,
                detail=f"الحد الأقصى للصور هو {MAX_IMAGES_PER_PROPERTY}",
            )

        if any(isinstance(img, str) and len(img) > 2048 for img in images):
            raise HTTPException(status_code=400, detail="مسار الصورة طويل جداً")

        payload["images"] = images

    for k, v in payload.items():
        setattr(prop, k, v)

    await db.commit()
    await db.refresh(prop)

    return prop_to_response(prop)


@api_router.delete("/properties/{property_id}")
async def delete_property(
    property_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Property).where(Property.id == property_id).limit(1))
    prop = result.scalars().first()

    if not prop:
        raise HTTPException(status_code=404, detail="العقار غير موجود")

    if current_user.role != "admin" and prop.agent_id != current_user.id:
        raise HTTPException(status_code=403, detail="غير مصرح")

    paths = []

    for img in prop.images or []:
        if not isinstance(img, str) or not img.strip():
            continue

        clean_path = img.split("/api/files/", 1)[-1] if "/api/files/" in img else img
        clean_path = clean_path.split("?", 1)[0].split("#", 1)[0].strip().lstrip("/")

        if clean_path:
            paths.append(clean_path)

    unique_paths = list(dict.fromkeys(paths))

    owned_storage_paths = []
    if unique_paths:
        file_conds = [FileRecord.storage_path.in_(unique_paths)]
        if current_user.role != "admin":
            file_conds.append(FileRecord.user_id == current_user.id)
        files_result = await db.execute(
            select(FileRecord).where(and_(*file_conds))
        )

        for rec in files_result.scalars().all():
            rec.is_deleted = True
            owned_storage_paths.append((rec.storage_path, rec.storage_provider or "emergent"))

    await db.delete(prop)
    await db.commit()

    for storage_path, storage_provider in owned_storage_paths:
        if storage_path.lower().startswith(("http://", "https://")):
            continue

        try:
            await delete_object(storage_path, storage_provider)
        except Exception as e:
            logger.warning(f"Failed to cleanup storage object {storage_path}: {e}")

    return {"message": "تم حذف العقار بنجاح"}


# ---------- Uploads ----------
@api_router.post("/upload")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_active_subscription(current_user, db)
    check_rate_limit(f"upload:{current_user.id}", limit=60, window_seconds=3600)

    filename = file.filename or ""
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="نوع الملف غير مدعوم، يرجى رفع صور فقط بصيغ (jpg, jpeg, png, webp)",
        )

    content_length = request.headers.get("content-length")

    if content_length:
        try:
            if int(content_length) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail="حجم الملف يتجاوز الحد المسموح به (5 ميجابايت)",
                )
        except ValueError:
            pass

    chunks = []
    total_size = 0

    while chunk := await file.read(64 * 1024):
        total_size += len(chunk)

        if total_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="حجم الملف يتجاوز الحد المسموح به (5 ميجابايت)",
            )

        chunks.append(chunk)

    data = b"".join(chunks)

    if not data:
        raise HTTPException(status_code=400, detail="الملف فارغ")

    if ext in ("jpg", "jpeg"):
        if not data.startswith(b"\xff\xd8\xff"):
            raise HTTPException(status_code=400, detail="محتوى الملف لا يطابق صورة JPEG حقيقية")
    elif ext == "png":
        if not data.startswith(b"\x89PNG\r\n\x1a\n"):
            raise HTTPException(status_code=400, detail="محتوى الملف لا يطابق صورة PNG حقيقية")
    elif ext == "webp":
        if len(data) < 12 or not data.startswith(b"RIFF") or data[8:12] != b"WEBP":
            raise HTTPException(status_code=400, detail="محتوى الملف لا يطابق صورة WebP حقيقية")

    media_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"

    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/properties/{current_user.id}/{file_id}.{ext}"

    result = await put_object(path, data, media_type)

    storage_path = result.get("path") if isinstance(result, dict) else None
    storage_path = str(storage_path).lstrip("/") if storage_path else ""

    if not storage_path:
        raise HTTPException(status_code=502, detail="استجابة خدمة التخزين غير صالحة")

    rec = FileRecord(
        id=file_id,
        storage_path=storage_path,
        original_filename=filename or "upload",
        content_type=media_type,
        size=result.get("size", len(data)),
        user_id=current_user.id,
        storage_provider=STORAGE_PROVIDER,
        is_deleted=False,
        created_at=datetime.now(timezone.utc),
    )

    db.add(rec)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=500, detail="فشل حفظ سجل الملف")

    return {
        "id": file_id,
        "path": storage_path,
        "url": f"/api/files/{storage_path}",
    }


@api_router.get("/files/{path:path}")
async def download_file(
    path: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if ".." in path.split("/") or path.startswith("/"):
        raise HTTPException(status_code=404, detail="الملف غير موجود")

    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""

    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=404, detail="الملف غير موجود")

    media_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"

    result = await db.execute(
        select(FileRecord).where(
            and_(
                FileRecord.storage_path == path,
                FileRecord.is_deleted.is_(False),
            )
        ).limit(1)
    )

    rec = result.scalars().first()

    if not rec:
        raise HTTPException(status_code=404, detail="الملف غير موجود")

    if current_user.role != "admin" and rec.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="غير مصرح")

    try:
        data, _ = await get_object(path, rec.storage_provider or "emergent")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="الملف غير موجود")

    return Response(
        content=data,
        media_type=media_type,
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


# ---------- Admin Stats ----------
@api_router.get("/admin/stats", response_model=AdminStats)
async def get_admin_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح - للمديرين فقط")

    total = (await db.execute(select(func.count()).select_from(Property))).scalar() or 0

    available = (
        await db.execute(
            select(func.count()).select_from(Property).where(Property.status == "available")
        )
    ).scalar() or 0

    sold = (
        await db.execute(
            select(func.count()).select_from(Property).where(Property.status == "sold")
        )
    ).scalar() or 0

    rented = (
        await db.execute(
            select(func.count()).select_from(Property).where(Property.status == "rented")
        )
    ).scalar() or 0

    total_offices = (await db.execute(select(func.count()).select_from(Office))).scalar() or 0

    now = datetime.now(timezone.utc)
    soon = now + timedelta(days=7)

    expiring_soon = (
        await db.execute(
            select(func.count())
            .select_from(Subscription)
            .where(
                and_(
                    Subscription.status == "active",
                    Subscription.end_date <= soon,
                    Subscription.end_date >= now,
                )
            )
        )
    ).scalar() or 0

    return AdminStats(
        total_properties=total,
        available=available,
        sold=sold,
        rented=rented,
        total_offices=total_offices,
        expiring_soon=expiring_soon,
    )


# ---------- Subscriptions ----------
@api_router.get("/subscriptions/plans")
async def get_subscription_plans():
    return [
        {
            "plan_type": k,
            "amount": PLAN_PRICING[k]["amount"],
            "label": PLAN_PRICING[k]["label"],
            "days": PLAN_PRICING[k]["days"],
            "currency": "IQD",
        }
        for k in PUBLIC_PLAN_KEYS
    ]


@api_router.get("/subscriptions/status", response_model=SubscriptionStatusResponse)
async def get_my_subscription_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == "admin":
        return SubscriptionStatusResponse(has_active=True, status="active")

    sub = await get_active_subscription(current_user.id, db)

    if not sub:
        return SubscriptionStatusResponse(has_active=False, status="expired")

    now = datetime.now(timezone.utc)
    end_dt = _ensure_utc(sub.end_date)

    days_remaining = max(0, (end_dt - now).days) if end_dt else 0
    state = "warning" if days_remaining <= 7 else "active"

    return SubscriptionStatusResponse(
        has_active=True,
        days_remaining=days_remaining,
        end_date=sub.end_date.isoformat() if sub.end_date else None,
        plan_type=sub.plan_type,
        status=state,
    )


@api_router.post("/subscriptions", response_model=SubscriptionResponse)
async def create_subscription(
    data: SubscriptionPlan,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح - فقط المدير يمكنه إنشاء الاشتراكات")

    if data.plan_type not in PLAN_PRICING:
        raise HTTPException(status_code=400, detail="نوع الاشتراك غير صحيح")

    target_user_id = data.user_id or current_user.id

    target_result = await db.execute(select(User).where(User.id == target_user_id).limit(1))
    target_user = target_result.scalars().first()

    if not target_user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")

    office_name = None

    if target_user.office_id:
        r = await db.execute(
            select(Office.office_name).where(Office.id == target_user.office_id).limit(1)
        )
        office_name = r.scalar_one_or_none()

    plan = PLAN_PRICING[data.plan_type]

    now = datetime.now(timezone.utc)
    base_date = now

    prev_result = await db.execute(
        select(Subscription)
        .where(
            and_(
                Subscription.user_id == target_user.id,
                Subscription.status == "active",
            )
        )
        .order_by(Subscription.end_date.desc())
        .limit(1)
    )

    prev_sub = prev_result.scalars().first()

    if prev_sub and prev_sub.end_date:
        prev_end = _ensure_utc(prev_sub.end_date)
        if prev_end and prev_end > now:
            base_date = prev_end

    old_result = await db.execute(
        select(Subscription).where(
            and_(
                Subscription.user_id == target_user.id,
                Subscription.status == "active",
            )
        )
    )

    for prev in old_result.scalars().all():
        prev.status = "superseded"

    sub = Subscription(
        id=str(uuid.uuid4()),
        user_id=target_user.id,
        user_name=target_user.name,
        office_name=office_name,
        plan_type=data.plan_type,
        amount=plan["amount"],
        currency="IQD",
        start_date=now,
        end_date=base_date + timedelta(days=plan["days"]),
        status="active",
        created_at=now,
    )

    db.add(sub)
    await db.commit()
    await db.refresh(sub)

    return sub_to_response(sub)


@api_router.delete("/subscriptions/{sub_id}")
async def delete_subscription(
    sub_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح - فقط المدير")

    result = await db.execute(select(Subscription).where(Subscription.id == sub_id).limit(1))
    sub = result.scalars().first()

    if not sub:
        raise HTTPException(status_code=404, detail="الاشتراك غير موجود")

    await db.delete(sub)
    await db.commit()

    return {"message": "تم حذف الاشتراك"}


@api_router.get("/subscriptions/me", response_model=List[SubscriptionResponse])
async def get_my_subscriptions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == current_user.id)
        .order_by(Subscription.created_at.desc())
    )

    subs = result.scalars().all()

    return [sub_to_response(s, status_override=_effective_sub_status(s)) for s in subs]


@api_router.get("/admin/subscriptions", response_model=List[SubscriptionResponse])
async def get_all_subscriptions(
    limit: int = Query(500, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح - للمديرين فقط")

    result = await db.execute(
        select(Subscription)
        .order_by(Subscription.created_at.desc())
        .limit(limit)
    )

    subs = result.scalars().all()

    return [sub_to_response(s, status_override=_effective_sub_status(s)) for s in subs]


@api_router.get("/admin/subscriptions/expiring", response_model=List[SubscriptionResponse])
async def get_expiring_subscriptions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح - للمديرين فقط")

    now = datetime.now(timezone.utc)
    soon = now + timedelta(days=7)

    result = await db.execute(
        select(Subscription)
        .where(
            and_(
                Subscription.status == "active",
                Subscription.end_date <= soon,
                Subscription.end_date >= now,
            )
        )
        .order_by(Subscription.end_date.asc())
        .limit(100)
    )

    return [sub_to_response(s) for s in result.scalars().all()]


@api_router.get("/admin/subscriptions/plans")
async def get_admin_subscription_plans(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح - للمديرين فقط")

    return [
        {
            "plan_type": k,
            "amount": v["amount"],
            "label": v["label"],
            "days": v["days"],
            "currency": "IQD",
        }
        for k, v in PLAN_PRICING.items()
    ]


@api_router.get("/admin/users")
async def get_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح - للمديرين فقط")

    stmt = (
        select(User, Office.office_name)
        .outerjoin(Office, User.office_id == Office.id)
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(stmt)

    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "phone": u.phone,
            "role": u.role,
            "office_name": office_name,
        }
        for u, office_name in result.all()
    ]


@api_router.get("/admin/offices")
async def get_offices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح - للمديرين فقط")

    offices_res = await db.execute(select(Office))
    offices = offices_res.scalars().all()

    agents_res = await db.execute(
        select(User).where(and_(User.office_id.isnot(None), User.role == "agent"))
    )
    agents = agents_res.scalars().all()

    office_agents = defaultdict(list)

    for a in agents:
        office_agents[a.office_id].append({"id": a.id, "name": a.name})

    return [
        {
            "office_name": o.office_name,
            "agents": office_agents[o.id],
            "agent_count": len(office_agents[o.id]),
        }
        for o in offices
    ]


@app.get("/share/{token}", response_class=HTMLResponse, include_in_schema=False)
async def public_property_share_preview(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Serve crawler metadata, then send human visitors to the React property page."""
    check_rate_limit(f"public-property-preview:{_client_ip(request)}", limit=120, window_seconds=60)
    result = await db.execute(
        select(Property).where(Property.public_share_token == token).limit(1)
    )
    prop = result.scalars().first()
    if not prop:
        raise HTTPException(status_code=404, detail="رابط العقار غير متاح")

    location = "، ".join(part for part in (prop.governorate, prop.district) if part)
    title = f"عقار في {location or 'العراق'} | عقاراتي"
    description = f"{location + ' · ' if location else ''}السعر {int(prop.price or 0):,} دينار عراقي. شاهد تفاصيل العقار عبر عقاراتي."
    property_url = f"{PUBLIC_API_URL}/share/{quote(token, safe='')}"
    frontend_url = f"{PUBLIC_APP_URL}/share/{quote(token, safe='')}"

    image_paths = await _verified_property_image_paths(prop, db)
    first_image_index = next((index for index, path in enumerate(image_paths) if path), None)
    image_url = (
        f"{PUBLIC_API_URL}/api/public/properties/{quote(token, safe='')}/images/{first_image_index}"
        if first_image_index is not None else ""
    )

    esc = lambda value: html.escape(value, quote=True)
    redirect_json = json.dumps(frontend_url, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e")
    image_meta = (
        f'<meta property="og:image" content="{esc(image_url)}" />'
        f'<meta property="og:image:alt" content="{esc(title)}" />'
        f'<meta name="twitter:image" content="{esc(image_url)}" />'
        if image_url else ""
    )
    page = f'''<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="description" content="{esc(description)}" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="ar_IQ" />
<meta property="og:site_name" content="عقاراتي" />
<meta property="og:title" content="{esc(title)}" />
<meta property="og:description" content="{esc(description)}" />
<meta property="og:url" content="{esc(property_url)}" />
<meta name="twitter:card" content="{'summary_large_image' if image_url else 'summary'}" />
<meta name="twitter:title" content="{esc(title)}" />
<meta name="twitter:description" content="{esc(description)}" />
{image_meta}
<meta http-equiv="refresh" content="0;url={esc(frontend_url)}" />
<title>{esc(title)}</title>
<script>window.location.replace({redirect_json});</script>
</head>
<body><p>جارٍ فتح تفاصيل العقار... <a href="{esc(frontend_url)}">افتح الصفحة</a></p></body>
</html>'''
    return HTMLResponse(
        content=page,
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
        },
    )


# ---------- Router ----------
app.include_router(api_router)


# ---------- CORS and cookie CSRF protection ----------
cors_env = os.environ.get("CORS_ORIGINS")
configured_origins = [
    origin.strip().rstrip("/")
    for origin in (cors_env or "").split(",")
    if origin.strip()
]

if IS_PRODUCTION and not configured_origins:
    _critical_exit("CRITICAL: CORS_ORIGINS must be set to at least one origin in production")

if "*" in configured_origins:
    _critical_exit("CRITICAL: wildcard CORS_ORIGINS cannot be used with cookie authentication")

if IS_PRODUCTION and any(not origin.startswith("https://") for origin in configured_origins):
    _critical_exit("CRITICAL: production CORS_ORIGINS must use HTTPS")

origins = configured_origins or [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
trusted_hosts = [host.strip() for host in os.environ.get("TRUSTED_HOSTS", "").split(",") if host.strip()]

if IS_PRODUCTION and not trusted_hosts:
    _critical_exit("CRITICAL: TRUSTED_HOSTS must list the public backend hostnames in production.")
if "*" in trusted_hosts:
    _critical_exit("CRITICAL: wildcard TRUSTED_HOSTS disables host-header protection.")

@app.middleware("http")
async def enforce_origin_for_cookie_mutations(request: Request, call_next):
    response = None
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") not in origins:
            from starlette.responses import JSONResponse
            response = JSONResponse(
                status_code=403,
                content={"detail": "مصدر الطلب غير مسموح"},
            )

    if response is None:
        response = await call_next(request)

    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "private, no-store")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if IS_PRODUCTION:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    return response

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
if trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts)


# ---------- Main Runner ----------
if __name__ == "__main__":
    try:
        import uvicorn
    except Exception as uvicorn_error:
        _critical_exit(f"uvicorn is not installed or failed to import: {uvicorn_error}")

    try:
        module_name = Path(__file__).stem
        use_reload = module_name.isidentifier() and not IS_PRODUCTION

        logger.info(f"Starting server on http://0.0.0.0:8000 (reload={use_reload})")
        print(f"Starting server on http://0.0.0.0:8000 (reload={use_reload})")

        if module_name.isidentifier():
            uvicorn.run(
                f"{module_name}:app",
                host="0.0.0.0",
                port=8000,
                reload=use_reload,
            )
        else:
            uvicorn.run(
                app,
                host="0.0.0.0",
                port=8000,
                reload=False,
            )

    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.critical(f"Failed to start server: {e}")
        print(f"Failed to start server: {e}")
    finally:
        _pause_console()