import { useState, useMemo, useEffect } from 'react';
import * as d3 from 'd3-geo';
import geoData from './MapVisualization/SIDO_MAP_2022.json';
import { sigCentroids, extractCityName } from '../data/sigCentroids';

const API_BASE_URL = 'http://3.35.171.253:8001';

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

// NULL 필드 정보
interface NullFieldInfo {
  field: string;
  label: string;
  null_ratio: number;
}

// 관측소 NULL 현황
interface StationNullStatus {
  stn_cd?: string;
  stn_id?: number;
  stn_name?: string;
  stn_nm?: string;
  total_count: number;
  null_fields: NullFieldInfo[];
  color: 'red' | 'yellow' | 'orange' | 'green';
}

// 지도에 표시할 위치
interface MapLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  station: StationNullStatus;
  color: string;
}

interface NullDataMapProps {
  onClose: () => void;
}

// 관측소 이름에서 시/군 추출
const extractCityFromStationName = (stationName: string): string => {
  const cityPatterns = [
    /^([가-힣]+시)/,
    /^([가-힣]+군)/,
    /^([가-힣]+구)/,
    /^([가-힣]{2,3})/
  ];

  for (const pattern of cityPatterns) {
    const match = stationName.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return stationName;
};

// 광역시/특별시 매핑
const metroMapping: Record<string, string> = {
  '서울': '서울특별시',
  '부산': '부산광역시',
  '대구': '대구광역시',
  '인천': '인천광역시',
  '광주': '광주광역시',
  '대전': '대전광역시',
  '울산': '울산광역시',
  '세종': '세종특별자치시',
};

// 시군구 좌표 찾기
const findCoordinates = (name: string): { lat: number; lng: number } | null => {
  if (sigCentroids[name]) {
    return { lat: sigCentroids[name].lat, lng: sigCentroids[name].lng };
  }

  if (metroMapping[name]) {
    const metroName = metroMapping[name];
    if (sigCentroids[metroName]) {
      return { lat: sigCentroids[metroName].lat, lng: sigCentroids[metroName].lng };
    }
  }

  const withSi = name.endsWith('시') ? name : name + '시';
  const withGun = name.endsWith('군') ? name : name + '군';

  if (sigCentroids[withSi]) {
    return { lat: sigCentroids[withSi].lat, lng: sigCentroids[withSi].lng };
  }
  if (sigCentroids[withGun]) {
    return { lat: sigCentroids[withGun].lat, lng: sigCentroids[withGun].lng };
  }

  const baseName = extractCityName(name);
  for (const [key, value] of Object.entries(sigCentroids)) {
    if (key.includes(baseName) || baseName.includes(extractCityName(key))) {
      return { lat: value.lat, lng: value.lng };
    }
  }

  return null;
};

// 색상 코드 매핑
const colorMap: Record<string, string> = {
  red: '#EF4444',     // 일사량만 NULL
  yellow: '#EAB308',  // 다른 값 NULL
  orange: '#F97316',  // 2개 이상 NULL
  green: '#22C55E',   // 정상
};

const NullDataMap: React.FC<NullDataMapProps> = ({ onClose }) => {
  const [institution, setInstitution] = useState<'RDA' | 'KMA'>('RDA');
  const [nullData, setNullData] = useState<StationNullStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredLocation, setHoveredLocation] = useState<MapLocation | null>(null);

  // SVG dimensions
  const width = 500;
  const height = 550;

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

  // NULL 데이터 조회
  useEffect(() => {
    const fetchNullData = async () => {
      setLoading(true);
      try {
        const endpoint = institution === 'RDA'
          ? `${API_BASE_URL}/api/stats/null-status/rda`
          : `${API_BASE_URL}/api/stats/null-status/kma`;

        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();
          setNullData(data.stations || []);
        }
      } catch (err) {
        console.error('NULL 데이터 조회 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNullData();
  }, [institution]);

  // 지도 위치 데이터 생성
  const mapLocations = useMemo(() => {
    const locations: MapLocation[] = [];

    nullData.forEach(station => {
      const name = station.stn_name || station.stn_nm || '';
      const cityName = extractCityFromStationName(name);
      const coords = findCoordinates(cityName);

      if (coords) {
        locations.push({
          id: station.stn_cd || String(station.stn_id) || '',
          name: name,
          lat: coords.lat,
          lng: coords.lng,
          station: station,
          color: colorMap[station.color] || colorMap.green
        });
      }
    });

    return locations;
  }, [nullData]);

  // 통계 계산
  const stats = useMemo(() => {
    const red = nullData.filter(s => s.color === 'red').length;
    const yellow = nullData.filter(s => s.color === 'yellow').length;
    const orange = nullData.filter(s => s.color === 'orange').length;
    const green = nullData.filter(s => s.color === 'green').length;
    return { red, yellow, orange, green, total: nullData.length };
  }, [nullData]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">데이터 NULL 지역 현황</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* 기관 선택 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">관측 기관 선택</label>
            <div className="flex gap-2">
              <button
                onClick={() => setInstitution('RDA')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  institution === 'RDA'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                RDA (농업과학원)
              </button>
              <button
                onClick={() => setInstitution('KMA')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  institution === 'KMA'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                KMA (기상청)
              </button>
            </div>
          </div>

          {/* 범례 */}
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: colorMap.red }}></div>
              <span className="text-gray-600">일사량만 NULL ({stats.red}개)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: colorMap.yellow }}></div>
              <span className="text-gray-600">다른 값 NULL ({stats.yellow}개)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: colorMap.orange }}></div>
              <span className="text-gray-600">2개 이상 NULL ({stats.orange}개)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: colorMap.green }}></div>
              <span className="text-gray-600">정상 ({stats.green}개)</span>
            </div>
          </div>

          {/* 지도 */}
          <div className="relative bg-gradient-to-b from-sky-50 to-sky-100 rounded-lg overflow-hidden" style={{ minHeight: '450px' }}>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
                <div className="text-gray-500 text-sm">데이터 로딩 중...</div>
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

              {/* Location markers */}
              {mapLocations.map((location) => {
                const { x, y } = latLngToXY(location.lat, location.lng);
                const isHovered = hoveredLocation?.id === location.id;
                const radius = isHovered ? 8 : 6;

                return (
                  <g
                    key={location.id}
                    onMouseEnter={() => setHoveredLocation(location)}
                    onMouseLeave={() => setHoveredLocation(null)}
                    className="cursor-pointer"
                  >
                    {/* Hover ring */}
                    {isHovered && (
                      <circle
                        cx={x}
                        cy={y}
                        r={radius + 3}
                        fill="none"
                        stroke={location.color}
                        strokeWidth={2}
                        opacity={0.5}
                      />
                    )}
                    {/* Main circle */}
                    <circle
                      cx={x}
                      cy={y}
                      r={radius}
                      fill={location.color}
                      stroke="white"
                      strokeWidth={1.5}
                      className="transition-all duration-150"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Hover tooltip */}
            {hoveredLocation && (
              <div
                className="absolute bg-white rounded-lg shadow-lg p-3 pointer-events-none z-10 text-sm min-w-[200px]"
                style={{
                  left: `${Math.min((latLngToXY(hoveredLocation.lat, hoveredLocation.lng).x / width) * 100, 70)}%`,
                  top: `${(latLngToXY(hoveredLocation.lat, hoveredLocation.lng).y / height) * 100}%`,
                  transform: 'translate(-50%, -120%)',
                }}
              >
                <p className="font-semibold text-gray-800 mb-1">{hoveredLocation.name}</p>
                <p className="text-gray-500 text-xs mb-2">
                  총 {hoveredLocation.station.total_count.toLocaleString()}건 데이터
                </p>
                {hoveredLocation.station.null_fields.length === 0 ? (
                  <p className="text-green-600 text-xs">모든 데이터 정상</p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-700">NULL 필드:</p>
                    {hoveredLocation.station.null_fields.map((field, idx) => (
                      <p key={idx} className="text-xs text-red-600">
                        - {field.label}: {field.null_ratio}% NULL
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 하단 통계 */}
          <div className="mt-4 text-center text-sm text-gray-600">
            총 {stats.total}개 관측소 중 {stats.red + stats.yellow + stats.orange}개 관측소에 NULL 데이터 존재
          </div>
        </div>
      </div>
    </div>
  );
};

export default NullDataMap;
