# backend/app/models/__init__.py
from .kma import AsosDailyData, WeatherRealtime, WeatherShortForecast, WeatherMidForecast
from .rda import WeatherData, WeatherDataDaily, WeatherDataMonthly

__all__ = [
    "AsosDailyData",
    "WeatherRealtime",
    "WeatherShortForecast",
    "WeatherMidForecast",
    "WeatherData",
    "WeatherDataDaily",
    "WeatherDataMonthly",
]
