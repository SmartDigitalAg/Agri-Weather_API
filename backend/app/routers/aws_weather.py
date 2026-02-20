# backend/app/routers/aws_weather.py
"""
AWS (기상대) 데이터 API 라우터
- 외부 기상대 데이터를 가져와서 제공하는 엔드포인트
"""

import httpx
from datetime import date, datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
import csv
import io
import json

router = APIRouter(
    prefix="/api/aws",
    tags=["AWS 기상대"]
)

# 기상대 정보 매핑
# ID '01' -> Site=85, Dev=1 (전주시)
AWS_STATIONS = {
    "01": {
        "site": 85,
        "dev": 1,
        "name": "전주시",
        "lat": 35.8242,
        "lng": 127.1480
    }
}

# 데이터 컬럼 인덱스 매핑
DATA_COLUMNS = {
    0: "Timestamp",
    1: "Temp",
    2: "Humid",
    6: "Radn",  # 순간광량
    7: "Wind_degree",
    13: "Wind",
    14: "Rainfall"
}

BASE_URL = "http://203.239.47.148:8080/dspnet.aspx"


async def fetch_aws_data(site: int, dev: int, year: int, month: int, day: int) -> List[dict]:
    """
    외부 기상대 URL에서 데이터를 가져와 파싱합니다.
    """
    url = f"{BASE_URL}?Site={site}&Dev={dev}&Year={year}&Mon={month:02d}&Day={day:02d}"

    # 브라우저처럼 요청하기 위한 헤더 추가
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/plain, text/html, */*",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()

            # 텍스트 데이터 파싱
            text_data = response.text

            # 응답이 "NoFile" 또는 에러인 경우 처리
            if not text_data or text_data.strip() == "NoFile" or text_data.strip() == "":
                print(f"[AWS] 데이터 없음: Site={site}, Dev={dev}, {year}-{month:02d}-{day:02d}")
                return []

            lines = text_data.strip().split('\n')

            parsed_data = []
            for line in lines:
                if not line.strip():
                    continue

                # 쉼표로 구분된 CSV 형식 파싱
                parts = line.strip().split(',')

                if len(parts) < 15:  # 최소 15개 컬럼 필요 (인덱스 14까지)
                    print(f"[AWS] 컬럼 부족 (got {len(parts)}): {line[:80]}...")
                    continue

                try:
                    record = {
                        "Timestamp": parts[0] if len(parts) > 0 else None,
                        "Temp": float(parts[1]) if len(parts) > 1 and parts[1] else None,
                        "Humid": float(parts[2]) if len(parts) > 2 and parts[2] else None,
                        "Radn": float(parts[6]) if len(parts) > 6 and parts[6] else None,
                        "Wind_degree": float(parts[7]) if len(parts) > 7 and parts[7] else None,
                        "Wind": float(parts[13]) if len(parts) > 13 and parts[13] else None,
                        "Rainfall": float(parts[14]) if len(parts) > 14 and parts[14] else None,
                    }
                    parsed_data.append(record)
                except (ValueError, IndexError) as e:
                    print(f"[AWS] 파싱 오류: {line[:50]}... - {str(e)}")
                    continue

            return parsed_data
    except httpx.RequestError as e:
        print(f"[AWS] 연결 오류: {url} - {str(e)}")
        raise HTTPException(status_code=503, detail=f"외부 서버 연결 실패: {str(e)}")
    except Exception as e:
        print(f"[AWS] 처리 오류: {url} - {str(e)}")
        raise HTTPException(status_code=500, detail=f"데이터 처리 오류: {str(e)}")


@router.get("/stations", summary="AWS 기상대 목록 조회")
async def get_aws_stations():
    """
    사용 가능한 AWS 기상대 목록을 반환합니다.
    """
    stations = []
    for station_id, info in AWS_STATIONS.items():
        stations.append({
            "id": station_id,
            "name": info["name"],
            "lat": info["lat"],
            "lng": info["lng"]
        })
    return stations


@router.get("/{station_id}/latest", summary="최신 AWS 기상 데이터 조회")
async def get_latest_aws_data(station_id: str):
    """
    특정 기상대의 오늘 날짜 최신 데이터를 조회합니다.

    - **station_id**: 기상대 ID (예: '01')
    """
    if station_id not in AWS_STATIONS:
        raise HTTPException(status_code=404, detail=f"기상대 '{station_id}'를 찾을 수 없습니다.")

    station = AWS_STATIONS[station_id]
    today = date.today()

    # 오늘 데이터 가져오기
    data = await fetch_aws_data(
        station["site"],
        station["dev"],
        today.year,
        today.month,
        today.day
    )

    if not data:
        # 오늘 데이터가 없으면 어제 데이터 시도
        yesterday = today - timedelta(days=1)
        data = await fetch_aws_data(
            station["site"],
            station["dev"],
            yesterday.year,
            yesterday.month,
            yesterday.day
        )

    if not data:
        raise HTTPException(status_code=404, detail="최신 데이터를 찾을 수 없습니다.")

    # 가장 최신 데이터 반환 (마지막 레코드)
    latest = data[-1]

    return {
        "station_id": station_id,
        "station_name": station["name"],
        "data": latest
    }


@router.get("/{station_id}/{start_date}/{end_date}", summary="기간별 AWS 기상 데이터 조회")
async def get_aws_data_range(
    station_id: str,
    start_date: date,
    end_date: date,
    format: Optional[str] = Query(default="json", description="응답 형식 (json 또는 csv)")
):
    """
    특정 기상대의 기간별 데이터를 조회합니다.

    - **station_id**: 기상대 ID (예: '01')
    - **start_date**: 시작 날짜 (YYYY-MM-DD)
    - **end_date**: 종료 날짜 (YYYY-MM-DD)
    - **format**: 응답 형식 (json 또는 csv)
    """
    if station_id not in AWS_STATIONS:
        raise HTTPException(status_code=404, detail=f"기상대 '{station_id}'를 찾을 수 없습니다.")

    if start_date > end_date:
        raise HTTPException(status_code=400, detail="시작 날짜가 종료 날짜보다 늦을 수 없습니다.")

    # 최대 조회 기간 제한 (예: 1년)
    max_days = 365
    if (end_date - start_date).days > max_days:
        raise HTTPException(status_code=400, detail=f"조회 기간은 최대 {max_days}일까지 가능합니다.")

    station = AWS_STATIONS[station_id]
    all_data = []

    # 날짜별로 데이터 수집
    current_date = start_date
    while current_date <= end_date:
        try:
            day_data = await fetch_aws_data(
                station["site"],
                station["dev"],
                current_date.year,
                current_date.month,
                current_date.day
            )

            # 날짜 정보 추가
            for record in day_data:
                record["Date"] = current_date.isoformat()

            all_data.extend(day_data)
        except HTTPException:
            # 특정 날짜 데이터 실패 시 건너뛰기
            pass

        current_date += timedelta(days=1)

    if not all_data:
        raise HTTPException(status_code=404, detail="해당 기간의 데이터가 없습니다.")

    # CSV 형식 응답
    if format.lower() == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["Date", "Timestamp", "Temp", "Humid", "Radn", "Wind_degree", "Wind", "Rainfall"])
        writer.writeheader()
        writer.writerows(all_data)

        output.seek(0)
        filename = f"aws_{station_id}_{start_date}_{end_date}.csv"

        return StreamingResponse(
            iter(['\ufeff' + output.getvalue()]),  # BOM 추가 for Excel
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    # JSON 형식 응답
    return {
        "station_id": station_id,
        "station_name": station["name"],
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total": len(all_data),
        "data": all_data
    }
