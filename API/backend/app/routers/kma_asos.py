# backend/app/routers/kma_asos.py
"""
KMA ASOS 일자료 API 라우터
- 기상청 ASOS 관측소 일자료 조회 엔드포인트
"""

from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from ..database import get_db
from ..models.kma import AsosDailyData
from ..schemas.kma import AsosDailyResponse
from ..schemas.common import PaginatedResponse

router = APIRouter(
    prefix="/api/kma/asos",
    tags=["KMA ASOS 일자료"]
)


@router.get("/latest", summary="최신 ASOS 일자료 조회")
def get_latest_asos_data(
    stn_id: Optional[int] = Query(default=None, description="지점 ID (미입력시 전체)"),
    limit: int = Query(default=20, ge=1, le=100, description="조회 개수"),
    db: Session = Depends(get_db)
):
    """
    최신 ASOS 일자료를 조회합니다.
    - stn_id: 특정 지점만 조회 (선택)
    - limit: 조회할 데이터 개수 (기본 20, 최대 100)
    """
    query = db.query(AsosDailyData).order_by(desc(AsosDailyData.tm))

    if stn_id:
        query = query.filter(AsosDailyData.stn_id == stn_id)

    results = query.limit(limit).all()

    return [
        {
            "id": r.id,
            "stn_id": r.stn_id,
            "stn_nm": r.stn_nm,
            "tm": r.tm.isoformat() if r.tm else None,
            "avg_ta": r.avg_ta,
            "min_ta": r.min_ta,
            "max_ta": r.max_ta,
            "sum_rn": r.sum_rn,
            "avg_ws": r.avg_ws,
            "avg_rhm": r.avg_rhm,
            "sum_ss_hr": r.sum_ss_hr,
            "sum_gsr": r.sum_gsr,
        }
        for r in results
    ]


@router.get("/date/{target_date}", summary="특정 날짜 ASOS 데이터 조회")
def get_asos_by_date(
    target_date: date,
    stn_id: Optional[int] = Query(default=None, description="지점 ID (미입력시 전체)"),
    db: Session = Depends(get_db)
):
    """
    특정 날짜의 ASOS 일자료를 조회합니다.
    - target_date: 조회할 날짜 (YYYY-MM-DD)
    - stn_id: 특정 지점만 조회 (선택)
    """
    query = db.query(AsosDailyData).filter(AsosDailyData.tm == target_date)

    if stn_id:
        query = query.filter(AsosDailyData.stn_id == stn_id)

    results = query.order_by(AsosDailyData.stn_id).all()

    if not results:
        raise HTTPException(status_code=404, detail=f"{target_date} 날짜의 데이터가 없습니다.")

    return [
        {
            "id": r.id,
            "stn_id": r.stn_id,
            "stn_nm": r.stn_nm,
            "tm": r.tm.isoformat() if r.tm else None,
            "avg_ta": r.avg_ta,
            "min_ta": r.min_ta,
            "max_ta": r.max_ta,
            "sum_rn": r.sum_rn,
            "avg_ws": r.avg_ws,
            "avg_rhm": r.avg_rhm,
            "sum_ss_hr": r.sum_ss_hr,
            "sum_gsr": r.sum_gsr,
        }
        for r in results
    ]


@router.get("/range", summary="기간별 ASOS 데이터 조회")
def get_asos_by_range(
    start_date: date = Query(description="시작 날짜 (YYYY-MM-DD)"),
    end_date: date = Query(description="종료 날짜 (YYYY-MM-DD)"),
    stn_id: Optional[int] = Query(default=None, description="지점 ID (미입력시 전체)"),
    offset: int = Query(default=0, ge=0, description="건너뛸 레코드 수"),
    limit: int = Query(default=20, ge=1, le=10000, description="조회할 레코드 수 (다운로드 시 최대 10000)"),
    db: Session = Depends(get_db)
):
    """
    기간별 ASOS 일자료를 조회합니다.
    - start_date: 시작 날짜
    - end_date: 종료 날짜
    - stn_id: 특정 지점만 조회 (선택)
    - 페이지네이션 지원 (offset, limit)
    """
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="시작 날짜가 종료 날짜보다 늦을 수 없습니다.")

    query = db.query(AsosDailyData).filter(
        AsosDailyData.tm >= start_date,
        AsosDailyData.tm <= end_date
    )

    if stn_id:
        query = query.filter(AsosDailyData.stn_id == stn_id)

    # 전체 개수 조회
    total = query.count()

    # 페이지네이션 적용
    results = query.order_by(AsosDailyData.tm, AsosDailyData.stn_id)\
        .offset(offset).limit(limit).all()

    # SQLAlchemy 모델을 딕셔너리로 변환
    data = [
        {
            "id": r.id,
            "stn_id": r.stn_id,
            "stn_nm": r.stn_nm,
            "tm": r.tm.isoformat() if r.tm else None,
            "avg_ta": r.avg_ta,
            "min_ta": r.min_ta,
            "max_ta": r.max_ta,
            "sum_rn": r.sum_rn,
            "avg_ws": r.avg_ws,
            "avg_rhm": r.avg_rhm,
            "sum_ss_hr": r.sum_ss_hr,
            "sum_gsr": r.sum_gsr,
        }
        for r in results
    ]

    return {"total": total, "offset": offset, "limit": limit, "data": data}


@router.get("/stations", summary="ASOS 관측소 목록 조회")
def get_asos_stations(db: Session = Depends(get_db)):
    """
    ASOS 관측소 목록을 조회합니다.
    - 관측소 ID와 이름, 데이터 개수를 반환합니다.
    """
    results = db.query(
        AsosDailyData.stn_id,
        AsosDailyData.stn_nm,
        func.count(AsosDailyData.id).label("data_count"),
        func.min(AsosDailyData.tm).label("first_date"),
        func.max(AsosDailyData.tm).label("last_date")
    ).group_by(
        AsosDailyData.stn_id,
        AsosDailyData.stn_nm
    ).order_by(AsosDailyData.stn_id).all()

    return [
        {
            "stn_id": r.stn_id,
            "stn_nm": r.stn_nm,
            "data_count": r.data_count,
            "first_date": r.first_date.isoformat() if r.first_date else None,
            "last_date": r.last_date.isoformat() if r.last_date else None
        }
        for r in results
    ]
