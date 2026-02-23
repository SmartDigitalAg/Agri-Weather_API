import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import PastWeatherMap from '../components/PastWeatherMap';
import NullDataMap from '../components/NullDataMap';

const API_BASE_URL = 'http://3.35.171.253:8001';

// 기관 타입
type Institution = 'RDA' | 'KMA';

// 데이터 유형 탭
type DataType = 'daily' | 'hourly';

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

// KMA 시간별 기상 데이터
interface KmaHourlyData {
  tm: string;             // 시간
  stnId: string;          // 지점번호
  stnNm: string;          // 지점명
  ta: string | null;      // 기온
  rn: string | null;      // 강수량
  ws: string | null;      // 풍속
  wd: string | null;      // 풍향
  hm: string | null;      // 습도
  icsr: string | null;    // 일사량
}

// RDA 시간별 기상 데이터
interface RdaHourlyData {
  stn_Cd: string;         // 관측지점코드
  stn_Name: string;       // 관측지점명
  date: string;           // 관측일자
  time: string;           // 관측시간
  temp: string | null;    // 기온
  hum: string | null;     // 습도
  widdir: string | null;  // 풍향
  wind: string | null;    // 풍속
  rn: string | null;      // 강수량
  srqty: string | null;   // 일사량
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
  // 데이터 유형 탭 (일별/시간별)
  const [dataType, setDataType] = useState<DataType>('daily');

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

  // 관측소 목록 로딩 상태
  const [rdaStationsLoading, setRdaStationsLoading] = useState<boolean>(true);
  const [kmaStationsLoading, setKmaStationsLoading] = useState<boolean>(true);

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

  // 조회 결과 (일별)
  const [queryResults, setQueryResults] = useState<(RdaDailyData | KmaAsosData)[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 조회 결과 (시간별)
  const [hourlyResults, setHourlyResults] = useState<(KmaHourlyData | RdaHourlyData)[]>([]);
  const [hourlyTotalCount, setHourlyTotalCount] = useState<number>(0);
  const [showHourlyResults, setShowHourlyResults] = useState<boolean>(false);
  const [hourlyLoading, setHourlyLoading] = useState<boolean>(false);
  const [hourlyError, setHourlyError] = useState<string | null>(null);
  const [hourlyProgress, setHourlyProgress] = useState<number>(0); // 진행률 (0-100)

  // 시간별 조회용 날짜 (YYYYMMDD 형식)
  const [hourlyStartDate, setHourlyStartDate] = useState<string>('');
  const [hourlyEndDate, setHourlyEndDate] = useState<string>('');

  // RDA 관측소 목록 로드 (일별 데이터 기준)
  useEffect(() => {
    const fetchRdaStations = async () => {
      setRdaStationsLoading(true);
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
      } finally {
        setRdaStationsLoading(false);
      }
    };
    fetchRdaStations();
  }, []);

  // KMA ASOS 관측소 목록 로드
  useEffect(() => {
    const fetchKmaStations = async () => {
      setKmaStationsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/kma/asos/stations`);
        if (response.ok) {
          const data: KmaStation[] = await response.json();
          setKmaStations(data);
        }
      } catch (err) {
        console.error('KMA ASOS 관측소 목록 로드 실패:', err);
      } finally {
        setKmaStationsLoading(false);
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
    setShowHourlyResults(false);
    setHourlyResults([]);
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

  // 데이터 유형 변경 시 결과 초기화
  useEffect(() => {
    setShowResults(false);
    setQueryResults([]);
    setShowHourlyResults(false);
    setHourlyResults([]);
    setError(null);
    setHourlyError(null);
  }, [dataType]);

  // 시간별 날짜 기본값 설정 (최근 3일)
  useEffect(() => {
    const today = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(today.getDate() - 3);

    const formatDateYYYYMMDD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    setHourlyStartDate(formatDateYYYYMMDD(threeDaysAgo));
    setHourlyEndDate(formatDateYYYYMMDD(today));
  }, []);

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

  // 날짜 범위 생성 함수 (YYYYMMDD 형식)
  const getDateRange = (startStr: string, endStr: string): string[] => {
    const dates: string[] = [];
    const start = new Date(
      parseInt(startStr.substring(0, 4)),
      parseInt(startStr.substring(4, 6)) - 1,
      parseInt(startStr.substring(6, 8))
    );
    const end = new Date(
      parseInt(endStr.substring(0, 4)),
      parseInt(endStr.substring(4, 6)) - 1,
      parseInt(endStr.substring(6, 8))
    );

    const current = new Date(start);
    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      dates.push(`${year}${month}${day}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  // 시간별 데이터 조회
  const handleHourlyQuery = async () => {
    if (!hourlyStartDate || !hourlyEndDate) {
      setHourlyError('기간을 입력해주세요.');
      return;
    }

    // 날짜 형식 검증 (YYYYMMDD)
    if (!/^\d{8}$/.test(hourlyStartDate) || !/^\d{8}$/.test(hourlyEndDate)) {
      setHourlyError('날짜 형식은 YYYYMMDD 여야 합니다.');
      return;
    }

    setHourlyLoading(true);
    setHourlyError(null);
    setHourlyProgress(0);
    setHourlyResults([]);
    setShowHourlyResults(false);

    try {
      if (institution === 'RDA' && selectedRdaStation) {
        // RDA: 날짜별로 개별 호출하여 진행률 표시
        const dates = getDateRange(hourlyStartDate, hourlyEndDate);
        const totalDays = dates.length;
        const allData: RdaHourlyData[] = [];

        for (let i = 0; i < dates.length; i++) {
          const dateStr = dates[i];
          try {
            const response = await fetch(
              `${API_BASE_URL}/api/rda/weather/hr/${selectedRdaStation}/${dateStr}/${dateStr}?format=json`
            );
            if (response.ok) {
              const data = await response.json();
              if (data.data && data.data.length > 0) {
                allData.push(...data.data);
              }
            }
          } catch (err) {
            console.error(`날짜 ${dateStr} 조회 실패:`, err);
          }
          // 진행률 업데이트
          setHourlyProgress(Math.round(((i + 1) / totalDays) * 100));
        }

        setHourlyResults(allData);
        setHourlyTotalCount(allData.length);
        setShowHourlyResults(true);

      } else if (institution === 'KMA' && selectedKmaStation) {
        // KMA: 31일 단위로 나눠서 호출
        const dates = getDateRange(hourlyStartDate, hourlyEndDate);
        const totalDays = dates.length;
        const allData: KmaHourlyData[] = [];

        // 31일 단위로 청크 분할
        const chunkSize = 31;
        const chunks: { start: string; end: string }[] = [];
        for (let i = 0; i < dates.length; i += chunkSize) {
          const chunkDates = dates.slice(i, i + chunkSize);
          chunks.push({
            start: chunkDates[0],
            end: chunkDates[chunkDates.length - 1]
          });
        }

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          try {
            const response = await fetch(
              `${API_BASE_URL}/api/kma/asos/hr/${selectedKmaStation}/${chunk.start}/${chunk.end}?format=json`
            );
            if (response.ok) {
              const data = await response.json();
              if (data.data && data.data.length > 0) {
                allData.push(...data.data);
              }
            }
          } catch (err) {
            console.error(`기간 ${chunk.start}~${chunk.end} 조회 실패:`, err);
          }
          // 진행률 업데이트
          setHourlyProgress(Math.round(((i + 1) / chunks.length) * 100));
        }

        setHourlyResults(allData);
        setHourlyTotalCount(allData.length);
        setShowHourlyResults(true);
      }
    } catch (err) {
      console.error('시간별 데이터 조회 실패:', err);
      setHourlyError('데이터 조회 중 오류가 발생했습니다.');
    } finally {
      setHourlyLoading(false);
      setHourlyProgress(100);
    }
  };

  // 시간별 데이터 다운로드 (CSV)
  const handleHourlyDownloadCsv = async () => {
    if (!hourlyStartDate || !hourlyEndDate) return;

    setDownloadLoading('hourly-csv');

    try {
      let url = '';
      if (institution === 'RDA' && selectedRdaStation) {
        url = `${API_BASE_URL}/api/rda/weather/hr/${selectedRdaStation}/${hourlyStartDate}/${hourlyEndDate}?format=csv`;
      } else if (institution === 'KMA' && selectedKmaStation) {
        url = `${API_BASE_URL}/api/kma/asos/hr/${selectedKmaStation}/${hourlyStartDate}/${hourlyEndDate}?format=csv`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const stationName = institution === 'RDA' ? selectedRdaStation : selectedKmaStation;
        link.download = `${institution.toLowerCase()}_hourly_${stationName}_${hourlyStartDate}_${hourlyEndDate}.csv`;
        link.click();
      } else {
        setHourlyError('다운로드 실패');
      }
    } catch (err) {
      console.error('다운로드 실패:', err);
      setHourlyError('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadLoading(null);
    }
  };

  // 시간별 데이터 다운로드 (JSON)
  const handleHourlyDownloadJson = async () => {
    if (!hourlyStartDate || !hourlyEndDate) return;

    setDownloadLoading('hourly-json');

    try {
      let url = '';
      if (institution === 'RDA' && selectedRdaStation) {
        url = `${API_BASE_URL}/api/rda/weather/hr/${selectedRdaStation}/${hourlyStartDate}/${hourlyEndDate}?format=json`;
      } else if (institution === 'KMA' && selectedKmaStation) {
        url = `${API_BASE_URL}/api/kma/asos/hr/${selectedKmaStation}/${hourlyStartDate}/${hourlyEndDate}?format=json`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const stationName = institution === 'RDA' ? selectedRdaStation : selectedKmaStation;
        link.download = `${institution.toLowerCase()}_hourly_${stationName}_${hourlyStartDate}_${hourlyEndDate}.json`;
        link.click();
      } else {
        setHourlyError('다운로드 실패');
      }
    } catch (err) {
      console.error('다운로드 실패:', err);
      setHourlyError('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadLoading(null);
    }
  };

  // 시간별 데이터 다운로드 (Excel)
  const handleHourlyDownloadExcel = async () => {
    if (!hourlyStartDate || !hourlyEndDate) return;

    setDownloadLoading('hourly-excel');

    try {
      let url = '';
      if (institution === 'RDA' && selectedRdaStation) {
        url = `${API_BASE_URL}/api/rda/weather/hr/${selectedRdaStation}/${hourlyStartDate}/${hourlyEndDate}?format=json`;
      } else if (institution === 'KMA' && selectedKmaStation) {
        url = `${API_BASE_URL}/api/kma/asos/hr/${selectedKmaStation}/${hourlyStartDate}/${hourlyEndDate}?format=json`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || [];

        let wsData: any[][];
        if (institution === 'KMA') {
          wsData = [
            ['시간', '지점번호', '지점명', '기온(°C)', '강수량(mm)', '풍속(m/s)', '풍향(°)', '습도(%)', '일사량(MJ/m²)'],
            ...data.map((row: KmaHourlyData) => [
              row.tm || '',
              row.stnId || '',
              row.stnNm || '',
              row.ta ?? '',
              row.rn ?? '',
              row.ws ?? '',
              row.wd ?? '',
              row.hm ?? '',
              row.icsr ?? ''
            ])
          ];
        } else {
          wsData = [
            ['날짜', '시간', '지점코드', '지점명', '기온(°C)', '습도(%)', '풍향(°)', '풍속(m/s)', '강수량(mm)', '일사량(MJ/m²)'],
            ...data.map((row: RdaHourlyData) => [
              row.date || '',
              row.time || '',
              row.stn_Cd || '',
              row.stn_Name || '',
              row.temp ?? '',
              row.hum ?? '',
              row.widdir ?? '',
              row.wind ?? '',
              row.rn ?? '',
              row.srqty ?? ''
            ])
          ];
        }

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '시간별기상데이터');
        const stationName = institution === 'RDA' ? selectedRdaStation : selectedKmaStation;
        XLSX.writeFile(wb, `${institution.toLowerCase()}_hourly_${stationName}_${hourlyStartDate}_${hourlyEndDate}.xlsx`);
      } else {
        setHourlyError('다운로드 실패');
      }
    } catch (err) {
      console.error('다운로드 실패:', err);
      setHourlyError('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadLoading(null);
    }
  };

  // 시간별 조회 가능 여부
  const canHourlyQuery = institution === 'RDA'
    ? selectedRdaStation && hourlyStartDate && hourlyEndDate
    : selectedKmaStation && hourlyStartDate && hourlyEndDate;

  // 다운로드 로딩 상태
  const [downloadLoading, setDownloadLoading] = useState<string | null>(null);

  // 지도 연도 슬라이더 상태
  const [mapYear, setMapYear] = useState<number>(2024);

  // NULL 데이터 지도 모달 상태
  const [showNullDataMap, setShowNullDataMap] = useState<boolean>(false);

  // RDA 데이터를 CSV 문자열로 변환
  const convertRdaDataToCsv = (data: RdaDailyData[]): string => {
    let content = `관측소코드,관측소명,날짜,평균기온,최고기온,최저기온,평균습도,평균풍속,강수량,일사량\n`;
    data.forEach(row => {
      content += `${row.stn_cd},${row.stn_name},${row.date},${row.temp ?? ''},${row.hghst_artmp ?? ''},${row.lowst_artmp ?? ''},${row.hum ?? ''},${row.wind ?? ''},${row.rn ?? ''},${row.srqty ?? ''}\n`;
    });
    return content;
  };

  // KMA ASOS 데이터를 CSV 문자열로 변환
  const convertKmaDataToCsv = (data: KmaAsosData[]): string => {
    let content = `지점ID,지점명,날짜,평균기온,최고기온,최저기온,평균습도,평균풍속,강수량,일사량\n`;
    data.forEach(row => {
      content += `${row.stn_id},${row.stn_nm},${row.tm},${row.avg_ta ?? ''},${row.max_ta ?? ''},${row.min_ta ?? ''},${row.avg_rhm ?? ''},${row.avg_ws ?? ''},${row.sum_rn ?? ''},${row.sum_gsr ?? ''}\n`;
    });
    return content;
  };

  // RDA 데이터를 Excel 워크북으로 변환
  const convertRdaDataToExcel = (data: RdaDailyData[]): XLSX.WorkBook => {
    const wsData = [
      ['관측소코드', '관측소명', '날짜', '평균기온', '최고기온', '최저기온', '평균습도', '평균풍속', '강수량', '일사량'],
      ...data.map(row => [
        row.stn_cd,
        row.stn_name,
        row.date,
        row.temp ?? '',
        row.hghst_artmp ?? '',
        row.lowst_artmp ?? '',
        row.hum ?? '',
        row.wind ?? '',
        row.rn ?? '',
        row.srqty ?? ''
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '기상데이터');
    return wb;
  };

  // KMA ASOS 데이터를 Excel 워크북으로 변환
  const convertKmaDataToExcel = (data: KmaAsosData[]): XLSX.WorkBook => {
    const wsData = [
      ['지점ID', '지점명', '날짜', '평균기온', '최고기온', '최저기온', '평균습도', '평균풍속', '강수량', '일사량'],
      ...data.map(row => [
        row.stn_id,
        row.stn_nm,
        row.tm,
        row.avg_ta ?? '',
        row.max_ta ?? '',
        row.min_ta ?? '',
        row.avg_rhm ?? '',
        row.avg_ws ?? '',
        row.sum_rn ?? '',
        row.sum_gsr ?? ''
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '기상데이터');
    return wb;
  };

  // CSV 파일 다운로드
  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  // Excel 파일 다운로드
  const downloadExcel = (workbook: XLSX.WorkBook, filename: string) => {
    XLSX.writeFile(workbook, `${filename}.xlsx`);
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
          const filename = `weather_${selectedRdaStation}_${startDateStr}_${endDateStr}`;
          if (format === 'csv') {
            const content = convertRdaDataToCsv(data.data || []);
            downloadCsv(content, filename);
          } else {
            const workbook = convertRdaDataToExcel(data.data || []);
            downloadExcel(workbook, filename);
          }
        }
      } else if (institution === 'KMA' && selectedKmaStation) {
        const response = await fetch(
          `${API_BASE_URL}/api/kma/asos/range?start_date=${startDateStr}&end_date=${endDateStr}&stn_id=${selectedKmaStation}&limit=10000`
        );
        if (response.ok) {
          const data = await response.json();
          const station = kmaStations.find(s => s.stn_id === selectedKmaStation);
          const filename = `weather_${station?.stn_nm || selectedKmaStation}_${startDateStr}_${endDateStr}`;
          if (format === 'csv') {
            const content = convertKmaDataToCsv(data.data || []);
            downloadCsv(content, filename);
          } else {
            const workbook = convertKmaDataToExcel(data.data || []);
            downloadExcel(workbook, filename);
          }
        }
      }
    } catch (err) {
      console.error('다운로드 실패:', err);
      setError('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadLoading(null);
    }
  };

  // 전체 기간 데이터 다운로드 (최근 10년으로 제한)
  const handleDownloadAll = async (format: 'csv' | 'excel') => {
    if (!dataStartDate || !dataEndDate) return;

    // 전체 기간이 너무 길면 최근 10년으로 제한 (약 3650일)
    const tenYearsAgo = new Date(dataEndDate);
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    const effectiveStartDate = tenYearsAgo > dataStartDate ? tenYearsAgo : dataStartDate;

    const startDateStr = formatDate(effectiveStartDate);
    const endDateStr = formatDate(dataEndDate);

    // 다운로드 범위 알림
    if (effectiveStartDate > dataStartDate) {
      const confirmed = window.confirm(
        `전체 데이터가 너무 많아 최근 10년 데이터만 다운로드합니다.\n` +
        `(${startDateStr} ~ ${endDateStr})\n\n` +
        `계속하시겠습니까?`
      );
      if (!confirmed) return;
    }

    setDownloadLoading(`all-${format}`);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초 타임아웃

      if (institution === 'RDA' && selectedRdaStation) {
        const response = await fetch(
          `${API_BASE_URL}/api/rda/weather/daily/range?start_date=${startDateStr}&end_date=${endDateStr}&stn_cd=${selectedRdaStation}&limit=10000`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        if (response.ok) {
          const data = await response.json();
          const station = rdaStations.find(s => s.stn_cd === selectedRdaStation);
          const filename = `weather_${station?.stn_name || selectedRdaStation}_${startDateStr}_${endDateStr}`;
          if (format === 'csv') {
            const content = convertRdaDataToCsv(data.data || []);
            downloadCsv(content, filename);
          } else {
            const workbook = convertRdaDataToExcel(data.data || []);
            downloadExcel(workbook, filename);
          }
        } else {
          setError('서버 오류가 발생했습니다.');
        }
      } else if (institution === 'KMA' && selectedKmaStation) {
        const response = await fetch(
          `${API_BASE_URL}/api/kma/asos/range?start_date=${startDateStr}&end_date=${endDateStr}&stn_id=${selectedKmaStation}&limit=10000`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        if (response.ok) {
          const data = await response.json();
          const station = kmaStations.find(s => s.stn_id === selectedKmaStation);
          const filename = `weather_${station?.stn_nm || selectedKmaStation}_${startDateStr}_${endDateStr}`;
          if (format === 'csv') {
            const content = convertKmaDataToCsv(data.data || []);
            downloadCsv(content, filename);
          } else {
            const workbook = convertKmaDataToExcel(data.data || []);
            downloadExcel(workbook, filename);
          }
        } else {
          setError('서버 오류가 발생했습니다.');
        }
      }
    } catch (err: any) {
      console.error('다운로드 실패:', err);
      if (err.name === 'AbortError') {
        setError('요청 시간이 초과되었습니다. 조회 기간을 줄여서 다시 시도해주세요.');
      } else {
        setError('다운로드 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.');
      }
    } finally {
      setDownloadLoading(null);
    }
  };

  // 조회 가능 여부
  const canQuery = institution === 'RDA'
    ? selectedRdaStation && startYear && startMonth && startDay && endYear && endMonth && endDay
    : selectedKmaStation && startYear && startMonth && startDay && endYear && endMonth && endDay;

  // RDA 시간별 데이터의 날짜/시간 파싱 (date에 시간이 포함되어 있을 수 있음)
  const parseRdaDateTime = (date: string | undefined, time: string | undefined) => {
    let dateStr = date || '';
    let timeStr = time || '';

    // date에 시간이 포함되어 있고 time이 비어있으면 분리
    if (dateStr.includes(' ') && !timeStr) {
      const parts = dateStr.split(' ');
      dateStr = parts[0];
      timeStr = parts[1] || '';
    }

    return { date: dateStr, time: timeStr };
  };

  // 지도에서 위치 선택 시 핸들러
  const handleMapLocationSelect = (
    selectedInstitution: 'RDA' | 'KMA',
    station: RdaStation | KmaStation
  ) => {
    if (selectedInstitution === 'RDA') {
      const rdaStation = station as RdaStation;
      setInstitution('RDA');
      // RDA 지역 선택: 관측소명에서 도 추출 후 설정
      const province = getProvinceFromStationName(rdaStation.stn_name);
      setSelectedRdaProvince(province);
      // 약간의 지연 후 관측소 선택 (도 선택 후 필터링이 완료되어야 함)
      setTimeout(() => {
        setSelectedRdaStation(rdaStation.stn_cd);
      }, 100);
    } else {
      const kmaStation = station as KmaStation;
      setInstitution('KMA');
      setSelectedKmaStation(kmaStation.stn_id);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Page Title */}
      <h2 className="text-base font-medium text-gray-600">과거기상현황</h2>

      {/* 데이터 유형 탭 */}
      <div className="flex gap-2">
        <button
          onClick={() => setDataType('daily')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            dataType === 'daily'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          일별 자료
        </button>
        <button
          onClick={() => setDataType('hourly')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            dataType === 'hourly'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          시간별 자료
        </button>
      </div>

      {/* Top Section: Data Selection | Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Data Selection Section */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4">데이터 선택</h3>

        {/* 기관 선택 */}
        <div className="mb-4">
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
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            지역
            {((institution === 'RDA' && rdaStationsLoading) || (institution === 'KMA' && kmaStationsLoading)) && (
              <span className="ml-2 text-xs text-gray-500">로딩 중...</span>
            )}
          </label>
          <div className="flex gap-2">
            {institution === 'RDA' ? (
              <>
                <select
                  value={selectedRdaProvince}
                  onChange={(e) => setSelectedRdaProvince(e.target.value)}
                  className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                  disabled={rdaStationsLoading}
                >
                  <option value="">{rdaStationsLoading ? '로딩 중...' : '도 선택'}</option>
                  {rdaProvinces.map(province => (
                    <option key={province} value={province}>{province}</option>
                  ))}
                </select>
                <select
                  value={selectedRdaStation}
                  onChange={(e) => setSelectedRdaStation(e.target.value)}
                  className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                  disabled={!selectedRdaProvince || rdaStationsLoading}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                disabled={kmaStationsLoading}
              >
                <option value="">{kmaStationsLoading ? '로딩 중...' : '관측소 선택'}</option>
                {kmaStations.map(station => (
                  <option key={station.stn_id} value={station.stn_id}>{station.stn_nm}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 기간 선택 - 일별 자료 */}
        {dataType === 'daily' && (
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
        )}

        {/* 기간 선택 - 시간별 자료 */}
        {dataType === 'hourly' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">기간 (YYYYMMDD 형식)</label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">시작</span>
              <input
                type="text"
                value={hourlyStartDate}
                onChange={(e) => setHourlyStartDate(e.target.value)}
                placeholder="20260101"
                maxLength={8}
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>

            <span className="text-gray-500 mx-2">~</span>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">종료</span>
              <input
                type="text"
                value={hourlyEndDate}
                onChange={(e) => setHourlyEndDate(e.target.value)}
                placeholder="20260131"
                maxLength={8}
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>

            {/* 조회 버튼 */}
            <button
              onClick={handleHourlyQuery}
              disabled={!canHourlyQuery || hourlyLoading}
              className="ml-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {hourlyLoading ? `조회 중... ${hourlyProgress}%` : '조회'}
            </button>
          </div>

          {/* 진행률 바 */}
          {hourlyLoading && (
            <div className="mt-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${hourlyProgress}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-700 min-w-[50px]">{hourlyProgress}%</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                데이터를 불러오는 중입니다. 기간이 길수록 시간이 오래 걸릴 수 있습니다.
              </p>
            </div>
          )}

          <p className="mt-2 text-xs text-gray-500">
            * 기간 제한 없이 조회 가능합니다. 긴 기간 조회 시 시간이 다소 걸릴 수 있습니다.
          </p>

          {/* 에러 메시지 */}
          {hourlyError && (
            <p className="mt-2 text-sm text-red-500">{hourlyError}</p>
          )}
        </div>
        )}
        </div>

        {/* Map Section */}
        <div className="flex flex-col">
          {/* NULL 데이터 지도 버튼 */}
          <div className="mb-2 flex justify-end">
            <button
              onClick={() => setShowNullDataMap(true)}
              className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              NULL 데이터 현황
            </button>
          </div>
          <PastWeatherMap
          rdaStations={rdaStations}
          kmaStations={kmaStations}
          selectedYear={mapYear}
          onYearChange={setMapYear}
          onLocationSelect={handleMapLocationSelect}
          selectedRdaStation={selectedRdaStation}
          selectedKmaStation={selectedKmaStation}
        />
        </div>
      </div>

      {/* NULL 데이터 지도 모달 */}
      {showNullDataMap && (
        <NullDataMap onClose={() => setShowNullDataMap(false)} />
      )}

      {/* Results Section - 일별 자료 */}
      {dataType === 'daily' && showResults && (
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

      {/* Results Section - 시간별 자료 */}
      {dataType === 'hourly' && showHourlyResults && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* 상단 정보 및 다운로드 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-800">
                시간별 조회 결과 <span className="text-sm font-normal text-gray-500">(총 {hourlyTotalCount}건)</span>
              </h3>
            </div>

            {/* 조회 기간 정보 */}
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium">조회 기간:</span> {hourlyStartDate} ~ {hourlyEndDate}
              </p>
            </div>

            {/* 다운로드 버튼 그룹 */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleHourlyDownloadCsv}
                disabled={downloadLoading !== null}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {downloadLoading === 'hourly-csv' ? '다운로드 중...' : 'CSV 다운로드'}
              </button>
              <button
                onClick={handleHourlyDownloadJson}
                disabled={downloadLoading !== null}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {downloadLoading === 'hourly-json' ? '다운로드 중...' : 'JSON 다운로드'}
              </button>
              <button
                onClick={handleHourlyDownloadExcel}
                disabled={downloadLoading !== null}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {downloadLoading === 'hourly-excel' ? '다운로드 중...' : 'Excel 다운로드'}
              </button>
            </div>
          </div>

          {/* 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  {institution === 'KMA' ? (
                    <>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">시간</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">지점번호</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">지점명</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">기온(°C)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">강수량(mm)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">풍속(m/s)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">풍향(°)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">습도(%)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">일사량(MJ/m²)</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">날짜</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">시간</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">지점코드</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">지점명</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">기온(°C)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">습도(%)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">풍향(°)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">풍속(m/s)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">강수량(mm)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">일사량(MJ/m²)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {hourlyResults.length === 0 ? (
                  <tr>
                    <td colSpan={institution === 'KMA' ? 9 : 10} className="px-4 py-8 text-center text-gray-500">
                      조회된 데이터가 없습니다.
                    </td>
                  </tr>
                ) : institution === 'KMA' ? (
                  (hourlyResults as KmaHourlyData[]).slice(0, 50).map((row, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">{row.tm}</td>
                      <td className="px-4 py-3">{row.stnId}</td>
                      <td className="px-4 py-3">{row.stnNm}</td>
                      <td className="px-4 py-3 text-right">{row.ta ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.rn ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.ws ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.wd ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.hm ?? '-'}</td>
                      <td className="px-4 py-3 text-right">{row.icsr ?? '-'}</td>
                    </tr>
                  ))
                ) : (
                  (hourlyResults as RdaHourlyData[]).slice(0, 50).map((row, index) => {
                    const { date, time } = parseRdaDateTime(row.date, row.time);
                    return (
                      <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3">{date}</td>
                        <td className="px-4 py-3">{time}</td>
                        <td className="px-4 py-3">{row.stn_Cd}</td>
                        <td className="px-4 py-3">{row.stn_Name}</td>
                        <td className="px-4 py-3 text-right">{row.temp ?? '-'}</td>
                        <td className="px-4 py-3 text-right">{row.hum ?? '-'}</td>
                        <td className="px-4 py-3 text-right">{row.widdir ?? '-'}</td>
                        <td className="px-4 py-3 text-right">{row.wind ?? '-'}</td>
                        <td className="px-4 py-3 text-right">{row.rn ?? '-'}</td>
                        <td className="px-4 py-3 text-right">{row.srqty ?? '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {hourlyResults.length > 50 && (
              <p className="mt-2 text-sm text-gray-500 text-center">
                * 미리보기는 최대 50건까지 표시됩니다. 전체 데이터는 다운로드를 이용해주세요.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PastWeather;
