# backend/app/main.py
"""
FastAPI 메인 애플리케이션
- 농업 기상 데이터 API 서버
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time

from .config import get_settings
from .database import engine, Base
from .routers import (
    kma_asos_router,
    kma_realtime_router,
    kma_forecast_router,
    rda_weather_router,
    stats_router
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 생명주기 관리"""
    # 시작 시 실행
    print(f"[START] {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"[DB] {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")

    yield

    # 종료 시 실행
    print("[STOP] Server shutdown")


# FastAPI 앱 생성
app = FastAPI(
    title=settings.APP_NAME,
    description="""
## 농업 기상 데이터 API

기상청(KMA)과 농촌진흥청(RDA)의 기상 데이터를 제공하는 API입니다.

### 주요 기능
- **KMA ASOS**: 기상청 ASOS 관측소 일자료
- **KMA 실황**: 초단기 실황 데이터
- **KMA 예보**: 단기예보 / 중기예보
- **RDA 농업기상**: 10분 간격 / 일별 / 월별 데이터
- **통계**: 관측소별 통계, 비교 분석

### 참고사항
- 모든 API는 읽기 전용입니다.
- 페이지네이션: `offset`, `limit` 파라미터 사용
- 날짜 형식: `YYYY-MM-DD`
    """,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET"],  # 읽기 전용
    allow_headers=["*"],
)


# 요청 시간 측정 미들웨어
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """응답 시간을 헤더에 추가"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    return response


# 전역 예외 처리
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """전역 예외 처리"""
    return JSONResponse(
        status_code=500,
        content={
            "detail": "서버 내부 오류가 발생했습니다.",
            "error": str(exc) if settings.DEBUG else None
        }
    )


# 라우터 등록
app.include_router(kma_asos_router)
app.include_router(kma_realtime_router)
app.include_router(kma_forecast_router)
app.include_router(rda_weather_router)
app.include_router(stats_router)


# 루트 엔드포인트
@app.get("/", tags=["기본"])
def root():
    """API 서버 정보를 반환합니다."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["기본"])
def health_check():
    """서버 상태를 확인합니다."""
    return {"status": "healthy"}


# 개발 서버 실행용
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=5000,
        reload=True
    )
