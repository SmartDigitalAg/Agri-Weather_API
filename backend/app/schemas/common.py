# backend/app/schemas/common.py
"""
공통 Pydantic 스키마
- 페이지네이션, 공통 응답 형식 등
"""

from typing import Optional, List, Any
from pydantic import BaseModel, Field


class PaginationParams(BaseModel):
    """페이지네이션 파라미터"""
    offset: int = Field(default=0, ge=0, description="건너뛸 레코드 수")
    limit: int = Field(default=20, ge=1, le=100, description="조회할 레코드 수 (최대 100)")


class PaginatedResponse(BaseModel):
    """페이지네이션 응답 형식"""
    total: int = Field(description="전체 레코드 수")
    offset: int = Field(description="현재 오프셋")
    limit: int = Field(description="페이지 크기")
    data: List[Any] = Field(description="데이터 목록")

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    """통계 응답 형식"""
    count: int = Field(description="데이터 개수")
    avg_temp: Optional[float] = Field(default=None, description="평균기온")
    max_temp: Optional[float] = Field(default=None, description="최고기온")
    min_temp: Optional[float] = Field(default=None, description="최저기온")
    total_rainfall: Optional[float] = Field(default=None, description="총 강수량")
    avg_humidity: Optional[float] = Field(default=None, description="평균습도")

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    """메시지 응답 형식"""
    message: str = Field(description="응답 메시지")
    detail: Optional[str] = Field(default=None, description="상세 내용")
