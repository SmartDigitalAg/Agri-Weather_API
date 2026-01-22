import { useState, useMemo } from 'react';
import * as d3 from 'd3-geo';
import geoData from './MapVisualization/SIDO_MAP_2022.json';
import { sigCentroids, extractCityName } from '../data/sigCentroids';

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

// RDA 관측소 정보
interface RdaStation {
  stn_cd: string;
  stn_name: string;
  data_count: number;
  first_date: string;
  last_date: string;
}

// KMA ASOS 관측소 정보
interface KmaStation {
  stn_id: number;
  stn_nm: string;
  data_count: number;
  first_date: string;
  last_date: string;
}

// 지도에 표시할 위치 정보
interface MapLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  institutions: ('RDA' | 'KMA')[];
  rdaStation?: RdaStation;
  kmaStation?: KmaStation;
  firstYear: number;
  lastYear: number;
}

interface PastWeatherMapProps {
  rdaStations: RdaStation[];
  kmaStations: KmaStation[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  onLocationSelect: (institution: 'RDA' | 'KMA', station: RdaStation | KmaStation) => void;
  selectedRdaStation?: string;
  selectedKmaStation?: number | null;
}


// 관측소 이름에서 시/군 추출 (RDA용)
const extractCityFromStationName = (stationName: string): string => {
  // "춘천시" -> "춘천시", "홍성홍북" -> "홍성", etc.
  const cityPatterns = [
    /^([가-힣]+시)/,   // ~시
    /^([가-힣]+군)/,   // ~군
    /^([가-힣]+구)/,   // ~구
    /^([가-힣]{2,3})/  // 2-3글자 이름
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
  // 직접 매칭
  if (sigCentroids[name]) {
    return { lat: sigCentroids[name].lat, lng: sigCentroids[name].lng };
  }

  // 광역시/특별시 매핑 확인
  if (metroMapping[name]) {
    const metroName = metroMapping[name];
    if (sigCentroids[metroName]) {
      return { lat: sigCentroids[metroName].lat, lng: sigCentroids[metroName].lng };
    }
  }

  // "XX시" 또는 "XX군" 형태로 시도
  const withSi = name.endsWith('시') ? name : name + '시';
  const withGun = name.endsWith('군') ? name : name + '군';

  if (sigCentroids[withSi]) {
    return { lat: sigCentroids[withSi].lat, lng: sigCentroids[withSi].lng };
  }
  if (sigCentroids[withGun]) {
    return { lat: sigCentroids[withGun].lat, lng: sigCentroids[withGun].lng };
  }

  // 부분 매칭
  const baseName = extractCityName(name);
  for (const [key, value] of Object.entries(sigCentroids)) {
    if (key.includes(baseName) || baseName.includes(extractCityName(key))) {
      return { lat: value.lat, lng: value.lng };
    }
  }

  return null;
};

const PastWeatherMap: React.FC<PastWeatherMapProps> = ({
  rdaStations,
  kmaStations,
  selectedYear,
  onYearChange,
  onLocationSelect,
  selectedRdaStation,
  selectedKmaStation
}) => {
  const [hoveredLocation, setHoveredLocation] = useState<MapLocation | null>(null);
  const [showInstitutionModal, setShowInstitutionModal] = useState<MapLocation | null>(null);

  // 관측소 데이터 로딩 중인지 확인
  const isLoading = rdaStations.length === 0 && kmaStations.length === 0;

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

  // 모든 위치 데이터 생성
  const mapLocations = useMemo(() => {
    const locations: Map<string, MapLocation> = new Map();

    // RDA 관측소 처리
    rdaStations.forEach(station => {
      const cityName = extractCityFromStationName(station.stn_name);
      const coords = findCoordinates(cityName);

      if (coords) {
        const key = `${coords.lat.toFixed(2)}_${coords.lng.toFixed(2)}`;
        const firstYear = parseInt(station.first_date?.substring(0, 4) || '2020');
        const lastYear = parseInt(station.last_date?.substring(0, 4) || '2026');

        if (locations.has(key)) {
          const existing = locations.get(key)!;
          if (!existing.institutions.includes('RDA')) {
            existing.institutions.push('RDA');
          }
          existing.rdaStation = station;
          existing.firstYear = Math.min(existing.firstYear, firstYear);
          existing.lastYear = Math.max(existing.lastYear, lastYear);
        } else {
          locations.set(key, {
            id: key,
            name: cityName,
            lat: coords.lat,
            lng: coords.lng,
            institutions: ['RDA'],
            rdaStation: station,
            firstYear,
            lastYear
          });
        }
      }
    });

    // KMA 관측소 처리
    kmaStations.forEach(station => {
      const coords = findCoordinates(station.stn_nm);

      if (coords) {
        const key = `${coords.lat.toFixed(2)}_${coords.lng.toFixed(2)}`;
        const firstYear = parseInt(station.first_date?.substring(0, 4) || '1904');
        const lastYear = parseInt(station.last_date?.substring(0, 4) || '2026');

        if (locations.has(key)) {
          const existing = locations.get(key)!;
          if (!existing.institutions.includes('KMA')) {
            existing.institutions.push('KMA');
          }
          existing.kmaStation = station;
          existing.firstYear = Math.min(existing.firstYear, firstYear);
          existing.lastYear = Math.max(existing.lastYear, lastYear);
        } else {
          locations.set(key, {
            id: key,
            name: station.stn_nm,
            lat: coords.lat,
            lng: coords.lng,
            institutions: ['KMA'],
            kmaStation: station,
            firstYear,
            lastYear
          });
        }
      }
    });

    return Array.from(locations.values());
  }, [rdaStations, kmaStations]);

  // 선택된 연도에 데이터가 있는 위치만 필터링
  const filteredLocations = useMemo(() => {
    return mapLocations.filter(loc =>
      loc.firstYear <= selectedYear && loc.lastYear >= selectedYear
    );
  }, [mapLocations, selectedYear]);

  // 위치 색상 결정
  const getLocationColor = (location: MapLocation): string => {
    const hasRDA = location.institutions.includes('RDA');
    const hasKMA = location.institutions.includes('KMA');

    if (hasRDA && hasKMA) {
      return '#d4a574'; // 베이지색 - 겹침
    } else if (hasRDA) {
      return '#87CEEB'; // 하늘색 - RDA
    } else {
      return '#FFA500'; // 주황색 - KMA
    }
  };

  // 위치 클릭 핸들러
  const handleLocationClick = (location: MapLocation) => {
    if (location.institutions.length > 1) {
      // 겹치는 경우 모달 표시
      setShowInstitutionModal(location);
    } else {
      // 단일 기관
      if (location.institutions[0] === 'RDA' && location.rdaStation) {
        onLocationSelect('RDA', location.rdaStation);
      } else if (location.kmaStation) {
        onLocationSelect('KMA', location.kmaStation);
      }
    }
  };

  // 기관 선택 핸들러
  const handleInstitutionSelect = (location: MapLocation, institution: 'RDA' | 'KMA') => {
    setShowInstitutionModal(null);
    if (institution === 'RDA' && location.rdaStation) {
      onLocationSelect('RDA', location.rdaStation);
    } else if (institution === 'KMA' && location.kmaStation) {
      onLocationSelect('KMA', location.kmaStation);
    }
  };

  // 선택된 위치인지 확인
  const isLocationSelected = (location: MapLocation): boolean => {
    if (selectedRdaStation && location.rdaStation?.stn_cd === selectedRdaStation) {
      return true;
    }
    if (selectedKmaStation && location.kmaStation?.stn_id === selectedKmaStation) {
      return true;
    }
    return false;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 h-full flex flex-col">
      <h3 className="text-base font-semibold text-gray-800 mb-3">관측소 지도</h3>

      {/* 범례 */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#87CEEB' }}></div>
          <span className="text-gray-600">RDA (농업과학원)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FFA500' }}></div>
          <span className="text-gray-600">KMA (기상청)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#d4a574' }}></div>
          <span className="text-gray-600">겹침</span>
        </div>
      </div>

      {/* 지도 */}
      <div className="flex-1 relative bg-gradient-to-b from-sky-50 to-sky-100 rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
            <div className="text-gray-500 text-sm">관측소 데이터 로딩 중...</div>
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
          {filteredLocations.map((location) => {
            const { x, y } = latLngToXY(location.lat, location.lng);
            const color = getLocationColor(location);
            const isSelected = isLocationSelected(location);
            const isHovered = hoveredLocation?.id === location.id;
            const radius = isSelected ? 8 : isHovered ? 7 : 5;

            return (
              <g
                key={location.id}
                onClick={() => handleLocationClick(location)}
                onMouseEnter={() => setHoveredLocation(location)}
                onMouseLeave={() => setHoveredLocation(null)}
                className="cursor-pointer"
              >
                {/* Selection/Hover ring */}
                {(isSelected || isHovered) && (
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + 3}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    opacity={0.5}
                  />
                )}
                {/* Main circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={color}
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
            className="absolute bg-white rounded-lg shadow-lg p-2 pointer-events-none z-10 text-xs"
            style={{
              left: `${(latLngToXY(hoveredLocation.lat, hoveredLocation.lng).x / width) * 100}%`,
              top: `${(latLngToXY(hoveredLocation.lat, hoveredLocation.lng).y / height) * 100}%`,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <p className="font-semibold text-gray-800">{hoveredLocation.name}</p>
            <p className="text-gray-500">
              {hoveredLocation.institutions.join(', ')} | {hoveredLocation.firstYear}~{hoveredLocation.lastYear}
            </p>
          </div>
        )}

        {/* Institution selection modal */}
        {showInstitutionModal && (
          <div
            className="absolute inset-0 bg-black/20 flex items-center justify-center z-20"
            onClick={() => setShowInstitutionModal(null)}
          >
            <div
              className="bg-white rounded-lg shadow-xl p-4 min-w-[200px]"
              onClick={e => e.stopPropagation()}
            >
              <h4 className="font-semibold text-gray-800 mb-3">
                {showInstitutionModal.name} - 기관 선택
              </h4>
              <div className="flex flex-col gap-2">
                {showInstitutionModal.rdaStation && (
                  <button
                    onClick={() => handleInstitutionSelect(showInstitutionModal, 'RDA')}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sky-50 transition-colors"
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#87CEEB' }}></div>
                    <span>RDA (농업과학원)</span>
                  </button>
                )}
                {showInstitutionModal.kmaStation && (
                  <button
                    onClick={() => handleInstitutionSelect(showInstitutionModal, 'KMA')}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors"
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FFA500' }}></div>
                    <span>KMA (기상청)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Year slider */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">데이터 기간</span>
          <span className="text-sm font-semibold text-green-600">{selectedYear}년</span>
        </div>
        <input
          type="range"
          min="1904"
          max="2026"
          value={selectedYear}
          onChange={(e) => onYearChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
          style={{
            background: `linear-gradient(to right, #22c55e 0%, #22c55e ${((selectedYear - 1904) / (2026 - 1904)) * 100}%, #e5e7eb ${((selectedYear - 1904) / (2026 - 1904)) * 100}%, #e5e7eb 100%)`
          }}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>1904</span>
          <span>1950</span>
          <span>2000</span>
          <span>2026</span>
        </div>
      </div>

      {/* Selected location count */}
      <div className="mt-2 text-xs text-gray-500 text-center">
        {selectedYear}년 기준 {filteredLocations.length}개 관측소 표시
      </div>
    </div>
  );
};

export default PastWeatherMap;
