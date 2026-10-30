"""Private customer lead CRM routes for real-estate agents."""
import re
import uuid
from datetime import datetime, timezone
from typing import Callable, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Lead, Property, User

LeadStatus = Literal["new", "contacted", "visit_scheduled", "negotiating", "won", "lost"]
LeadSource = Literal["manual", "phone", "whatsapp", "website", "referral"]
PHONE_REGEX = re.compile(r"^\+?[0-9]{7,15}$")
EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
CLOSED_STATUSES = ("won", "lost")


class LeadCreate(BaseModel):
    customer_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=7, max_length=24)
    email: Optional[str] = Field(default=None, max_length=254)
    property_id: Optional[str] = Field(default=None, max_length=80)
    status: LeadStatus = "new"
    source: LeadSource = "manual"
    notes: Optional[str] = Field(default=None, max_length=2500)
    follow_up_at: Optional[datetime] = None


class LeadUpdate(BaseModel):
    customer_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    phone: Optional[str] = Field(default=None, min_length=7, max_length=24)
    email: Optional[str] = Field(default=None, max_length=254)
    property_id: Optional[str] = Field(default=None, max_length=80)
    status: Optional[LeadStatus] = None
    source: Optional[LeadSource] = None
    notes: Optional[str] = Field(default=None, max_length=2500)
    follow_up_at: Optional[datetime] = None


class LeadResponse(BaseModel):
    id: str
    agent_id: str
    agent_name: Optional[str] = None
    property_id: Optional[str] = None
    customer_name: str
    phone: str
    email: Optional[str] = None
    status: str
    source: str
    notes: Optional[str] = None
    follow_up_at: Optional[str] = None
    closed_at: Optional[str] = None
    created_at: str
    updated_at: str


class LeadPageResponse(BaseModel):
    items: List[LeadResponse]
    total: int
    skip: int
    limit: int


def _ensure_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _serialize_lead(lead: Lead, agent_name: Optional[str] = None) -> LeadResponse:
    return LeadResponse(
        id=lead.id,
        agent_id=lead.agent_id,
        agent_name=agent_name,
        property_id=lead.property_id,
        customer_name=lead.customer_name,
        phone=lead.phone,
        email=lead.email,
        status=lead.status,
        source=lead.source,
        notes=lead.notes,
        follow_up_at=lead.follow_up_at.isoformat() if lead.follow_up_at else None,
        closed_at=lead.closed_at.isoformat() if lead.closed_at else None,
        created_at=lead.created_at.isoformat() if lead.created_at else "",
        updated_at=lead.updated_at.isoformat() if lead.updated_at else "",
    )


def _clean_payload(payload: dict) -> dict:
    for required_field in ("customer_name", "phone", "status", "source"):
        if required_field in payload and payload[required_field] is None:
            raise HTTPException(status_code=422, detail="لا يمكن ترك الحقول الأساسية فارغة")

    if "customer_name" in payload and payload["customer_name"] is not None:
        payload["customer_name"] = payload["customer_name"].strip()
        if len(payload["customer_name"]) < 2:
            raise HTTPException(status_code=422, detail="اسم العميل مطلوب")

    if "phone" in payload and payload["phone"] is not None:
        phone = payload["phone"].translate(
            str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
        )
        phone = re.sub(r"[\s()\-]", "", phone)
        if not PHONE_REGEX.fullmatch(phone):
            raise HTTPException(status_code=422, detail="رقم الهاتف غير صالح")
        payload["phone"] = phone

    if "email" in payload:
        email = (payload["email"] or "").strip().lower()
        if email and not EMAIL_REGEX.fullmatch(email):
            raise HTTPException(status_code=422, detail="البريد الإلكتروني غير صالح")
        payload["email"] = email or None

    if "notes" in payload:
        payload["notes"] = (payload["notes"] or "").strip() or None

    if "property_id" in payload:
        payload["property_id"] = (payload["property_id"] or "").strip() or None

    if "follow_up_at" in payload and payload["follow_up_at"] is not None:
        payload["follow_up_at"] = _ensure_utc(payload["follow_up_at"])

    return payload


async def _ensure_property_access(
    property_id: Optional[str], current_user: User, db: AsyncSession
):
    if not property_id:
        return
    conditions = [Property.id == property_id]
    if current_user.role != "admin":
        conditions.append(Property.agent_id == current_user.id)
    result = await db.execute(select(Property.id).where(and_(*conditions)).limit(1))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="العقار غير موجود أو غير متاح لحسابك")


def create_leads_router(
    current_user_dependency: Callable,
    db_dependency: Callable,
    active_subscription_guard: Callable,
) -> APIRouter:
    """Build routes with the app's authentication, database, and plan guards."""
    router = APIRouter()

    def scope_for(current_user: User):
        return [] if current_user.role == "admin" else [Lead.agent_id == current_user.id]

    @router.get("/analytics/overview")
    async def get_analytics_overview(
        current_user: User = Depends(current_user_dependency),
        db: AsyncSession = Depends(db_dependency),
    ):
        lead_scope = scope_for(current_user)
        property_scope = [] if current_user.role == "admin" else [Property.agent_id == current_user.id]

        property_result = await db.execute(
            select(Property.status, func.count(Property.id))
            .where(*property_scope)
            .group_by(Property.status)
        )
        property_counts = {status: count for status, count in property_result.all()}

        lead_result = await db.execute(
            select(Lead.status, func.count(Lead.id))
            .where(*lead_scope)
            .group_by(Lead.status)
        )
        lead_counts = {status: count for status, count in lead_result.all()}
        lead_total = sum(lead_counts.values())
        open_count = sum(
            lead_counts.get(status, 0)
            for status in ("new", "contacted", "visit_scheduled", "negotiating")
        )
        closed_count = lead_counts.get("won", 0) + lead_counts.get("lost", 0)
        due_result = await db.execute(
            select(func.count(Lead.id)).where(
                *lead_scope,
                Lead.status.notin_(CLOSED_STATUSES),
                Lead.follow_up_at.is_not(None),
                Lead.follow_up_at <= datetime.now(timezone.utc),
            )
        )

        now = datetime.now(timezone.utc)
        month_index = now.year * 12 + now.month - 1
        month_keys = [month_index - offset for offset in range(5, -1, -1)]
        month_labels = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"]
        months = []
        for key in month_keys:
            year, zero_month = divmod(key, 12)
            months.append((year, zero_month + 1))
        cutoff_year, cutoff_month = months[0]
        cutoff = datetime(cutoff_year, cutoff_month, 1, tzinfo=timezone.utc)
        month_expr = func.date_trunc("month", Lead.closed_at)
        wins_result = await db.execute(
            select(month_expr, func.count(Lead.id))
            .where(*lead_scope, Lead.status == "won", Lead.closed_at >= cutoff)
            .group_by(month_expr)
            .order_by(month_expr.asc())
        )
        wins_by_month = {
            (month.year, month.month): count
            for month, count in wins_result.all()
            if month is not None
        }
        return {
            "properties": {
                "total": sum(property_counts.values()),
                "available": property_counts.get("available", 0),
                "sold": property_counts.get("sold", 0),
                "rented": property_counts.get("rented", 0),
            },
            "leads": {
                "total": lead_total,
                "open": open_count,
                "follow_up_due": due_result.scalar_one() or 0,
                "won": lead_counts.get("won", 0),
                "lost": lead_counts.get("lost", 0),
                "conversion_rate": round(lead_counts.get("won", 0) * 100 / closed_count, 1) if closed_count else 0,
                "by_status": lead_counts,
            },
            "monthly_wins": [
                {"label": f"{month_labels[month - 1]} {year}", "value": wins_by_month.get((year, month), 0)}
                for year, month in months
            ],
        }

    @router.get("/leads/stats")
    async def get_lead_stats(
        current_user: User = Depends(current_user_dependency),
        db: AsyncSession = Depends(db_dependency),
    ):
        scope = scope_for(current_user)
        result = await db.execute(
            select(Lead.status, func.count(Lead.id)).where(*scope).group_by(Lead.status)
        )
        counts = {status: count for status, count in result.all()}
        total = sum(counts.values())
        open_count = sum(
            counts.get(status, 0)
            for status in ("new", "contacted", "visit_scheduled", "negotiating")
        )
        due_result = await db.execute(
            select(func.count(Lead.id)).where(
                *scope,
                Lead.status.notin_(CLOSED_STATUSES),
                Lead.follow_up_at.is_not(None),
                Lead.follow_up_at <= datetime.now(timezone.utc),
            )
        )
        return {
            "total": total,
            "open": open_count,
            "follow_up_due": due_result.scalar_one() or 0,
            "won": counts.get("won", 0),
            "lost": counts.get("lost", 0),
            "by_status": counts,
        }

    @router.get("/leads", response_model=LeadPageResponse)
    async def get_leads(
        q: Optional[str] = Query(default=None, max_length=200),
        status: Optional[LeadStatus] = None,
        follow_up_from: Optional[datetime] = None,
        follow_up_to: Optional[datetime] = None,
        skip: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=100),
        current_user: User = Depends(current_user_dependency),
        db: AsyncSession = Depends(db_dependency),
    ):
        conditions = scope_for(current_user)
        if status:
            conditions.append(Lead.status == status)
        start = _ensure_utc(follow_up_from)
        end = _ensure_utc(follow_up_to)
        if start and end and start >= end:
            raise HTTPException(status_code=422, detail="نطاق موعد المتابعة غير صالح")
        if start or end:
            conditions.append(Lead.status.notin_(CLOSED_STATUSES))
        if start:
            conditions.extend([Lead.follow_up_at.is_not(None), Lead.follow_up_at >= start])
        if end:
            conditions.extend([Lead.follow_up_at.is_not(None), Lead.follow_up_at < end])
        if q and q.strip():
            pattern = f"%{_escape_like(q.strip())}%"
            conditions.append(
                or_(
                    Lead.customer_name.ilike(pattern, escape="\\"),
                    Lead.phone.ilike(pattern, escape="\\"),
                    Lead.email.ilike(pattern, escape="\\"),
                    Lead.notes.ilike(pattern, escape="\\"),
                )
            )

        total_result = await db.execute(select(func.count(Lead.id)).where(*conditions))
        rows = await db.execute(
            select(Lead, User.name)
            .join(User, User.id == Lead.agent_id)
            .where(*conditions)
            .order_by(Lead.follow_up_at.asc().nullslast(), Lead.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return LeadPageResponse(
            items=[_serialize_lead(lead, agent_name) for lead, agent_name in rows.all()],
            total=total_result.scalar_one() or 0,
            skip=skip,
            limit=limit,
        )

    @router.post("/leads", response_model=LeadResponse, status_code=201)
    async def create_lead(
        data: LeadCreate,
        current_user: User = Depends(current_user_dependency),
        db: AsyncSession = Depends(db_dependency),
    ):
        await active_subscription_guard(current_user, db)
        payload = _clean_payload(data.model_dump())
        await _ensure_property_access(payload.get("property_id"), current_user, db)
        now = datetime.now(timezone.utc)
        lead = Lead(
            id=str(uuid.uuid4()),
            agent_id=current_user.id,
            **payload,
            created_at=now,
            updated_at=now,
        )
        db.add(lead)
        await db.commit()
        await db.refresh(lead)
        return _serialize_lead(lead, current_user.name)

    @router.get("/leads/{lead_id}", response_model=LeadResponse)
    async def get_lead(
        lead_id: str,
        current_user: User = Depends(current_user_dependency),
        db: AsyncSession = Depends(db_dependency),
    ):
        conditions = [Lead.id == lead_id]
        if current_user.role != "admin":
            conditions.append(Lead.agent_id == current_user.id)
        result = await db.execute(
            select(Lead, User.name)
            .join(User, User.id == Lead.agent_id)
            .where(and_(*conditions))
            .limit(1)
        )
        row = result.first()
        if not row:
            raise HTTPException(status_code=404, detail="العميل غير موجود")
        lead, agent_name = row
        return _serialize_lead(lead, agent_name)

    @router.patch("/leads/{lead_id}", response_model=LeadResponse)
    async def update_lead(
        lead_id: str,
        data: LeadUpdate,
        current_user: User = Depends(current_user_dependency),
        db: AsyncSession = Depends(db_dependency),
    ):
        await active_subscription_guard(current_user, db)
        conditions = [Lead.id == lead_id]
        if current_user.role != "admin":
            conditions.append(Lead.agent_id == current_user.id)
        result = await db.execute(select(Lead).where(and_(*conditions)).limit(1))
        lead = result.scalars().first()
        if not lead:
            raise HTTPException(status_code=404, detail="العميل غير موجود")

        updates = _clean_payload(data.model_dump(exclude_unset=True))
        if not updates:
            raise HTTPException(status_code=422, detail="أرسل حقلاً واحداً على الأقل للتعديل")
        await _ensure_property_access(
            updates.get("property_id", lead.property_id), current_user, db
        )
        for field, value in updates.items():
            setattr(lead, field, value)
        if "status" in updates:
            lead.closed_at = (
                datetime.now(timezone.utc)
                if updates["status"] in CLOSED_STATUSES
                else None
            )
        lead.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(lead)
        return _serialize_lead(lead, current_user.name)

    @router.delete("/leads/{lead_id}")
    async def delete_lead(
        lead_id: str,
        current_user: User = Depends(current_user_dependency),
        db: AsyncSession = Depends(db_dependency),
    ):
        await active_subscription_guard(current_user, db)
        conditions = [Lead.id == lead_id]
        if current_user.role != "admin":
            conditions.append(Lead.agent_id == current_user.id)
        result = await db.execute(select(Lead).where(and_(*conditions)).limit(1))
        lead = result.scalars().first()
        if not lead:
            raise HTTPException(status_code=404, detail="العميل غير موجود")
        await db.delete(lead)
        await db.commit()
        return {"message": "تم حذف بيانات العميل"}

    return router
