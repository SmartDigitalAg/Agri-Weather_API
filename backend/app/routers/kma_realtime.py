# backend/app/routers/kma_realtime.py
"""
KMA 초단기 실황 API 라우터
- 기상청 초단기 실황 데이터 조회 엔드포인트
"""

from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from ..database import get_db
from ..models.kma import WeatherRealtime
from ..schemas.kma import WeatherRealtimeResponse, WeatherRealtimePivotResponse
from ..schemas.common import PaginatedResponse

router = APIRouter(
    prefix="/api/kma/realtime",
    tags=["KMA 초단기 실황"]
)


@router.get("/latest", response_model=List[WeatherRealtimeResponse], summary="최신 초단기 실황 조회")
def get_latest_realtime(
    region_name: Optional[str] = Query(default=None, description="지역명 (미입력시 전체)"),
    limit: int = Query(default=50, ge=1, le=100, description="조회 개수"),
    db: Session = Depends(get_db)
):
    """
    최신 초단기 실황 데이터를 조회합니다.
    - region_name: 특정 지역만 조회 (선택)
    - limit: 조회할 데이터 개수
    """
    query = db.query(WeatherRealtime).order_by(
        desc(WeatherRealtime.base_date),
        desc(WeatherRealtime.base_time)
    )

    if region_name:
        query = query.filter(WeatherRealtime.region_name == region_name)

    results = query.limit(limit).all()
    return results


@router.get("/latest/pivot", response_model=List[WeatherRealtimePivotResponse], summary="최신 초단기 실황 (피벗)")
def get_latest_realtime_pivot(
    sido: Optional[str] = Query(default=None, description="시도 (미입력시 전체)"),
    region_name: Optional[str] = Query(default=None, description="지역명 (미입력시 전체)"),
    limit: int = Query(default=20, ge=1, le=500, description="조회 개수"),
    db: Session = Depends(get_db)
):
    """
    최신 초단기 실황 데이터를 카테고리별 컬럼으로 피벗하여 조회합니다.
    - T1H: 기온, RN1: 강수량, REH: 습도, WSD: 풍속 등
    """
    # 최신 발표 시각 조회
    subquery = db.query(
        WeatherRealtime.sido,
        WeatherRealtime.region_name,
        WeatherRealtime.base_date,
        WeatherRealtime.base_time
    ).distinct().order_by(
        desc(WeatherRealtime.base_date),
        desc(WeatherRealtime.base_time)
    )

    if sido:
        subquery = subquery.filter(WeatherRealtime.sido == sido)
    if region_name:
        subquery = subquery.filter(WeatherRealtime.region_name == region_name)

    latest_times = subquery.limit(limit).all()

    results = []
    for lt in latest_times:
        # 해당 시각의 모든 카테고리 조회
        records = db.query(WeatherRealtime).filter(
            WeatherRealtime.region_name == lt.region_name,
            WeatherRealtime.base_date == lt.base_date,
            WeatherRealtime.base_time == lt.base_time
        ).all()

        # 피벗 변환
        pivot_data = {
            "sido": lt.sido,
            "region_name": lt.region_name,
            "base_date": lt.base_date,
            "base_time": lt.base_time,
            "T1H": None, "RN1": None, "UUU": None, "VVV": None,
            "REH": None, "PTY": None, "VEC": None, "WSD": None
        }

        for r in records:
            if r.category in pivot_data:
                pivot_data[r.category] = r.obsrvalue

        results.append(WeatherRealtimePivotResponse(**pivot_data))

    return results


@router.get("/region/{region_name}", response_model=PaginatedResponse, summary="지역별 초단기 실황 조회")
def get_realtime_by_region(
    region_name: str,
    target_date: Optional[date] = Query(default=None, description="조회 날짜 (미입력시 전체)"),
    offset: int = Query(default=0, ge=0, description="건너뛸 레코드 수"),
    limit: int = Query(default=20, ge=1, le=100, description="조회할 레코드 수"),
    db: Session = Depends(get_db)
):
    """
    특정 지역의 초단기 실황 데이터를 조회합니다.
    - region_name: 지역명
    - target_date: 특정 날짜만 조회 (선택)
    """
    query = db.query(WeatherRealtime).filter(
        WeatherRealtime.region_name == region_name
    )

    if target_date:
        query = query.filter(WeatherRealtime.base_date == target_date)

    total = query.count()

    if total == 0:
        raise HTTPException(status_code=404, detail=f"'{region_name}' 지역의 데이터가 없습니다.")

    results = query.order_by(
        desc(WeatherRealtime.base_date),
        desc(WeatherRealtime.base_time)
    ).offset(offset).limit(limit).all()

    return PaginatedResponse(
        total=total,
        offset=offset,
        limit=limit,
        data=results
    )


@router.get("/regions", response_model=List[dict], summary="초단기 실황 지역 목록 조회")
def get_realtime_regions(
    sido: Optional[str] = Query(default=None, description="시도로 필터링"),
    db: Session = Depends(get_db)
):
    """
    초단기 실황 데이터가 있는 지역 목록을 조회합니다.
    """
    query = db.query(
        WeatherRealtime.sido,
        WeatherRealtime.region_name,
        WeatherRealtime.nx,
        WeatherRealtime.ny,
        func.count(WeatherRealtime.id).label("data_count"),
        func.min(WeatherRealtime.base_date).label("first_date"),
        func.max(WeatherRealtime.base_date).label("last_date")
    )

    if sido:
        query = query.filter(WeatherRealtime.sido == sido)

    results = query.group_by(
        WeatherRealtime.sido,
        WeatherRealtime.region_name,
        WeatherRealtime.nx,
        WeatherRealtime.ny
    ).order_by(WeatherRealtime.sido, WeatherRealtime.region_name).all()

    return [
        {
            "sido": r.sido,
            "region_name": r.region_name,
            "nx": r.nx,
            "ny": r.ny,
            "data_count": r.data_count,
            "first_date": r.first_date,
            "last_date": r.last_date
        }
        for r in results
    ]


@router.get("/sidos", response_model=List[str], summary="초단기 실황 시도 목록 조회")
def get_realtime_sidos(db: Session = Depends(get_db)):
    """
    초단기 실황 데이터가 있는 시도 목록을 조회합니다.
    """
    results = db.query(
        WeatherRealtime.sido
    ).filter(
        WeatherRealtime.sido.isnot(None)
    ).distinct().order_by(WeatherRealtime.sido).all()

    return [r.sido for r in results if r.sido]
