# backend/app/routers/stats.py
"""
통계 API 라우터
- 기상 데이터 통계 조회 엔드포인트
"""

from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models.kma import AsosDailyData
from ..models.rda import WeatherDataDaily

router = APIRouter(
    prefix="/api/stats",
    tags=["통계"]
)


@router.get("/summary", summary="전체 데이터 통계 요약")
def get_stats_summary(db: Session = Depends(get_db)):
    """
    전체 데이터베이스의 통계 요약을 조회합니다.
    - 각 테이블별 데이터 개수
    - 데이터 기간 정보
    """
    # ASOS 일자료 통계
    asos_stats = db.query(
        func.count(AsosDailyData.id).label("count"),
        func.min(AsosDailyData.tm).label("first_date"),
        func.max(AsosDailyData.tm).label("last_date"),
        func.count(func.distinct(AsosDailyData.stn_id)).label("station_count")
    ).first()

    # RDA 일별 통계
    rda_daily_stats = db.query(
        func.count(WeatherDataDaily.id).label("count"),
        func.min(WeatherDataDaily.date).label("first_date"),
        func.max(WeatherDataDaily.date).label("last_date"),
        func.count(func.distinct(WeatherDataDaily.stn_cd)).label("station_count")
    ).first()

    return {
        "asos_daily": {
            "total_records": asos_stats.count or 0,
            "first_date": asos_stats.first_date,
            "last_date": asos_stats.last_date,
            "station_count": asos_stats.station_count or 0
        },
        "rda_daily": {
            "total_records": rda_daily_stats.count or 0,
            "first_date": rda_daily_stats.first_date,
            "last_date": rda_daily_stats.last_date,
            "station_count": rda_daily_stats.station_count or 0
        }
    }


@router.get("/kma/asos/station/{stn_id}", summary="ASOS 관측소별 통계")
def get_asos_station_stats(
    stn_id: int,
    start_date: Optional[date] = Query(default=None, description="시작 날짜"),
    end_date: Optional[date] = Query(default=None, description="종료 날짜"),
    db: Session = Depends(get_db)
):
    """
    특정 ASOS 관측소의 통계를 조회합니다.
    - 평균/최고/최저 기온
    - 총 강수량
    - 평균 습도
    """
    query = db.query(
        func.count(AsosDailyData.id).label("count"),
        func.avg(AsosDailyData.avg_ta).label("avg_temp"),
        func.max(AsosDailyData.max_ta).label("max_temp"),
        func.min(AsosDailyData.min_ta).label("min_temp"),
        func.sum(AsosDailyData.sum_rn).label("total_rainfall"),
        func.avg(AsosDailyData.avg_rhm).label("avg_humidity"),
        func.avg(AsosDailyData.avg_ws).label("avg_wind_speed"),
        func.sum(AsosDailyData.sum_ss_hr).label("total_sunshine")
    ).filter(AsosDailyData.stn_id == stn_id)

    if start_date:
        query = query.filter(AsosDailyData.tm >= start_date)
    if end_date:
        query = query.filter(AsosDailyData.tm <= end_date)

    result = query.first()

    if result.count == 0:
        raise HTTPException(status_code=404, detail=f"지점 {stn_id}의 데이터가 없습니다.")

    # 지점 정보 조회
    station_info = db.query(
        AsosDailyData.stn_nm,
        func.min(AsosDailyData.tm).label("first_date"),
        func.max(AsosDailyData.tm).label("last_date")
    ).filter(AsosDailyData.stn_id == stn_id).group_by(AsosDailyData.stn_nm).first()

    return {
        "stn_id": stn_id,
        "stn_nm": station_info.stn_nm if station_info else None,
        "period": {
            "start_date": start_date or station_info.first_date,
            "end_date": end_date or station_info.last_date
        },
        "statistics": {
            "data_count": result.count,
            "avg_temp": round(result.avg_temp, 2) if result.avg_temp else None,
            "max_temp": result.max_temp,
            "min_temp": result.min_temp,
            "total_rainfall": round(result.total_rainfall, 2) if result.total_rainfall else None,
            "avg_humidity": round(result.avg_humidity, 1) if result.avg_humidity else None,
            "avg_wind_speed": round(result.avg_wind_speed, 2) if result.avg_wind_speed else None,
            "total_sunshine": round(result.total_sunshine, 1) if result.total_sunshine else None
        }
    }


@router.get("/rda/station/{stn_cd}", summary="RDA 관측소별 통계")
def get_rda_station_stats(
    stn_cd: str,
    start_date: Optional[date] = Query(default=None, description="시작 날짜"),
    end_date: Optional[date] = Query(default=None, description="종료 날짜"),
    db: Session = Depends(get_db)
):
    """
    특정 RDA 관측소의 통계를 조회합니다.
    """
    query = db.query(
        func.count(WeatherDataDaily.id).label("count"),
        func.avg(WeatherDataDaily.temp).label("avg_temp"),
        func.max(WeatherDataDaily.hghst_artmp).label("max_temp"),
        func.min(WeatherDataDaily.lowst_artmp).label("min_temp"),
        func.sum(WeatherDataDaily.rn).label("total_rainfall"),
        func.avg(WeatherDataDaily.hum).label("avg_humidity"),
        func.avg(WeatherDataDaily.wind).label("avg_wind_speed"),
        func.sum(WeatherDataDaily.sun_time).label("total_sunshine")
    ).filter(WeatherDataDaily.stn_cd == stn_cd)

    if start_date:
        query = query.filter(WeatherDataDaily.date >= start_date)
    if end_date:
        query = query.filter(WeatherDataDaily.date <= end_date)

    result = query.first()

    if result.count == 0:
        raise HTTPException(status_code=404, detail=f"관측소 '{stn_cd}'의 데이터가 없습니다.")

    # 관측소 정보 조회
    station_info = db.query(
        WeatherDataDaily.stn_name,
        func.min(WeatherDataDaily.date).label("first_date"),
        func.max(WeatherDataDaily.date).label("last_date")
    ).filter(WeatherDataDaily.stn_cd == stn_cd).group_by(WeatherDataDaily.stn_name).first()

    return {
        "stn_cd": stn_cd,
        "stn_name": station_info.stn_name if station_info else None,
        "period": {
            "start_date": start_date or station_info.first_date,
            "end_date": end_date or station_info.last_date
        },
        "statistics": {
            "data_count": result.count,
            "avg_temp": round(result.avg_temp, 2) if result.avg_temp else None,
            "max_temp": result.max_temp,
            "min_temp": result.min_temp,
            "total_rainfall": round(result.total_rainfall, 2) if result.total_rainfall else None,
            "avg_humidity": round(result.avg_humidity, 1) if result.avg_humidity else None,
            "avg_wind_speed": round(result.avg_wind_speed, 2) if result.avg_wind_speed else None,
            "total_sunshine": round(result.total_sunshine, 1) if result.total_sunshine else None
        }
    }


@router.get("/comparison", summary="관측소 간 비교 통계")
def get_comparison_stats(
    stn_ids: str = Query(description="비교할 ASOS 지점 ID (콤마 구분, 예: 108,133,159)"),
    start_date: date = Query(description="시작 날짜"),
    end_date: date = Query(description="종료 날짜"),
    db: Session = Depends(get_db)
):
    """
    여러 ASOS 관측소의 통계를 비교합니다.
    """
    try:
        station_list = [int(s.strip()) for s in stn_ids.split(",")]
    except ValueError:
        raise HTTPException(status_code=400, detail="지점 ID는 숫자여야 합니다.")

    if len(station_list) > 10:
        raise HTTPException(status_code=400, detail="최대 10개 지점까지 비교 가능합니다.")

    results = []
    for stn_id in station_list:
        stats = db.query(
            AsosDailyData.stn_nm,
            func.count(AsosDailyData.id).label("count"),
            func.avg(AsosDailyData.avg_ta).label("avg_temp"),
            func.max(AsosDailyData.max_ta).label("max_temp"),
            func.min(AsosDailyData.min_ta).label("min_temp"),
            func.sum(AsosDailyData.sum_rn).label("total_rainfall"),
            func.avg(AsosDailyData.avg_rhm).label("avg_humidity")
        ).filter(
            AsosDailyData.stn_id == stn_id,
            AsosDailyData.tm >= start_date,
            AsosDailyData.tm <= end_date
        ).group_by(AsosDailyData.stn_nm).first()

        if stats and stats.count > 0:
            results.append({
                "stn_id": stn_id,
                "stn_nm": stats.stn_nm,
                "data_count": stats.count,
                "avg_temp": round(stats.avg_temp, 2) if stats.avg_temp else None,
                "max_temp": stats.max_temp,
                "min_temp": stats.min_temp,
                "total_rainfall": round(stats.total_rainfall, 2) if stats.total_rainfall else None,
                "avg_humidity": round(stats.avg_humidity, 1) if stats.avg_humidity else None
            })

    return {
        "period": {
            "start_date": start_date,
            "end_date": end_date
        },
        "stations": results
    }
