import { useState, useEffect, useMemo } from 'react';
import * as d3 from 'd3-geo';
import geoData from '../components/MapVisualization/SIDO_MAP_2022.json';

const API_BASE_URL = 'http://weather-rda.digitalag.kr:8001';

// GeoJSON 타입 정의
interface GeoFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
  properties: {
    CTPRVN_CD: string;
    CTP_ENG_NM: string;
    CTP_KOR_NM: string;
  };
}

interface GeoData {
  type: string;
  features: GeoFeature[];
}

// 단기예보 데이터 인터페이스
interface ShortForecastData {
  id: number;
  region_name: string;
  nx: number;
  ny: number;
  base_date: string;
  base_time: string;
  fcst_date: string;
  fcst_time: string;
  category: string;
  fcst_value: string;
}

// 중기예보 데이터 인터페이스
interface MidForecastData {
  id: number;
  reg_id: string;
  region_name: string;
  tm_fc: string;
  forecast_date: string;
  time_period: string;
  rain_prob: number | null;
  weather_condition: string | null;
  temp_min: number | null;
  temp_max: number | null;
}

// 중기예보 지역 인터페이스
interface MidForecastRegion {
  reg_id: string;
  region_name: string;
  data_count: number;
}

// 지도에 표시할 위치 정보
interface ForecastLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  regionName: string; // API 조회용 지역명
}

// 단기예보 지역 인터페이스
interface ShortForecastRegion {
  region_name: string;
  data_count: number;
}

// 예보 위치 데이터 (6개 지역)
const forecastLocations: ForecastLocation[] = [
  { id: 'gwanak', name: '관악구', lat: 37.4674, lng: 126.9453, regionName: '관악구' },
  { id: 'yuseong', name: '유성구', lat: 36.3617, lng: 127.3561, regionName: '유성구' },
  { id: 'deokjin', name: '전주시덕진구', lat: 35.8383, lng: 127.1244, regionName: '전주시덕진구' },
  { id: 'dalseo', name: '달서구', lat: 35.8244, lng: 128.5389, regionName: '달서구' },
  { id: 'haeundae', name: '해운대구', lat: 35.1631, lng: 129.1635, regionName: '해운대구' },
  { id: 'gangneung', name: '강릉시', lat: 37.7206, lng: 128.7955, regionName: '강릉시' },
];

// 내일 날짜 계산
const getTomorrow = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
};

// 날짜 포맷팅 (YYYY-MM-DD)
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// 날짜 포맷팅 (YYYY년 MM월 DD일(요일))
const formatDateKorean = (date: Date): string => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  return `${year}년 ${month}월 ${day}일(${dayOfWeek})`;
};

// N일 후 날짜 계산
const getDateAfterDays = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

// 날씨 아이콘 결정 (SKY, PTY 기반)
const getWeatherIcon = (sky: number | null, pty: number | null): { icon: string; color: string; label: string } => {
  // SKY=1: 맑음 (해)
  if (sky === 1) {
    return { icon: '☀️', color: '#FFD700', label: '맑음' };
  }

  // SKY=3 or 4 (구름많음/흐림)
  if (sky === 3 || sky === 4) {
    // PTY=0: 강수 없음 (구름)
    if (pty === 0 || pty === null) {
      return { icon: '☁️', color: '#9CA3AF', label: '흐림' };
    }
    // PTY=1,4: 비
    if (pty === 1 || pty === 4) {
      return { icon: '🌧️', color: '#3B82F6', label: '비' };
    }
    // PTY=2,3: 눈
    if (pty === 2 || pty === 3) {
      return { icon: '❄️', color: '#93C5FD', label: '눈' };
    }
  }

  // 기본값: 구름
  return { icon: '☁️', color: '#9CA3AF', label: '흐림' };
};

// 날씨 상태 텍스트에서 아이콘 결정 (중기예보용)
const getWeatherIconFromCondition = (condition: string | null): { icon: string; label: string } => {
  if (!condition) return { icon: '☁️', label: '정보없음' };

  if (condition.includes('맑음')) return { icon: '☀️', label: condition };
  if (condition.includes('눈') || condition.includes('적설')) return { icon: '❄️', label: condition };
  if (condition.includes('비') || condition.includes('소나기')) return { icon: '🌧️', label: condition };
  if (condition.includes('구름많음')) return { icon: '⛅', label: condition };
  if (condition.includes('흐림') || condition.includes('흐리')) return { icon: '☁️', label: condition };

  return { icon: '☁️', label: condition };
};

const WeatherForecast = () => {
  // 단기예보 상태
  const [shortForecastRegions, setShortForecastRegions] = useState<ShortForecastRegion[]>([]);
  const [selectedShortRegion, setSelectedShortRegion] = useState<string>('');
  const [shortForecastData, setShortForecastData] = useState<ShortForecastData[]>([]);
  const [shortForecastLoading, setShortForecastLoading] = useState<boolean>(false);

  // 중기예보 상태
  const [midForecastRegions, setMidForecastRegions] = useState<MidForecastRegion[]>([]);
  const [selectedMidRegion, setSelectedMidRegion] = useState<string>('');
  const [midForecastData, setMidForecastData] = useState<MidForecastData[]>([]);
  const [midForecastLoading, setMidForecastLoading] = useState<boolean>(false);

  // 지도용 예보 데이터 (내일 기준)
  const [mapForecastData, setMapForecastData] = useState<Map<string, { sky: number | null; pty: number | null }>>(new Map());
  const [mapLoading, setMapLoading] = useState<boolean>(true);

  // 사용 가능한 지역 목록 (지도용)
  const [availableRegions, setAvailableRegions] = useState<Set<string>>(new Set());

  // SVG dimensions
  const width = 500;
  const height = 550;

  // 타입 캐스팅
  const koreaGeoData = geoData as GeoData;

  // D3 projection for Korea
  const projection = useMemo(() => {
    return d3.geoMercator()
      .center([127.5, 36.0])
      .scale(4500)
      .translate([width / 2, height / 2 - 20]);
  }, []);

  // Path generator
  const pathGenerator = useMemo(() => {
    return d3.geoPath().projection(projection);
  }, [projection]);

  // Convert lat/lng to SVG coordinates
  const latLngToXY = (lat: number, lng: number) => {
    const projected = projection([lng, lat]);
    return projected ? { x: projected[0], y: projected[1] } : { x: 0, y: 0 };
  };

  // 내일 날짜
  const tomorrow = getTomorrow();
  const tomorrowStr = formatDate(tomorrow);

  // 단기예보 지역 목록 로드
  useEffect(() => {
    const fetchShortRegions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/kma/forecast/short/regions`);
        if (response.ok) {
          const data: ShortForecastRegion[] = await response.json();
          setShortForecastRegions(data);
          setAvailableRegions(new Set(data.map(r => r.region_name)));
          if (data.length > 0) {
            setSelectedShortRegion(data[0].region_name);
          }
        }
      } catch (err) {
        console.error('단기예보 지역 목록 로드 실패:', err);
      }
    };
    fetchShortRegions();
  }, []);

  // 지도용 예보 데이터 로드 (6개 지역의 내일 예보)
  useEffect(() => {
    if (availableRegions.size === 0) return;

    const fetchMapForecastData = async () => {
      setMapLoading(true);
      const forecastMap = new Map<string, { sky: number | null; pty: number | null }>();

      for (const location of forecastLocations) {
        // 해당 지역이 데이터베이스에 있는지 확인
        if (!availableRegions.has(location.regionName)) {
          console.log(`${location.name} 지역 데이터 없음`);
          continue;
        }

        try {
          const response = await fetch(
            `${API_BASE_URL}/api/kma/forecast/short/latest?region_name=${encodeURIComponent(location.regionName)}&limit=100`
          );
          if (response.ok) {
            const forecasts: ShortForecastData[] = await response.json();

            // 내일 12시 예보 찾기
            const tomorrowForecast = forecasts.filter(f =>
              f.fcst_date === tomorrowStr && f.fcst_time === '1200'
            );

            const skyData = tomorrowForecast.find(f => f.category === 'SKY');
            const ptyData = tomorrowForecast.find(f => f.category === 'PTY');

            forecastMap.set(location.id, {
              sky: skyData ? parseInt(skyData.fcst_value) : null,
              pty: ptyData ? parseInt(ptyData.fcst_value) : null
            });
          }
        } catch (err) {
          console.error(`${location.name} 예보 로드 실패:`, err);
        }
      }

      setMapForecastData(forecastMap);
      setMapLoading(false);
    };

    fetchMapForecastData();
  }, [tomorrowStr, availableRegions]);

  // 중기예보 지역 목록 로드
  useEffect(() => {
    const fetchMidRegions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/kma/forecast/mid/regions`);
        if (response.ok) {
          const data: MidForecastRegion[] = await response.json();
          setMidForecastRegions(data);
          if (data.length > 0) {
            setSelectedMidRegion(data[0].region_name);
          }
        }
      } catch (err) {
        console.error('중기예보 지역 목록 로드 실패:', err);
      }
    };
    fetchMidRegions();
  }, []);

  // 단기예보 데이터 로드
  useEffect(() => {
    if (!selectedShortRegion) return;

    const fetchShortForecast = async () => {
      setShortForecastLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/kma/forecast/short/latest?region_name=${encodeURIComponent(selectedShortRegion)}&limit=100`
        );
        if (response.ok) {
          const data: ShortForecastData[] = await response.json();
          setShortForecastData(data);
        }
      } catch (err) {
        console.error('단기예보 로드 실패:', err);
      } finally {
        setShortForecastLoading(false);
      }
    };

    fetchShortForecast();
  }, [selectedShortRegion]);

  // 중기예보 데이터 로드
  useEffect(() => {
    if (!selectedMidRegion) return;

    const fetchMidForecast = async () => {
      setMidForecastLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/kma/forecast/mid/latest?region_name=${encodeURIComponent(selectedMidRegion)}&limit=50`
        );
        if (response.ok) {
          const data: MidForecastData[] = await response.json();
          setMidForecastData(data);
        }
      } catch (err) {
        console.error('중기예보 로드 실패:', err);
      } finally {
        setMidForecastLoading(false);
      }
    };

    fetchMidForecast();
  }, [selectedMidRegion]);

  // 단기예보 일별 데이터 그룹핑 (3일간)
  const shortForecastByDay = useMemo(() => {
    const days: { date: Date; dateStr: string; data: Record<string, string> }[] = [];

    for (let i = 1; i <= 3; i++) {
      const date = getDateAfterDays(i);
      const dateStr = formatDate(date);

      // 해당 날짜의 12시 예보 데이터 필터링
      const dayForecasts = shortForecastData.filter(f =>
        f.fcst_date === dateStr && f.fcst_time === '1200'
      );

      const data: Record<string, string> = {};
      dayForecasts.forEach(f => {
        data[f.category] = f.fcst_value;
      });

      days.push({ date, dateStr, data });
    }

    return days;
  }, [shortForecastData]);

  // 중기예보 일별 데이터 그룹핑 (4~7일 후)
  const midForecastByDay = useMemo(() => {
    const days: { date: Date; dateStr: string; am: MidForecastData | null; pm: MidForecastData | null }[] = [];

    for (let i = 4; i <= 7; i++) {
      const date = getDateAfterDays(i);
      const dateStr = formatDate(date);

      const dayForecasts = midForecastData.filter(f => f.forecast_date === dateStr);
      const amForecast = dayForecasts.find(f => f.time_period === 'Am') || null;
      const pmForecast = dayForecasts.find(f => f.time_period === 'Pm') || null;

      days.push({ date, dateStr, am: amForecast, pm: pmForecast });
    }

    return days;
  }, [midForecastData]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Page Title */}
      <h2 className="text-base font-medium text-gray-600">기상예보</h2>

      {/* Main Content: Map | Data Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Map Section */}
        <div className="bg-white rounded-xl shadow-lg p-4 h-full flex flex-col">
          {/* 내일 날짜 표시 */}
          <div className="text-center mb-3">
            <span className="text-sm font-semibold text-gray-800 bg-blue-50 px-3 py-1 rounded-full">
              {formatDateKorean(tomorrow)} 기상예보
            </span>
          </div>

          {/* 범례 */}
          <div className="flex items-center justify-center gap-3 mb-3 text-xs flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-base">☀️</span>
              <span className="text-gray-600">맑음</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-base">☁️</span>
              <span className="text-gray-600">흐림</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-base">🌧️</span>
              <span className="text-gray-600">비</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-base">❄️</span>
              <span className="text-gray-600">눈</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-base">❓</span>
              <span className="text-gray-400">데이터없음</span>
            </div>
          </div>

          {/* 지도 */}
          <div className="flex-1 relative bg-gradient-to-b from-sky-50 to-sky-100 rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
            {mapLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                <div className="text-gray-500 text-sm">예보 데이터 로딩 중...</div>
              </div>
            )}
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Background sea */}
              <rect x="0" y="0" width={width} height={height} fill="#bae6fd" />

              {/* Province fills */}
              {koreaGeoData.features.map((feature, index) => {
                const geometry = {
                  type: feature.geometry.type,
                  coordinates: feature.geometry.coordinates
                };
                const path = pathGenerator(geometry as d3.GeoPermissibleObjects);

                if (!path) return null;

                return (
                  <path
                    key={`fill-${feature.properties.CTPRVN_CD || index}`}
                    d={path}
                    fill="#d1fae5"
                    stroke="none"
                  />
                );
              })}

              {/* Province strokes */}
              {koreaGeoData.features.map((feature, index) => {
                const geometry = {
                  type: feature.geometry.type,
                  coordinates: feature.geometry.coordinates
                };
                const path = pathGenerator(geometry as d3.GeoPermissibleObjects);

                if (!path) return null;

                return (
                  <path
                    key={`stroke-${feature.properties.CTPRVN_CD || index}`}
                    d={path}
                    fill="none"
                    stroke="#065f46"
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                );
              })}

              {/* Weather icons for each location */}
              {forecastLocations.map((location) => {
                const { x, y } = latLngToXY(location.lat, location.lng);
                const forecastInfo = mapForecastData.get(location.id);
                const hasData = availableRegions.has(location.regionName);

                let weather;
                if (!hasData) {
                  weather = { icon: '❓', color: '#9CA3AF', label: '데이터없음' };
                } else if (forecastInfo) {
                  weather = getWeatherIcon(forecastInfo.sky, forecastInfo.pty);
                } else {
                  weather = { icon: '⏳', color: '#9CA3AF', label: '로딩중' };
                }

                return (
                  <g key={location.id}>
                    {/* Background circle */}
                    <circle
                      cx={x}
                      cy={y}
                      r={20}
                      fill={hasData ? "white" : "#f3f4f6"}
                      stroke={hasData ? "#e5e7eb" : "#d1d5db"}
                      strokeWidth={1}
                      opacity={0.9}
                    />
                    {/* Weather icon */}
                    <text
                      x={x}
                      y={y + 5}
                      textAnchor="middle"
                      fontSize="20"
                      className="select-none"
                    >
                      {weather.icon}
                    </text>
                    {/* Location name */}
                    <text
                      x={x}
                      y={y + 32}
                      textAnchor="middle"
                      fontSize="10"
                      fill={hasData ? "#374151" : "#9ca3af"}
                      fontWeight="500"
                      className="select-none"
                    >
                      {location.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* 지역 목록 */}
          <div className="mt-3 text-xs text-gray-500 text-center">
            {forecastLocations.map(loc => loc.name).join(' | ')}
          </div>
        </div>

        {/* Data Section */}
        <div className="flex flex-col gap-4">
          {/* 단기예보 섹션 */}
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-800">기상청 단기예보</h3>
              <select
                value={selectedShortRegion}
                onChange={(e) => setSelectedShortRegion(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={shortForecastRegions.length === 0}
              >
                {shortForecastRegions.length === 0 ? (
                  <option value="">지역 로딩 중...</option>
                ) : (
                  shortForecastRegions.map(region => (
                    <option key={region.region_name} value={region.region_name}>{region.region_name}</option>
                  ))
                )}
              </select>
            </div>

            {shortForecastLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">로딩 중...</div>
            ) : shortForecastByDay.length === 0 || Object.keys(shortForecastByDay[0]?.data || {}).length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">데이터가 없습니다.</div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {shortForecastByDay.map(({ date, data }) => {
                  const sky = data['SKY'] ? parseInt(data['SKY']) : null;
                  const pty = data['PTY'] ? parseInt(data['PTY']) : null;
                  const weather = getWeatherIcon(sky, pty);

                  return (
                    <div key={date.toISOString()} className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        {date.getMonth() + 1}/{date.getDate()}({['일','월','화','수','목','금','토'][date.getDay()]})
                      </div>
                      <div className="text-3xl mb-2">{weather.icon}</div>
                      <div className="text-xs text-gray-600 mb-2">{weather.label}</div>
                      <div className="space-y-1 text-xs">
                        {data['TMP'] && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">기온</span>
                            <span className="font-medium">{data['TMP']}°C</span>
                          </div>
                        )}
                        {(data['TMN'] || data['TMX']) && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">최저/최고</span>
                            <span className="font-medium text-blue-600">{data['TMN'] || '-'}</span>
                            <span>/</span>
                            <span className="font-medium text-red-600">{data['TMX'] || '-'}</span>
                          </div>
                        )}
                        {data['POP'] && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">강수확률</span>
                            <span className="font-medium">{data['POP']}%</span>
                          </div>
                        )}
                        {data['REH'] && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">습도</span>
                            <span className="font-medium">{data['REH']}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 중기예보 섹션 */}
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-800">기상청 중기예보</h3>
              <select
                value={selectedMidRegion}
                onChange={(e) => setSelectedMidRegion(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={midForecastRegions.length === 0}
              >
                {midForecastRegions.length === 0 ? (
                  <option value="">지역 로딩 중...</option>
                ) : (
                  midForecastRegions.map(region => (
                    <option key={region.reg_id} value={region.region_name}>{region.region_name}</option>
                  ))
                )}
              </select>
            </div>

            {midForecastLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">로딩 중...</div>
            ) : midForecastByDay.length === 0 || (!midForecastByDay[0]?.am && !midForecastByDay[0]?.pm) ? (
              <div className="text-center py-8 text-gray-500 text-sm">데이터가 없습니다.</div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {midForecastByDay.map(({ date, am, pm }) => {
                  const amWeather = getWeatherIconFromCondition(am?.weather_condition || null);
                  const pmWeather = getWeatherIconFromCondition(pm?.weather_condition || null);

                  return (
                    <div key={date.toISOString()} className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        {date.getMonth() + 1}/{date.getDate()}({['일','월','화','수','목','금','토'][date.getDay()]})
                      </div>

                      {/* 오전 */}
                      <div className="mb-2">
                        <div className="text-xs text-gray-400 mb-1">오전</div>
                        <div className="text-2xl">{amWeather.icon}</div>
                        <div className="text-xs text-gray-600 truncate" title={amWeather.label}>
                          {am?.weather_condition || '-'}
                        </div>
                        {am && am.rain_prob !== null && (
                          <div className="text-xs text-blue-600">{am.rain_prob}%</div>
                        )}
                      </div>

                      {/* 오후 */}
                      <div>
                        <div className="text-xs text-gray-400 mb-1">오후</div>
                        <div className="text-2xl">{pmWeather.icon}</div>
                        <div className="text-xs text-gray-600 truncate" title={pmWeather.label}>
                          {pm?.weather_condition || '-'}
                        </div>
                        {pm && pm.rain_prob !== null && (
                          <div className="text-xs text-blue-600">{pm.rain_prob}%</div>
                        )}
                      </div>

                      {/* 기온 */}
                      {(am?.temp_min !== null || am?.temp_max !== null) && (
                        <div className="mt-2 pt-2 border-t border-gray-200 text-xs">
                          <span className="text-blue-600">{am?.temp_min ?? '-'}°</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-red-600">{am?.temp_max ?? '-'}°</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherForecast;
