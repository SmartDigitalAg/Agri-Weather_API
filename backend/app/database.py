# backend/app/database.py
"""
데이터베이스 연결 모듈
- PostgreSQL 연결을 관리합니다.
- 읽기 전용으로 접근합니다.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from .config import get_settings

settings = get_settings()

# SQLAlchemy 엔진 생성 (읽기 전용 권장)
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,  # 연결 상태 확인
    pool_size=5,         # 커넥션 풀 크기
    max_overflow=10,     # 추가 연결 허용 수
    echo=settings.DEBUG  # SQL 로깅 (디버그 모드에서만)
)

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
