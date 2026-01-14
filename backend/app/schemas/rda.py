# backend/app/schemas/rda.py
"""
RDA(농촌진흥청) 데이터 Pydantic 스키마
- API 응답 형식을 정의합니다.
"""

from typing import Optional
import datetime as dt
from pydantic import BaseModel, Field


class WeatherDataResponse(BaseModel):
    """10분 간격 기상 데이터 응답 스키마"""
    id: int
    stn_cd: Optional[str] = Field(default=None, description="관측소 코드")
    stn_name: Optional[str] = Field(default=None, description="관측소명")
    province: Optional[str] = Field(default=None, description="도/광역시")
    datetime: Optional[dt.datetime] = Field(default=None, description="관측일시")
    temp: Optional[float] = Field(default=None, description="기온 (°C)")
    hghst_artmp: Optional[float] = Field(default=None, description="최고기온 (°C)")
    lowst_artmp: Optional[float] = Field(default=None, description="최저기온 (°C)")
    hum: Optional[float] = Field(default=None, description="습도 (%)")
    widdir: Optional[float] = Field(default=None, description="풍향 (deg)")
    wind: Optional[float] = Field(default=None, description="풍속 (m/s)")
    max_wind: Optional[float] = Field(default=None, description="최대풍속 (m/s)")
    rn: Optional[float] = Field(default=None, description="강수량 (mm)")
    sun_time: Optional[float] = Field(default=None, description="일조시간 (min)")
    srqty: Optional[float] = Field(default=None, description="일사량 (MJ/m²)")
    condens_time: Optional[float] = Field(default=None, description="응축시간 (min)")
    gr_temp: Optional[float] = Field(default=None, description="지면온도 (°C)")
    soil_temp: Optional[float] = Field(default=None, description="토양온도 (°C)")
    soil_wt: Optional[float] = Field(default=None, description="토양습도 (%)")
    created_at: Optional[dt.datetime] = None

    class Config:
        from_attributes = True


class WeatherDataDailyResponse(BaseModel):
    """일별 기상 데이터 응답 스키마"""
    id: int
    stn_cd: Optional[str] = Field(default=None, description="관측소 코드")
    stn_name: Optional[str] = Field(default=None, description="관측소명")
    date: Optional[dt.date] = Field(default=None, description="관측일자")
    temp: Optional[float] = Field(default=None, description="평균기온 (°C)")
    hghst_artmp: Optional[float] = Field(default=None, description="최고기온 (°C)")
    lowst_artmp: Optional[float] = Field(default=None, description="최저기온 (°C)")
    hum: Optional[float] = Field(default=None, description="평균습도 (%)")
    widdir: Optional[float] = Field(default=None, description="풍향 (deg)")
    wind: Optional[float] = Field(default=None, description="평균풍속 (m/s)")
    max_wind: Optional[float] = Field(default=None, description="최대풍속 (m/s)")
    rn: Optional[float] = Field(default=None, description="강수량 (mm)")
    sun_time: Optional[float] = Field(default=None, description="일조시간 (hr)")
    srqty: Optional[float] = Field(default=None, description="일사량 (MJ/m²)")
    condens_time: Optional[float] = Field(default=None, description="응축시간 (min)")
    gr_temp: Optional[float] = Field(default=None, description="지면온도 (°C)")
    soil_temp: Optional[float] = Field(default=None, description="토양온도 (°C)")
    soil_wt: Optional[float] = Field(default=None, description="토양습도 (%)")
    created_at: Optional[dt.datetime] = None

    class Config:
        from_attributes = True


class WeatherDataMonthlyResponse(BaseModel):
    """월별 기상 데이터 응답 스키마"""
    id: int
    stn_cd: Optional[str] = Field(default=None, description="관측소 코드")
    stn_name: Optional[str] = Field(default=None, description="관측소명")
    date: Optional[str] = Field(default=None, description="관측월 (YYYY-MM)")
    temp: Optional[float] = Field(default=None, description="평균기온 (°C)")
    hghst_artmp: Optional[float] = Field(default=None, description="최고기온 (°C)")
    lowst_artmp: Optional[float] = Field(default=None, description="최저기온 (°C)")
    hum: Optional[float] = Field(default=None, description="평균습도 (%)")
    widdir: Optional[float] = Field(default=None, description="풍향 (deg)")
    wind: Optional[float] = Field(default=None, description="평균풍속 (m/s)")
    max_wind: Optional[float] = Field(default=None, description="최대풍속 (m/s)")
    rn: Optional[float] = Field(default=None, description="강수량 (mm)")
    sun_time: Optional[float] = Field(default=None, description="일조시간 (hr)")
    srqty: Optional[float] = Field(default=None, description="일사량 (MJ/m²)")
    condens_time: Optional[float] = Field(default=None, description="응축시간 (min)")
    gr_temp: Optional[float] = Field(default=None, description="지면온도 (°C)")
    soil_temp: Optional[float] = Field(default=None, description="토양온도 (°C)")
    soil_wt: Optional[float] = Field(default=None, description="토양습도 (%)")
    created_at: Optional[dt.datetime] = None

    class Config:
        from_attributes = True
