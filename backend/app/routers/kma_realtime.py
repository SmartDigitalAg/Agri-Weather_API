# backend/app/routers/kma_realtime.py
"""
KMA 초단기 실황 API 라우터
- 기상청 초단기 실황 데이터 조회 엔드포인트
"""

import csv
import os
from typing import Optional, List
from datetime import date, datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, String

from ..database import get_db
from ..models.kma import WeatherRealtime
from ..schemas.kma import WeatherRealtimeResponse, WeatherRealtimePivotResponse
from ..schemas.common import PaginatedResponse

router = APIRouter(
    prefix="/api/kma/realtime",
    tags=["KMA 초단기 실황"]
)

# --- 행정구역코드 매핑 로드 ---
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_CSV_PATH = os.path.join(_BASE_DIR, "..", "..", "..", "Agri-Weather_DB", "KMA", "region_preprocessed.csv")

REGION_MAP: dict = {}   # {행정구역코드: {"region_name", "sido", "nx", "ny"}}
REGION_LIST: list = []   # 전체 지역 목록


def _load_region_map():
    resolved = os.path.normpath(_CSV_PATH)
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
            REGION_MAP[code] = entry
            REGION_LIST.append(entry)


_load_region_map()


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


@router.get("/today/{region_name}", summary="지역별 오늘 데이터 조회 (그래프용)")
def get_today_weather(
    region_name: str,
    db: Session = Depends(get_db)
):
    """
    특정 지역의 오늘 날짜 초단기 실황 데이터를 조회합니다.
    - 매일 자정에 리셋되어 새로 시작
    - 시간순 오름차순 정렬 (그래프용)
    - T1H(기온), REH(습도) 값 반환
    """
    # 오늘 날짜 (한국시간 KST 기준)
    KST = timezone(timedelta(hours=9))
    today_date = datetime.now(KST).date()

    # 해당 지역의 오늘 데이터에서 고유 시간대 조회 (시간 오름차순)
    subquery = db.query(
        WeatherRealtime.base_date,
        WeatherRealtime.base_time
    ).filter(
        WeatherRealtime.region_name == region_name,
        WeatherRealtime.base_date == today_date
    ).distinct().order_by(
        WeatherRealtime.base_time.asc()
    )

    time_slots = subquery.all()

    if not time_slots:
        return {"data": []}

    results = []
    for ts in time_slots:
        # 해당 시각의 모든 카테고리 조회
        records = db.query(WeatherRealtime).filter(
            WeatherRealtime.region_name == region_name,
            WeatherRealtime.base_date == ts.base_date,
            WeatherRealtime.base_time == ts.base_time
        ).all()

        # 피벗 변환
        pivot_data = {
            "region_name": region_name,
            "base_date": ts.base_date.isoformat() if ts.base_date else None,
            "base_time": ts.base_time,
            "T1H": None,
            "REH": None
        }

        for r in records:
            if r.category == "T1H":
                pivot_data["T1H"] = r.obsrvalue
            elif r.category == "REH":
                pivot_data["REH"] = r.obsrvalue

        results.append(pivot_data)

    return {"data": results}


@router.get("/region/{region_name}/range", summary="지역별 기간 조회 (피벗)")
def get_realtime_by_region_range(
    region_name: str,
    start_date: date = Query(description="시작 날짜"),
    end_date: date = Query(description="종료 날짜"),
    offset: int = Query(default=0, ge=0, description="건너뛸 레코드 수"),
    limit: int = Query(default=20, ge=1, le=10000, description="조회할 레코드 수"),
    db: Session = Depends(get_db)
):
    """
    특정 지역의 기간별 초단기 실황 데이터를 피벗 형태로 조회합니다.
    """
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="시작 날짜가 종료 날짜보다 늦을 수 없습니다.")

    # 해당 기간의 고유 시간대 조회
    subquery = db.query(
        WeatherRealtime.base_date,
        WeatherRealtime.base_time
    ).filter(
        WeatherRealtime.region_name == region_name,
        WeatherRealtime.base_date >= start_date,
        WeatherRealtime.base_date <= end_date
    ).distinct().order_by(
        desc(WeatherRealtime.base_date),
        desc(WeatherRealtime.base_time)
    )

    total = subquery.count()
    time_slots = subquery.offset(offset).limit(limit).all()

    results = []
    for ts in time_slots:
        # 해당 시각의 모든 카테고리 조회
        records = db.query(WeatherRealtime).filter(
            WeatherRealtime.region_name == region_name,
            WeatherRealtime.base_date == ts.base_date,
            WeatherRealtime.base_time == ts.base_time
        ).all()

        # 피벗 변환
        pivot_data = {
            "region_name": region_name,
            "base_date": ts.base_date.isoformat() if ts.base_date else None,
            "base_time": ts.base_time,
            "T1H": None, "RN1": None, "REH": None, "VEC": None, "WSD": None
        }

        for r in records:
            if r.category in pivot_data:
                pivot_data[r.category] = r.obsrvalue

        results.append(pivot_data)

    return {"total": total, "offset": offset, "limit": limit, "data": results}


@router.get("/region/{region_name}", summary="지역별 초단기 실황 조회")
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

    # 딕셔너리로 변환
    data = [
        {
            "id": r.id,
            "region_name": r.region_name,
            "base_date": r.base_date.isoformat() if r.base_date else None,
            "base_time": r.base_time,
            "category": r.category,
            "obsrvalue": r.obsrvalue
        }
        for r in results
    ]

    return {"total": total, "offset": offset, "limit": limit, "data": data}


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


# ===== 행정구역코드 기반 조회 =====

@router.get("/code/regions", summary="행정구역코드 지역 목록 조회")
def get_region_code_list():
    """
    조회 가능한 행정구역코드 목록을 반환합니다.
    - region_code: 행정구역코드 (예: 4182000000)
    - region_name: 지역명 (예: 가평군)
    - sido: 시도 (예: 경기도)
    - nx, ny: 기상청 격자 좌표
    """
    return REGION_LIST


@router.get("/code/{region_code}", summary="행정구역코드로 최신 날씨 조회")
def get_realtime_by_region_code(
    region_code: str,
    db: Session = Depends(get_db)
):
    """
    행정구역코드로 특정 지역의 최신 초단기 실황 데이터를 피벗 형태로 반환합니다.
    - region_code: 행정구역코드 (예: 4182000000)
    - 응답: T1H(기온), RN1(강수량), REH(습도), WSD(풍속) 등
    """
    region_info = REGION_MAP.get(region_code)
    if not region_info:
        raise HTTPException(status_code=404, detail=f"행정구역코드 '{region_code}'에 해당하는 지역이 없습니다.")

    region_name = region_info["region_name"]

    latest = db.query(
        WeatherRealtime.base_date,
        WeatherRealtime.base_time
    ).filter(
        WeatherRealtime.region_name == region_name
    ).order_by(
        desc(WeatherRealtime.base_date),
        desc(WeatherRealtime.base_time)
    ).first()

    if not latest:
        raise HTTPException(status_code=404, detail=f"'{region_name}' 지역의 데이터가 없습니다.")

    records = db.query(WeatherRealtime).filter(
        WeatherRealtime.region_name == region_name,
        WeatherRealtime.base_date == latest.base_date,
        WeatherRealtime.base_time == latest.base_time
    ).all()

    pivot_data = {
        "region_code": region_code,
        "region_name": region_name,
        "sido": region_info["sido"],
        "nx": region_info["nx"],
        "ny": region_info["ny"],
        "base_date": latest.base_date.isoformat() if latest.base_date else None,
        "base_time": latest.base_time,
        "T1H": None, "RN1": None, "UUU": None, "VVV": None,
        "REH": None, "PTY": None, "VEC": None, "WSD": None,
    }

    for r in records:
        if r.category in pivot_data:
            pivot_data[r.category] = r.obsrvalue

    return pivot_data
