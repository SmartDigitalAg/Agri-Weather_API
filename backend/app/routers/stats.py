# backend/app/routers/stats.py
"""
통계 API 라우터
- 기상 데이터 통계 조회 엔드포인트
"""

from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_

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


@router.get("/null-status/rda", summary="RDA 관측소별 NULL 데이터 현황")
def get_rda_null_status(db: Session = Depends(get_db)):
    """
    RDA 관측소별 NULL 데이터 현황을 조회합니다.
    각 관측소별로 어떤 필드에 NULL이 많은지 확인합니다.

    - 일사량(srqty)만 NULL: 빨간색
    - 다른 필드가 NULL: 노란색
    - 2개 이상 NULL: 주황색
    """
    # 주요 필드들
    fields = ['temp', 'hghst_artmp', 'lowst_artmp', 'hum', 'wind', 'rn', 'srqty', 'sun_time']

    # 관측소별 통계 조회
    results = db.query(
        WeatherDataDaily.stn_cd,
        WeatherDataDaily.stn_name,
        func.count(WeatherDataDaily.id).label('total_count'),
        func.sum(case((WeatherDataDaily.temp == None, 1), else_=0)).label('temp_null'),
        func.sum(case((WeatherDataDaily.hghst_artmp == None, 1), else_=0)).label('hghst_artmp_null'),
        func.sum(case((WeatherDataDaily.lowst_artmp == None, 1), else_=0)).label('lowst_artmp_null'),
        func.sum(case((WeatherDataDaily.hum == None, 1), else_=0)).label('hum_null'),
        func.sum(case((WeatherDataDaily.wind == None, 1), else_=0)).label('wind_null'),
        func.sum(case((WeatherDataDaily.rn == None, 1), else_=0)).label('rn_null'),
        func.sum(case((WeatherDataDaily.srqty == None, 1), else_=0)).label('srqty_null'),
        func.sum(case((WeatherDataDaily.sun_time == None, 1), else_=0)).label('sun_time_null'),
    ).group_by(
        WeatherDataDaily.stn_cd,
        WeatherDataDaily.stn_name
    ).all()

    stations = []
    for row in results:
        total = row.total_count or 1

        # NULL 비율 계산 (50% 이상이면 해당 필드가 NULL인 것으로 판단)
        null_fields = []
        null_threshold = 0.5  # 50% 이상 NULL이면 해당 필드 없음으로 판단

        field_null_info = {
            'temp': {'count': row.temp_null or 0, 'label': '기온'},
            'hghst_artmp': {'count': row.hghst_artmp_null or 0, 'label': '최고기온'},
            'lowst_artmp': {'count': row.lowst_artmp_null or 0, 'label': '최저기온'},
            'hum': {'count': row.hum_null or 0, 'label': '습도'},
            'wind': {'count': row.wind_null or 0, 'label': '풍속'},
            'rn': {'count': row.rn_null or 0, 'label': '강수량'},
            'srqty': {'count': row.srqty_null or 0, 'label': '일사량'},
            'sun_time': {'count': row.sun_time_null or 0, 'label': '일조시간'},
        }

        for field, info in field_null_info.items():
            if info['count'] / total >= null_threshold:
                null_fields.append({
                    'field': field,
                    'label': info['label'],
                    'null_ratio': round(info['count'] / total * 100, 1)
                })

        # 색상 결정
        srqty_only_null = len(null_fields) == 1 and null_fields[0]['field'] == 'srqty'
        has_srqty_null = any(f['field'] == 'srqty' for f in null_fields)
        other_null_count = len([f for f in null_fields if f['field'] != 'srqty'])

        if srqty_only_null:
            color = 'red'  # 일사량만 NULL
        elif len(null_fields) >= 2:
            color = 'orange'  # 2개 이상 NULL
        elif len(null_fields) == 1:
            color = 'yellow'  # 다른 값 1개 NULL
        else:
            color = 'green'  # 모든 데이터 정상

        stations.append({
            'stn_cd': row.stn_cd,
            'stn_name': row.stn_name,
            'total_count': total,
            'null_fields': null_fields,
            'color': color
        })

    return {
        'institution': 'RDA',
        'total_stations': len(stations),
        'stations': stations
    }


@router.get("/null-status/kma", summary="KMA 관측소별 NULL 데이터 현황")
def get_kma_null_status(db: Session = Depends(get_db)):
    """
    KMA ASOS 관측소별 NULL 데이터 현황을 조회합니다.
    """
    # 관측소별 통계 조회
    results = db.query(
        AsosDailyData.stn_id,
        AsosDailyData.stn_nm,
        func.count(AsosDailyData.id).label('total_count'),
        func.sum(case((AsosDailyData.avg_ta == None, 1), else_=0)).label('avg_ta_null'),
        func.sum(case((AsosDailyData.min_ta == None, 1), else_=0)).label('min_ta_null'),
        func.sum(case((AsosDailyData.max_ta == None, 1), else_=0)).label('max_ta_null'),
        func.sum(case((AsosDailyData.sum_rn == None, 1), else_=0)).label('sum_rn_null'),
        func.sum(case((AsosDailyData.avg_ws == None, 1), else_=0)).label('avg_ws_null'),
        func.sum(case((AsosDailyData.avg_rhm == None, 1), else_=0)).label('avg_rhm_null'),
        func.sum(case((AsosDailyData.sum_ss_hr == None, 1), else_=0)).label('sum_ss_hr_null'),
        func.sum(case((AsosDailyData.sum_gsr == None, 1), else_=0)).label('sum_gsr_null'),
    ).group_by(
        AsosDailyData.stn_id,
        AsosDailyData.stn_nm
    ).all()

    stations = []
    for row in results:
        total = row.total_count or 1

        null_fields = []
        null_threshold = 0.5

        field_null_info = {
            'avg_ta': {'count': row.avg_ta_null or 0, 'label': '평균기온'},
            'min_ta': {'count': row.min_ta_null or 0, 'label': '최저기온'},
            'max_ta': {'count': row.max_ta_null or 0, 'label': '최고기온'},
            'sum_rn': {'count': row.sum_rn_null or 0, 'label': '강수량'},
            'avg_ws': {'count': row.avg_ws_null or 0, 'label': '풍속'},
            'avg_rhm': {'count': row.avg_rhm_null or 0, 'label': '습도'},
            'sum_ss_hr': {'count': row.sum_ss_hr_null or 0, 'label': '일조시간'},
            'sum_gsr': {'count': row.sum_gsr_null or 0, 'label': '일사량'},
        }

        for field, info in field_null_info.items():
            if info['count'] / total >= null_threshold:
                null_fields.append({
                    'field': field,
                    'label': info['label'],
                    'null_ratio': round(info['count'] / total * 100, 1)
                })

        # 색상 결정 (sum_gsr = 일사량)
        srqty_only_null = len(null_fields) == 1 and null_fields[0]['field'] == 'sum_gsr'

        if srqty_only_null:
            color = 'red'
        elif len(null_fields) >= 2:
            color = 'orange'
        elif len(null_fields) == 1:
            color = 'yellow'
        else:
            color = 'green'

        stations.append({
            'stn_id': row.stn_id,
            'stn_nm': row.stn_nm,
            'total_count': total,
            'null_fields': null_fields,
            'color': color
        })

    return {
        'institution': 'KMA',
        'total_stations': len(stations),
        'stations': stations
    }
