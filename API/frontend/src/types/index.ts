// 기상 데이터 타입
export interface WeatherData {
  id: string;
  date: string;
  time: string;
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  windDirection: string;
  pressure: number;
  sunshine: number;
  cloudCover: number;
}

// 지역 정보 타입
export interface Region {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  province: string;
  city: string;
}

// 데이터 소스 타입
export type DataSource = 'RDA' | 'KMA';
export type DataCategory = 'current' | 'past' | 'forecast' | 'api';

// 선택된 옵션들
export interface SelectedOptions {
  dataSource: DataSource;
  dataCategory: DataCategory;
  region: Region | null;
  province: string;
  city: string;
  startDate: string;
  endDate: string;
  timeUnit: 'year' | 'month' | 'week' | 'day' | 'hour';
}

// 차트 데이터 타입
export interface ChartDataPoint {
  name: string;
  value: number;
  date?: string;
}

// 지도 마커 타입
export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  value: number;
  type: 'station' | 'farm';
  name: string;
}

// API 응답 타입
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// 테이블 컬럼 정의
export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
}

// 페이지네이션
export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

// 로딩 상태
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

// 선택 박스 옵션
export interface SelectOption {
  value: string;
  label: string;
}

// 기상 변수 타입
export type WeatherVariable =
  | 'temperature'
  | 'humidity'
  | 'rainfall'
  | 'windSpeed'
  | 'pressure'
  | 'sunshine';

export interface WeatherVariableConfig {
  key: WeatherVariable;
  label: string;
  unit: string;
  color: string;
}
