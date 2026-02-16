# backend/app/routers/download.py
"""
파일 다운로드 API 라우터
- 지역 정보 CSV, API 명세서 등 파일 다운로드 엔드포인트
"""

import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(
    prefix="/api/download",
    tags=["파일 다운로드"]
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(BASE_DIR, "..", "..", "..", "Agri-Weather_DB")
INFO_DIR = os.path.join(BASE_DIR, "..", "..", "..", "info")


@router.get("/kma/region-info", summary="KMA 지역 정보 CSV 다운로드")
def download_kma_region_info():
    """KMA 행정구역 매핑 정보 CSV 파일을 다운로드합니다."""
    file_path = os.path.join(DB_DIR, "KMA", "region_preprocessed.csv")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(
        path=file_path,
        filename="region_preprocessed.csv",
        media_type="text/csv"
    )


@router.get("/kma/spec", summary="KMA API 명세서 다운로드")
def download_kma_spec():
    """KMA 초단기실황 API 명세서(DOCX)를 다운로드합니다."""
    file_path = os.path.join(INFO_DIR, "ASOS_KMA_info_forecast_short.docx")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(
        path=file_path,
        filename="ASOS_KMA_info_forecast_short.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


@router.get("/rda/region-info", summary="RDA 지역 정보 CSV 다운로드")
def download_rda_region_info():
    """RDA 관측소 정보 CSV 파일을 다운로드합니다."""
    file_path = os.path.join(DB_DIR, "RDA", "region_info.csv")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(
        path=file_path,
        filename="region_info.csv",
        media_type="text/csv"
    )


@router.get("/rda/spec", summary="RDA API 명세서 다운로드")
def download_rda_spec():
    """RDA 농업기상 API 명세서(PDF)를 다운로드합니다."""
    file_path = os.path.join(INFO_DIR, "RDA_info.pdf")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(
        path=file_path,
        filename="RDA_info.pdf",
        media_type="application/pdf"
    )


# ===== 과거기상 관련 다운로드 =====

@router.get("/kma/day/region-info", summary="KMA ASOS 관측소 정보 CSV 다운로드")
def download_kma_day_region_info():
    """KMA ASOS 관측소 정보(지점번호, 지점명, 관리관서, 관측시작일) CSV 파일을 다운로드합니다."""
    file_path = os.path.join(DB_DIR, "KMA", "kma_region.csv")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(
        path=file_path,
        filename="kma_region.csv",
        media_type="text/csv"
    )


@router.get("/kma/day/spec", summary="KMA ASOS 일자료 명세서 다운로드")
def download_kma_day_spec():
    """KMA ASOS 일자료 원본데이터 명세서(DOCX)를 다운로드합니다."""
    file_path = os.path.join(INFO_DIR, "ASOS_KMA_info_day.docx")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(
        path=file_path,
        filename="ASOS_KMA_info_day.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


@router.get("/rda/day/region-info", summary="RDA 관측소 정보 CSV 다운로드")
def download_rda_day_region_info():
    """RDA 관측소 정보(도명, 지점명, 지점코드 등) CSV 파일을 다운로드합니다."""
    file_path = os.path.join(DB_DIR, "RDA", "region_info.csv")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(
        path=file_path,
        filename="region_info.csv",
        media_type="text/csv"
    )


@router.get("/rda/day/spec", summary="RDA 일자료 명세서 다운로드")
def download_rda_day_spec():
    """RDA 농업기상 일자료 원본데이터 명세서(PDF)를 다운로드합니다."""
    file_path = os.path.join(INFO_DIR, "RDA_info.pdf")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(
        path=file_path,
        filename="RDA_info.pdf",
        media_type="application/pdf"
    )


# ===== 예보 관련 다운로드 =====

@router.get("/kma/forecast/region-info", summary="KMA 예보 지역 정보 CSV 다운로드")
def download_kma_forecast_region_info():
    """KMA 예보 지역 좌표 정보(행정구역코드, 격자좌표, 경위도) CSV 파일을 다운로드합니다."""
    file_path = os.path.join(DB_DIR, "KMA", "region_latitude_longitude.csv")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(
        path=file_path,
        filename="region_latitude_longitude.csv",
        media_type="text/csv"
    )


@router.get("/kma/forecast/spec-short", summary="KMA 단기예보 명세서 다운로드")
def download_kma_forecast_short_spec():
    """KMA 단기예보 원본데이터 명세서(DOCX)를 다운로드합니다."""
    file_path = os.path.join(INFO_DIR, "ASOS_KMA_info_forecast_short.docx")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(
        path=file_path,
        filename="ASOS_KMA_info_forecast_short.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


@router.get("/kma/forecast/spec-mid", summary="KMA 중기예보 명세서 다운로드")
def download_kma_forecast_mid_spec():
    """KMA 중기예보 원본데이터 명세서(DOCX)를 다운로드합니다."""
    file_path = os.path.join(INFO_DIR, "ASOS_KMA_info_forecast_mid.docx")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(
        path=file_path,
        filename="ASOS_KMA_info_forecast_mid.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
