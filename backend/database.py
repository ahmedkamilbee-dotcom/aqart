"""
اتصال قاعدة البيانات - Supabase Postgres (عبر Transaction Pooler).

ملاحظات مهمة:
- نستخدم رابط الـ Pooler (المنفذ 6543) لأنه الأنسب لخادم يعمل باستمرار على Supabase.
- الـ Pooler في وضع Transaction لا يدعم الـ prepared statements، لذلك نعطّل الكاش
  ونولّد أسماء فريدة للعبارات المحضّرة.
- مكتبة asyncpg لا تقبل بعض الوسائط في الرابط (مثل sslmode و pgbouncer)،
  لذلك نزيلها من الرابط ونمرّر SSL عبر connect_args.
"""
import os
import ssl
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

load_dotenv(Path(__file__).parent / '.env')

_RAW_DATABASE_URL = os.environ.get('DATABASE_URL')
if not _RAW_DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL غير موجود. انسخ backend/.env.example إلى backend/.env "
        "وضع رابط Supabase (Transaction Pooler) فيه."
    )

# وسائط الرابط التي لا يفهمها asyncpg
_UNSUPPORTED_QUERY_KEYS = {'sslmode', 'pgbouncer', 'supa', 'connection_limit', 'pool_timeout'}


def _build_async_url(url: str) -> str:
    # Supabase / Heroku قد يعطيان postgres:// بدل postgresql://
    if url.startswith('postgres://'):
        url = 'postgresql://' + url[len('postgres://'):]
    if url.startswith('postgresql://'):
        url = 'postgresql+asyncpg://' + url[len('postgresql://'):]

    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k.lower() not in _UNSUPPORTED_QUERY_KEYS]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


ASYNC_DATABASE_URL = _build_async_url(_RAW_DATABASE_URL)

# Supabase يفرض SSL؛ DB_SSL=false مسموح محلياً فقط.
_USE_SSL = os.environ.get('DB_SSL', 'true').lower() not in ('0', 'false', 'no')
_IS_PRODUCTION = os.environ.get('ENV', '').lower() in ('production', 'prod')
_DB_SSL_CA = os.environ.get('DB_SSL_CA')

if _IS_PRODUCTION and not _USE_SSL:
    raise RuntimeError('DB_SSL=false غير مسموح في بيئة الإنتاج.')
if _IS_PRODUCTION and not _DB_SSL_CA:
    raise RuntimeError('DB_SSL_CA مطلوب في الإنتاج للتحقق من شهادة Supabase.')


def _ssl_context():
    if _DB_SSL_CA:
        return ssl.create_default_context(cafile=_DB_SSL_CA)

    # Local development uses encryption; certificate verification is enabled by DB_SSL_CA.
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context


_connect_args = {
    # مطلوب مع الـ Transaction Pooler (pgbouncer)
    'statement_cache_size': 0,
    'prepared_statement_cache_size': 0,
    'prepared_statement_name_func': lambda: f'__asyncpg_{uuid.uuid4()}__',
    'command_timeout': 30,
}
if _USE_SSL:
    _connect_args['ssl'] = _ssl_context()

engine = create_async_engine(
    ASYNC_DATABASE_URL,
    pool_size=int(os.environ.get('DB_POOL_SIZE', '10')),
    max_overflow=int(os.environ.get('DB_MAX_OVERFLOW', '5')),
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True,   # الـ Pooler قد يغلق اتصالات خاملة
    echo=False,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
