import { useState, useEffect, useMemo } from 'react';

const API_BASE_URL = 'http://weather-rda.digitalag.kr:8001';

// 기관 타입
type Institution = 'RDA' | 'KMA';

// RDA 관측소 정보 (일별 데이터 기준 - 기간 포함)
interface RdaStation {
  stn_cd: string;
  stn_name: string;
  data_count: number;
  first_date: string;
  last_date: string;
}

// KMA 지역 정보
interface KmaRegion {
  sido: string | null;
  region_name: string;
  nx: number;
  ny: number;
  data_count: number;
  first_date: string;
  last_date: string;
}

// RDA 일별 기상 데이터
interface RdaDailyData {
  id: number;
  stn_cd: string;
  stn_name: string;
  date: string;
  temp: number | null;        // 평균기온
  hghst_artmp: number | null; // 최고기온
  lowst_artmp: number | null; // 최저기온
  hum: number | null;         // 평균습도
  wind: number | null;        // 평균풍속
  rn: number | null;          // 강수량
  srqty: number | null;       // 일사량
}

// KMA 기상 데이터 (피벗)
interface KmaWeatherData {
  sido: string | null;
  region_name: string;
  base_date: string;
  base_time: string;
  T1H: number | null;
  RN1: number | null;
  REH: number | null;
  VEC: number | null;
  WSD: number | null;
}

// 2일 전 날짜 계산
const getTwoDaysAgo = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() - 2);
  return date;
};

// 날짜 포맷팅 (YYYY-MM-DD)
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// 연도 배열 생성
const getYearRange = (startDate: Date, endDate: Date): number[] => {
  const years: number[] = [];
  for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
    years.push(y);
  }
  return years;
};

// 월 배열 생성
const getMonthRange = (startDate: Date, endDate: Date, selectedYear: number): number[] => {
  const months: number[] = [];
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  let startMonth = 1;
  let endMonth = 12;

  if (selectedYear === startYear) {
    startMonth = startDate.getMonth() + 1;
  }
  if (selectedYear === endYear) {
    endMonth = endDate.getMonth() + 1;
  }

  for (let m = startMonth; m <= endMonth; m++) {
    months.push(m);
  }
  return months;
};

// 일 배열 생성
const getDayRange = (startDate: Date, endDate: Date, selectedYear: number, selectedMonth: number): number[] => {
  const days: number[] = [];
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth() + 1;

  // 해당 월의 마지막 날
  const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  let startDay = 1;
  let endDay = lastDayOfMonth;

  if (selectedYear === startYear && selectedMonth === startMonth) {
    startDay = startDate.getDate();
  }
  if (selectedYear === endYear && selectedMonth === endMonth) {
    endDay = Math.min(endDate.getDate(), lastDayOfMonth);
  }

  for (let d = startDay; d <= endDay; d++) {
    days.push(d);
  }
  return days;
};

// RDA 관측소에 도 정보 추가하기 위한 매핑 (관측소명 기준)
const getProvinceFromStationName = (stnName: string): string => {
  if (stnName.includes('서울')) return '서울특별시';
  if (stnName.includes('부산')) return '부산광역시';
  if (stnName.includes('대구') || stnName.includes('경산') || stnName.includes('청도') || stnName.includes('군위') || stnName.includes('칠곡') || stnName.includes('성주')) return '대구광역시/경상북도';
  if (stnName.includes('인천') || stnName.includes('옹진')) return '인천광역시';
  if (stnName.includes('광주')) return '광주광역시';
  if (stnName.includes('대전')) return '대전광역시';
  if (stnName.includes('울산') || stnName.includes('울주')) return '울산광역시';
  if (stnName.includes('제주') || stnName.includes('서귀포')) return '제주특별자치도';

  // 경기도
  if (['고양', '파주', '김포', '시흥', '화성', '용인', '평택', '안성', '광주', '이천', '여주', '남양주', '양평', '가평', '양주', '연천', '포천', '수원'].some(city => stnName.includes(city))) {
    return '경기도';
  }

  // 강원도
  if (['춘천', '화천', '강릉', '양양', '속초', '원주', '횡성', '영월', '평창', '정선', '태백', '동해', '삼척', '홍천', '인제', '양구', '철원'].some(city => stnName.includes(city))) {
    return '강원특별자치도';
  }

  // 충청북도
  if (['청주', '청원', '진천', '음성', '충주', '제천', '영동', '옥천', '보은', '괴산', '증평', '단양'].some(city => stnName.includes(city))) {
    return '충청북도';
  }

  // 충청남도
  if (['천안', '공주', '금산', '논산', '계룡', '부여', '아산', '예산', '당진', '청양', '홍성', '보령', '태안', '서산'].some(city => stnName.includes(city))) {
    return '충청남도';
  }

  // 전라북도 (전북특별자치도)
  if (['전주', '완주', '임실', '진안', '익산', '김제', '정읍', '무주', '남원', '순창', '장수', '군산', '부안', '고창'].some(city => stnName.includes(city))) {
    return '전북특별자치도';
  }

  // 전라남도
  if (['목포', '영광', '장성', '곡성', '화순', '나주', '함평', '영암', '장흥', '무안', '신안', '해남', '완도', '진도', '순천', '구례', '보성', '고흥', '여수', '강진', '담양'].some(city => stnName.includes(city))) {
    return '전라남도';
  }

  // 경상북도
  if (['포항', '경주', '영천', '구미', '상주', '영주', '봉화', '예천', '안동', '청송', '영양', '영덕', '울진', '의성', '문경'].some(city => stnName.includes(city))) {
    return '경상북도';
  }

  // 경상남도
  if (['창원', '김해', '밀양', '창녕', '고성', '통영', '거제', '진주', '사천', '하동', '남해', '거창', '합천', '함양', '산청', '의령'].some(city => stnName.includes(city))) {
    return '경상남도';
  }

  return '기타';
};

const PastWeather = () => {
  // 기관 선택
  const [institution, setInstitution] = useState<Institution>('RDA');

  // RDA 상태
  const [rdaStations, setRdaStations] = useState<RdaStation[]>([]);
  const [rdaProvinces, setRdaProvinces] = useState<string[]>([]);
  const [selectedRdaProvince, setSelectedRdaProvince] = useState<string>('');
  const [filteredRdaStations, setFilteredRdaStations] = useState<RdaStation[]>([]);
  const [selectedRdaStation, setSelectedRdaStation] = useState<string>('');

  // KMA 상태
  const [kmaRegions, setKmaRegions] = useState<KmaRegion[]>([]);
  const [kmaSidos, setKmaSidos] = useState<string[]>([]);
  const [selectedKmaSido, setSelectedKmaSido] = useState<string>('');
  const [filteredKmaRegions, setFilteredKmaRegions] = useState<KmaRegion[]>([]);
  const [selectedKmaRegion, setSelectedKmaRegion] = useState<string>('');

  // 데이터 기간 (선택된 관측소/지역 기준)
  const [dataStartDate, setDataStartDate] = useState<Date | null>(null);
  const [dataEndDate, setDataEndDate] = useState<Date | null>(null);

  // 선택된 기간
  const [startYear, setStartYear] = useState<number>(0);
  const [startMonth, setStartMonth] = useState<number>(0);
  const [startDay, setStartDay] = useState<number>(0);
  const [endYear, setEndYear] = useState<number>(0);
  const [endMonth, setEndMonth] = useState<number>(0);
  const [endDay, setEndDay] = useState<number>(0);

  // 조회 결과
  const [queryResults, setQueryResults] = useState<(RdaDailyData | KmaWeatherData)[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // RDA 관측소 목록 로드 (일별 데이터 기준)
  useEffect(() => {
    const fetchRdaStations = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/rda/weather/stations`);
        if (response.ok) {
          const data: RdaStation[] = await response.json();
          setRdaStations(data);

          // 관측소명에서 도 추출
          const provinceSet = new Set<string>();
          data.forEach(station => {
            const province = getProvinceFromStationName(station.stn_name);
            provinceSet.add(province);
          });

          const provinces = Array.from(provinceSet).sort();
          setRdaProvinces(provinces);
        }
      } catch (err) {
        console.error('RDA 관측소 목록 로드 실패:', err);
      }
    };
    fetchRdaStations();
  }, []);

  // KMA 지역 목록 로드
  useEffect(() => {
    const fetchKmaRegions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/kma/realtime/regions`);
        if (response.ok) {
          const data: KmaRegion[] = await response.json();
          setKmaRegions(data);

          // 시도 목록 추출
          const sidos = [...new Set(data.map(r => r.sido).filter(Boolean))] as string[];
          setKmaSidos(sidos.sort());
        }
      } catch (err) {
        console.error('KMA 지역 목록 로드 실패:', err);
      }
    };
    fetchKmaRegions();
  }, []);

  // RDA 도 선택 시 관측소 필터링
  useEffect(() => {
    if (selectedRdaProvince) {
      const filtered = rdaStations.filter(s => {
        const province = getProvinceFromStationName(s.stn_name);
        return province === selectedRdaProvince;
      });
      setFilteredRdaStations(filtered);
      setSelectedRdaStation('');
      setDataStartDate(null);
      setDataEndDate(null);
      resetDateSelections();
    } else {
      setFilteredRdaStations([]);
    }
  }, [selectedRdaProvince, rdaStations]);

  // KMA 시도 선택 시 지역 필터링
  useEffect(() => {
    if (selectedKmaSido) {
      const filtered = kmaRegions.filter(r => r.sido === selectedKmaSido);
      setFilteredKmaRegions(filtered);
      setSelectedKmaRegion('');
      setDataStartDate(null);
      setDataEndDate(null);
      resetDateSelections();
    } else {
      setFilteredKmaRegions([]);
    }
  }, [selectedKmaSido, kmaRegions]);

  // 날짜 선택 초기화
  const resetDateSelections = () => {
    setStartYear(0);
    setStartMonth(0);
    setStartDay(0);
    setEndYear(0);
    setEndMonth(0);
    setEndDay(0);
  };

  // RDA 관측소 선택 시 데이터 기간 설정
  useEffect(() => {
    if (selectedRdaStation) {
      const station = rdaStations.find(s => s.stn_cd === selectedRdaStation);
      if (station && station.first_date && station.last_date) {
        const dataStart = new Date(station.first_date);
        const twoDaysAgo = getTwoDaysAgo();
        const lastDate = new Date(station.last_date);

        // 종료일은 2일 전과 last_date 중 더 이른 날짜
        const end = twoDaysAgo < lastDate ? twoDaysAgo : lastDate;

        // 데이터 범위 설정 (선택 가능한 전체 범위)
        setDataStartDate(dataStart);
        setDataEndDate(end);

        // 기본 조회 시작일: 최근 1개월 전 (단, 데이터 시작일보다 이전이면 데이터 시작일 사용)
        const oneMonthAgo = new Date(end);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const defaultStart = oneMonthAgo > dataStart ? oneMonthAgo : dataStart;

        // 기본값 설정: 시작 = 최근 1개월 전, 종료 = 2일 전
        setStartYear(defaultStart.getFullYear());
        setStartMonth(defaultStart.getMonth() + 1);
        setStartDay(defaultStart.getDate());
        setEndYear(end.getFullYear());
        setEndMonth(end.getMonth() + 1);
        setEndDay(end.getDate());
      }
    }
  }, [selectedRdaStation, rdaStations]);

  // KMA 지역 선택 시 데이터 기간 설정
  useEffect(() => {
    if (selectedKmaRegion) {
      const region = kmaRegions.find(r => r.region_name === selectedKmaRegion);
      if (region && region.first_date && region.last_date) {
        const dataStart = new Date(region.first_date);
        const twoDaysAgo = getTwoDaysAgo();
        const lastDate = new Date(region.last_date);

        // 종료일은 2일 전과 last_date 중 더 이른 날짜
        const end = twoDaysAgo < lastDate ? twoDaysAgo : lastDate;

        // 데이터 범위 설정 (선택 가능한 전체 범위)
        setDataStartDate(dataStart);
        setDataEndDate(end);

        // 기본 조회 시작일: 최근 1개월 전 (단, 데이터 시작일보다 이전이면 데이터 시작일 사용)
        const oneMonthAgo = new Date(end);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const defaultStart = oneMonthAgo > dataStart ? oneMonthAgo : dataStart;

        // 기본값 설정: 시작 = 최근 1개월 전, 종료 = 종료일
        setStartYear(defaultStart.getFullYear());
        setStartMonth(defaultStart.getMonth() + 1);
        setStartDay(defaultStart.getDate());
        setEndYear(end.getFullYear());
        setEndMonth(end.getMonth() + 1);
        setEndDay(end.getDate());
      }
    }
  }, [selectedKmaRegion, kmaRegions]);

  // 기관 변경 시 초기화
  useEffect(() => {
    setShowResults(false);
    setQueryResults([]);
    setDataStartDate(null);
    setDataEndDate(null);
    resetDateSelections();
    if (institution === 'RDA') {
      setSelectedKmaSido('');
      setSelectedKmaRegion('');
    } else {
      setSelectedRdaProvince('');
      setSelectedRdaStation('');
    }
  }, [institution]);

  // 연도/월/일 옵션 계산
  const yearOptions = useMemo(() => {
    if (!dataStartDate || !dataEndDate) return [];
    return getYearRange(dataStartDate, dataEndDate);
  }, [dataStartDate, dataEndDate]);

  const startMonthOptions = useMemo(() => {
    if (!dataStartDate || !dataEndDate || !startYear) return [];
    return getMonthRange(dataStartDate, dataEndDate, startYear);
  }, [dataStartDate, dataEndDate, startYear]);

  const startDayOptions = useMemo(() => {
    if (!dataStartDate || !dataEndDate || !startYear || !startMonth) return [];
    return getDayRange(dataStartDate, dataEndDate, startYear, startMonth);
  }, [dataStartDate, dataEndDate, startYear, startMonth]);

  const endMonthOptions = useMemo(() => {
    if (!dataStartDate || !dataEndDate || !endYear) return [];
    return getMonthRange(dataStartDate, dataEndDate, endYear);
  }, [dataStartDate, dataEndDate, endYear]);

  const endDayOptions = useMemo(() => {
    if (!dataStartDate || !dataEndDate || !endYear || !endMonth) return [];
    return getDayRange(dataStartDate, dataEndDate, endYear, endMonth);
  }, [dataStartDate, dataEndDate, endYear, endMonth]);

  // 조회 버튼 클릭
  const handleQuery = async () => {
    if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
      setError('기간을 모두 선택해주세요.');
      return;
    }

    const startDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const endDateStr = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    setLoading(true);
    setError(null);

    try {
      if (institution === 'RDA' && selectedRdaStation) {
        // RDA 일별 데이터 조회
        const response = await fetch(
          `${API_BASE_URL}/api/rda/weather/daily/range?start_date=${startDateStr}&end_date=${endDateStr}&stn_cd=${selectedRdaStation}&limit=20`
        );
        if (response.ok) {
          const data = await response.json();
          setQueryResults(data.data || []);
          setTotalCount(data.total || 0);
          setShowResults(true);
        } else {
          const errorData = await response.json();
          setError(errorData.detail || '데이터 조회 실패');
        }
      } else if (institution === 'KMA' && selectedKmaRegion) {
        // KMA 데이터 조회
        const response = await fetch(
          `${API_BASE_URL}/api/kma/realtime/region/${encodeURIComponent(selectedKmaRegion)}?target_date=${startDateStr}&limit=20`
        );
        if (response.ok) {
          const data = await response.json();
          setQueryResults(data.data || []);
          setTotalCount(data.total || 0);
          setShowResults(true);
        } else {
          const errorData = await response.json();
          setError(errorData.detail || '데이터 조회 실패');
        }
      }
    } catch (err) {
      console.error('데이터 조회 실패:', err);
      setError('데이터 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // CSV 다운로드
  const handleDownloadCSV = () => {
    if (queryResults.length === 0) return;

    let csvContent = '';

    if (institution === 'RDA') {
      csvContent = '관측소코드,관측소명,날짜,평균기온,최고기온,최저기온,평균습도,평균풍속,강수량,일사량\n';
      (queryResults as RdaDailyData[]).forEach(row => {
        csvContent += `${row.stn_cd},${row.stn_name},${row.date},${row.temp ?? ''},${row.hghst_artmp ?? ''},${row.lowst_artmp ?? ''},${row.hum ?? ''},${row.wind ?? ''},${row.rn ?? ''},${row.srqty ?? ''}\n`;
      });
    } else {
      csvContent = '지역명,날짜,시간,기온,습도,풍속,풍향,강수량\n';
      (queryResults as KmaWeatherData[]).forEach(row => {
        csvContent += `${row.region_name},${row.base_date},${row.base_time},${row.T1H ?? ''},${row.REH ?? ''},${row.WSD ?? ''},${row.VEC ?? ''},${row.RN1 ?? ''}\n`;
      });
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `weather_data_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Excel 다운로드
  const handleDownloadExcel = () => {
    if (queryResults.length === 0) return;

    let csvContent = '';

    if (institution === 'RDA') {
      csvContent = '관측소코드\t관측소명\t날짜\t평균기온\t최고기온\t최저기온\t평균습도\t평균풍속\t강수량\t일사량\n';
      (queryResults as RdaDailyData[]).forEach(row => {
        csvContent += `${row.stn_cd}\t${row.stn_name}\t${row.date}\t${row.temp ?? ''}\t${row.hghst_artmp ?? ''}\t${row.lowst_artmp ?? ''}\t${row.hum ?? ''}\t${row.wind ?? ''}\t${row.rn ?? ''}\t${row.srqty ?? ''}\n`;
      });
    } else {
      csvContent = '지역명\t날짜\t시간\t기온\t습도\t풍속\t풍향\t강수량\n';
      (queryResults as KmaWeatherData[]).forEach(row => {
        csvContent += `${row.region_name}\t${row.base_date}\t${row.base_time}\t${row.T1H ?? ''}\t${row.REH ?? ''}\t${row.WSD ?? ''}\t${row.VEC ?? ''}\t${row.RN1 ?? ''}\n`;
      });
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `weather_data_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
  };

  // 조회 가능 여부
  const canQuery = institution === 'RDA'
    ? selectedRdaStation && startYear && startMonth && startDay && endYear && endMonth && endDay
    : selectedKmaRegion && startYear && startMonth && startDay && endYear && endMonth && endDay;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Page Title */}
      <h2 className="text-base font-medium text-gray-600">과거기상현황</h2>

      {/* Data Selection Section */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">데이터 선택</h3>

        {/* 기관 및 지역 선택 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* 기관 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">기관</label>
            <select
              value={institution}
              onChange={(e) => setInstitution(e.target.value as Institution)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="RDA">국립농업과학원 (RDA)</option>
              <option value="KMA">기상청 (KMA)</option>
            </select>
          </div>

          {/* 지역 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">지역</label>
            <div className="flex gap-2">
              {institution === 'RDA' ? (
                <>
                  <select
                    value={selectedRdaProvince}
                    onChange={(e) => setSelectedRdaProvince(e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">도 선택</option>
                    {rdaProvinces.map(province => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                  <select
                    value={selectedRdaStation}
                    onChange={(e) => setSelectedRdaStation(e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    disabled={!selectedRdaProvince}
                  >
                    <option value="">시/군 선택</option>
                    {filteredRdaStations.map(station => (
                      <option key={station.stn_cd} value={station.stn_cd}>{station.stn_name}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <select
                    value={selectedKmaSido}
                    onChange={(e) => setSelectedKmaSido(e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">도 선택</option>
                    {kmaSidos.map(sido => (
                      <option key={sido} value={sido}>{sido}</option>
                    ))}
                  </select>
                  <select
                    value={selectedKmaRegion}
                    onChange={(e) => setSelectedKmaRegion(e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    disabled={!selectedKmaSido}
                  >
                    <option value="">시/군 선택</option>
                    {filteredKmaRegions.map(region => (
                      <option key={region.region_name} value={region.region_name}>{region.region_name}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 기간 선택 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">기간</label>
          <div className="flex flex-wrap items-center gap-2">
            {/* 시작 기간 */}
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-600 mr-2">시작</span>
              <select
                value={startYear || ''}
                onChange={(e) => {
                  setStartYear(Number(e.target.value));
                  setStartMonth(0);
                  setStartDay(0);
                }}
                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                disabled={yearOptions.length === 0}
              >
                <option value="">년도</option>
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select
                value={startMonth || ''}
                onChange={(e) => {
                  setStartMonth(Number(e.target.value));
                  setStartDay(0);
                }}
                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                disabled={startMonthOptions.length === 0}
              >
                <option value="">월</option>
                {startMonthOptions.map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <select
                value={startDay || ''}
                onChange={(e) => setStartDay(Number(e.target.value))}
                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                disabled={startDayOptions.length === 0}
              >
                <option value="">일</option>
                {startDayOptions.map(d => (
                  <option key={d} value={d}>{d}일</option>
                ))}
              </select>
            </div>

            <span className="text-gray-500 mx-2">~</span>

            {/* 종료 기간 */}
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-600 mr-2">종료</span>
              <select
                value={endYear || ''}
                onChange={(e) => {
                  setEndYear(Number(e.target.value));
                  setEndMonth(0);
                  setEndDay(0);
                }}
                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                disabled={yearOptions.length === 0}
              >
                <option value="">년도</option>
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select
                value={endMonth || ''}
                onChange={(e) => {
                  setEndMonth(Number(e.target.value));
                  setEndDay(0);
                }}
                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                disabled={endMonthOptions.length === 0}
              >
                <option value="">월</option>
                {endMonthOptions.map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <select
                value={endDay || ''}
                onChange={(e) => setEndDay(Number(e.target.value))}
                className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                disabled={endDayOptions.length === 0}
              >
                <option value="">일</option>
                {endDayOptions.map(d => (
                  <option key={d} value={d}>{d}일</option>
                ))}
              </select>
            </div>

            {/* 조회 버튼 */}
            <button
              onClick={handleQuery}
              disabled={!canQuery || loading}
              className="ml-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? '조회 중...' : '조회'}
            </button>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <p className="mt-2 text-sm text-red-500">{error}</p>
          )}
        </div>
      </div>

      {/* Results Section */}
      {showResults && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-800">
              조회 결과 <span className="text-sm font-normal text-gray-500">(총 {totalCount}건 중 {queryResults.length}건 표시)</span>
            </h3>

            {/* 다운로드 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={handleDownloadCSV}
                disabled={queryResults.length === 0}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                CSV 다운로드
              </button>
              <button
                onClick={handleDownloadExcel}
                disabled={queryResults.length === 0}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Excel 다운로드
              </button>
            </div>
          </div>

          {/* 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  {institution === 'RDA' ? (
                    <>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">관측소</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">날짜</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">평균기온(°C)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">최고기온(°C)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">최저기온(°C)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">평균습도(%)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">평균풍속(m/s)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">강수량(mm)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">일사량(MJ/m²)</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">지역</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">날짜</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">시간</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">기온(°C)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">습도(%)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">풍속(m/s)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">강수량(mm)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {queryResults.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      조회된 데이터가 없습니다.
                    </td>
                  </tr>
                ) : institution === 'RDA' ? (
                  (queryResults as RdaDailyData[]).map((row, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">{row.stn_name}</td>
                      <td className="px-4 py-3">{row.date}</td>
                      <td className="px-4 py-3 text-right">{row.temp?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.hghst_artmp?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.lowst_artmp?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.hum?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.wind?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.rn?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.srqty?.toFixed(1) ?? '-'}</td>
                    </tr>
                  ))
                ) : (
                  (queryResults as KmaWeatherData[]).map((row, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">{row.region_name}</td>
                      <td className="px-4 py-3">{row.base_date}</td>
                      <td className="px-4 py-3">{row.base_time?.slice(0, 2)}:{row.base_time?.slice(2, 4)}</td>
                      <td className="px-4 py-3 text-right">{row.T1H?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.REH?.toFixed(0) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.WSD?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.RN1?.toFixed(1) ?? '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PastWeather;
