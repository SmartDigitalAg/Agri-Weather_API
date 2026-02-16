# backend/app/routers/__init__.py
from .kma_asos import router as kma_asos_router
from .kma_asos import day_router as kma_day_router
from .kma_realtime import router as kma_realtime_router
from .kma_forecast import router as kma_forecast_router
from .rda_weather import router as rda_weather_router
from .rda_weather import day_router as rda_day_router
from .download import router as download_router
from .stats import router as stats_router

__all__ = [
    "kma_asos_router",
    "kma_day_router",
    "kma_realtime_router",
    "kma_forecast_router",
    "rda_weather_router",
    "rda_day_router",
    "download_router",
    "stats_router",
]
