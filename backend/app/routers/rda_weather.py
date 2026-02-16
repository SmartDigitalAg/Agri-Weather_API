# backend/app/routers/rda_weather.py
"""
RDA 농업기상 API 라우터
- 농촌진흥청 기상 데이터 조회 엔드포인트
"""

import csv
import os
from typing import Optional, List
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from ..database import get_db
from ..models.rda import WeatherData, WeatherDataDaily, WeatherDataMonthly
from ..schemas.rda import (
    WeatherDataResponse,
    WeatherDataDailyResponse,
    WeatherDataMonthlyResponse
)
from ..schemas.common import PaginatedResponse

router = APIRouter(
    prefix="/api/rda/weather",
    tags=["RDA 농업기상"]
)

# --- 지점 정보 매핑 로드 ---
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_CSV_PATH = os.path.join(_BASE_DIR, "..", "..", "..", "Agri-Weather_DB", "RDA", "region_info.csv")

STATION_MAP: dict = {}   # {지점코드: {"stn_name", "province"}}
STATION_LIST: list = []   # 전체 지점 목록


def _load_station_map():
    resolved = os.path.normpath(_CSV_PATH)
    if not os.path.exists(resolved):
        print(f"[WARN] region_info.csv not found: {resolved}")
        return
    with open(resolved, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row.get("지점코드", "").strip()
            if not code:
                continue
            entry = {
                "stn_cd": code,
                "stn_name": row.get("지점명", "").strip(),
                "province": row.get("도명", "").strip(),
            }
            STATION_MAP[code] = entry
            STATION_LIST.append(entry)


_load_station_map()


# ===== 10분 간격 데이터 =====

@router.get("/realtime/latest", response_model=List[WeatherDataResponse], summary="최신 10분 간격 데이터 조회")
def get_latest_realtime_data(
    stn_cd: Optional[str] = Query(default=None, description="관측소 코드"),
    limit: int = Query(default=20, ge=1, le=500, description="조회 개수"),
    db: Session = Depends(get_db)
):
    """
    최신 10분 간격 기상 데이터를 조회합니다.
    """
    query = db.query(WeatherData).order_by(desc(WeatherData.datetime))

    if stn_cd:
        query = query.filter(WeatherData.stn_cd == stn_cd)

    results = query.limit(limit).all()
    return results


@router.get("/realtime/station/{stn_cd}", response_model=PaginatedResponse, summary="관측소별 10분 간격 데이터 조회")
def get_realtime_by_station(
    stn_cd: str,
    start_datetime: Optional[datetime] = Query(default=None, description="시작 일시"),
    end_datetime: Optional[datetime] = Query(default=None, description="종료 일시"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    특정 관측소의 10분 간격 데이터를 조회합니다.
    """
    query = db.query(WeatherData).filter(WeatherData.stn_cd == stn_cd)

    if start_datetime:
        query = query.filter(WeatherData.datetime >= start_datetime)
    if end_datetime:
        query = query.filter(WeatherData.datetime <= end_datetime)

    total = query.count()

    if total == 0:
        raise HTTPException(status_code=404, detail=f"관측소 '{stn_cd}'의 데이터가 없습니다.")

    results = query.order_by(desc(WeatherData.datetime)).offset(offset).limit(limit).all()

    return PaginatedResponse(total=total, offset=offset, limit=limit, data=results)


# ===== 일별 데이터 =====

@router.get("/daily/latest", response_model=List[WeatherDataDailyResponse], summary="최신 일별 데이터 조회")
def get_latest_daily_data(
    stn_cd: Optional[str] = Query(default=None, description="관측소 코드"),
    limit: int = Query(default=20, ge=1, le=100, description="조회 개수"),
    db: Session = Depends(get_db)
):
    """
    최신 일별 기상 데이터를 조회합니다.
    """
    query = db.query(WeatherDataDaily).order_by(desc(WeatherDataDaily.date))

    if stn_cd:
        query = query.filter(WeatherDataDaily.stn_cd == stn_cd)

    results = query.limit(limit).all()
    return results


@router.get("/daily/date/{target_date}", response_model=List[WeatherDataDailyResponse], summary="특정 날짜 일별 데이터 조회")
def get_daily_by_date(
    target_date: date,
    stn_cd: Optional[str] = Query(default=None, description="관측소 코드"),
    db: Session = Depends(get_db)
):
    """
    특정 날짜의 일별 기상 데이터를 조회합니다.
    """
    query = db.query(WeatherDataDaily).filter(WeatherDataDaily.date == target_date)

    if stn_cd:
        query = query.filter(WeatherDataDaily.stn_cd == stn_cd)

    results = query.order_by(WeatherDataDaily.stn_cd).all()

    if not results:
        raise HTTPException(status_code=404, detail=f"{target_date} 날짜의 데이터가 없습니다.")

    return results


@router.get("/daily/range", summary="기간별 일별 데이터 조회")
def get_daily_by_range(
    start_date: date = Query(description="시작 날짜"),
    end_date: date = Query(description="종료 날짜"),
    stn_cd: Optional[str] = Query(default=None, description="관측소 코드"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=10000, description="조회 개수 (다운로드 시 최대 10000)"),
    db: Session = Depends(get_db)
):
    """
    기간별 일별 기상 데이터를 조회합니다.
    """
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="시작 날짜가 종료 날짜보다 늦을 수 없습니다.")

    query = db.query(WeatherDataDaily).filter(
        WeatherDataDaily.date >= start_date,
        WeatherDataDaily.date <= end_date
    )

    if stn_cd:
        query = query.filter(WeatherDataDaily.stn_cd == stn_cd)

    total = query.count()

    results = query.order_by(WeatherDataDaily.date, WeatherDataDaily.stn_cd)\
        .offset(offset).limit(limit).all()

    # SQLAlchemy 모델을 딕셔너리로 변환
    data = [
        {
            "id": r.id,
            "stn_cd": r.stn_cd,
            "stn_name": r.stn_name,
            "date": r.date.isoformat() if r.date else None,
            "temp": r.temp,
            "hghst_artmp": r.hghst_artmp,
            "lowst_artmp": r.lowst_artmp,
            "hum": r.hum,
            "wind": r.wind,
            "rn": r.rn,
            "srqty": r.srqty,
        }
        for r in results
    ]

    return {"total": total, "offset": offset, "limit": limit, "data": data}


# ===== 월별 데이터 =====

@router.get("/monthly/latest", response_model=List[WeatherDataMonthlyResponse], summary="최신 월별 데이터 조회")
def get_latest_monthly_data(
    stn_cd: Optional[str] = Query(default=None, description="관측소 코드"),
    limit: int = Query(default=20, ge=1, le=100, description="조회 개수"),
    db: Session = Depends(get_db)
):
    """
    최신 월별 기상 데이터를 조회합니다.
    """
    query = db.query(WeatherDataMonthly).order_by(desc(WeatherDataMonthly.date))

    if stn_cd:
        query = query.filter(WeatherDataMonthly.stn_cd == stn_cd)

    results = query.limit(limit).all()
    return results


@router.get("/monthly/year/{year}", response_model=List[WeatherDataMonthlyResponse], summary="연도별 월별 데이터 조회")
def get_monthly_by_year(
    year: int,
    stn_cd: Optional[str] = Query(default=None, description="관측소 코드"),
    db: Session = Depends(get_db)
):
    """
    특정 연도의 월별 기상 데이터를 조회합니다.
    """
    query = db.query(WeatherDataMonthly).filter(
        WeatherDataMonthly.date.like(f"{year}-%")
    )

    if stn_cd:
        query = query.filter(WeatherDataMonthly.stn_cd == stn_cd)

    results = query.order_by(WeatherDataMonthly.date, WeatherDataMonthly.stn_cd).all()

    if not results:
        raise HTTPException(status_code=404, detail=f"{year}년의 데이터가 없습니다.")

    return results


@router.get("/monthly/range", response_model=PaginatedResponse, summary="기간별 월별 데이터 조회")
def get_monthly_by_range(
    start_month: str = Query(description="시작 월 (YYYY-MM)"),
    end_month: str = Query(description="종료 월 (YYYY-MM)"),
    stn_cd: Optional[str] = Query(default=None, description="관측소 코드"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    기간별 월별 기상 데이터를 조회합니다.
    """
    if start_month > end_month:
        raise HTTPException(status_code=400, detail="시작 월이 종료 월보다 늦을 수 없습니다.")

    query = db.query(WeatherDataMonthly).filter(
        WeatherDataMonthly.date >= start_month,
        WeatherDataMonthly.date <= end_month
    )

    if stn_cd:
        query = query.filter(WeatherDataMonthly.stn_cd == stn_cd)

    total = query.count()

    results = query.order_by(WeatherDataMonthly.date, WeatherDataMonthly.stn_cd)\
        .offset(offset).limit(limit).all()

    return PaginatedResponse(total=total, offset=offset, limit=limit, data=results)


# ===== 관측소 목록 =====

@router.get("/stations", response_model=List[dict], summary="RDA 관측소 목록 조회")
def get_rda_stations(db: Session = Depends(get_db)):
    """
    RDA 관측소 목록을 조회합니다. (일별 데이터 기준)
    """
    results = db.query(
        WeatherDataDaily.stn_cd,
        WeatherDataDaily.stn_name,
        func.count(WeatherDataDaily.id).label("data_count"),
        func.min(WeatherDataDaily.date).label("first_date"),
        func.max(WeatherDataDaily.date).label("last_date")
    ).group_by(
        WeatherDataDaily.stn_cd,
        WeatherDataDaily.stn_name
    ).order_by(WeatherDataDaily.stn_cd).all()

    return [
        {
            "stn_cd": r.stn_cd,
            "stn_name": r.stn_name,
            "data_count": r.data_count,
            "first_date": r.first_date,
            "last_date": r.last_date
        }
        for r in results
    ]


@router.get("/realtime/stations", response_model=List[dict], summary="RDA 실시간 관측소 목록 조회")
def get_rda_realtime_stations(
    province: Optional[str] = Query(default=None, description="도/광역시로 필터링"),
    db: Session = Depends(get_db)
):
    """
    RDA 실시간 데이터가 있는 관측소 목록을 조회합니다. (10분 데이터 기준)
    """
    query = db.query(
        WeatherData.province,
        WeatherData.stn_cd,
        WeatherData.stn_name,
        func.count(WeatherData.id).label("data_count"),
        func.min(WeatherData.datetime).label("first_datetime"),
        func.max(WeatherData.datetime).label("last_datetime")
    )

    if province:
        query = query.filter(WeatherData.province == province)

    results = query.group_by(
        WeatherData.province,
        WeatherData.stn_cd,
        WeatherData.stn_name
    ).order_by(WeatherData.province, WeatherData.stn_cd).all()

    return [
        {
            "province": r.province,
            "stn_cd": r.stn_cd,
            "stn_name": r.stn_name,
            "data_count": r.data_count,
            "first_datetime": r.first_datetime,
            "last_datetime": r.last_datetime
        }
        for r in results
    ]


@router.get("/realtime/provinces", response_model=List[str], summary="RDA 실시간 도/광역시 목록 조회")
def get_rda_realtime_provinces(db: Session = Depends(get_db)):
    """
    RDA 실시간 데이터가 있는 도/광역시 목록을 조회합니다.
    """
    results = db.query(
        WeatherData.province
    ).filter(
        WeatherData.province.isnot(None)
    ).distinct().order_by(WeatherData.province).all()

    return [r.province for r in results if r.province]


# ===== 지점코드 기반 조회 =====

@router.get("/realtime/code/stations", summary="지점코드 목록 조회 (CSV 기반)")
def get_station_code_list():
    """
    조회 가능한 RDA 관측소 지점코드 목록을 반환합니다.
    - stn_cd: 지점코드 (예: 477802A001)
    - stn_name: 지점명 (예: 가평군 가평읍)
    - province: 도명 (예: 경기도)
    """
    return STATION_LIST


@router.get("/realtime/code/{stn_cd}", summary="지점코드로 최신 날씨 조회")
def get_realtime_by_station_code(
    stn_cd: str,
    db: Session = Depends(get_db)
):
    """
    지점코드로 특정 관측소의 최신 10분 간격 기상 데이터를 반환합니다.
    - stn_cd: 관측소 지점코드 (예: 477802A001)
    """
    station_info = STATION_MAP.get(stn_cd)
    if not station_info:
        raise HTTPException(status_code=404, detail=f"지점코드 '{stn_cd}'에 해당하는 관측소가 없습니다.")

    record = db.query(WeatherData).filter(
        WeatherData.stn_cd == stn_cd
    ).order_by(
        desc(WeatherData.datetime)
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail=f"관측소 '{stn_cd}'의 데이터가 없습니다.")

    return {
        "stn_cd": record.stn_cd,
        "stn_name": record.stn_name,
        "province": record.province,
        "datetime": record.datetime.isoformat() if record.datetime else None,
        "temp": record.temp,
        "hghst_artmp": record.hghst_artmp,
        "lowst_artmp": record.lowst_artmp,
        "hum": record.hum,
        "widdir": record.widdir,
        "wind": record.wind,
        "max_wind": record.max_wind,
        "rn": record.rn,
        "sun_time": record.sun_time,
        "srqty": record.srqty,
        "condens_time": record.condens_time,
        "gr_temp": record.gr_temp,
        "soil_temp": record.soil_temp,
        "soil_wt": record.soil_wt,
    }


# ============================================================
# RDA 과거기상 (일자료) 공개 API
# ============================================================

day_router = APIRouter(
    prefix="/api/rda/day",
    tags=["RDA 과거기상 (일자료)"]
)


@day_router.get("/region", summary="조회 가능한 RDA 관측소 목록")
def get_rda_day_regions(db: Session = Depends(get_db)):
    """
    과거기상 데이터를 조회할 수 있는 RDA 관측소 목록을 반환합니다.
    DB에 저장된 관측 시작일자와 마지막 관측일자를 포함합니다.
    """
    results = db.query(
        WeatherDataDaily.stn_cd,
        WeatherDataDaily.stn_name,
        func.min(WeatherDataDaily.date).label("first_date"),
        func.max(WeatherDataDaily.date).label("last_date")
    ).group_by(
        WeatherDataDaily.stn_cd,
        WeatherDataDaily.stn_name
    ).order_by(WeatherDataDaily.stn_cd).all()

    return [
        {
            "stn_cd": r.stn_cd,
            "stn_name": r.stn_name,
            "first_date": r.first_date.isoformat() if r.first_date else None,
            "last_date": r.last_date.isoformat() if r.last_date else None,
        }
        for r in results
    ]


@day_router.get("/{stn_cd}/{start_date}/{end_date}", summary="지역별 특정기간 과거기상 조회")
def get_rda_day_data(
    stn_cd: str,
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db)
):
    """
    특정 관측소의 기간별 과거기상 일자료를 조회합니다.

    - **stn_cd**: 지점코드 (예: 477802A001)
    - **start_date**: 시작 날짜 (YYYY-MM-DD)
    - **end_date**: 종료 날짜 (YYYY-MM-DD)
    - 가장 최근 종료일자는 **현재일자보다 2일 전**까지 가능합니다.
    - 데이터 업데이트 주기: 매일 1회 (전일 데이터 기준, 2일 지연)
    """
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="시작 날짜가 종료 날짜보다 늦을 수 없습니다.")

    max_date = date.today() - timedelta(days=2)
    if end_date > max_date:
        raise HTTPException(
            status_code=400,
            detail=f"종료 날짜는 {max_date.isoformat()} 이전이어야 합니다. (현재일자 - 2일)"
        )

    results = db.query(WeatherDataDaily).filter(
        WeatherDataDaily.stn_cd == stn_cd,
        WeatherDataDaily.date >= start_date,
        WeatherDataDaily.date <= end_date
    ).order_by(WeatherDataDaily.date).all()

    if not results:
        raise HTTPException(status_code=404, detail=f"관측소 '{stn_cd}'의 해당 기간 데이터가 없습니다.")

    data = [
        {
            "stn_cd": r.stn_cd,
            "stn_name": r.stn_name,
            "date": r.date.isoformat() if r.date else None,
            "temp": r.temp,
            "hghst_artmp": r.hghst_artmp,
            "lowst_artmp": r.lowst_artmp,
            "hum": r.hum,
            "wind": r.wind,
            "rn": r.rn,
            "srqty": r.srqty,
        }
        for r in results
    ]

    return {"total": len(data), "data": data}
