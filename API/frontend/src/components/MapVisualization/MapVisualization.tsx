import { useState, useMemo } from 'react';
import * as d3 from 'd3-geo';
import type { MapMarker } from '../../types';
import geoData from './SIDO_MAP_2022.json';
import { provinceCenters } from '../../data/koreaGeo';

// 카드형 마커 데이터 타입
export interface WeatherCardMarker {
  id: string;
  name: string;           // 시군구 이름
  temperature: number;    // 기온
  latitude: number;
  longitude: number;
}

interface MapVisualizationProps {
  markers: MapMarker[];
  weatherCards?: WeatherCardMarker[];  // 카드형 마커
  onMarkerClick?: (marker: MapMarker) => void;
  onWeatherCardClick?: (card: WeatherCardMarker) => void;  // 카드 클릭 핸들러
  onProvinceClick?: (provinceName: string) => void;
  selectedMarkerId?: string;
  selectedCardId?: string;  // 선택된 카드
  selectedProvince?: string;
}

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

const MapVisualization: React.FC<MapVisualizationProps> = ({
  markers,
  weatherCards = [],
  onMarkerClick,
  onWeatherCardClick,
  onProvinceClick,
  selectedMarkerId,
  selectedCardId,
  selectedProvince,
}) => {
  const [hoveredMarker, setHoveredMarker] = useState<MapMarker | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  // SVG dimensions
  const width = 500;
  const height = 600;

  // 타입 캐스팅
  const koreaGeoData = geoData as GeoData;

  // D3 projection for Korea - 수동 설정
  const projection = useMemo(() => {
    // 대한민국 중심 좌표와 스케일을 수동으로 설정
    return d3.geoMercator()
      .center([127.5, 36.0])  // 대한민국 중심
      .scale(4500)            // 스케일
      .translate([width / 2, height / 2]);  // SVG 중앙에 배치
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

  // 한글 이름 매핑
  const provinceNameMap: Record<string, string> = {
    '11': '서울특별시',
    '26': '부산광역시',
    '27': '대구광역시',
    '28': '인천광역시',
    '29': '광주광역시',
    '30': '대전광역시',
    '31': '울산광역시',
    '36': '세종특별자치시',
    '41': '경기도',
    '42': '강원도',
    '43': '충청북도',
    '44': '충청남도',
    '45': '전북특별자치도',
    '46': '전라남도',
    '47': '경상북도',
    '48': '경상남도',
    '50': '제주특별자치도'
  };

  // Province colors - hover 효과 제거
  const getProvinceColor = (provinceName: string) => {
    if (selectedProvince === provinceName) return '#22c55e';
    return '#d1fae5';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 h-full flex flex-col">
      <div className="flex-1 relative bg-gradient-to-b from-sky-50 to-sky-100 rounded-lg overflow-hidden" style={{ minHeight: '500px' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background sea */}
          <rect x="0" y="0" width={width} height={height} fill="#bae6fd" />

          {/* Province fills - 먼저 모든 채우기를 그림 */}
          {koreaGeoData.features.map((feature, index) => {
            const geometry = {
              type: feature.geometry.type,
              coordinates: feature.geometry.coordinates
            };
            const path = pathGenerator(geometry as d3.GeoPermissibleObjects);
            const provinceName = provinceNameMap[feature.properties.CTPRVN_CD] || feature.properties.CTP_KOR_NM;

            if (!path) return null;

            return (
              <path
                key={`fill-${feature.properties.CTPRVN_CD || index}`}
                d={path}
                fill={getProvinceColor(provinceName)}
                stroke="none"
                className="cursor-pointer"
                onClick={() => onProvinceClick?.(provinceName)}
              />
            );
          })}

          {/* Province strokes - 그 위에 테두리만 그림 */}
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

          {/* Province labels */}
          {Object.entries(provinceCenters).map(([name, center]) => {
            const { x, y } = latLngToXY(center.lat, center.lng);
            const isMetro = name.includes('광역시') || name.includes('특별');
            const displayName = name
              .replace('특별자치시', '')
              .replace('특별자치도', '')
              .replace('광역시', '')
              .replace('특별시', '');

            return (
              <text
                key={name}
                x={x}
                y={y}
                textAnchor="middle"
                fill="#1f2937"
                fontSize={isMetro ? '6' : '8'}
                fontWeight="600"
                className="pointer-events-none select-none"
                style={{ textShadow: '0 0 2px white, 0 0 2px white' }}
              >
                {displayName}
              </text>
            );
          })}

          {/* Markers */}
          {markers.map((marker) => {
            const { x, y } = latLngToXY(marker.latitude, marker.longitude);
            const isSelected = selectedMarkerId === marker.id;
            const isHovered = hoveredMarker?.id === marker.id;

            return (
              <g
                key={marker.id}
                onClick={() => onMarkerClick?.(marker)}
                onMouseEnter={() => setHoveredMarker(marker)}
                onMouseLeave={() => setHoveredMarker(null)}
                className="cursor-pointer"
              >
                {(isSelected || isHovered) && (
                  <circle
                    cx={x}
                    cy={y}
                    r={10}
                    fill={marker.type === 'station' ? '#ef444430' : '#3b82f630'}
                    className="animate-pulse"
                  />
                )}

                <circle
                  cx={x}
                  cy={y}
                  r={isSelected || isHovered ? 6 : 4}
                  fill={marker.type === 'station' ? '#ef4444' : '#3b82f6'}
                  stroke="white"
                  strokeWidth="1.5"
                  className="transition-all duration-200"
                />

                <text
                  x={x}
                  y={y + 2}
                  textAnchor="middle"
                  fill="white"
                  fontSize="4"
                  fontWeight="bold"
                  className="pointer-events-none"
                >
                  {Math.round(marker.value)}
                </text>
              </g>
            );
          })}

          {/* Weather Cards */}
          {weatherCards.map((card) => {
            const { x, y } = latLngToXY(card.latitude, card.longitude);
            const isSelected = selectedCardId === card.id;
            const isHovered = hoveredCardId === card.id;
            const scale = isSelected || isHovered ? 1.12 : 1;

            // 카드 기본 사이즈 (더 크게)
            const cardWidth = 70;
            const cardHeight = 36;

            return (
              <g
                key={card.id}
                transform={`translate(${x}, ${y})`}
                onClick={() => onWeatherCardClick?.(card)}
                onMouseEnter={() => setHoveredCardId(card.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                className="cursor-pointer"
                style={{ transition: 'transform 0.2s ease' }}
              >
                {/* Card shadow */}
                <rect
                  x={-(cardWidth / 2) * scale}
                  y={-(cardHeight / 2) * scale + 2}
                  width={cardWidth * scale}
                  height={cardHeight * scale}
                  rx={5}
                  fill="rgba(0,0,0,0.2)"
                  style={{ transition: 'all 0.2s ease' }}
                />
                {/* Card background */}
                <rect
                  x={-(cardWidth / 2) * scale}
                  y={-(cardHeight / 2) * scale}
                  width={cardWidth * scale}
                  height={cardHeight * scale}
                  rx={5}
                  fill={isSelected ? '#22c55e' : 'white'}
                  stroke={isSelected ? '#16a34a' : '#d1d5db'}
                  strokeWidth={isSelected ? 2 : 1}
                  style={{ transition: 'all 0.2s ease' }}
                />
                {/* Region name */}
                <text
                  x={0}
                  y={-4 * scale}
                  textAnchor="middle"
                  fill={isSelected ? 'white' : '#374151'}
                  fontSize={9 * scale}
                  fontWeight="500"
                  className="pointer-events-none select-none"
                  style={{ transition: 'all 0.2s ease' }}
                >
                  {card.name}
                </text>
                {/* Temperature */}
                <text
                  x={0}
                  y={11 * scale}
                  textAnchor="middle"
                  fill={isSelected ? 'white' : '#ef4444'}
                  fontSize={12 * scale}
                  fontWeight="bold"
                  className="pointer-events-none select-none"
                  style={{ transition: 'all 0.2s ease' }}
                >
                  {card.temperature?.toFixed(1) ?? '-'}°
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip for marker */}
        {hoveredMarker && (
          <div
            className="absolute bg-white rounded-lg shadow-lg p-3 pointer-events-none z-10 min-w-[120px]"
            style={{
              left: `${(latLngToXY(hoveredMarker.latitude, hoveredMarker.longitude).x / width) * 100}%`,
              top: `${(latLngToXY(hoveredMarker.latitude, hoveredMarker.longitude).y / height) * 100}%`,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <p className="font-bold text-gray-800">{hoveredMarker.name}</p>
            <p className="text-sm text-gray-600">
              기온: <span className="font-medium text-red-500">{hoveredMarker.value}°C</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapVisualization;
