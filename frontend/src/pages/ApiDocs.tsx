// frontend/src/pages/ApiDocs.tsx
/**
 * API 문서 페이지
 * - 현재기상 / 과거기상 / 기상예보 API 설명
 */

import React, { useState } from 'react';
import styled from 'styled-components';

const API_BASE_URL = 'http://weather-rda.digitalag.kr:8001';

const Container = styled.div`
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
`;

const Title = styled.h1`
  font-size: 28px;
  margin-bottom: 24px;
  color: #1a1a2e;
`;

const TabContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 8px;
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 12px 24px;
  border: none;
  background: ${props => props.$active ? '#1a73e8' : '#f5f5f5'};
  color: ${props => props.$active ? 'white' : '#333'};
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  font-size: 16px;
  font-weight: ${props => props.$active ? 'bold' : 'normal'};
  transition: all 0.2s;

  &:hover {
    background: ${props => props.$active ? '#1557b0' : '#e0e0e0'};
  }
`;

const Section = styled.div`
  margin-bottom: 32px;
`;

const SectionTitle = styled.h2`
  font-size: 22px;
  color: #1a73e8;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #1a73e8;
`;

const ApiCard = styled.div`
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
`;

const ApiTitle = styled.h3`
  font-size: 18px;
  color: #333;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Method = styled.span`
  background: #4caf50;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
`;

const Endpoint = styled.code`
  background: #f5f5f5;
  padding: 8px 12px;
  border-radius: 4px;
  display: block;
  margin-bottom: 16px;
  font-family: 'Consolas', monospace;
  color: #d63384;
  font-size: 14px;
`;

const SubTitle = styled.h4`
  font-size: 14px;
  color: #666;
  margin: 16px 0 8px 0;
  font-weight: bold;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
  font-size: 14px;

  th, td {
    border: 1px solid #e0e0e0;
    padding: 10px;
    text-align: left;
  }

  th {
    background: #f5f5f5;
    font-weight: bold;
    color: #333;
  }

  td {
    background: white;
  }

  code {
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Consolas', monospace;
    color: #d63384;
  }
`;

const CodeBlock = styled.pre`
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 13px;
  font-family: 'Consolas', monospace;
  line-height: 1.5;
`;

const InfoBox = styled.div`
  background: #e3f2fd;
  border-left: 4px solid #1a73e8;
  padding: 12px 16px;
  margin: 12px 0;
  border-radius: 0 4px 4px 0;
  font-size: 14px;
`;

const WarnBox = styled.div`
  background: #fff3e0;
  border-left: 4px solid #ff9800;
  padding: 12px 16px;
  margin: 12px 0;
  border-radius: 0 4px 4px 0;
  font-size: 14px;
  color: #e65100;
`;

const DownloadLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #1a73e8;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
`;

const UpdateFrequency = styled.div`
  background: #fff3e0;
  border-left: 4px solid #ff9800;
  padding: 10px 14px;
  margin-top: 12px;
  border-radius: 0 4px 4px 0;
  font-size: 13px;
  color: #e65100;
`;

const DownloadCard = styled.div`
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
`;

type TabType = 'current' | 'past' | 'forecast' | 'aws';

const ApiDocs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('current');

  return (
    <Container>
      <Title>API 문서</Title>
      <InfoBox>
        <strong>Base URL:</strong> <code>{API_BASE_URL}</code>
        <br />
        <strong>테스트페이지:</strong> <a href={`${API_BASE_URL}/docs`} target="_blank" rel="noopener noreferrer" style={{color: '#1a73e8'}}>{API_BASE_URL}/docs</a>
      </InfoBox>

      <TabContainer>
        <Tab $active={activeTab === 'current'} onClick={() => setActiveTab('current')}>
          현재기상
        </Tab>
        <Tab $active={activeTab === 'past'} onClick={() => setActiveTab('past')}>
          과거기상
        </Tab>
        <Tab $active={activeTab === 'forecast'} onClick={() => setActiveTab('forecast')}>
          기상예보
        </Tab>
        <Tab $active={activeTab === 'aws'} onClick={() => setActiveTab('aws')}>
          AWS(기상대)
        </Tab>
      </TabContainer>

      {activeTab === 'current' && <CurrentWeatherDocs />}
      {activeTab === 'past' && <PastWeatherDocs />}
      {activeTab === 'forecast' && <ForecastDocs />}
      {activeTab === 'aws' && <AwsDocs />}
    </Container>
  );
};

// ===== 현재기상 =====
const CurrentWeatherDocs: React.FC = () => (
  <>
    {/* ===== 기상청(KMA, ASOS) ===== */}
    <Section>
      <SectionTitle>기상청 (KMA, ASOS)</SectionTitle>

      {/* 1. 지역별 최신날씨 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 지역별 최신날씨 조회</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/kma/realtime/{'{지역코드}'}</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>지역코드</code></td><td>string</td><td>필수 (경로)</td><td>행정구역코드 (예: 4182000000)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`{
  "region_code": "4182000000",
  "region_name": "가평군",
  "sido": "경기도",
  "nx": 69,
  "ny": 133,
  "base_date": "2025-01-15",
  "base_time": "1400",
  "T1H": 2.3,       // 기온 (°C)
  "RN1": 0.0,       // 1시간 강수량 (mm)
  "UUU": -0.5,      // 동서바람성분 (m/s)
  "VVV": 1.2,       // 남북바람성분 (m/s)
  "REH": 45.0,      // 습도 (%)
  "PTY": 0.0,       // 강수형태 (0:없음, 1:비, 2:비/눈, 3:눈)
  "VEC": 180.0,     // 풍향 (°)
  "WSD": 1.5        // 풍속 (m/s)
}`}</CodeBlock>

        <UpdateFrequency>
          <strong>데이터 업데이트 주기:</strong> 매시 정각 (1시간 간격)
        </UpdateFrequency>
      </ApiCard>

      {/* 2. 지역 코드 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 조회 할 수 있는 지역 코드 조회</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/kma/realtime/region</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <InfoBox>파라미터 없음</InfoBox>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`[
  {
    "region_code": "4182000000",
    "region_name": "가평군",
    "sido": "경기도",
    "nx": 69,
    "ny": 133
  },
  {
    "region_code": "1168000000",
    "region_name": "강남구",
    "sido": "서울특별시",
    "nx": 61,
    "ny": 126
  },
  ...
]`}</CodeBlock>
      </ApiCard>

      {/* 3. 지역 정보 CSV 다운로드 */}
      <DownloadCard>
        <SubTitle>지역 정보 파일</SubTitle>
        <DownloadLink href="/region_files/region_preprocessed.csv" download>
          region_preprocessed.csv 다운로드
        </DownloadLink>
        <p style={{margin: '8px 0 0 0', fontSize: '13px', color: '#666'}}>
          행정구역코드, 1단계(시도), 2단계(시군구), 3단계(읍면동), 격자 X, 격자 Y, 위경도 정보 포함
        </p>
      </DownloadCard>

      {/* 4. 원본데이터 명세서 다운로드 */}
      <DownloadCard>
        <SubTitle>원본데이터 명세서</SubTitle>
        <DownloadLink href="/info_files/ASOS_KMA_info_forecast_short.docx" download>
          ASOS_KMA_info_forecast_short.docx 다운로드
        </DownloadLink>
      </DownloadCard>
    </Section>

    {/* ===== 국립농업과학원(RDA) ===== */}
    <Section>
      <SectionTitle>국립농업과학원 (RDA)</SectionTitle>

      {/* 1. 지역별 최신날씨 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 지역별 최신날씨 조회</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/rda/realtime/{'{지점코드}'}</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>지점코드</code></td><td>string</td><td>필수 (경로)</td><td>관측소 지점코드 (예: 477802A001)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`{
  "stn_cd": "477802A001",
  "stn_name": "가평군 가평읍",
  "province": "경기도",
  "datetime": "2025-01-15T14:30:00",
  "temp": 3.2,            // 기온 (°C)
  "hghst_artmp": 5.1,     // 최고기온 (°C)
  "lowst_artmp": -2.3,    // 최저기온 (°C)
  "hum": 45.0,            // 습도 (%)
  "widdir": 180,          // 풍향 (°)
  "wind": 1.5,            // 풍속 (m/s)
  "max_wind": 3.2,        // 최대풍속 (m/s)
  "rn": 0.0,              // 강수량 (mm)
  "sun_time": 120,        // 일조시간 (분)
  "srqty": 0.5,           // 일사량 (MJ/m²)
  "condens_time": null,   // 결로시간 (분)
  "gr_temp": 2.1,         // 지면온도 (°C)
  "soil_temp": 5.3,       // 토양온도 (°C)
  "soil_wt": 30.2         // 토양수분 (%)
}`}</CodeBlock>

        <UpdateFrequency>
          <strong>데이터 업데이트 주기:</strong> 10분 간격
        </UpdateFrequency>
      </ApiCard>

      {/* 2. 지역 코드 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 조회 할 수 있는 지역 코드 조회</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/rda/realtime/region</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <InfoBox>파라미터 없음</InfoBox>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`[
  {
    "stn_cd": "477802A001",
    "stn_name": "가평군 가평읍",
    "province": "경기도"
  },
  {
    "stn_cd": "411801A001",
    "stn_name": "고양시 구산동",
    "province": "경기도"
  },
  ...
]`}</CodeBlock>
      </ApiCard>

      {/* 3. 지역 정보 CSV 다운로드 */}
      <DownloadCard>
        <SubTitle>지역 정보 파일</SubTitle>
        <DownloadLink href="/region_files/rda_region_info.csv" download>
          region_info.csv 다운로드
        </DownloadLink>
        <p style={{margin: '8px 0 0 0', fontSize: '13px', color: '#666'}}>
          도명, 지점명, 지점코드, 위도, 경도, 고도, 관측시작일 정보 포함
        </p>
      </DownloadCard>

      {/* 4. 원본데이터 명세서 다운로드 */}
      <DownloadCard>
        <SubTitle>원본데이터 명세서</SubTitle>
        <DownloadLink href="/info_files/RDA_info.pdf" download>
          RDA_info.pdf 다운로드
        </DownloadLink>
      </DownloadCard>
    </Section>
  </>
);

// ===== 과거기상 =====
const PastWeatherDocs: React.FC = () => (
  <>
    {/* ===== 기상청(KMA, ASOS) ===== */}
    <Section>
      <SectionTitle>기상청 (KMA, ASOS)</SectionTitle>

      {/* 1. 지역별 특정기간 과거기상 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 지역별 특정기간 과거기상 조회</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/kma/day/{'{지점번호}'}/{'{시작일자}'}/{'{종료일자}'}</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>지점번호</code></td><td>integer</td><td>필수 (경로)</td><td>관측소 지점번호 (예: 108)</td></tr>
            <tr><td><code>시작일자</code></td><td>date</td><td>필수 (경로)</td><td>조회 시작일 (yyyy-mm-dd 형식, 예: 2024-01-01)</td></tr>
            <tr><td><code>종료일자</code></td><td>date</td><td>필수 (경로)</td><td>조회 종료일 (yyyy-mm-dd 형식, 예: 2024-01-31)</td></tr>
          </tbody>
        </Table>

        <WarnBox>
          <strong>* 참고:</strong> 가장 최근 종료일자는 <strong>현재일자보다 2일 전</strong>까지 가능합니다.
        </WarnBox>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`{
  "total": 31,
  "data": [
    {
      "stn_id": 108,
      "stn_nm": "서울",
      "tm": "2024-01-01",
      "avg_ta": 2.3,       // 평균기온 (°C)
      "min_ta": -1.5,      // 최저기온 (°C)
      "max_ta": 5.2,       // 최고기온 (°C)
      "sum_rn": 0.0,       // 일강수량 (mm)
      "avg_ws": 1.8,       // 평균풍속 (m/s)
      "avg_rhm": 55.0,     // 평균상대습도 (%)
      "sum_ss_hr": 6.5,    // 합계일조시간 (hr)
      "sum_gsr": 8.2       // 합계일사량 (MJ/m²)
    },
    ...
  ]
}`}</CodeBlock>

        <UpdateFrequency>
          <strong>데이터 업데이트 주기:</strong> 매일 1회 (전일 데이터 기준, 2일 지연)
        </UpdateFrequency>
      </ApiCard>

      {/* 2. 지역 및 관측 시작/마지막 일자 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 조회 할 수 있는 지역 및 관측 시작일자, 마지막 관측일자 조회</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/kma/day/region</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <InfoBox>파라미터 없음</InfoBox>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`[
  {
    "stn_id": 108,
    "stn_nm": "서울",
    "first_date": "2024-01-01",
    "last_date": "2025-01-13"
  },
  {
    "stn_id": 112,
    "stn_nm": "인천",
    "first_date": "2024-01-01",
    "last_date": "2025-01-13"
  },
  ...
]`}</CodeBlock>
      </ApiCard>

      {/* 2. 지역별 특정기간 과거기상 조회 (시간별) */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 지역별 특정기간 과거기상 조회 (시간별)</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/kma/asos/hr/{'{지점번호}'}/{'{시작일자}'}/{'{종료일자}'}</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>지점번호</code></td><td>integer</td><td>필수 (경로)</td><td>관측소 지점번호 (예: 108)</td></tr>
            <tr><td><code>시작일자</code></td><td>string</td><td>필수 (경로)</td><td>조회 시작일 (YYYYMMDD 형식, 예: 20240101)</td></tr>
            <tr><td><code>종료일자</code></td><td>string</td><td>필수 (경로)</td><td>조회 종료일 (YYYYMMDD 형식, 예: 20240131)</td></tr>
            <tr><td><code>format</code></td><td>string</td><td>선택 (쿼리)</td><td>응답 형식 (json 또는 csv, 기본값: json)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`{
  "stn_id": 108,
  "start_date": "20240101",
  "end_date": "20240101",
  "total": 24,
  "data": [
    {
      "tm": "2024-01-01 01:00",   // 관측시간
      "stnId": "108",             // 지점번호
      "stnNm": "서울",            // 지점명
      "ta": "2.3",                // 기온 (°C)
      "rn": "0.0",                // 강수량 (mm)
      "ws": "1.5",                // 풍속 (m/s)
      "wd": "180",                // 풍향 (°)
      "hm": "55",                 // 습도 (%)
      "icsr": "0.0"               // 일사량 (MJ/m²)
    },
    ...
  ]
}`}</CodeBlock>

        <UpdateFrequency>
          <strong>데이터 업데이트 주기:</strong> 매시간 (1시간 간격)
        </UpdateFrequency>
      </ApiCard>

      {/* 3. 지역 정보 CSV 다운로드 */}
      <DownloadCard>
        <SubTitle>지역 정보 파일</SubTitle>
        <DownloadLink href="/region_files/kma_region.csv" download>
          kma_region.csv 다운로드
        </DownloadLink>
        <p style={{margin: '8px 0 0 0', fontSize: '13px', color: '#666'}}>
          지점번호, 지점명, 관리관서, 관측시작일 정보 포함
        </p>
      </DownloadCard>

      {/* 4. 원본데이터 명세서 다운로드 */}
      <DownloadCard>
        <SubTitle>원본데이터 명세서</SubTitle>
        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
          <div>
            <DownloadLink href="/info_files/ASOS_KMA_info_day.docx" download>
              ASOS_KMA_info_day.docx 다운로드
            </DownloadLink>
            <span style={{fontSize: '13px', color: '#666', marginLeft: '8px'}}>- 일별 데이터</span>
          </div>
          <div>
            <DownloadLink href="/info_files/ASOS_KMA_info_hour.docx" download>
              ASOS_KMA_info_hour.docx 다운로드
            </DownloadLink>
            <span style={{fontSize: '13px', color: '#666', marginLeft: '8px'}}>- 시간별 데이터</span>
          </div>
        </div>
      </DownloadCard>
    </Section>

    {/* ===== 국립농업과학원(RDA) ===== */}
    <Section>
      <SectionTitle>국립농업과학원 (RDA)</SectionTitle>

      {/* 1. 지역별 특정기간 과거기상 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 지역별 특정기간 과거기상 조회</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/rda/day/{'{지점코드}'}/{'{시작일자}'}/{'{종료일자}'}</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>지점코드</code></td><td>string</td><td>필수 (경로)</td><td>관측소 지점코드 (예: 477802A001)</td></tr>
            <tr><td><code>시작일자</code></td><td>date</td><td>필수 (경로)</td><td>조회 시작일 (yyyy-mm-dd 형식, 예: 2024-01-01)</td></tr>
            <tr><td><code>종료일자</code></td><td>date</td><td>필수 (경로)</td><td>조회 종료일 (yyyy-mm-dd 형식, 예: 2024-01-31)</td></tr>
          </tbody>
        </Table>

        <WarnBox>
          <strong>* 참고:</strong> 가장 최근 종료일자는 <strong>현재일자보다 2일 전</strong>까지 가능합니다.
        </WarnBox>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`{
  "total": 31,
  "data": [
    {
      "stn_cd": "477802A001",
      "stn_name": "가평군 가평읍",
      "date": "2024-01-01",
      "temp": 2.3,            // 평균기온 (°C)
      "hghst_artmp": 5.1,     // 최고기온 (°C)
      "lowst_artmp": -1.5,    // 최저기온 (°C)
      "hum": 55.0,            // 평균습도 (%)
      "wind": 1.8,            // 평균풍속 (m/s)
      "rn": 0.0,              // 강수량 (mm)
      "srqty": 8.2            // 일사량 (MJ/m²)
    },
    ...
  ]
}`}</CodeBlock>

        <UpdateFrequency>
          <strong>데이터 업데이트 주기:</strong> 매일 1회 (전일 데이터 기준, 2일 지연)
        </UpdateFrequency>
      </ApiCard>

      {/* 2. 지역별 특정기간 과거기상 조회 (시간별) */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 지역별 특정기간 과거기상 조회 (시간별)</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/rda/weather/hr/{'{지점코드}'}/{'{시작일자}'}/{'{종료일자}'}</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>지점코드</code></td><td>string</td><td>필수 (경로)</td><td>관측소 지점코드 (예: 477802A001)</td></tr>
            <tr><td><code>시작일자</code></td><td>string</td><td>필수 (경로)</td><td>조회 시작일 (YYYYMMDD 형식, 예: 20240101)</td></tr>
            <tr><td><code>종료일자</code></td><td>string</td><td>필수 (경로)</td><td>조회 종료일 (YYYYMMDD 형식, 예: 20240131)</td></tr>
            <tr><td><code>format</code></td><td>string</td><td>선택 (쿼리)</td><td>응답 형식 (json 또는 csv, 기본값: json)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`{
  "stn_code": "477802A001",
  "start_date": "20240101",
  "end_date": "20240101",
  "total": 24,
  "data": [
    {
      "stn_Cd": "477802A001",     // 관측지점코드
      "stn_Name": "가평군 가평읍", // 관측지점명
      "date": "2024-01-01",       // 관측일자
      "time": "01:00",            // 관측시간
      "temp": "2.3",              // 기온 (°C)
      "hum": "55",                // 습도 (%)
      "widdir": "180",            // 풍향 (°)
      "wind": "1.5",              // 풍속 (m/s)
      "rn": "0.0",                // 강수량 (mm)
      "srqty": "0.0"              // 일사량 (MJ/m²)
    },
    ...
  ]
}`}</CodeBlock>

        <UpdateFrequency>
          <strong>데이터 업데이트 주기:</strong> 매시간 (1시간 간격)
        </UpdateFrequency>
      </ApiCard>

      {/* 3. 지역 코드 및 관측 시작/마지막 일자 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 조회 할 수 있는 지역 코드 및 관측 시작일자, 마지막 관측일자 조회</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/rda/day/region</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <InfoBox>파라미터 없음</InfoBox>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`[
  {
    "stn_cd": "477802A001",
    "stn_name": "가평군 가평읍",
    "first_date": "2024-01-01",
    "last_date": "2025-01-13"
  },
  {
    "stn_cd": "411801A001",
    "stn_name": "고양시 구산동",
    "first_date": "2024-01-01",
    "last_date": "2025-01-13"
  },
  ...
]`}</CodeBlock>
      </ApiCard>

      {/* 4. 지역 정보 CSV 다운로드 */}
      <DownloadCard>
        <SubTitle>지역 정보 파일</SubTitle>
        <DownloadLink href="/region_files/rda_region_info.csv" download>
          region_info.csv 다운로드
        </DownloadLink>
        <p style={{margin: '8px 0 0 0', fontSize: '13px', color: '#666'}}>
          도명, 지점명, 지점코드, 위도, 경도, 고도, 관측시작일 정보 포함
        </p>
      </DownloadCard>

      {/* 4. 원본데이터 명세서 다운로드 */}
      <DownloadCard>
        <SubTitle>원본데이터 명세서</SubTitle>
        <DownloadLink href="/info_files/RDA_info.pdf" download>
          RDA_info.pdf 다운로드
        </DownloadLink>
      </DownloadCard>
    </Section>
  </>
);

// ===== 기상예보 =====
const ForecastDocs: React.FC = () => (
  <>
    <Section>
      <SectionTitle>기상청 (KMA, ASOS)</SectionTitle>

      {/* 1. 단기기상 예보 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 지역별 단기기상 예보 조회</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/kma/forecast/short/{'{지역코드}'}</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>지역코드</code></td><td>string</td><td>필수 (경로)</td><td>행정구역코드 (예: 4182000000)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`{
  "region_code": "4182000000",
  "region_name": "가평군",
  "sido": "경기도",
  "base_date": "2025-01-15",
  "base_time": "0500",
  "forecasts": [
    {
      "fcst_date": "2025-01-15",
      "fcst_time": "0600",
      "TMP": "2",        // 기온 (°C)
      "TMN": "-3",       // 최저기온 (°C)
      "TMX": "5",        // 최고기온 (°C)
      "POP": "0",        // 강수확률 (%)
      "PTY": "0",        // 강수형태 (0:없음, 1:비, 2:비/눈, 3:눈, 4:소나기)
      "SKY": "1",        // 하늘상태 (1:맑음, 3:구름많음, 4:흐림)
      "REH": "55",       // 습도 (%)
      "WSD": "1.5"       // 풍속 (m/s)
    },
    ...
  ]
}`}</CodeBlock>

        <UpdateFrequency>
          <strong>데이터 업데이트 주기:</strong> 1일 8회 (02, 05, 08, 11, 14, 17, 20, 23시)
        </UpdateFrequency>
      </ApiCard>

      {/* 2. 중기기상 예보 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 지역별 중기기상 예보 조회</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/kma/forecast/mid/{'{지역코드}'}</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>지역코드</code></td><td>string</td><td>필수 (경로)</td><td>예보구역코드 (예: 11B00000)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`{
  "reg_id": "11B00000",
  "region_name": "서울·인천·경기도",
  "tm_fc": "202501150600",
  "forecasts": [
    {
      "forecast_date": "2025-01-18",
      "time_period": "오전",
      "rain_prob": 20,             // 강수확률 (%)
      "weather_condition": "맑음", // 날씨상태
      "temp_min": -3,              // 최저기온 (°C)
      "temp_max": 5                // 최고기온 (°C)
    },
    {
      "forecast_date": "2025-01-18",
      "time_period": "오후",
      "rain_prob": 10,
      "weather_condition": "구름많음",
      "temp_min": -3,
      "temp_max": 5
    },
    ...
  ]
}`}</CodeBlock>

        <UpdateFrequency>
          <strong>데이터 업데이트 주기:</strong> 1일 2회 (06시, 18시)
        </UpdateFrequency>
      </ApiCard>

      {/* 3. 지역 코드 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 조회 할 수 있는 지역 코드 조회</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/kma/forecast/region</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <InfoBox>파라미터 없음</InfoBox>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`{
  "short": [
    {
      "region_code": "4182000000",
      "region_name": "가평군",
      "sido": "경기도",
      "nx": 69,
      "ny": 133
    },
    ...
  ],
  "mid": [
    {
      "reg_id": "11B00000",
      "region_name": "서울·인천·경기도"
    },
    {
      "reg_id": "11D10000",
      "region_name": "강원도영서"
    },
    ...
  ]
}`}</CodeBlock>
      </ApiCard>

      {/* 4. 지역 정보 CSV 다운로드 */}
      <DownloadCard>
        <SubTitle>지역 정보 파일</SubTitle>
        <DownloadLink href="/region_files/region_latitude_longitude.csv" download>
          region_latitude_longitude.csv 다운로드
        </DownloadLink>
        <p style={{margin: '8px 0 0 0', fontSize: '13px', color: '#666'}}>
          행정구역코드, 1단계(시도), 2단계(시군구), 3단계(읍면동), 격자 X, 격자 Y, 위경도 정보 포함
        </p>
      </DownloadCard>

      {/* 5. 원본데이터 명세서 다운로드 */}
      <DownloadCard>
        <SubTitle>원본데이터 명세서</SubTitle>
        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
          <div>
            <DownloadLink href="/info_files/ASOS_KMA_info_forecast_short.docx" download>
              ASOS_KMA_info_forecast_short.docx 다운로드
            </DownloadLink>
            <span style={{fontSize: '13px', color: '#666', marginLeft: '8px'}}>- 단기예보</span>
          </div>
          <div>
            <DownloadLink href="/info_files/ASOS_KMA_info_forecast_mid.docx" download>
              ASOS_KMA_info_forecast_mid.docx 다운로드
            </DownloadLink>
            <span style={{fontSize: '13px', color: '#666', marginLeft: '8px'}}>- 중기예보</span>
          </div>
        </div>
      </DownloadCard>
    </Section>
  </>
);

// ===== AWS (기상대) =====
const AwsDocs: React.FC = () => (
  <>
    <Section>
      <SectionTitle>AWS 기상대</SectionTitle>

      {/* 1. 기상대 목록 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> AWS 기상대 목록 조회</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/aws/stations</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <InfoBox>파라미터 없음</InfoBox>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`[
  {
    "id": "01",
    "name": "전주시",
    "lat": 35.8242,
    "lng": 127.1480
  },
  ...
]`}</CodeBlock>
      </ApiCard>

      {/* 2. 최신 기상 데이터 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 최신 AWS 기상 데이터 조회</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/aws/{'{기상대ID}'}/latest</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>기상대ID</code></td><td>string</td><td>필수 (경로)</td><td>기상대 ID (예: 01)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`{
  "station_id": "01",
  "station_name": "전주시",
  "data": {
    "Timestamp": "14:30",      // 측정시간
    "Temp": 15.2,              // 온도 (°C)
    "Humid": 55.0,             // 습도 (%)
    "Radn": 450.5,             // 순간광량 (W/m²)
    "Wind_degree": 180.0,      // 풍향 (°)
    "Wind": 2.3,               // 풍속 (m/s)
    "Rainfall": 0.0            // 강수량 (mm)
  }
}`}</CodeBlock>

        <UpdateFrequency>
          <strong>데이터 업데이트 주기:</strong> 실시간 (약 10분 간격)
        </UpdateFrequency>
      </ApiCard>

      {/* 3. 기간별 기상 데이터 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 기간별 AWS 기상 데이터 조회</ApiTitle>
        <Endpoint>{API_BASE_URL}/api/aws/{'{기상대ID}'}/{'{시작일자}'}/{'{종료일자}'}</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>기상대ID</code></td><td>string</td><td>필수 (경로)</td><td>기상대 ID (예: 01)</td></tr>
            <tr><td><code>시작일자</code></td><td>date</td><td>필수 (경로)</td><td>조회 시작일 (YYYY-MM-DD 형식, 예: 2024-01-01)</td></tr>
            <tr><td><code>종료일자</code></td><td>date</td><td>필수 (경로)</td><td>조회 종료일 (YYYY-MM-DD 형식, 예: 2024-01-31)</td></tr>
            <tr><td><code>format</code></td><td>string</td><td>선택 (쿼리)</td><td>응답 형식 (json 또는 csv, 기본값: json)</td></tr>
          </tbody>
        </Table>

        <WarnBox>
          <strong>* 참고:</strong> 최대 조회 기간은 <strong>365일</strong>까지 가능합니다.
        </WarnBox>

        <SubTitle>응답 메시지 예시</SubTitle>
        <CodeBlock>{`{
  "station_id": "01",
  "station_name": "전주시",
  "start_date": "2024-01-01",
  "end_date": "2024-01-02",
  "total": 288,
  "data": [
    {
      "Date": "2024-01-01",      // 날짜
      "Timestamp": "00:10",      // 측정시간
      "Temp": 2.3,               // 온도 (°C)
      "Humid": 65.0,             // 습도 (%)
      "Radn": 0.0,               // 순간광량 (W/m²)
      "Wind_degree": 270.0,      // 풍향 (°)
      "Wind": 1.2,               // 풍속 (m/s)
      "Rainfall": 0.0            // 강수량 (mm)
    },
    {
      "Date": "2024-01-01",
      "Timestamp": "00:20",
      "Temp": 2.1,
      "Humid": 66.0,
      "Radn": 0.0,
      "Wind_degree": 265.0,
      "Wind": 1.0,
      "Rainfall": 0.0
    },
    ...
  ]
}`}</CodeBlock>

        <UpdateFrequency>
          <strong>데이터 업데이트 주기:</strong> 약 10분 간격
        </UpdateFrequency>
      </ApiCard>

      <InfoBox>
        <strong>참고:</strong> AWS 기상대 데이터는 외부 기상대 시스템에서 실시간으로 수집됩니다.
        데이터 제공 시간이나 가용성은 외부 시스템 상태에 따라 달라질 수 있습니다.
      </InfoBox>
    </Section>
  </>
);

export default ApiDocs;
