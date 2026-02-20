import { useState, useEffect } from 'react';
import * as d3 from 'd3-geo';
import * as XLSX from 'xlsx';
import geoData from '../components/MapVisualization/SIDO_MAP_2022.json';

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

// AWS 기상대 정보
interface AwsStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

// AWS 기상 데이터
interface AwsWeatherData {
  Timestamp: string;
  Temp: number | null;
  Humid: number | null;
  Radn: number | null;
  Wind_degree: number | null;
  Wind: number | null;
  Rainfall: number | null;
  Date?: string;
}

// 날짜 포맷팅 (YYYY-MM-DD)
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const AwsWeather = () => {
  // 기상대 목록
  const [stations, setStations] = useState<AwsStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('01');
  const [stationsLoading, setStationsLoading] = useState<boolean>(true);

  // 최신 데이터
  const [latestData, setLatestData] = useState<AwsWeatherData | null>(null);
  const [latestLoading, setLatestLoading] = useState<boolean>(false);
  const [latestError, setLatestError] = useState<string | null>(null);

  // 기간 조회
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [downloadLoading, setDownloadLoading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // 기상대 목록 로드
  useEffect(() => {
    const fetchStations = async () => {
      setStationsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/aws/stations`);
        if (response.ok) {
          const data: AwsStation[] = await response.json();
          setStations(data);
          if (data.length > 0) {
            setSelectedStation(data[0].id);
          }
        }
      } catch (err) {
        console.error('기상대 목록 로드 실패:', err);
      } finally {
        setStationsLoading(false);
      }
    };
    fetchStations();
  }, []);

  // 최신 데이터 로드
  useEffect(() => {
    const fetchLatestData = async () => {
      if (!selectedStation) return;

      setLatestLoading(true);
      setLatestError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/aws/${selectedStation}/latest`);
        if (response.ok) {
          const result = await response.json();
          setLatestData(result.data);
        } else {
          const errorData = await response.json();
          setLatestError(errorData.detail || '데이터를 불러올 수 없습니다.');
        }
      } catch (err) {
        console.error('최신 데이터 로드 실패:', err);
        setLatestError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLatestLoading(false);
      }
    };
    fetchLatestData();
  }, [selectedStation]);

  // 기본 날짜 설정 (오늘 ~ 일주일 전)
  useEffect(() => {
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);
    setStartDate(formatDate(weekAgo));
    setEndDate(formatDate(today));
  }, []);

  // JSON 다운로드
  const handleDownloadJson = async () => {
    if (!startDate || !endDate || !selectedStation) return;

    setDownloadLoading('json');
    setDownloadError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/aws/${selectedStation}/${startDate}/${endDate}?format=json`
      );
      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `aws_${selectedStation}_${startDate}_${endDate}.json`;
        link.click();
      } else {
        const errorData = await response.json();
        setDownloadError(errorData.detail || '다운로드 실패');
      }
    } catch (err) {
      console.error('다운로드 실패:', err);
      setDownloadError('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadLoading(null);
    }
  };

  // CSV 다운로드
  const handleDownloadCsv = async () => {
    if (!startDate || !endDate || !selectedStation) return;

    setDownloadLoading('csv');
    setDownloadError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/aws/${selectedStation}/${startDate}/${endDate}?format=csv`
      );
      if (response.ok) {
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `aws_${selectedStation}_${startDate}_${endDate}.csv`;
        link.click();
      } else {
        const errorData = await response.json();
        setDownloadError(errorData.detail || '다운로드 실패');
      }
    } catch (err) {
      console.error('다운로드 실패:', err);
      setDownloadError('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadLoading(null);
    }
  };

  // Excel 다운로드
  const handleDownloadExcel = async () => {
    if (!startDate || !endDate || !selectedStation) return;

    setDownloadLoading('excel');
    setDownloadError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/aws/${selectedStation}/${startDate}/${endDate}?format=json`
      );
      if (response.ok) {
        const data = await response.json();
        const wsData = [
          ['날짜', '시간', '온도(°C)', '습도(%)', '순간광량(W/m²)', '풍향(°)', '풍속(m/s)', '강수량(mm)'],
          ...data.data.map((row: AwsWeatherData) => [
            row.Date || '',
            row.Timestamp || '',
            row.Temp ?? '',
            row.Humid ?? '',
            row.Radn ?? '',
            row.Wind_degree ?? '',
            row.Wind ?? '',
            row.Rainfall ?? ''
          ])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '기상데이터');
        XLSX.writeFile(wb, `aws_${selectedStation}_${startDate}_${endDate}.xlsx`);
      } else {
        const errorData = await response.json();
        setDownloadError(errorData.detail || '다운로드 실패');
      }
    } catch (err) {
      console.error('다운로드 실패:', err);
      setDownloadError('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadLoading(null);
    }
  };

  // 지도 설정
  const mapWidth = 400;
  const mapHeight = 460;
  const projection = d3.geoMercator()
    .center([127.5, 36.0])
    .scale(4500)
    .translate([mapWidth / 2, mapHeight / 2]);
  const pathGenerator = d3.geoPath().projection(projection);

  // 선택된 기상대 정보
  const selectedStationInfo = stations.find(s => s.id === selectedStation);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Page Title */}
      <h2 className="text-base font-medium text-gray-600">AWS(기상대) 데이터</h2>

      {/* Top Section: Data Display | Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Section: Latest Data + Download */}
        <div className="space-y-4">
          {/* Latest Weather Data */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">
              현재 기상대 최신 데이터
              {selectedStationInfo && (
                <span className="ml-2 text-sm font-normal text-purple-600">
                  ({selectedStationInfo.name})
                </span>
              )}
            </h3>

            {/* 기상대 선택 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">기상대 선택</label>
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={stationsLoading}
              >
                {stationsLoading ? (
                  <option value="">로딩 중...</option>
                ) : (
                  stations.map(station => (
                    <option key={station.id} value={station.id}>
                      {station.name} (ID: {station.id})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* 최신 데이터 표시 */}
            {latestLoading ? (
              <div className="text-center py-8 text-gray-500">데이터 로딩 중...</div>
            ) : latestError ? (
              <div className="text-center py-8 text-red-500">{latestError}</div>
            ) : latestData ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">측정시간</div>
                  <div className="text-lg font-semibold text-purple-700">{latestData.Timestamp || '-'}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">온도</div>
                  <div className="text-lg font-semibold text-red-700">
                    {latestData.Temp !== null ? `${latestData.Temp.toFixed(1)}°C` : '-'}
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">습도</div>
                  <div className="text-lg font-semibold text-blue-700">
                    {latestData.Humid !== null ? `${latestData.Humid.toFixed(1)}%` : '-'}
                  </div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">순간광량</div>
                  <div className="text-lg font-semibold text-yellow-700">
                    {latestData.Radn !== null ? `${latestData.Radn.toFixed(1)} W/m²` : '-'}
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">풍속</div>
                  <div className="text-lg font-semibold text-green-700">
                    {latestData.Wind !== null ? `${latestData.Wind.toFixed(1)} m/s` : '-'}
                  </div>
                </div>
                <div className="bg-cyan-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">강수량</div>
                  <div className="text-lg font-semibold text-cyan-700">
                    {latestData.Rainfall !== null ? `${latestData.Rainfall.toFixed(1)} mm` : '-'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">데이터가 없습니다.</div>
            )}
          </div>

          {/* Download Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">기간별 데이터 다운로드</h3>

            {/* 기간 선택 */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">시작일</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <span className="text-gray-500">~</span>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">종료일</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            {/* 다운로드 버튼 */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDownloadJson}
                disabled={!startDate || !endDate || downloadLoading !== null}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {downloadLoading === 'json' ? '다운로드 중...' : 'JSON 다운로드'}
              </button>
              <button
                onClick={handleDownloadCsv}
                disabled={!startDate || !endDate || downloadLoading !== null}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {downloadLoading === 'csv' ? '다운로드 중...' : 'CSV 다운로드'}
              </button>
              <button
                onClick={handleDownloadExcel}
                disabled={!startDate || !endDate || downloadLoading !== null}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {downloadLoading === 'excel' ? '다운로드 중...' : 'Excel 다운로드'}
              </button>
            </div>

            {/* 에러 메시지 */}
            {downloadError && (
              <p className="mt-3 text-sm text-red-500">{downloadError}</p>
            )}

            {/* 안내 문구 */}
            <p className="mt-4 text-xs text-gray-500">
              * 최대 1년 기간까지 다운로드 가능합니다.
            </p>
          </div>
        </div>

        {/* Right Section: Map */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4">기상대 위치</h3>

          {/* 범례 */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-purple-500"></div>
              <span className="text-sm text-gray-600">AWS 기상대</span>
            </div>
          </div>

          {/* 지도 */}
          <div className="flex justify-center">
            <svg
              width={mapWidth}
              height={mapHeight}
              className="bg-blue-50 rounded-lg"
            >
              {/* 지도 배경 */}
              <g>
                {(geoData as GeoData).features.map((feature, idx) => {
                  const path = pathGenerator(feature.geometry as d3.GeoPermissibleObjects);
                  return (
                    <path
                      key={idx}
                      d={path || ''}
                      fill="#f3f4f6"
                      stroke="#d1d5db"
                      strokeWidth={0.5}
                    />
                  );
                })}
              </g>

              {/* 기상대 마커 */}
              {stations.map(station => {
                const coords = projection([station.lng, station.lat]);
                if (!coords) return null;
                const [x, y] = coords;
                const isSelected = station.id === selectedStation;

                return (
                  <g
                    key={station.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedStation(station.id)}
                  >
                    {/* 외곽 원 (선택 시) */}
                    {isSelected && (
                      <circle
                        cx={x}
                        cy={y}
                        r={18}
                        fill="none"
                        stroke="#9333ea"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                      />
                    )}
                    {/* 기상대 마커 */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 12 : 10}
                      fill="#9333ea"
                      stroke="#ffffff"
                      strokeWidth={2}
                      opacity={0.9}
                    />
                    {/* 레이블 */}
                    <text
                      x={x}
                      y={y + 25}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill="#4b5563"
                    >
                      {station.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AwsWeather;
