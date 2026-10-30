import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base

Base = declarative_base()

# --- ثوابت خطط الاشتراك الأربع والمدد بالأيام ---
PLAN_TRIAL = 'trial'             # شهر مجاني (نفس المفتاح المستخدم في الخادم والواجهة)
PLAN_MONTHLY = 'monthly'         # اشتراك شهري
PLAN_QUARTERLY = 'quarterly'     # اشتراك ربع سنوي
PLAN_YEARLY = 'yearly'           # اشتراك سنوي

TRIAL_DAYS = 30
DEFAULT_PLAN_TYPE = PLAN_TRIAL
PLAN_FREE_TRIAL = PLAN_TRIAL      # اسم بديل قديم للتوافق فقط

PLAN_DURATION_DAYS = {
    PLAN_TRIAL: 30,
    PLAN_MONTHLY: 30,
    PLAN_QUARTERLY: 90,
    PLAN_YEARLY: 365,
}

AVAILABLE_PLANS = [
    PLAN_TRIAL,
    PLAN_MONTHLY,
    PLAN_QUARTERLY,
    PLAN_YEARLY,
]


def _uuid_str():
    return str(uuid.uuid4())


def _now_utc():
    return datetime.now(timezone.utc)


class Office(Base):
    __tablename__ = 'offices'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    office_name = Column(Text, nullable=False)
    phone_number = Column(Text, nullable=True)


class User(Base):
    __tablename__ = 'users'

    id = Column(Text, primary_key=True, default=_uuid_str)
    office_id = Column(UUID(as_uuid=True), ForeignKey('offices.id'), nullable=True)
    email = Column(Text, nullable=True, unique=True)
    phone = Column(Text, nullable=True, unique=True)
    name = Column(Text, nullable=False)
    role = Column(Text, nullable=False, default='agent')
    password_hash = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now_utc, nullable=False)


class Property(Base):
    __tablename__ = 'properties'

    id = Column(Text, primary_key=True, default=_uuid_str)
    total_area = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    front_width = Column(Float, nullable=False)
    length = Column(Float, nullable=False)
    bedrooms = Column(Integer, nullable=False)
    bathrooms = Column(Integer, nullable=False)
    owner_name = Column(Text, nullable=True, default='')
    owner_phone = Column(Text, nullable=False)
    images = Column(JSONB, nullable=False, default=list)
    public_share_token = Column(Text, nullable=True)
    public_contact_enabled = Column(Boolean, nullable=False, default=False)
    status = Column(Text, nullable=False, default='available')
    agent_id = Column(Text, nullable=False)
    agent_name = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now_utc, nullable=False)
    governorate = Column(Text, nullable=True)
    district = Column(Text, nullable=True)


class Subscription(Base):
    __tablename__ = 'subscriptions'

    id = Column(Text, primary_key=True, default=_uuid_str)
    user_id = Column(Text, nullable=False)
    user_name = Column(Text, nullable=False)
    office_name = Column(Text, nullable=True)
    plan_type = Column(Text, nullable=False, default=DEFAULT_PLAN_TYPE)
    amount = Column(Integer, nullable=False, default=0)
    currency = Column(Text, nullable=False, default='IQD')
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(Text, nullable=False, default='active')
    created_at = Column(DateTime(timezone=True), default=_now_utc, nullable=False)


class FileRecord(Base):
    __tablename__ = 'files'

    id = Column(Text, primary_key=True, default=_uuid_str)
    storage_path = Column(Text, nullable=False)
    storage_provider = Column(Text, nullable=False, default='emergent')
    original_filename = Column(Text, nullable=True)
    content_type = Column(Text, nullable=True)
    size = Column(Integer, nullable=True)
    user_id = Column(Text, nullable=False)
    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=_now_utc, nullable=False)


class RevokedRefreshToken(Base):
    __tablename__ = 'revoked_refresh_tokens'

    token_hash = Column(String(64), primary_key=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now_utc, nullable=False)


class Lead(Base):
    """A customer inquiry owned by one agent and optionally linked to a listing."""

    __tablename__ = 'leads'

    id = Column(Text, primary_key=True, default=_uuid_str)
    agent_id = Column(Text, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    property_id = Column(Text, ForeignKey('properties.id', ondelete='SET NULL'), nullable=True)
    customer_name = Column(Text, nullable=False)
    phone = Column(Text, nullable=False)
    email = Column(Text, nullable=True)
    status = Column(Text, nullable=False, default='new')
    source = Column(Text, nullable=False, default='manual')
    notes = Column(Text, nullable=True)
    follow_up_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now_utc, nullable=False)
