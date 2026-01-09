# backend/app/config.py
"""
환경 설정 모듈
- 환경 변수를 통해 DB 연결 정보 및 앱 설정을 관리합니다.
"""

import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """앱 설정 클래스"""

    # 앱 기본 설정
    APP_NAME: str = "농업 기상 데이터 API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # 데이터베이스 설정
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "ag_weather_db"
    DB_USER: str = "smartfarm"
    DB_PASSWORD: str = "smartfarm"

    # CORS 설정 (콤마로 구분된 문자열 또는 "*")
    CORS_ORIGINS: str = "*"

    @property
    def cors_origins_list(self) -> list[str]:
        """CORS 허용 출처 목록 반환"""
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    # 페이지네이션 기본값
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    @property
    def database_url(self) -> str:
        """PostgreSQL 연결 URL 생성 (psycopg3 사용)"""
        return f"postgresql+psycopg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """설정 인스턴스 반환 (캐시됨)"""
    return Settings()
