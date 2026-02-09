import type { WeatherData, Region, ApiResponse, SelectedOptions } from '../types';
import { generateMockWeatherData, regions, mapMarkers } from '../data/mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// API 요청 기본 함수 (실제 API 연동 시 사용)
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      data: null as T,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// 기상 데이터 조회 (Mock)
export async function fetchWeatherData(
  _options: Partial<SelectedOptions>
): Promise<ApiResponse<WeatherData[]>> {
  // 실제 API가 준비되면 아래 코드 사용
  // return fetchApi<WeatherData[]>('/weather', {
  //   method: 'POST',
  //   body: JSON.stringify(options),
  // });

  // Mock 데이터 반환
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockData = generateMockWeatherData(30);
      resolve({
        success: true,
        data: mockData,
      });
    }, 500); // 로딩 시뮬레이션
  });
}

// 지역 목록 조회 (Mock)
export async function fetchRegions(): Promise<ApiResponse<Region[]>> {
  // 실제 API가 준비되면 아래 코드 사용
  // return fetchApi<Region[]>('/regions');

  // Mock 데이터 반환
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        data: regions,
      });
    }, 300);
  });
}

// 현재 기상 정보 조회 (Mock)
export async function fetchCurrentWeather(
  _regionId: string
): Promise<ApiResponse<WeatherData>> {
  // 실제 API가 준비되면 아래 코드 사용
  // return fetchApi<WeatherData>(`/weather/current/${regionId}`);

  // Mock 데이터 반환
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockData = generateMockWeatherData(1)[0];
      resolve({
        success: true,
        data: mockData,
      });
    }, 200);
  });
}

// 지도 마커 데이터 조회 (Mock)
export async function fetchMapMarkers(): Promise<ApiResponse<typeof mapMarkers>> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        data: mapMarkers,
      });
    }, 300);
  });
}

// CSV 다운로드
export function downloadCSV(data: WeatherData[], filename: string = 'weather_data.csv') {
  const headers = ['날짜', '시간', '기온(°C)', '습도(%)', '강수량(mm)', '풍속(m/s)', '풍향', '기압(hPa)', '일조(h)'];
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      [
        row.date,
        row.time,
        row.temperature,
        row.humidity,
        row.rainfall,
        row.windSpeed,
        row.windDirection,
        row.pressure,
        row.sunshine,
      ].join(',')
    ),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// Excel 다운로드 (간단한 CSV 형식)
export function downloadExcel(data: WeatherData[], filename: string = 'weather_data.xlsx') {
  // 실제 Excel 파일 생성은 xlsx 라이브러리 필요
  // 여기서는 CSV로 대체
  downloadCSV(data, filename.replace('.xlsx', '.csv'));
}
