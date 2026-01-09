# backend/app/schemas/__init__.py
from .common import PaginationParams, PaginatedResponse
from .kma import (
    AsosDailyResponse,
    WeatherRealtimeResponse,
    WeatherShortForecastResponse,
    WeatherMidForecastResponse,
)
from .rda import (
    WeatherDataResponse,
    WeatherDataDailyResponse,
    WeatherDataMonthlyResponse,
)

__all__ = [
    "PaginationParams",
    "PaginatedResponse",
    "AsosDailyResponse",
    "WeatherRealtimeResponse",
    "WeatherShortForecastResponse",
    "WeatherMidForecastResponse",
    "WeatherDataResponse",
    "WeatherDataDailyResponse",
    "WeatherDataMonthlyResponse",
]
