import type { Region, WeatherData, MapMarker, WeatherVariableConfig } from '../types';

// 시/도 목록
export const provinces = [
  { value: '', label: '시/도 선택' },
  { value: 'seoul', label: '서울특별시' },
  { value: 'busan', label: '부산광역시' },
  { value: 'daegu', label: '대구광역시' },
  { value: 'incheon', label: '인천광역시' },
  { value: 'gwangju', label: '광주광역시' },
  { value: 'daejeon', label: '대전광역시' },
  { value: 'ulsan', label: '울산광역시' },
  { value: 'sejong', label: '세종특별자치시' },
  { value: 'gyeonggi', label: '경기도' },
  { value: 'gangwon', label: '강원도' },
  { value: 'chungbuk', label: '충청북도' },
  { value: 'chungnam', label: '충청남도' },
  { value: 'jeonbuk', label: '전라북도' },
  { value: 'jeonnam', label: '전라남도' },
  { value: 'gyeongbuk', label: '경상북도' },
  { value: 'gyeongnam', label: '경상남도' },
  { value: 'jeju', label: '제주특별자치도' },
];

// 시/군/구 목록 (시/도별)
export const citiesByProvince: Record<string, { value: string; label: string }[]> = {
  seoul: [
    { value: '', label: '시/군/구 선택' },
    { value: 'gangnam', label: '강남구' },
    { value: 'gangdong', label: '강동구' },
    { value: 'gangbuk', label: '강북구' },
    { value: 'gangseo', label: '강서구' },
    { value: 'gwanak', label: '관악구' },
    { value: 'gwangjin', label: '광진구' },
    { value: 'guro', label: '구로구' },
    { value: 'geumcheon', label: '금천구' },
    { value: 'nowon', label: '노원구' },
    { value: 'dobong', label: '도봉구' },
  ],
  gyeonggi: [
    { value: '', label: '시/군/구 선택' },
    { value: 'suwon', label: '수원시' },
    { value: 'seongnam', label: '성남시' },
    { value: 'goyang', label: '고양시' },
    { value: 'yongin', label: '용인시' },
    { value: 'bucheon', label: '부천시' },
    { value: 'ansan', label: '안산시' },
    { value: 'anyang', label: '안양시' },
    { value: 'namyangju', label: '남양주시' },
    { value: 'hwaseong', label: '화성시' },
    { value: 'pyeongtaek', label: '평택시' },
  ],
  gangwon: [
    { value: '', label: '시/군/구 선택' },
    { value: 'chuncheon', label: '춘천시' },
    { value: 'wonju', label: '원주시' },
    { value: 'gangneung', label: '강릉시' },
    { value: 'donghae', label: '동해시' },
    { value: 'taebaek', label: '태백시' },
    { value: 'sokcho', label: '속초시' },
    { value: 'samcheok', label: '삼척시' },
  ],
  chungnam: [
    { value: '', label: '시/군/구 선택' },
    { value: 'cheonan', label: '천안시' },
    { value: 'gongju', label: '공주시' },
    { value: 'boryeong', label: '보령시' },
    { value: 'asan', label: '아산시' },
    { value: 'seosan', label: '서산시' },
    { value: 'nonsan', label: '논산시' },
    { value: 'gyeryong', label: '계룡시' },
    { value: 'dangjin', label: '당진시' },
  ],
  jeonnam: [
    { value: '', label: '시/군/구 선택' },
    { value: 'mokpo', label: '목포시' },
    { value: 'yeosu', label: '여수시' },
    { value: 'suncheon', label: '순천시' },
    { value: 'naju', label: '나주시' },
    { value: 'gwangyang', label: '광양시' },
  ],
};

// 기본 시/군/구 목록
export const defaultCities = [{ value: '', label: '시/군/구 선택' }];

// 지역 데이터
export const regions: Region[] = [
  { id: '1', name: '서울', code: '108', latitude: 37.5665, longitude: 126.9780, province: '서울특별시', city: '' },
  { id: '2', name: '부산', code: '159', latitude: 35.1796, longitude: 129.0756, province: '부산광역시', city: '' },
  { id: '3', name: '대구', code: '143', latitude: 35.8714, longitude: 128.6014, province: '대구광역시', city: '' },
  { id: '4', name: '인천', code: '112', latitude: 37.4563, longitude: 126.7052, province: '인천광역시', city: '' },
  { id: '5', name: '광주', code: '156', latitude: 35.1595, longitude: 126.8526, province: '광주광역시', city: '' },
  { id: '6', name: '대전', code: '133', latitude: 36.3504, longitude: 127.3845, province: '대전광역시', city: '' },
  { id: '7', name: '울산', code: '152', latitude: 35.5384, longitude: 129.3114, province: '울산광역시', city: '' },
  { id: '8', name: '수원', code: '119', latitude: 37.2636, longitude: 127.0286, province: '경기도', city: '수원시' },
  { id: '9', name: '춘천', code: '101', latitude: 37.8813, longitude: 127.7298, province: '강원도', city: '춘천시' },
  { id: '10', name: '강릉', code: '105', latitude: 37.7519, longitude: 128.8761, province: '강원도', city: '강릉시' },
  { id: '11', name: '청주', code: '131', latitude: 36.6424, longitude: 127.4890, province: '충청북도', city: '청주시' },
  { id: '12', name: '전주', code: '146', latitude: 35.8242, longitude: 127.1480, province: '전라북도', city: '전주시' },
  { id: '13', name: '제주', code: '184', latitude: 33.4996, longitude: 126.5312, province: '제주특별자치도', city: '제주시' },
];

// 기상 변수 설정
export const weatherVariables: WeatherVariableConfig[] = [
  { key: 'temperature', label: '기온', unit: '°C', color: '#ef4444' },
  { key: 'humidity', label: '습도', unit: '%', color: '#3b82f6' },
  { key: 'rainfall', label: '강수량', unit: 'mm', color: '#06b6d4' },
  { key: 'windSpeed', label: '풍속', unit: 'm/s', color: '#22c55e' },
  { key: 'pressure', label: '기압', unit: 'hPa', color: '#a855f7' },
  { key: 'sunshine', label: '일조시간', unit: 'h', color: '#f59e0b' },
];

// Mock 기상 데이터 생성
export const generateMockWeatherData = (days: number = 30): WeatherData[] => {
  const data: WeatherData[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    for (let hour = 0; hour < 24; hour += 3) {
      data.push({
        id: `${date.toISOString().split('T')[0]}-${hour}`,
        date: date.toISOString().split('T')[0],
        time: `${hour.toString().padStart(2, '0')}:00`,
        temperature: Math.round((15 + Math.random() * 15 + Math.sin(hour / 24 * Math.PI * 2) * 5) * 10) / 10,
        humidity: Math.round(50 + Math.random() * 40),
        rainfall: Math.random() > 0.8 ? Math.round(Math.random() * 20 * 10) / 10 : 0,
        windSpeed: Math.round((2 + Math.random() * 8) * 10) / 10,
        windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
        pressure: Math.round(1010 + Math.random() * 20),
        sunshine: hour >= 6 && hour <= 18 ? Math.round(Math.random() * 3 * 10) / 10 : 0,
        cloudCover: Math.round(Math.random() * 100),
      });
    }
  }

  return data;
};

// 차트용 일별 데이터 집계
export const generateDailyChartData = (days: number = 14) => {
  const data = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    data.push({
      name: `${date.getMonth() + 1}/${date.getDate()}`,
      date: date.toISOString().split('T')[0],
      temperature: Math.round((15 + Math.random() * 15) * 10) / 10,
      maxTemp: Math.round((20 + Math.random() * 10) * 10) / 10,
      minTemp: Math.round((5 + Math.random() * 10) * 10) / 10,
      humidity: Math.round(50 + Math.random() * 40),
      rainfall: Math.random() > 0.7 ? Math.round(Math.random() * 30 * 10) / 10 : 0,
      windSpeed: Math.round((2 + Math.random() * 6) * 10) / 10,
    });
  }

  return data;
};

// 지도 마커 데이터
export const mapMarkers: MapMarker[] = [
  { id: '1', latitude: 37.5665, longitude: 126.9780, value: 23.5, type: 'station', name: '서울' },
  { id: '2', latitude: 35.1796, longitude: 129.0756, value: 25.2, type: 'station', name: '부산' },
  { id: '3', latitude: 35.8714, longitude: 128.6014, value: 24.1, type: 'station', name: '대구' },
  { id: '4', latitude: 37.4563, longitude: 126.7052, value: 22.8, type: 'station', name: '인천' },
  { id: '5', latitude: 35.1595, longitude: 126.8526, value: 24.5, type: 'station', name: '광주' },
  { id: '6', latitude: 36.3504, longitude: 127.3845, value: 23.9, type: 'station', name: '대전' },
  { id: '7', latitude: 35.5384, longitude: 129.3114, value: 24.8, type: 'station', name: '울산' },
  { id: '8', latitude: 37.8813, longitude: 127.7298, value: 21.3, type: 'farm', name: '춘천 농장' },
  { id: '9', latitude: 35.8242, longitude: 127.1480, value: 24.2, type: 'farm', name: '전주 농장' },
  { id: '10', latitude: 33.4996, longitude: 126.5312, value: 26.1, type: 'station', name: '제주' },
];

// 테이블용 Mock 데이터
export const mockTableData = generateMockWeatherData(7);
