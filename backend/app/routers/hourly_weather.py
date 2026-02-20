# backend/app/routers/hourly_weather.py
"""
시간별 기상 데이터 API 라우터
- KMA(기상청) 및 RDA(국립농업과학원) 시간별 데이터 조회 엔드포인트
- 외부 공공데이터 API를 호출하여 데이터를 가져옴
"""

import httpx
import csv
import io
import xml.etree.ElementTree as ET
from datetime import date, datetime
from typing import Optional, List

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

# ============================================================
# KMA 시간별 데이터 API
# ============================================================

kma_hr_router = APIRouter(
    prefix="/api/kma/asos/hr",
    tags=["KMA 시간별 기상 데이터"]
)

KMA_BASE_URL = "http://apis.data.go.kr/1360000/AsosHourlyInfoService/getWthrDataList"
SERVICE_KEY = "fa9d976efe6bd54b13679be3ae0207f12ae70cb1e87bafb7d3e911025f00f250"


async def fetch_kma_hourly_data(stn_id: int, start_date: str, end_date: str) -> List[dict]:
    """
    기상청 ASOS 시간별 데이터를 조회합니다.
    - stn_id: 지점번호
    - start_date: 시작일자 (YYYYMMDD)
    - end_date: 종료일자 (YYYYMMDD)
    """
    params = {
        "serviceKey": SERVICE_KEY,
        "numOfRows": 999,
        "pageNo": 1,
        "dataType": "JSON",
        "dataCd": "ASOS",
        "dateCd": "HR",
        "startDt": start_date,
        "startHh": "00",
        "endDt": end_date,
        "endHh": "23",
        "stnIds": stn_id
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(KMA_BASE_URL, params=params)
            response.raise_for_status()

            # 응답 내용 확인 (JSON이 아닐 수 있음)
            content_type = response.headers.get("content-type", "")
            response_text = response.text

            # JSON 파싱 시도
            try:
                data = response.json()
            except Exception as json_err:
                print(f"[KMA HR] JSON 파싱 실패. Content-Type: {content_type}")
                print(f"[KMA HR] 응답 내용 (처음 500자): {response_text[:500]}")
                raise HTTPException(status_code=500, detail=f"API 응답이 JSON 형식이 아닙니다: {str(json_err)}")

            # 응답 구조 파싱
            if "response" not in data:
                print(f"[KMA HR] 응답에 'response' 키 없음: {str(data)[:300]}")
                raise HTTPException(status_code=500, detail="API 응답 형식 오류")

            header = data["response"].get("header", {})
            if header.get("resultCode") != "00":
                raise HTTPException(
                    status_code=400,
                    detail=f"API 오류: {header.get('resultMsg', '알 수 없는 오류')}"
                )

            body = data["response"].get("body", {})
            items = body.get("items", {})

            if not items:
                return []

            # items가 dict일 경우 item 추출
            if isinstance(items, dict):
                items = items.get("item", [])

            # 단일 항목인 경우 리스트로 변환
            if isinstance(items, dict):
                items = [items]

            if not items:
                return []

            # 필요한 필드만 추출
            parsed_data = []
            for item in items:
                record = {
                    "tm": item.get("tm"),           # 시간
                    "stnId": item.get("stnId"),     # 지점번호
                    "stnNm": item.get("stnNm"),     # 지점명
                    "ta": item.get("ta"),           # 기온
                    "rn": item.get("rn"),           # 강수량
                    "ws": item.get("ws"),           # 풍속
                    "wd": item.get("wd"),           # 풍향
                    "hm": item.get("hm"),           # 습도
                    "icsr": item.get("icsr"),       # 일사량
                }
                parsed_data.append(record)

            return parsed_data

    except httpx.RequestError as e:
        print(f"[KMA HR] 연결 오류: stn_id={stn_id}, {start_date}~{end_date} - {str(e)}")
        raise HTTPException(status_code=503, detail=f"외부 API 연결 실패: {str(e)}")
    except Exception as e:
        print(f"[KMA HR] 처리 오류: stn_id={stn_id}, {start_date}~{end_date} - {str(e)}")
        raise HTTPException(status_code=500, detail=f"데이터 처리 오류: {str(e)}")


@kma_hr_router.get("/{stn_id}/{start_date}/{end_date}", summary="KMA 시간별 기상 데이터 조회")
async def get_kma_hourly_data(
    stn_id: int,
    start_date: str,
    end_date: str,
    format: Optional[str] = Query(default="json", description="응답 형식 (json 또는 csv)")
):
    """
    기상청 ASOS 시간별 기상 데이터를 조회합니다.

    - **stn_id**: 지점번호 (예: 108)
    - **start_date**: 시작 날짜 (YYYYMMDD)
    - **end_date**: 종료 날짜 (YYYYMMDD)
    - **format**: 응답 형식 (json 또는 csv)

    반환 필드:
    - tm: 시간
    - stnId: 지점번호
    - stnNm: 지점명
    - ta: 기온 (°C)
    - rn: 강수량 (mm)
    - ws: 풍속 (m/s)
    - wd: 풍향 (°)
    - hm: 습도 (%)
    - icsr: 일사량 (MJ/m²)
    """
    # 날짜 형식 검증
    try:
        start_dt = datetime.strptime(start_date, "%Y%m%d")
        end_dt = datetime.strptime(end_date, "%Y%m%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식은 YYYYMMDD 여야 합니다.")

    if start_dt > end_dt:
        raise HTTPException(status_code=400, detail="시작 날짜가 종료 날짜보다 늦을 수 없습니다.")

    # 최대 조회 기간 제한 (31일)
    if (end_dt - start_dt).days > 31:
        raise HTTPException(status_code=400, detail="조회 기간은 최대 31일까지 가능합니다.")

    data = await fetch_kma_hourly_data(stn_id, start_date, end_date)

    if not data:
        raise HTTPException(status_code=404, detail="해당 기간의 데이터가 없습니다.")

    # CSV 형식 응답
    if format.lower() == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["tm", "stnId", "stnNm", "ta", "rn", "ws", "wd", "hm", "icsr"])
        writer.writeheader()
        writer.writerows(data)

        output.seek(0)
        filename = f"kma_hourly_{stn_id}_{start_date}_{end_date}.csv"

        return StreamingResponse(
            iter(['\ufeff' + output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    # JSON 형식 응답
    return {
        "stn_id": stn_id,
        "start_date": start_date,
        "end_date": end_date,
        "total": len(data),
        "data": data
    }


# ============================================================
# RDA 시간별 데이터 API
# ============================================================

rda_hr_router = APIRouter(
    prefix="/api/rda/weather/hr",
    tags=["RDA 시간별 기상 데이터"]
)

RDA_BASE_URL = "http://apis.data.go.kr/1390802/AgriWeather/WeatherObsrInfo/V3/GnrlWeather/getWeatherTimeList3"


def parse_xml_items(xml_text: str) -> tuple:
    """
    XML 응답을 파싱하여 (result_code, result_msg, items) 튜플을 반환합니다.
    """
    try:
        root = ET.fromstring(xml_text)

        # 헤더 정보 추출
        header = root.find(".//header")
        result_code = None
        result_msg = None

        if header is not None:
            code_elem = header.find("result_Code") or header.find("resultCode")
            msg_elem = header.find("result_Msg") or header.find("resultMsg")
            result_code = code_elem.text if code_elem is not None else None
            result_msg = msg_elem.text if msg_elem is not None else None

        # items 추출
        items = []
        body = root.find(".//body")
        if body is not None:
            items_elem = body.find("items")
            if items_elem is not None:
                for item in items_elem.findall("item"):
                    item_dict = {}
                    for child in item:
                        item_dict[child.tag] = child.text
                    items.append(item_dict)

        return result_code, result_msg, items
    except ET.ParseError as e:
        print(f"[XML 파싱 오류] {str(e)}")
        return None, str(e), []


async def fetch_rda_hourly_data(stn_code: str, obs_date: str, obsr_spot_nm: str) -> List[dict]:
    """
    국립농업과학원 RDA 시간별 데이터를 조회합니다.
    - stn_code: 관측지점코드
    - obs_date: 관측년월일 (YYYYMMDD)
    """
    # XML로 요청 (JSON이 무시되는 경우가 있음)
    # 날짜 형식 정제 (YYYY-MM-DD)
    obs_date = datetime.strptime(obs_date, "%Y%m%d").strftime("%Y-%m-%d")

    params = {
        "serviceKey": SERVICE_KEY,
        "Page_No": 1,
        "page_Size": 100,
        "date_Time": obs_date,
        "obsr_Spot_Nm": obsr_spot_nm,
        "obsr_spot_Cd": stn_code
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(RDA_BASE_URL, params=params)
            print(f"[RDA HR] 요청 URL: {response.url}")
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")
            response_text = response.text

            # XML 또는 JSON 응답 처리
            if "xml" in content_type.lower():
                # XML 파싱
                result_code, result_msg, items = parse_xml_items(response_text)

                if result_code != "00":
                    if result_code == "204":
                        print(f"[RDA HR] 필수 파라미터 누락: stn_code={stn_code}, obs_date={obs_date}")
                        return []
                    print(f"[RDA HR] API 오류: {result_code} - {result_msg}")
                    return []
            else:
                # JSON 파싱 시도
                try:
                    data = response.json()
                    body = data.get("response", {}).get("body", {})
                    items = body.get("items", {})
                    if isinstance(items, dict):
                        items = items.get("item", [])
                    if isinstance(items, dict):
                        items = [items]
                except Exception as json_err:
                    print(f"[RDA HR] JSON 파싱 실패: {str(json_err)}")
                    # XML로 재시도
                    result_code, result_msg, items = parse_xml_items(response_text)
                    if result_code != "00":
                        return []

            if not items:
                return []

            # 필요한 필드만 추출
            parsed_data = []
            for item in items:
                record = {
                    "stn_Cd": item.get("obsr_spot_code") or item.get("stn_Cd"),
                    "stn_Name": item.get("obsr_spot_nm") or item.get("stn_Name"),
                    "date": item.get("obsr_date") or item.get("date"),
                    "time": item.get("obsr_time") or item.get("time"),
                    "temp": item.get("temp"),
                    "hum": item.get("hum"),
                    "widdir": item.get("widdir"),
                    "wind": item.get("wind"),
                    "rn": item.get("rn"),
                    "srqty": item.get("srqty"),
                }
                parsed_data.append(record)

            return parsed_data

    except httpx.RequestError as e:
        print(f"[RDA HR] 연결 오류: stn_code={stn_code}, obs_date={obs_date} - {str(e)}")
        raise HTTPException(status_code=503, detail=f"외부 API 연결 실패: {str(e)}")
    except Exception as e:
        print(f"[RDA HR] 처리 오류: stn_code={stn_code}, obs_date={obs_date} - {str(e)}")
        raise HTTPException(status_code=500, detail=f"데이터 처리 오류: {str(e)}")


@rda_hr_router.get("/{stn_code}/{start_date}/{end_date}", summary="RDA 시간별 기상 데이터 조회")
async def get_rda_hourly_data(
    stn_code: str,
    start_date: str,
    end_date: str,
    format: Optional[str] = Query(default="json", description="응답 형식 (json 또는 csv)")
):
    """
    국립농업과학원 RDA 시간별 기상 데이터를 조회합니다.

    - **stn_code**: 관측지점코드 (예: 477802A001)
    - **start_date**: 시작 날짜 (YYYYMMDD)
    - **end_date**: 종료 날짜 (YYYYMMDD)
    - **format**: 응답 형식 (json 또는 csv)

    반환 필드:
    - stn_Cd: 관측지점코드
    - stn_Name: 관측지점명
    - date: 관측일자
    - time: 관측시간
    - temp: 기온 (°C)
    - hum: 습도 (%)
    - widdir: 풍향 (°)
    - wind: 풍속 (m/s)
    - rn: 강수량 (mm)
    - srqty: 일사량 (MJ/m²)
    """

    df = pd.read_csv("frontend/public/region_files/rda_region_info.csv")

    # obsr_spot_nm 추출
    obsr_spot_nm = None
    for _, row in df.iterrows():
        if row["지점코드"] == stn_code:
            obsr_spot_nm = row["지점명"]
            break

    if not obsr_spot_nm:
        raise HTTPException(status_code=400, detail=f"유효하지 않은 관측지점코드: {stn_code}")


    # 날짜 형식 검증
    try:
        start_dt = datetime.strptime(start_date, "%Y%m%d")
        end_dt = datetime.strptime(end_date, "%Y%m%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식은 YYYYMMDD 여야 합니다.")

    if start_dt > end_dt:
        raise HTTPException(status_code=400, detail="시작 날짜가 종료 날짜보다 늦을 수 없습니다.")

    # 최대 조회 기간 제한 (7일)
    if (end_dt - start_dt).days > 7:
        raise HTTPException(status_code=400, detail="조회 기간은 최대 7일까지 가능합니다.")

    # 날짜별로 데이터 수집
    from datetime import timedelta
    all_data = []
    current_dt = start_dt

    while current_dt <= end_dt:
        obs_date = current_dt.strftime("%Y%m%d")
        try:
            day_data = await fetch_rda_hourly_data(stn_code, obs_date, obsr_spot_nm)
            all_data.extend(day_data)
        except HTTPException:
            # 특정 날짜 데이터 실패 시 건너뛰기
            pass
        current_dt = current_dt + timedelta(days=1)

    if not all_data:
        raise HTTPException(status_code=404, detail="해당 기간의 데이터가 없습니다.")

    # CSV 형식 응답
    if format.lower() == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["stn_Cd", "stn_Name", "date", "time", "temp", "hum", "widdir", "wind", "rn", "srqty"])
        writer.writeheader()
        writer.writerows(all_data)

        output.seek(0)
        filename = f"rda_hourly_{stn_code}_{start_date}_{end_date}.csv"

        return StreamingResponse(
            iter(['\ufeff' + output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    # JSON 형식 응답
    return {
        "stn_code": stn_code,
        "start_date": start_date,
        "end_date": end_date,
        "total": len(all_data),
        "data": all_data
    }
