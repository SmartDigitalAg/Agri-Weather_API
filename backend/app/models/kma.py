# backend/app/models/kma.py
"""
KMA(기상청) 데이터 SQLAlchemy 모델
- ASOS 일자료, 초단기 실황, 단기예보, 중기예보 테이블
"""

from sqlalchemy import Column, Integer, String, Float, Date, Text, TIMESTAMP
from sqlalchemy.sql import func

from ..database import Base


class AsosDailyData(Base):
    """ASOS 일자료 테이블 모델"""
    __tablename__ = "asos_daily_data"

    id = Column(Integer, primary_key=True, index=True)
    stn_id = Column(Integer, nullable=False, index=True)  # 지점 ID
    stn_nm = Column(String(50))  # 지점명
    tm = Column(Date, nullable=False, index=True)  # 날짜
    avg_ta = Column(Float)  # 평균기온
    min_ta = Column(Float)  # 최저기온
    min_ta_hrmt = Column(String(4))  # 최저기온 시각
    max_ta = Column(Float)  # 최고기온
    max_ta_hrmt = Column(String(4))  # 최고기온 시각
    sum_rn = Column(Float)  # 일강수량
    avg_ws = Column(Float)  # 평균풍속
    avg_td = Column(Float)  # 평균이슬점온도
    min_rhm_hrmt = Column(String(4))  # 최저습도 시각
    avg_rhm = Column(Integer)  # 평균상대습도
    sum_ss_hr = Column(Float)  # 일조시간
    sum_gsr = Column(Float)  # 일사량
    dd_mes = Column(Float)  # 적설량
    avg_tca = Column(Float)  # 평균전운량
    avg_ts = Column(Float)  # 평균지면온도
    sum_lrg_ev = Column(Float)  # 대형증발량
    sum_sml_ev = Column(Float)  # 소형증발량
    n99_rn = Column(Float)  # 9-9강수량
    iscs = Column(Text)  # 일기현상
    created_at = Column(TIMESTAMP, server_default=func.now())


class WeatherRealtime(Base):
    """초단기 실황 테이블 모델"""
    __tablename__ = "weather_realtime"

    id = Column(Integer, primary_key=True, index=True)
    sido = Column(String(50), index=True)  # 시도 (도/광역시)
    region_name = Column(String(100), index=True)  # 지역명
    nx = Column(Integer)  # 격자 X
    ny = Column(Integer)  # 격자 Y
    base_date = Column(Date, index=True)  # 발표일자
    base_time = Column(String(4), index=True)  # 발표시각
    category = Column(String(10), index=True)  # 자료구분 (T1H, RN1, UUU 등)
    obsrvalue = Column(Float)  # 관측값
    created_at = Column(TIMESTAMP, server_default=func.now())


class WeatherShortForecast(Base):
    """단기예보 테이블 모델"""
    __tablename__ = "weather_short_forecast"

    id = Column(Integer, primary_key=True, index=True)
    region_name = Column(String(100), index=True)  # 지역명
    nx = Column(Integer)  # 격자 X
    ny = Column(Integer)  # 격자 Y
    base_date = Column(Date, index=True)  # 발표일자
    base_time = Column(String(4))  # 발표시각
    fcst_date = Column(Date, index=True)  # 예보일자
    fcst_time = Column(String(4))  # 예보시각
    category = Column(String(10), index=True)  # 자료구분
    fcst_value = Column(String(50))  # 예보값
    created_at = Column(TIMESTAMP, server_default=func.now())


class WeatherMidForecast(Base):
    """중기예보 테이블 모델"""
    __tablename__ = "weather_mid_forecast"

    id = Column(Integer, primary_key=True, index=True)
    reg_id = Column(String(20), index=True)  # 예보구역코드
    region_name = Column(String(100), index=True)  # 지역명
    tm_fc = Column(String(12))  # 발표시각
    forecast_date = Column(Date, index=True)  # 예보일자
    time_period = Column(String(10))  # 시간대 (Am, Pm, All)
    rain_prob = Column(Integer)  # 강수확률
    weather_condition = Column(String(50))  # 날씨상태
    temp_min = Column(Float)  # 최저기온
    temp_min_low = Column(Float)  # 최저기온 하한
    temp_min_high = Column(Float)  # 최저기온 상한
    temp_max = Column(Float)  # 최고기온
    temp_max_low = Column(Float)  # 최고기온 하한
    temp_max_high = Column(Float)  # 최고기온 상한
    created_at = Column(TIMESTAMP, server_default=func.now())
