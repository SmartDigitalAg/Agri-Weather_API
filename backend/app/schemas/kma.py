# backend/app/schemas/kma.py
"""
KMA(기상청) 데이터 Pydantic 스키마
- API 응답 형식을 정의합니다.
"""

from typing import Optional
import datetime as dt
from pydantic import BaseModel, Field


class AsosDailyResponse(BaseModel):
    """ASOS 일자료 응답 스키마"""
    id: int
    stn_id: int = Field(description="지점 ID")
    stn_nm: Optional[str] = Field(default=None, description="지점명")
    tm: dt.date = Field(description="날짜")
    avg_ta: Optional[float] = Field(default=None, description="평균기온 (°C)")
    min_ta: Optional[float] = Field(default=None, description="최저기온 (°C)")
    min_ta_hrmt: Optional[str] = Field(default=None, description="최저기온 시각")
    max_ta: Optional[float] = Field(default=None, description="최고기온 (°C)")
    max_ta_hrmt: Optional[str] = Field(default=None, description="최고기온 시각")
    sum_rn: Optional[float] = Field(default=None, description="일강수량 (mm)")
    avg_ws: Optional[float] = Field(default=None, description="평균풍속 (m/s)")
    avg_td: Optional[float] = Field(default=None, description="평균이슬점온도 (°C)")
    avg_rhm: Optional[int] = Field(default=None, description="평균상대습도 (%)")
    sum_ss_hr: Optional[float] = Field(default=None, description="일조시간 (hr)")
    sum_gsr: Optional[float] = Field(default=None, description="일사량 (MJ/m²)")
    dd_mes: Optional[float] = Field(default=None, description="적설량 (cm)")
    avg_tca: Optional[float] = Field(default=None, description="평균전운량 (1/10)")
    avg_ts: Optional[float] = Field(default=None, description="평균지면온도 (°C)")
    iscs: Optional[str] = Field(default=None, description="일기현상")
    created_at: Optional[dt.datetime] = None

    class Config:
        from_attributes = True


class WeatherRealtimeResponse(BaseModel):
    """초단기 실황 응답 스키마"""
    id: int
    region_name: Optional[str] = Field(default=None, description="지역명")
    nx: Optional[int] = Field(default=None, description="격자 X")
    ny: Optional[int] = Field(default=None, description="격자 Y")
    base_date: Optional[dt.date] = Field(default=None, description="발표일자")
    base_time: Optional[str] = Field(default=None, description="발표시각")
    category: Optional[str] = Field(default=None, description="자료구분")
    obsrvalue: Optional[float] = Field(default=None, description="관측값")
    created_at: Optional[dt.datetime] = None

    class Config:
        from_attributes = True


class WeatherRealtimePivotResponse(BaseModel):
    """초단기 실황 피벗 응답 스키마 (카테고리별 컬럼)"""
    region_name: str = Field(description="지역명")
    base_date: dt.date = Field(description="발표일자")
    base_time: str = Field(description="발표시각")
    T1H: Optional[float] = Field(default=None, description="기온 (°C)")
    RN1: Optional[float] = Field(default=None, description="1시간 강수량 (mm)")
    UUU: Optional[float] = Field(default=None, description="동서바람성분 (m/s)")
    VVV: Optional[float] = Field(default=None, description="남북바람성분 (m/s)")
    REH: Optional[float] = Field(default=None, description="습도 (%)")
    PTY: Optional[float] = Field(default=None, description="강수형태")
    VEC: Optional[float] = Field(default=None, description="풍향 (deg)")
    WSD: Optional[float] = Field(default=None, description="풍속 (m/s)")

    class Config:
        from_attributes = True


class WeatherShortForecastResponse(BaseModel):
    """단기예보 응답 스키마"""
    id: int
    region_name: Optional[str] = Field(default=None, description="지역명")
    nx: Optional[int] = Field(default=None, description="격자 X")
    ny: Optional[int] = Field(default=None, description="격자 Y")
    base_date: Optional[dt.date] = Field(default=None, description="발표일자")
    base_time: Optional[str] = Field(default=None, description="발표시각")
    fcst_date: Optional[dt.date] = Field(default=None, description="예보일자")
    fcst_time: Optional[str] = Field(default=None, description="예보시각")
    category: Optional[str] = Field(default=None, description="자료구분")
    fcst_value: Optional[str] = Field(default=None, description="예보값")
    created_at: Optional[dt.datetime] = None

    class Config:
        from_attributes = True


class WeatherMidForecastResponse(BaseModel):
    """중기예보 응답 스키마"""
    id: int
    reg_id: Optional[str] = Field(default=None, description="예보구역코드")
    region_name: Optional[str] = Field(default=None, description="지역명")
    tm_fc: Optional[str] = Field(default=None, description="발표시각")
    forecast_date: Optional[dt.date] = Field(default=None, description="예보일자")
    time_period: Optional[str] = Field(default=None, description="시간대")
    rain_prob: Optional[int] = Field(default=None, description="강수확률 (%)")
    weather_condition: Optional[str] = Field(default=None, description="날씨상태")
    temp_min: Optional[float] = Field(default=None, description="최저기온 (°C)")
    temp_min_low: Optional[float] = Field(default=None, description="최저기온 하한 (°C)")
    temp_min_high: Optional[float] = Field(default=None, description="최저기온 상한 (°C)")
    temp_max: Optional[float] = Field(default=None, description="최고기온 (°C)")
    temp_max_low: Optional[float] = Field(default=None, description="최고기온 하한 (°C)")
    temp_max_high: Optional[float] = Field(default=None, description="최고기온 상한 (°C)")
    created_at: Optional[dt.datetime] = None

    class Config:
        from_attributes = True
