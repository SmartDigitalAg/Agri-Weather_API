# backend/app/routers/kma_forecast.py
"""
KMA 예보 API 라우터
- 기상청 단기예보/중기예보 데이터 조회 엔드포인트
"""

import csv
import os
from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from ..database import get_db
from ..models.kma import WeatherShortForecast, WeatherMidForecast
from ..schemas.kma import WeatherShortForecastResponse, WeatherMidForecastResponse
from ..schemas.common import PaginatedResponse

router = APIRouter(
    prefix="/api/kma/forecast",
    tags=["KMA 예보"]
)


# ===== 단기예보 =====

@router.get("/short/latest", response_model=List[WeatherShortForecastResponse], summary="최신 단기예보 조회")
def get_latest_short_forecast(
    region_name: Optional[str] = Query(default=None, description="지역명"),
    category: Optional[str] = Query(default=None, description="자료구분 (TMP, POP, SKY 등)"),
    limit: int = Query(default=1000, ge=1, le=1000, description="조회 개수"),
    db: Session = Depends(get_db)
):
    """
    최신 단기예보 데이터를 조회합니다.
    - region_name: 특정 지역만 조회 (선택)
    - category: 특정 자료구분만 조회 (TMP:기온, POP:강수확률, SKY:하늘상태 등)
    """
    query = db.query(WeatherShortForecast).order_by(
        desc(WeatherShortForecast.base_date),
        desc(WeatherShortForecast.base_time),
        WeatherShortForecast.fcst_date,
        WeatherShortForecast.fcst_time
    )

    if region_name:
        query = query.filter(WeatherShortForecast.region_name == region_name)
    if category:
        query = query.filter(WeatherShortForecast.category == category)

    results = query.limit(limit).all()
    return results


@router.get("/short/region/{region_name}", response_model=PaginatedResponse, summary="지역별 단기예보 조회")
def get_short_forecast_by_region(
    region_name: str,
    fcst_date: Optional[date] = Query(default=None, description="예보일자"),
    category: Optional[str] = Query(default=None, description="자료구분"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    특정 지역의 단기예보 데이터를 조회합니다.
    """
    query = db.query(WeatherShortForecast).filter(
        WeatherShortForecast.region_name == region_name
    )

    if fcst_date:
        query = query.filter(WeatherShortForecast.fcst_date == fcst_date)
    if category:
        query = query.filter(WeatherShortForecast.category == category)

    total = query.count()

    if total == 0:
        raise HTTPException(status_code=404, detail=f"'{region_name}' 지역의 예보 데이터가 없습니다.")

    results = query.order_by(
        desc(WeatherShortForecast.base_date),
        desc(WeatherShortForecast.base_time),
        WeatherShortForecast.fcst_date,
        WeatherShortForecast.fcst_time
    ).offset(offset).limit(limit).all()

    return PaginatedResponse(total=total, offset=offset, limit=limit, data=results)


# ===== 단기예보 지역 목록 =====

@router.get("/short/regions", response_model=List[dict], summary="단기예보 지역 목록 조회")
def get_short_forecast_regions(db: Session = Depends(get_db)):
    """
    단기예보 데이터가 있는 지역 목록을 조회합니다.
    """
    results = db.query(
        WeatherShortForecast.region_name,
        func.count(WeatherShortForecast.id).label("data_count")
    ).group_by(
        WeatherShortForecast.region_name
    ).order_by(WeatherShortForecast.region_name).all()

    return [
        {
            "region_name": r.region_name,
            "data_count": r.data_count
        }
        for r in results
    ]


# ===== 중기예보 =====

@router.get("/mid/latest", response_model=List[WeatherMidForecastResponse], summary="최신 중기예보 조회")
def get_latest_mid_forecast(
    region_name: Optional[str] = Query(default=None, description="지역명"),
    limit: int = Query(default=50, ge=1, le=100, description="조회 개수"),
    db: Session = Depends(get_db)
):
    """
    최신 중기예보 데이터를 조회합니다.
    - 3~10일 후의 예보 데이터
    """
    query = db.query(WeatherMidForecast).order_by(
        desc(WeatherMidForecast.tm_fc),
        WeatherMidForecast.forecast_date
    )

    if region_name:
        query = query.filter(WeatherMidForecast.region_name == region_name)

    results = query.limit(limit).all()
    return results


@router.get("/mid/region/{region_name}", response_model=PaginatedResponse, summary="지역별 중기예보 조회")
def get_mid_forecast_by_region(
    region_name: str,
    forecast_date: Optional[date] = Query(default=None, description="예보일자"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    특정 지역의 중기예보 데이터를 조회합니다.
    """
    query = db.query(WeatherMidForecast).filter(
        WeatherMidForecast.region_name == region_name
    )

    if forecast_date:
        query = query.filter(WeatherMidForecast.forecast_date == forecast_date)

    total = query.count()

    if total == 0:
        raise HTTPException(status_code=404, detail=f"'{region_name}' 지역의 중기예보 데이터가 없습니다.")

    results = query.order_by(
        desc(WeatherMidForecast.tm_fc),
        WeatherMidForecast.forecast_date
    ).offset(offset).limit(limit).all()

    return PaginatedResponse(total=total, offset=offset, limit=limit, data=results)


@router.get("/mid/regions", response_model=List[dict], summary="중기예보 지역 목록 조회")
def get_mid_forecast_regions(db: Session = Depends(get_db)):
    """
    중기예보 데이터가 있는 지역 목록을 조회합니다.
    """
    results = db.query(
        WeatherMidForecast.reg_id,
        WeatherMidForecast.region_name,
        func.count(WeatherMidForecast.id).label("data_count")
    ).group_by(
        WeatherMidForecast.reg_id,
        WeatherMidForecast.region_name
    ).order_by(WeatherMidForecast.region_name).all()

    return [
        {
            "reg_id": r.reg_id,
            "region_name": r.region_name,
            "data_count": r.data_count
        }
        for r in results
    ]


# ============================================================
# 지역코드 기반 예보 조회 (공개 API)
# ============================================================

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- 단기예보용: 행정구역코드 → region_name 매핑 (region_preprocessed.csv) ---
_SHORT_CSV = os.path.join(_BASE_DIR, "..", "..", "..", "Agri-Weather_DB", "KMA", "region_preprocessed.csv")
SHORT_REGION_MAP: dict = {}
SHORT_REGION_LIST: list = []


def _load_short_regions():
    resolved = os.path.normpath(_SHORT_CSV)
    if not os.path.exists(resolved):
        print(f"[WARN] region_preprocessed.csv not found: {resolved}")
        return
    with open(resolved, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row.get("행정구역코드", "").strip()
            if not code:
                continue
            entry = {
                "region_code": code,
                "region_name": row.get("2단계", "").strip(),
                "sido": row.get("1단계", "").strip(),
                "nx": int(row.get("격자 X", 0)),
                "ny": int(row.get("격자 Y", 0)),
            }
            SHORT_REGION_MAP[code] = entry
            SHORT_REGION_LIST.append(entry)


_load_short_regions()

# --- 중기예보용: 예보구역코드 → 구역명 매핑 (region_info_mid.csv) ---
_MID_CSV = os.path.join(_BASE_DIR, "..", "..", "..", "Agri-Weather_DB", "KMA", "region_info_mid.csv")
MID_REGION_MAP: dict = {}
MID_REGION_LIST: list = []


def _load_mid_regions():
    resolved = os.path.normpath(_MID_CSV)
    if not os.path.exists(resolved):
        print(f"[WARN] region_info_mid.csv not found: {resolved}")
        return
    with open(resolved, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row.get("예보구역코드", "").strip()
            if not code:
                continue
            entry = {
                "reg_id": code,
                "region_name": row.get("구역명", "").strip(),
            }
            MID_REGION_MAP[code] = entry
            MID_REGION_LIST.append(entry)


_load_mid_regions()


@router.get("/region", summary="예보 조회 가능한 지역 코드 목록")
def get_forecast_region_list():
    """
    예보 데이터를 조회할 수 있는 지역 코드 목록을 반환합니다.

    - **short**: 단기예보 지역 목록 (행정구역코드 기반)
    - **mid**: 중기예보 지역 목록 (예보구역코드 기반)
    """
    return {
        "short": SHORT_REGION_LIST,
        "mid": MID_REGION_LIST,
    }


@router.get("/short/{region_code}", summary="지역코드로 단기예보 조회")
def get_short_forecast_by_code(
    region_code: str,
    db: Session = Depends(get_db)
):
    """
    행정구역코드로 특정 지역의 최신 단기예보를 피벗 형태로 조회합니다.

    - **region_code**: 행정구역코드 (예: 4182000000)
    - 데이터 업데이트 주기: 1일 8회 (02, 05, 08, 11, 14, 17, 20, 23시)
    - 응답: 예보일자/시각별 TMP(기온), POP(강수확률), SKY(하늘상태), PTY(강수형태) 등
    """
    region_info = SHORT_REGION_MAP.get(region_code)
    if not region_info:
        raise HTTPException(status_code=404, detail=f"행정구역코드 '{region_code}'에 해당하는 지역이 없습니다.")

    region_name = region_info["region_name"]

    # 최신 발표 시각 조회
    latest = db.query(
        WeatherShortForecast.base_date,
        WeatherShortForecast.base_time
    ).filter(
        WeatherShortForecast.region_name == region_name
    ).order_by(
        desc(WeatherShortForecast.base_date),
        desc(WeatherShortForecast.base_time)
    ).first()

    if not latest:
        raise HTTPException(status_code=404, detail=f"'{region_name}' 지역의 단기예보 데이터가 없습니다.")

    # 해당 발표 시각의 모든 예보 데이터 조회
    records = db.query(WeatherShortForecast).filter(
        WeatherShortForecast.region_name == region_name,
        WeatherShortForecast.base_date == latest.base_date,
        WeatherShortForecast.base_time == latest.base_time
    ).order_by(
        WeatherShortForecast.fcst_date,
        WeatherShortForecast.fcst_time
    ).all()

    # 예보시각별로 피벗
    pivot_map = {}
    for r in records:
        key = f"{r.fcst_date}_{r.fcst_time}"
        if key not in pivot_map:
            pivot_map[key] = {
                "fcst_date": r.fcst_date.isoformat() if r.fcst_date else None,
                "fcst_time": r.fcst_time,
            }
        pivot_map[key][r.category] = r.fcst_value

    return {
        "region_code": region_code,
        "region_name": region_name,
        "sido": region_info["sido"],
        "base_date": latest.base_date.isoformat() if latest.base_date else None,
        "base_time": latest.base_time,
        "forecasts": list(pivot_map.values()),
    }


@router.get("/mid/{region_code}", summary="지역코드로 중기예보 조회")
def get_mid_forecast_by_code(
    region_code: str,
    db: Session = Depends(get_db)
):
    """
    예보구역코드로 특정 지역의 최신 중기예보를 조회합니다.

    - **region_code**: 예보구역코드 (예: 11B00000)
    - 데이터 업데이트 주기: 1일 2회 (06시, 18시)
    - 응답: 3~10일 후 강수확률, 날씨상태, 최저/최고기온 등
    """
    region_info = MID_REGION_MAP.get(region_code)
    if not region_info:
        raise HTTPException(status_code=404, detail=f"예보구역코드 '{region_code}'에 해당하는 지역이 없습니다.")

    # 최신 발표 시각 조회
    latest = db.query(
        WeatherMidForecast.tm_fc
    ).filter(
        WeatherMidForecast.reg_id == region_code
    ).order_by(
        desc(WeatherMidForecast.tm_fc)
    ).first()

    if not latest:
        raise HTTPException(status_code=404, detail=f"'{region_info['region_name']}' 지역의 중기예보 데이터가 없습니다.")

    records = db.query(WeatherMidForecast).filter(
        WeatherMidForecast.reg_id == region_code,
        WeatherMidForecast.tm_fc == latest.tm_fc
    ).order_by(
        WeatherMidForecast.forecast_date,
        WeatherMidForecast.time_period
    ).all()

    data = [
        {
            "forecast_date": r.forecast_date.isoformat() if r.forecast_date else None,
            "time_period": r.time_period,
            "rain_prob": r.rain_prob,
            "weather_condition": r.weather_condition,
            "temp_min": r.temp_min,
            "temp_max": r.temp_max,
        }
        for r in records
    ]

    return {
        "reg_id": region_code,
        "region_name": region_info["region_name"],
        "tm_fc": latest.tm_fc,
        "forecasts": data,
    }
