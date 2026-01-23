import { useState, useEffect, useMemo } from 'react';
import MapVisualization from '../components/MapVisualization';
import type { WeatherCardMarker } from '../components/MapVisualization';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const API_BASE_URL = 'http://weather-rda.digitalag.kr:8001';

// RDA 지도에 표시할 6개 도 목록
const RDA_TARGET_PROVINCES = ['경기도', '경상북도', '충청남도', '충청북도', '강원특별자치도', '전북특별자치도'];

// RDA 각 도의 중심 좌표 (카드 표시 위치) - 겹치지 않게 조정
const RDA_PROVINCE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  '경기도': { lat: 37.55, lng: 127.15 },
  '경상북도': { lat: 36.30, lng: 128.90 },
  '충청남도': { lat: 36.50, lng: 126.75 },
  '충청북도': { lat: 36.85, lng: 127.70 },
  '강원특별자치도': { lat: 37.70, lng: 128.50 },
  '전북특별자치도': { lat: 35.70, lng: 127.00 },
};

// KMA 지도에 표시할 도 목록
const KMA_TARGET_SIDOS = ['경기도', '경상북도', '경상남도', '충청남도', '충청북도', '강원특별자치도', '전북특별자치도', '전라남도'];

// KMA 각 도의 중심 좌표 (카드 표시 위치)
const KMA_SIDO_COORDINATES: Record<string, { lat: number; lng: number }> = {
  '경기도': { lat: 37.55, lng: 127.15 },
  '경상북도': { lat: 36.30, lng: 128.90 },
  '경상남도': { lat: 35.35, lng: 128.30 },
  '충청남도': { lat: 36.50, lng: 126.75 },
  '충청북도': { lat: 36.85, lng: 127.70 },
  '강원특별자치도': { lat: 37.70, lng: 128.50 },
  '전북특별자치도': { lat: 35.70, lng: 127.00 },
  '전라남도': { lat: 34.90, lng: 126.90 },
};

// 풍향 각도를 방향 문자로 변환
const getWindDirection = (degree: number | null | undefined): string => {
  if (degree === null || degree === undefined) return '-';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degree / 22.5) % 16;
  return directions[index];
};

// 날짜/시간 포맷팅
const formatDateTime = (dateStr: string | null | undefined, timeStr?: string): string => {
  if (!dateStr) return '-';

  try {
    let date: Date;
    if (timeStr) {
      // KMA 형식: base_date (YYYY-MM-DD), base_time (HHmm)
      const hours = timeStr.padStart(4, '0').slice(0, 2);
      const minutes = timeStr.padStart(4, '0').slice(2, 4);
      date = new Date(`${dateStr}T${hours}:${minutes}:00`);
    } else {
      // RDA 형식: datetime (ISO string)
      date = new Date(dateStr);
    }

    // Invalid Date 체크
    if (isNaN(date.getTime())) {
      return timeStr ? `${dateStr} ${timeStr.slice(0,2)}:${timeStr.slice(2,4)}` : dateStr;
    }

    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

// RDA 기상 데이터 타입
interface RdaWeatherData {
  stn_cd: string;
  stn_name: string;
  province: string | null;
  datetime: string;
  temp: number | null;
  hum: number | null;
  wind: number | null;
  widdir: number | null;
  rn: number | null;
  created_at: string | null;
}

// KMA 기상 데이터 타입 (피벗)
interface KmaWeatherData {
  sido: string | null;
  region_name: string;
  base_date: string;
  base_time: string;
  T1H: number | null;  // 기온
  RN1: number | null;  // 강수량
  REH: number | null;  // 습도
  VEC: number | null;  // 풍향
  WSD: number | null;  // 풍속
}

// KMA 실시간 원본 데이터 타입
interface KmaRealtimeData {
  id: number;
  stn_id: string;
  region_name: string;
  tm: string;
  ta: number | null;
  rn: number | null;
  ws: number | null;
  wd: number | null;
  hm: number | null;
  pa: number | null;
}

// RDA 관측소 타입
interface RdaStation {
  province: string | null;
  stn_cd: string;
  stn_name: string;
}

// KMA 지역 타입
interface KmaRegion {
  sido: string | null;
  region_name: string;
  nx: number;
  ny: number;
}

// 차트 데이터 타입
interface ChartDataPoint {
  time: string;
  hour: number;
  temperature: number | null;
  humidity: number | null;
}

// ===== 오늘의 기온/습도 차트 컴포넌트 =====
interface TodayChartProps {
  data: ChartDataPoint[];
  title: string;
}

const TodayWeatherChart: React.FC<TodayChartProps> = ({ data, title }) => {
  if (data.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 h-48 flex items-center justify-center">
        <p className="text-gray-400 text-sm">오늘의 데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <h4 className="text-xs font-medium text-gray-600 mb-2">{title}</h4>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#e0e0e0' }}
          />
          <YAxis
            yAxisId="temp"
            orientation="left"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#e0e0e0' }}
            domain={['auto', 'auto']}
            label={{ value: '°C', position: 'top', offset: -5, fontSize: 10 }}
          />
          <YAxis
            yAxisId="hum"
            orientation="right"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#e0e0e0' }}
            domain={[0, 100]}
            label={{ value: '%', position: 'top', offset: -5, fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, padding: '4px 8px' }}
            formatter={(value, name) => [
              typeof value === 'number' ? value.toFixed(1) : '-',
              name === 'temperature' ? '기온(°C)' : '습도(%)'
            ]}
            labelFormatter={(label) => `${label}시`}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
            formatter={(value) => String(value) === 'temperature' ? '기온' : '습도'}
          />
          <Bar
            yAxisId="hum"
            dataKey="humidity"
            fill="#93c5fd"
            opacity={0.6}
            radius={[2, 2, 0, 0]}
            name="humidity"
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temperature"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 3, fill: '#f97316' }}
            name="temperature"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// ===== RDA 기상 섹션 컴포넌트 =====
const RdaWeatherSection: React.FC = () => {
  const [provinces, setProvinces] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [stations, setStations] = useState<RdaStation[]>([]);
  const [filteredStations, setFilteredStations] = useState<RdaStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [weatherData, setWeatherData] = useState<RdaWeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialDataMap, setInitialDataMap] = useState<Map<string, RdaWeatherData>>(new Map());
  const [provinceRepStations, setProvinceRepStations] = useState<Map<string, RdaWeatherData>>(new Map());

  // 실시간 데이터에서 관측소 목록 추출 및 도 목록 생성
  useEffect(() => {
    const fetchRealtimeData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/rda/weather/realtime/latest?limit=500`);
        if (response.ok) {
          const data: RdaWeatherData[] = await response.json();
          if (data.length > 0) {
            // 고유 관측소 목록 및 데이터 맵 생성
            const stationMap = new Map<string, RdaStation>();
            const dataMap = new Map<string, RdaWeatherData>();
            const provinceSet = new Set<string>();

            // 6개 도의 대표 관측소 데이터 (각 도에서 첫 번째 관측소)
            const repStationMap = new Map<string, RdaWeatherData>();

            data.forEach(item => {
              if (!stationMap.has(item.stn_cd)) {
                stationMap.set(item.stn_cd, {
                  province: item.province,
                  stn_cd: item.stn_cd,
                  stn_name: item.stn_name
                });
                dataMap.set(item.stn_cd, item);
                if (item.province) {
                  provinceSet.add(item.province);
                  // 6개 대상 도에 해당하고, 아직 대표 관측소가 없으면 추가
                  if (RDA_TARGET_PROVINCES.includes(item.province) && !repStationMap.has(item.province)) {
                    repStationMap.set(item.province, item);
                  }
                }
              }
            });

            const uniqueStations = Array.from(stationMap.values());
            const uniqueProvinces = Array.from(provinceSet).sort();

            setStations(uniqueStations);
            setProvinces(uniqueProvinces);
            setInitialDataMap(dataMap);
            setProvinceRepStations(repStationMap);

            // 첫 번째 도 선택
            if (uniqueProvinces.length > 0) {
              const firstProvince = uniqueProvinces[0];
              setSelectedProvince(firstProvince);

              // 해당 도의 관측소 필터링
              const filtered = uniqueStations.filter(s => s.province === firstProvince);
              setFilteredStations(filtered);

              // 첫 번째 관측소 선택 및 데이터 설정
              if (filtered.length > 0) {
                setSelectedStation(filtered[0].stn_cd);
                const firstData = dataMap.get(filtered[0].stn_cd);
                if (firstData) {
                  setWeatherData(firstData);
                }
              }
            }
          } else {
            setError('데이터가 없습니다');
          }
        }
      } catch (err) {
        console.error('RDA 기상 데이터 조회 실패:', err);
        setError('데이터 조회 실패');
      } finally {
        setLoading(false);
      }
    };
    fetchRealtimeData();
  }, []);

  // 지도에 표시할 카드 마커 생성
  const weatherCards: WeatherCardMarker[] = useMemo(() => {
    const cards: WeatherCardMarker[] = [];
    provinceRepStations.forEach((data, province) => {
      const coords = RDA_PROVINCE_COORDINATES[province];
      if (coords && data.temp !== null) {
        cards.push({
          id: data.stn_cd,
          name: data.stn_name,
          temperature: data.temp,
          latitude: coords.lat,
          longitude: coords.lng,
        });
      }
    });
    return cards;
  }, [provinceRepStations]);

  // 카드 클릭 핸들러 - 해당 지역 기상 데이터로 변경
  const handleWeatherCardClick = (card: WeatherCardMarker) => {
    const data = initialDataMap.get(card.id);
    if (data) {
      // 해당 도 선택
      if (data.province) {
        setSelectedProvince(data.province);
        // 해당 도의 관측소 필터링
        const filtered = stations.filter(s => s.province === data.province);
        setFilteredStations(filtered);
      }
      // 해당 관측소 선택
      setSelectedStation(card.id);
      setWeatherData(data);
    }
  };

  // 도 선택 변경 핸들러
  const handleProvinceChange = (newProvince: string) => {
    if (!newProvince || newProvince === selectedProvince) return;

    setSelectedProvince(newProvince);

    // 해당 도의 관측소 필터링
    const filtered = stations.filter(s => s.province === newProvince);
    setFilteredStations(filtered);

    // 첫 번째 관측소 선택
    if (filtered.length > 0) {
      const firstStation = filtered[0];
      setSelectedStation(firstStation.stn_cd);

      const cachedData = initialDataMap.get(firstStation.stn_cd);
      if (cachedData) {
        setWeatherData(cachedData);
      }
    } else {
      setSelectedStation('');
      setWeatherData(null);
    }
  };

  // 관측소 선택 변경 핸들러
  const handleStationChange = async (newStation: string) => {
    if (!newStation || newStation === selectedStation) return;

    setSelectedStation(newStation);

    // 초기 데이터 맵에서 먼저 확인 (캐시된 데이터 사용)
    const cachedData = initialDataMap.get(newStation);
    if (cachedData) {
      setWeatherData(cachedData);
      return;
    }

    // 캐시에 없으면 API 호출
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rda/weather/realtime/latest?stn_cd=${newStation}&limit=1`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setWeatherData(data[0]);
        } else {
          setWeatherData(null);
          setError('데이터가 없습니다');
        }
      } else {
        setError('데이터 조회 실패');
      }
    } catch (err) {
      console.error('RDA 기상 데이터 조회 실패:', err);
      setError('데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <h3 className="text-base font-semibold text-gray-800 mb-3">국립농업과학원(RDA)</h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Data Section */}
        <div className="lg:col-span-2 flex flex-col">
          {/* 도/시군구 선택 */}
          <div className="flex gap-2 mb-2">
            <select
              value={selectedProvince}
              onChange={(e) => handleProvinceChange(e.target.value)}
              className="w-1/3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
            >
              <option value="">도 선택</option>
              {provinces.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
            <select
              value={selectedStation}
              onChange={(e) => handleStationChange(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
            >
              <option value="">시군구 선택</option>
              {filteredStations.map((station) => (
                <option key={station.stn_cd} value={station.stn_cd}>
                  {station.stn_name}
                </option>
              ))}
            </select>
          </div>

          {/* 업데이트 시각 */}
          <p className="text-xs text-gray-500 mb-3">
            업데이트: {weatherData?.datetime ? formatDateTime(weatherData.datetime) : '-'}
          </p>

          {/* 기상 데이터 카드 */}
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-gray-500">로딩 중...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-red-500">{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {/* 기온 */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 text-center">
                <p className="text-xs text-orange-600 mb-1">기온</p>
                <p className="text-2xl font-bold text-orange-700">
                  {weatherData?.temp?.toFixed(1) ?? '-'}
                </p>
                <p className="text-xs text-orange-500">°C</p>
              </div>

              {/* 습도 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 mb-1">습도</p>
                <p className="text-2xl font-bold text-blue-700">
                  {weatherData?.hum?.toFixed(0) ?? '-'}
                </p>
                <p className="text-xs text-blue-500">%</p>
              </div>

              {/* 강수량 */}
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-3 text-center">
                <p className="text-xs text-cyan-600 mb-1">강수량</p>
                <p className="text-2xl font-bold text-cyan-700">
                  {weatherData?.rn?.toFixed(1) ?? '-'}
                </p>
                <p className="text-xs text-cyan-500">mm</p>
              </div>

              {/* 풍속 */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 text-center">
                <p className="text-xs text-green-600 mb-1">풍속</p>
                <p className="text-2xl font-bold text-green-700">
                  {weatherData?.wind?.toFixed(1) ?? '-'}
                </p>
                <p className="text-xs text-green-500">m/s</p>
              </div>

              {/* 풍향 */}
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-3 text-center">
                <p className="text-xs text-teal-600 mb-1">풍향</p>
                <p className="text-2xl font-bold text-teal-700">
                  {getWindDirection(weatherData?.widdir)}
                </p>
                <p className="text-xs text-teal-500">&nbsp;</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Map */}
        <div className="lg:col-span-1 min-h-[200px]">
          <MapVisualization
            markers={[]}
            weatherCards={weatherCards}
            onWeatherCardClick={handleWeatherCardClick}
            selectedCardId={selectedStation}
          />
        </div>
      </div>
    </div>
  );
};

// ===== KMA 기상 섹션 컴포넌트 =====
const KmaWeatherSection: React.FC = () => {
  const [sidos, setSidos] = useState<string[]>([]);
  const [selectedSido, setSelectedSido] = useState<string>('');
  const [regions, setRegions] = useState<KmaRegion[]>([]);
  const [filteredRegions, setFilteredRegions] = useState<KmaRegion[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [weatherData, setWeatherData] = useState<KmaWeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialDataMap, setInitialDataMap] = useState<Map<string, KmaWeatherData>>(new Map());
  const [sidoRepRegions, setSidoRepRegions] = useState<Map<string, KmaWeatherData>>(new Map());
  const [todayChartData, setTodayChartData] = useState<ChartDataPoint[]>([]);

  // 실시간 데이터에서 지역 목록 추출 및 시도 목록 생성
  useEffect(() => {
    const fetchRealtimeData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/kma/realtime/latest/pivot?limit=500`);
        if (response.ok) {
          const data: KmaWeatherData[] = await response.json();
          if (data.length > 0) {
            // 고유 지역 목록 및 데이터 맵 생성
            const regionMap = new Map<string, KmaRegion>();
            const dataMap = new Map<string, KmaWeatherData>();
            const sidoSet = new Set<string>();

            // 시도별 대표 지역 데이터 (각 시도에서 첫 번째 지역)
            const repRegionMap = new Map<string, KmaWeatherData>();

            data.forEach(item => {
              if (!regionMap.has(item.region_name)) {
                regionMap.set(item.region_name, {
                  sido: item.sido,
                  region_name: item.region_name,
                  nx: 0,
                  ny: 0
                });
                dataMap.set(item.region_name, item);
                if (item.sido) {
                  sidoSet.add(item.sido);
                  // 대상 시도에 해당하고, 아직 대표 지역이 없으면 추가
                  if (KMA_TARGET_SIDOS.includes(item.sido) && !repRegionMap.has(item.sido)) {
                    repRegionMap.set(item.sido, item);
                  }
                }
              }
            });

            const uniqueRegions = Array.from(regionMap.values());
            const uniqueSidos = Array.from(sidoSet).sort();

            setRegions(uniqueRegions);
            setSidos(uniqueSidos);
            setInitialDataMap(dataMap);
            setSidoRepRegions(repRegionMap);

            // 첫 번째 시도 선택
            if (uniqueSidos.length > 0) {
              const firstSido = uniqueSidos[0];
              setSelectedSido(firstSido);

              // 해당 시도의 지역 필터링
              const filtered = uniqueRegions.filter(r => r.sido === firstSido);
              setFilteredRegions(filtered);

              // 첫 번째 지역 선택 및 데이터 설정
              if (filtered.length > 0) {
                setSelectedRegion(filtered[0].region_name);
                const firstData = dataMap.get(filtered[0].region_name);
                if (firstData) {
                  setWeatherData(firstData);
                }
              }
            }
          } else {
            setError('데이터가 없습니다');
          }
        }
      } catch (err) {
        console.error('KMA 기상 데이터 조회 실패:', err);
        setError('데이터 조회 실패');
      } finally {
        setLoading(false);
      }
    };
    fetchRealtimeData();
  }, []);

  // 선택된 지역의 오늘 데이터 가져오기
  useEffect(() => {
    if (!selectedRegion) return;

    const fetchTodayData = async () => {
      try {
        // 오늘 날짜 계산
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const currentHour = today.getHours();

        // KMA 실시간 데이터에서 해당 지역의 오늘 데이터 가져오기
        const response = await fetch(
          `${API_BASE_URL}/api/kma/realtime/region/${encodeURIComponent(selectedRegion)}/range?start_date=${todayStr}&end_date=${todayStr}&limit=100`
        );

        if (response.ok) {
          const result = await response.json();
          const data: KmaRealtimeData[] = result.data || result;

          // 시간별로 그룹화 (같은 시간대의 마지막 데이터 사용)
          const hourlyMap = new Map<number, KmaRealtimeData>();
          data.forEach(item => {
            const hour = new Date(item.tm).getHours();
            if (hour <= currentHour) {
              hourlyMap.set(hour, item);
            }
          });

          // 차트 데이터 생성 (0시부터 현재시간까지)
          const chartData: ChartDataPoint[] = [];
          for (let h = 0; h <= currentHour; h++) {
            const hourData = hourlyMap.get(h);
            chartData.push({
              time: String(h).padStart(2, '0'),
              hour: h,
              temperature: hourData?.ta ?? null,
              humidity: hourData?.hm ?? null,
            });
          }

          setTodayChartData(chartData);
        }
      } catch (err) {
        console.error('KMA 오늘 데이터 조회 실패:', err);
        setTodayChartData([]);
      }
    };

    fetchTodayData();
  }, [selectedRegion]);

  // 지도에 표시할 카드 마커 생성
  const weatherCards: WeatherCardMarker[] = useMemo(() => {
    const cards: WeatherCardMarker[] = [];
    sidoRepRegions.forEach((data, sido) => {
      const coords = KMA_SIDO_COORDINATES[sido];
      if (coords && data.T1H !== null) {
        cards.push({
          id: data.region_name,
          name: data.region_name,
          temperature: data.T1H,
          latitude: coords.lat,
          longitude: coords.lng,
        });
      }
    });
    return cards;
  }, [sidoRepRegions]);

  // 카드 클릭 핸들러 - 해당 지역 기상 데이터로 변경
  const handleWeatherCardClick = (card: WeatherCardMarker) => {
    const data = initialDataMap.get(card.id);
    if (data) {
      // 해당 시도 선택
      if (data.sido) {
        setSelectedSido(data.sido);
        // 해당 시도의 지역 필터링
        const filtered = regions.filter(r => r.sido === data.sido);
        setFilteredRegions(filtered);
      }
      // 해당 지역 선택
      setSelectedRegion(card.id);
      setWeatherData(data);
    }
  };

  // 시도 선택 변경 핸들러
  const handleSidoChange = (newSido: string) => {
    if (!newSido || newSido === selectedSido) return;

    setSelectedSido(newSido);

    // 해당 시도의 지역 필터링
    const filtered = regions.filter(r => r.sido === newSido);
    setFilteredRegions(filtered);

    // 첫 번째 지역 선택
    if (filtered.length > 0) {
      const firstRegion = filtered[0];
      setSelectedRegion(firstRegion.region_name);

      const cachedData = initialDataMap.get(firstRegion.region_name);
      if (cachedData) {
        setWeatherData(cachedData);
      }
    } else {
      setSelectedRegion('');
      setWeatherData(null);
    }
  };

  // 지역 선택 변경 핸들러
  const handleRegionChange = async (newRegion: string) => {
    if (!newRegion || newRegion === selectedRegion) return;

    setSelectedRegion(newRegion);

    // 초기 데이터 맵에서 먼저 확인 (캐시된 데이터 사용)
    const cachedData = initialDataMap.get(newRegion);
    if (cachedData) {
      setWeatherData(cachedData);
      return;
    }

    // 캐시에 없으면 API 호출
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/kma/realtime/latest/pivot?region_name=${encodeURIComponent(newRegion)}&limit=1`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setWeatherData(data[0]);
        } else {
          setWeatherData(null);
          setError('데이터가 없습니다');
        }
      } else {
        setError('데이터 조회 실패');
      }
    } catch (err) {
      console.error('KMA 기상 데이터 조회 실패:', err);
      setError('데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <h3 className="text-base font-semibold text-gray-800 mb-3">기상청(KMA)</h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Data Section */}
        <div className="lg:col-span-2 flex flex-col">
          {/* 시도/시군구 선택 */}
          <div className="flex gap-2 mb-2">
            <select
              value={selectedSido}
              onChange={(e) => handleSidoChange(e.target.value)}
              className="w-1/3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
            >
              <option value="">시도 선택</option>
              {sidos.map((sido) => (
                <option key={sido} value={sido}>
                  {sido}
                </option>
              ))}
            </select>
            <select
              value={selectedRegion}
              onChange={(e) => handleRegionChange(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
            >
              <option value="">시군구 선택</option>
              {filteredRegions.map((region) => (
                <option key={region.region_name} value={region.region_name}>
                  {region.region_name}
                </option>
              ))}
            </select>
          </div>

          {/* 업데이트 시각 */}
          <p className="text-xs text-gray-500 mb-3">
            업데이트: {weatherData ? formatDateTime(weatherData.base_date, weatherData.base_time) : '-'}
          </p>

          {/* 기상 데이터 카드 */}
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-gray-500">로딩 중...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-red-500">{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {/* 기온 */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 text-center">
                <p className="text-xs text-orange-600 mb-1">기온</p>
                <p className="text-2xl font-bold text-orange-700">
                  {weatherData?.T1H?.toFixed(1) ?? '-'}
                </p>
                <p className="text-xs text-orange-500">°C</p>
              </div>

              {/* 습도 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 mb-1">습도</p>
                <p className="text-2xl font-bold text-blue-700">
                  {weatherData?.REH?.toFixed(0) ?? '-'}
                </p>
                <p className="text-xs text-blue-500">%</p>
              </div>

              {/* 강수량 */}
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-3 text-center">
                <p className="text-xs text-cyan-600 mb-1">강수량</p>
                <p className="text-2xl font-bold text-cyan-700">
                  {weatherData?.RN1?.toFixed(1) ?? '-'}
                </p>
                <p className="text-xs text-cyan-500">mm</p>
              </div>

              {/* 풍속 */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 text-center">
                <p className="text-xs text-green-600 mb-1">풍속</p>
                <p className="text-2xl font-bold text-green-700">
                  {weatherData?.WSD?.toFixed(1) ?? '-'}
                </p>
                <p className="text-xs text-green-500">m/s</p>
              </div>

              {/* 풍향 */}
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-3 text-center">
                <p className="text-xs text-teal-600 mb-1">풍향</p>
                <p className="text-2xl font-bold text-teal-700">
                  {getWindDirection(weatherData?.VEC)}
                </p>
                <p className="text-xs text-teal-500">&nbsp;</p>
              </div>
            </div>
          )}

          {/* 오늘의 기온/습도 차트 */}
          <div className="mt-4">
            <TodayWeatherChart
              data={todayChartData}
              title="오늘의 기온/습도 (0시~현재)"
            />
          </div>
        </div>

        {/* Right: Map */}
        <div className="lg:col-span-1 min-h-[200px]">
          <MapVisualization
            markers={[]}
            weatherCards={weatherCards}
            onWeatherCardClick={handleWeatherCardClick}
            selectedCardId={selectedRegion}
          />
        </div>
      </div>
    </div>
  );
};

// ===== 메인 컴포넌트 =====
const CurrentWeather = () => {
  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Page Title */}
      <h2 className="text-base font-medium text-gray-600">현재기상실황</h2>

      {/* RDA Section */}
      <RdaWeatherSection />

      {/* KMA Section */}
      <KmaWeatherSection />
    </div>
  );
};

export default CurrentWeather;
