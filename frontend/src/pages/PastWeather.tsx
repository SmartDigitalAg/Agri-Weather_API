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

// KMA ASOS 관측소 정보
interface KmaStation {
  stn_id: number;
  stn_nm: string;
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

// KMA ASOS 일별 기상 데이터
interface KmaAsosData {
  id: number;
  stn_id: number;
  stn_nm: string;
  tm: string;             // 날짜
  avg_ta: number | null;  // 평균기온
  min_ta: number | null;  // 최저기온
  max_ta: number | null;  // 최고기온
  sum_rn: number | null;  // 일강수량
  avg_ws: number | null;  // 평균풍속
  avg_rhm: number | null; // 평균상대습도
  sum_ss_hr: number | null; // 일조시간
  sum_gsr: number | null;   // 일사량
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

  // KMA ASOS 상태
  const [kmaStations, setKmaStations] = useState<KmaStation[]>([]);
  const [selectedKmaStation, setSelectedKmaStation] = useState<number | null>(null);

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
  const [queryResults, setQueryResults] = useState<(RdaDailyData | KmaAsosData)[]>([]);
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

  // KMA ASOS 관측소 목록 로드
  useEffect(() => {
    const fetchKmaStations = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/kma/asos/stations`);
        if (response.ok) {
          const data: KmaStation[] = await response.json();
          setKmaStations(data);
        }
      } catch (err) {
        console.error('KMA ASOS 관측소 목록 로드 실패:', err);
      }
    };
    fetchKmaStations();
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

  // KMA ASOS 관측소 선택 시 데이터 기간 설정
  useEffect(() => {
    if (selectedKmaStation) {
      const station = kmaStations.find(s => s.stn_id === selectedKmaStation);
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

        // 기본값 설정: 시작 = 최근 1개월 전, 종료 = 종료일
        setStartYear(defaultStart.getFullYear());
        setStartMonth(defaultStart.getMonth() + 1);
        setStartDay(defaultStart.getDate());
        setEndYear(end.getFullYear());
        setEndMonth(end.getMonth() + 1);
        setEndDay(end.getDate());
      }
    }
  }, [selectedKmaStation, kmaStations]);

  // 기관 변경 시 초기화
  useEffect(() => {
    setShowResults(false);
    setQueryResults([]);
    setDataStartDate(null);
    setDataEndDate(null);
    resetDateSelections();
    if (institution === 'RDA') {
      setSelectedKmaStation(null);
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
      } else if (institution === 'KMA' && selectedKmaStation) {
        // KMA ASOS 일별 데이터 조회
        const response = await fetch(
          `${API_BASE_URL}/api/kma/asos/range?start_date=${startDateStr}&end_date=${endDateStr}&stn_id=${selectedKmaStation}&limit=20`
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

  // 다운로드 로딩 상태
  const [downloadLoading, setDownloadLoading] = useState<string | null>(null);

  // RDA 데이터를 CSV/Excel 문자열로 변환
  const convertRdaDataToString = (data: RdaDailyData[], format: 'csv' | 'excel'): string => {
    const separator = format === 'csv' ? ',' : '\t';
    let content = `관측소코드${separator}관측소명${separator}날짜${separator}평균기온${separator}최고기온${separator}최저기온${separator}평균습도${separator}평균풍속${separator}강수량${separator}일사량\n`;
    data.forEach(row => {
      content += `${row.stn_cd}${separator}${row.stn_name}${separator}${row.date}${separator}${row.temp ?? ''}${separator}${row.hghst_artmp ?? ''}${separator}${row.lowst_artmp ?? ''}${separator}${row.hum ?? ''}${separator}${row.wind ?? ''}${separator}${row.rn ?? ''}${separator}${row.srqty ?? ''}\n`;
    });
    return content;
  };

  // KMA ASOS 데이터를 CSV/Excel 문자열로 변환
  const convertKmaDataToString = (data: KmaAsosData[], format: 'csv' | 'excel'): string => {
    const separator = format === 'csv' ? ',' : '\t';
    let content = `지점ID${separator}지점명${separator}날짜${separator}평균기온${separator}최고기온${separator}최저기온${separator}평균습도${separator}평균풍속${separator}강수량${separator}일사량\n`;
    data.forEach(row => {
      content += `${row.stn_id}${separator}${row.stn_nm}${separator}${row.tm}${separator}${row.avg_ta ?? ''}${separator}${row.max_ta ?? ''}${separator}${row.min_ta ?? ''}${separator}${row.avg_rhm ?? ''}${separator}${row.avg_ws ?? ''}${separator}${row.sum_rn ?? ''}${separator}${row.sum_gsr ?? ''}\n`;
    });
    return content;
  };

  // 파일 다운로드 실행
  const downloadFile = (content: string, filename: string, format: 'csv' | 'excel') => {
    const mimeType = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;';
    const extension = format === 'csv' ? 'csv' : 'xls';
    const blob = new Blob(['\ufeff' + content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.${extension}`;
    link.click();
  };

  // 조회 기간 데이터 다운로드
  const handleDownloadRange = async (format: 'csv' | 'excel') => {
    if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) return;

    const startDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const endDateStr = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    setDownloadLoading(`range-${format}`);

    try {
      if (institution === 'RDA' && selectedRdaStation) {
        const response = await fetch(
          `${API_BASE_URL}/api/rda/weather/daily/range?start_date=${startDateStr}&end_date=${endDateStr}&stn_cd=${selectedRdaStation}&limit=10000`
        );
        if (response.ok) {
          const data = await response.json();
          const content = convertRdaDataToString(data.data || [], format);
          downloadFile(content, `weather_${selectedRdaStation}_${startDateStr}_${endDateStr}`, format);
        }
      } else if (institution === 'KMA' && selectedKmaStation) {
        const response = await fetch(
          `${API_BASE_URL}/api/kma/asos/range?start_date=${startDateStr}&end_date=${endDateStr}&stn_id=${selectedKmaStation}&limit=10000`
        );
        if (response.ok) {
          const data = await response.json();
          const content = convertKmaDataToString(data.data || [], format);
          const station = kmaStations.find(s => s.stn_id === selectedKmaStation);
          downloadFile(content, `weather_${station?.stn_nm || selectedKmaStation}_${startDateStr}_${endDateStr}`, format);
        }
      }
    } catch (err) {
      console.error('다운로드 실패:', err);
      setError('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadLoading(null);
    }
  };

  // 전체 기간 데이터 다운로드
  const handleDownloadAll = async (format: 'csv' | 'excel') => {
    if (!dataStartDate || !dataEndDate) return;

    const startDateStr = formatDate(dataStartDate);
    const endDateStr = formatDate(dataEndDate);

    setDownloadLoading(`all-${format}`);

    try {
      if (institution === 'RDA' && selectedRdaStation) {
        const response = await fetch(
          `${API_BASE_URL}/api/rda/weather/daily/range?start_date=${startDateStr}&end_date=${endDateStr}&stn_cd=${selectedRdaStation}&limit=10000`
        );
        if (response.ok) {
          const data = await response.json();
          const content = convertRdaDataToString(data.data || [], format);
          const station = rdaStations.find(s => s.stn_cd === selectedRdaStation);
          downloadFile(content, `weather_${station?.stn_name || selectedRdaStation}_전체기간`, format);
        }
      } else if (institution === 'KMA' && selectedKmaStation) {
        const response = await fetch(
          `${API_BASE_URL}/api/kma/asos/range?start_date=${startDateStr}&end_date=${endDateStr}&stn_id=${selectedKmaStation}&limit=10000`
        );
        if (response.ok) {
          const data = await response.json();
          const content = convertKmaDataToString(data.data || [], format);
          const station = kmaStations.find(s => s.stn_id === selectedKmaStation);
          downloadFile(content, `weather_${station?.stn_nm || selectedKmaStation}_전체기간`, format);
        }
      }
    } catch (err) {
      console.error('다운로드 실패:', err);
      setError('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadLoading(null);
    }
  };

  // 조회 가능 여부
  const canQuery = institution === 'RDA'
    ? selectedRdaStation && startYear && startMonth && startDay && endYear && endMonth && endDay
    : selectedKmaStation && startYear && startMonth && startDay && endYear && endMonth && endDay;

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
                <select
                  value={selectedKmaStation || ''}
                  onChange={(e) => setSelectedKmaStation(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">관측소 선택</option>
                  {kmaStations.map(station => (
                    <option key={station.stn_id} value={station.stn_id}>{station.stn_nm}</option>
                  ))}
                </select>
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
          {/* 상단 정보 및 다운로드 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-800">
                조회 결과 <span className="text-sm font-normal text-gray-500">(총 {totalCount}건 중 {queryResults.length}건 미리보기)</span>
              </h3>
            </div>

            {/* 데이터 기간 정보 */}
            {dataStartDate && dataEndDate && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">데이터 보유 기간:</span> {formatDate(dataStartDate)} ~ {formatDate(dataEndDate)}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">현재 조회 기간:</span> {startYear}-{String(startMonth).padStart(2, '0')}-{String(startDay).padStart(2, '0')} ~ {endYear}-{String(endMonth).padStart(2, '0')}-{String(endDay).padStart(2, '0')}
                </p>
              </div>
            )}

            {/* 다운로드 버튼 그룹 */}
            <div className="flex flex-wrap gap-4">
              {/* 조회 기간 다운로드 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 font-medium">조회 기간 다운로드:</span>
                <button
                  onClick={() => handleDownloadRange('csv')}
                  disabled={!canQuery || downloadLoading !== null}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {downloadLoading === 'range-csv' ? '다운로드 중...' : 'CSV'}
                </button>
                <button
                  onClick={() => handleDownloadRange('excel')}
                  disabled={!canQuery || downloadLoading !== null}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {downloadLoading === 'range-excel' ? '다운로드 중...' : 'Excel'}
                </button>
              </div>

              {/* 전체 기간 다운로드 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 font-medium">전체 기간 다운로드:</span>
                <button
                  onClick={() => handleDownloadAll('csv')}
                  disabled={!dataStartDate || !dataEndDate || downloadLoading !== null}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {downloadLoading === 'all-csv' ? '다운로드 중...' : 'CSV'}
                </button>
                <button
                  onClick={() => handleDownloadAll('excel')}
                  disabled={!dataStartDate || !dataEndDate || downloadLoading !== null}
                  className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {downloadLoading === 'all-excel' ? '다운로드 중...' : 'Excel'}
                </button>
              </div>
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
                  (queryResults as KmaAsosData[]).map((row, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">{row.stn_nm}</td>
                      <td className="px-4 py-3">{row.tm}</td>
                      <td className="px-4 py-3 text-right">{row.avg_ta?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.max_ta?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.min_ta?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.avg_rhm?.toFixed(0) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.avg_ws?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.sum_rn?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.sum_gsr?.toFixed(1) ?? '-'}</td>
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
