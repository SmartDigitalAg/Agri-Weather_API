# backend/app/models/rda.py
"""
RDA(농촌진흥청) 데이터 SQLAlchemy 모델
- 10분 간격 데이터, 일별 데이터, 월별 데이터 테이블
"""

from sqlalchemy import Column, Integer, String, Float, Date, TIMESTAMP
from sqlalchemy.sql import func

from ..database import Base


class WeatherData(Base):
    """10분 간격 기상 데이터 테이블 모델"""
    __tablename__ = "weather_data"

    id = Column(Integer, primary_key=True, index=True)
    no = Column(Integer)  # 순번
    stn_cd = Column(String(20), index=True)  # 관측소 코드
    stn_name = Column(String(100))  # 관측소명
    province = Column(String(50), index=True)  # 도/광역시
    datetime = Column(TIMESTAMP, index=True)  # 관측일시
    temp = Column(Float)  # 기온
    hghst_artmp = Column(Float)  # 최고기온
    lowst_artmp = Column(Float)  # 최저기온
    hum = Column(Float)  # 습도
    widdir = Column(Float)  # 풍향
    wind = Column(Float)  # 풍속
    max_wind = Column(Float)  # 최대풍속
    rn = Column(Float)  # 강수량
    sun_time = Column(Float)  # 일조시간
    srqty = Column(Float)  # 일사량
    condens_time = Column(Float)  # 응축시간
    gr_temp = Column(Float)  # 지면온도
    soil_temp = Column(Float)  # 토양온도
    soil_wt = Column(Float)  # 토양습도
    created_at = Column(TIMESTAMP, server_default=func.now())


class WeatherDataDaily(Base):
    """일별 기상 데이터 테이블 모델"""
    __tablename__ = "weather_data_daily"

    id = Column(Integer, primary_key=True, index=True)
    no = Column(Integer)  # 순번
    stn_cd = Column(String(20), index=True)  # 관측소 코드
    stn_name = Column(String(100))  # 관측소명
    date = Column(Date, index=True)  # 관측일자
    temp = Column(Float)  # 평균기온
    hghst_artmp = Column(Float)  # 최고기온
    lowst_artmp = Column(Float)  # 최저기온
    hum = Column(Float)  # 평균습도
    widdir = Column(Float)  # 풍향
    wind = Column(Float)  # 평균풍속
    max_wind = Column(Float)  # 최대풍속
    rn = Column(Float)  # 강수량
    sun_time = Column(Float)  # 일조시간
    srqty = Column(Float)  # 일사량
    condens_time = Column(Float)  # 응축시간
    gr_temp = Column(Float)  # 지면온도
    soil_temp = Column(Float)  # 토양온도
    soil_wt = Column(Float)  # 토양습도
    created_at = Column(TIMESTAMP, server_default=func.now())


class WeatherDataMonthly(Base):
    """월별 기상 데이터 테이블 모델"""
    __tablename__ = "weather_data_monthly"

    id = Column(Integer, primary_key=True, index=True)
    no = Column(Integer)  # 순번
    stn_cd = Column(String(20), index=True)  # 관측소 코드
    stn_name = Column(String(100))  # 관측소명
    date = Column(String(7), index=True)  # 관측월 (YYYY-MM)
    temp = Column(Float)  # 평균기온
    hghst_artmp = Column(Float)  # 최고기온
    lowst_artmp = Column(Float)  # 최저기온
    hum = Column(Float)  # 평균습도
    widdir = Column(Float)  # 풍향
    wind = Column(Float)  # 평균풍속
    max_wind = Column(Float)  # 최대풍속
    rn = Column(Float)  # 강수량
    sun_time = Column(Float)  # 일조시간
    srqty = Column(Float)  # 일사량
    condens_time = Column(Float)  # 응축시간
    gr_temp = Column(Float)  # 지면온도
    soil_temp = Column(Float)  # 토양온도
    soil_wt = Column(Float)  # 토양습도
    created_at = Column(TIMESTAMP, server_default=func.now())
