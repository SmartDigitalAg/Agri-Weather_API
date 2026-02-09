# backend/app/database.py
"""
데이터베이스 연결 모듈
- PostgreSQL 연결을 관리합니다.
- 읽기 전용으로 접근합니다.
"""

from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from .config import get_settings

settings = get_settings()

# SQLAlchemy 엔진 생성 (읽기 전용 권장)
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,      # 연결 상태 확인 (stale connection 방지)
    pool_size=10,            # 커넥션 풀 크기 증가
    max_overflow=20,         # 추가 연결 허용 수 증가
    pool_recycle=300,        # 5분마다 연결 재활용 (stale connection 방지)
    pool_timeout=30,         # 풀에서 연결 대기 최대 시간 (초)
    echo=settings.DEBUG      # SQL 로깅 (디버그 모드에서만)
)

# 쿼리 타임아웃 설정 (30초)
@event.listens_for(engine, "connect")
def set_query_timeout(dbapi_connection, connection_record):
    """각 연결에 쿼리 타임아웃 설정"""
    cursor = dbapi_connection.cursor()
    cursor.execute("SET statement_timeout = '30s'")
    cursor.close()

# 세션 팩토리 생성
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# ORM 베이스 클래스
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    데이터베이스 세션 의존성
    - FastAPI 의존성 주입에 사용됩니다.
    - 요청 완료 후 세션을 자동으로 닫습니다.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
