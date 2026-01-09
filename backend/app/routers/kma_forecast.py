# backend/app/routers/kma_forecast.py
"""
KMA 예보 API 라우터
- 기상청 단기예보/중기예보 데이터 조회 엔드포인트
"""

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
    limit: int = Query(default=50, ge=1, le=100, description="조회 개수"),
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
