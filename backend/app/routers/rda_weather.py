# backend/app/routers/rda_weather.py
"""
RDA 농업기상 API 라우터
- 농촌진흥청 기상 데이터 조회 엔드포인트
"""

from typing import Optional, List
from datetime import date, datetime
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


@router.get("/daily/range", response_model=PaginatedResponse, summary="기간별 일별 데이터 조회")
def get_daily_by_range(
    start_date: date = Query(description="시작 날짜"),
    end_date: date = Query(description="종료 날짜"),
    stn_cd: Optional[str] = Query(default=None, description="관측소 코드"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
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

    return PaginatedResponse(total=total, offset=offset, limit=limit, data=results)


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
