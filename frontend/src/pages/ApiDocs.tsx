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

  .keyword { color: #569cd6; }
  .string { color: #ce9178; }
  .comment { color: #6a9955; }
  .function { color: #dcdcaa; }
`;

const InfoBox = styled.div`
  background: #e3f2fd;
  border-left: 4px solid #1a73e8;
  padding: 12px 16px;
  margin: 12px 0;
  border-radius: 0 4px 4px 0;
  font-size: 14px;
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

type TabType = 'current' | 'past' | 'forecast';

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
      </TabContainer>

      {activeTab === 'current' && <CurrentWeatherDocs />}
      {activeTab === 'past' && <PastWeatherDocs />}
      {activeTab === 'forecast' && <ForecastDocs />}
    </Container>
  );
};

// ===== 현재기상 =====
const CurrentWeatherDocs: React.FC = () => (
  <>
    <Section>
      <SectionTitle>KMA 실시간 기상 API</SectionTitle>

      {/* 최신 실시간 데이터 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 최신 실시간 기상 데이터</ApiTitle>
        <Endpoint>/api/kma/realtime/latest</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>region_name</code></td><td>string</td><td>선택</td><td>지역명 필터 (예: 서울)</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>선택</td><td>조회 개수 (기본: 100, 최대: 100)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 메시지</SubTitle>
        <Table>
          <thead>
            <tr><th>필드</th><th>타입</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>id</code></td><td>integer</td><td>데이터 ID</td></tr>
            <tr><td><code>stn_id</code></td><td>string</td><td>관측소 ID</td></tr>
            <tr><td><code>region_name</code></td><td>string</td><td>지역명</td></tr>
            <tr><td><code>tm</code></td><td>datetime</td><td>관측 시각</td></tr>
            <tr><td><code>ta</code></td><td>float</td><td>기온 (°C)</td></tr>
            <tr><td><code>rn</code></td><td>float</td><td>강수량 (mm)</td></tr>
            <tr><td><code>ws</code></td><td>float</td><td>풍속 (m/s)</td></tr>
            <tr><td><code>wd</code></td><td>float</td><td>풍향 (°)</td></tr>
            <tr><td><code>hm</code></td><td>float</td><td>습도 (%)</td></tr>
            <tr><td><code>pa</code></td><td>float</td><td>기압 (hPa)</td></tr>
          </tbody>
        </Table>

        <SubTitle>예시 코드</SubTitle>
        <CodeBlock>{`// JavaScript (fetch)
const response = await fetch('${API_BASE_URL}/api/kma/realtime/latest?region_name=서울&limit=10');
const data = await response.json();
console.log(data);

// Python (requests)
import requests
response = requests.get('${API_BASE_URL}/api/kma/realtime/latest',
                        params={'region_name': '서울', 'limit': 10})
data = response.json()`}</CodeBlock>

        <SubTitle>지역 정보 파일</SubTitle>
        <InfoBox>
          <DownloadLink href="/region_files/kma_region.csv" download>
            📥 kma_region.csv 다운로드
          </DownloadLink>
          <p style={{margin: '8px 0 0 0', fontSize: '13px', color: '#666'}}>
            지점번호, 지점명, 관리관서 정보 포함
          </p>
        </InfoBox>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 매시 정각 (1시간 간격)
        </UpdateFrequency>
      </ApiCard>

      {/* Pivot 형태 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 최신 실시간 데이터 (Pivot)</ApiTitle>
        <Endpoint>/api/kma/realtime/latest/pivot</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>limit</code></td><td>integer</td><td>선택</td><td>조회 개수 (기본: 50, 최대: 100)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 설명</SubTitle>
        <InfoBox>
          지역별로 최신 1건씩 Pivot 형태로 조회합니다. 각 지역의 최신 관측값만 반환됩니다.
        </InfoBox>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 매시 정각 (1시간 간격)
        </UpdateFrequency>
      </ApiCard>

      {/* 지역별 범위 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 지역별 기간 조회</ApiTitle>
        <Endpoint>/api/kma/realtime/region/{'{region_name}'}/range</Endpoint>

        <SubTitle>경로 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>region_name</code></td><td>string</td><td>필수</td><td>지역명 (예: 서울)</td></tr>
          </tbody>
        </Table>

        <SubTitle>쿼리 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>start_date</code></td><td>date</td><td>필수</td><td>조회 시작일 (YYYY-MM-DD)</td></tr>
            <tr><td><code>end_date</code></td><td>date</td><td>필수</td><td>조회 종료일 (YYYY-MM-DD)</td></tr>
            <tr><td><code>offset</code></td><td>integer</td><td>선택</td><td>페이지 오프셋 (기본: 0)</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>선택</td><td>조회 개수 (기본: 100)</td></tr>
          </tbody>
        </Table>

        <SubTitle>예시 코드</SubTitle>
        <CodeBlock>{`// JavaScript
const response = await fetch(
  '${API_BASE_URL}/api/kma/realtime/region/서울/range?start_date=2024-01-01&end_date=2024-01-07'
);
const data = await response.json();

// Python
import requests
response = requests.get(
    '${API_BASE_URL}/api/kma/realtime/region/서울/range',
    params={'start_date': '2024-01-01', 'end_date': '2024-01-07'}
)`}</CodeBlock>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 매시 정각 (1시간 간격)
        </UpdateFrequency>
      </ApiCard>

      {/* 지역 목록 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 지역 목록 조회</ApiTitle>
        <Endpoint>/api/kma/realtime/regions</Endpoint>

        <SubTitle>응답 메시지</SubTitle>
        <Table>
          <thead>
            <tr><th>필드</th><th>타입</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>stn_id</code></td><td>string</td><td>관측소 ID</td></tr>
            <tr><td><code>region_name</code></td><td>string</td><td>지역명</td></tr>
            <tr><td><code>data_count</code></td><td>integer</td><td>데이터 수</td></tr>
          </tbody>
        </Table>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 지역 목록은 고정적 (데이터 수만 변동)
        </UpdateFrequency>
      </ApiCard>

      {/* 시도 목록 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 시도 목록 조회</ApiTitle>
        <Endpoint>/api/kma/realtime/sidos</Endpoint>

        <SubTitle>응답 설명</SubTitle>
        <InfoBox>
          시도별 지역 목록을 계층 구조로 반환합니다.
        </InfoBox>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 고정적
        </UpdateFrequency>
      </ApiCard>
    </Section>

    <Section>
      <SectionTitle>RDA 실시간 기상 API</SectionTitle>

      {/* RDA 최신 실시간 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> RDA 최신 실시간 데이터</ApiTitle>
        <Endpoint>/api/rda/realtime/latest</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>province</code></td><td>string</td><td>선택</td><td>도명 필터 (예: 경기도)</td></tr>
            <tr><td><code>stn_nm</code></td><td>string</td><td>선택</td><td>지점명 필터</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>선택</td><td>조회 개수 (기본: 100)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 메시지</SubTitle>
        <Table>
          <thead>
            <tr><th>필드</th><th>타입</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>stn_cd</code></td><td>string</td><td>지점 코드</td></tr>
            <tr><td><code>stn_nm</code></td><td>string</td><td>지점명</td></tr>
            <tr><td><code>province</code></td><td>string</td><td>도명</td></tr>
            <tr><td><code>obs_tm</code></td><td>datetime</td><td>관측 시각</td></tr>
            <tr><td><code>ta</code></td><td>float</td><td>기온 (°C)</td></tr>
            <tr><td><code>rn</code></td><td>float</td><td>강수량 (mm)</td></tr>
            <tr><td><code>ws</code></td><td>float</td><td>풍속 (m/s)</td></tr>
            <tr><td><code>hm</code></td><td>float</td><td>습도 (%)</td></tr>
            <tr><td><code>sd_day</code></td><td>float</td><td>일조시간 (분)</td></tr>
          </tbody>
        </Table>

        <SubTitle>지역 정보 파일</SubTitle>
        <InfoBox>
          <DownloadLink href="/region_files/rda_region_info.csv" download>
            📥 region_info.csv 다운로드
          </DownloadLink>
          <p style={{margin: '8px 0 0 0', fontSize: '13px', color: '#666'}}>
            도명, 지점명, 지점코드, 위도, 경도, 고도, 관측시작일 정보 포함
          </p>
        </InfoBox>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 10분 간격
        </UpdateFrequency>
      </ApiCard>

      {/* RDA 관측소별 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 관측소별 실시간 데이터</ApiTitle>
        <Endpoint>/api/rda/realtime/station/{'{stn_cd}'}</Endpoint>

        <SubTitle>경로 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>stn_cd</code></td><td>string</td><td>필수</td><td>지점 코드</td></tr>
          </tbody>
        </Table>

        <SubTitle>쿼리 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>offset</code></td><td>integer</td><td>선택</td><td>페이지 오프셋 (기본: 0)</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>선택</td><td>조회 개수 (기본: 100)</td></tr>
          </tbody>
        </Table>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 10분 간격
        </UpdateFrequency>
      </ApiCard>

      {/* RDA 관측소 목록 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> RDA 실시간 관측소 목록</ApiTitle>
        <Endpoint>/api/rda/realtime/stations</Endpoint>

        <SubTitle>응답 메시지</SubTitle>
        <Table>
          <thead>
            <tr><th>필드</th><th>타입</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>stn_cd</code></td><td>string</td><td>지점 코드</td></tr>
            <tr><td><code>stn_nm</code></td><td>string</td><td>지점명</td></tr>
            <tr><td><code>province</code></td><td>string</td><td>도명</td></tr>
            <tr><td><code>data_count</code></td><td>integer</td><td>데이터 수</td></tr>
          </tbody>
        </Table>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 고정적
        </UpdateFrequency>
      </ApiCard>

      {/* RDA 도별 목록 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> RDA 도별 목록</ApiTitle>
        <Endpoint>/api/rda/realtime/provinces</Endpoint>

        <SubTitle>응답 설명</SubTitle>
        <InfoBox>
          도별 관측소 목록을 계층 구조로 반환합니다.
        </InfoBox>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 고정적
        </UpdateFrequency>
      </ApiCard>
    </Section>
  </>
);

// ===== 과거기상 =====
const PastWeatherDocs: React.FC = () => (
  <>
    <Section>
      <SectionTitle>KMA ASOS 일별 기상 API</SectionTitle>

      {/* ASOS 최신 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 최신 ASOS 일별 데이터</ApiTitle>
        <Endpoint>/api/kma/asos/latest</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>region_name</code></td><td>string</td><td>선택</td><td>지역명 필터</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>선택</td><td>조회 개수 (기본: 100)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 메시지</SubTitle>
        <Table>
          <thead>
            <tr><th>필드</th><th>타입</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>stn_id</code></td><td>string</td><td>관측소 ID</td></tr>
            <tr><td><code>region_name</code></td><td>string</td><td>지역명</td></tr>
            <tr><td><code>obs_date</code></td><td>date</td><td>관측 일자</td></tr>
            <tr><td><code>avg_ta</code></td><td>float</td><td>평균기온 (°C)</td></tr>
            <tr><td><code>max_ta</code></td><td>float</td><td>최고기온 (°C)</td></tr>
            <tr><td><code>min_ta</code></td><td>float</td><td>최저기온 (°C)</td></tr>
            <tr><td><code>sum_rn</code></td><td>float</td><td>일강수량 (mm)</td></tr>
            <tr><td><code>avg_ws</code></td><td>float</td><td>평균풍속 (m/s)</td></tr>
            <tr><td><code>avg_rhm</code></td><td>float</td><td>평균습도 (%)</td></tr>
            <tr><td><code>sum_ss</code></td><td>float</td><td>일조시간 (hr)</td></tr>
          </tbody>
        </Table>

        <SubTitle>지역 정보 파일</SubTitle>
        <InfoBox>
          <DownloadLink href="/region_files/kma_region.csv" download>
            📥 kma_region.csv 다운로드
          </DownloadLink>
          <p style={{margin: '8px 0 0 0', fontSize: '13px', color: '#666'}}>
            지점번호, 지점명, 관리관서 정보 포함
          </p>
        </InfoBox>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 매일 1회 (전일 데이터)
        </UpdateFrequency>
      </ApiCard>

      {/* ASOS 특정일 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 특정일 ASOS 데이터</ApiTitle>
        <Endpoint>/api/kma/asos/date/{'{target_date}'}</Endpoint>

        <SubTitle>경로 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>target_date</code></td><td>date</td><td>필수</td><td>조회 날짜 (YYYY-MM-DD)</td></tr>
          </tbody>
        </Table>

        <SubTitle>쿼리 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>region_name</code></td><td>string</td><td>선택</td><td>지역명 필터</td></tr>
          </tbody>
        </Table>

        <SubTitle>예시 코드</SubTitle>
        <CodeBlock>{`// JavaScript
const response = await fetch('${API_BASE_URL}/api/kma/asos/date/2024-01-15');
const data = await response.json();

// Python
import requests
response = requests.get('${API_BASE_URL}/api/kma/asos/date/2024-01-15')`}</CodeBlock>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 매일 1회 (전일 데이터)
        </UpdateFrequency>
      </ApiCard>

      {/* ASOS 기간 조회 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> ASOS 기간 조회</ApiTitle>
        <Endpoint>/api/kma/asos/range</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>start_date</code></td><td>date</td><td>필수</td><td>조회 시작일 (YYYY-MM-DD)</td></tr>
            <tr><td><code>end_date</code></td><td>date</td><td>필수</td><td>조회 종료일 (YYYY-MM-DD)</td></tr>
            <tr><td><code>region_name</code></td><td>string</td><td>선택</td><td>지역명 필터</td></tr>
            <tr><td><code>offset</code></td><td>integer</td><td>선택</td><td>페이지 오프셋</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>선택</td><td>조회 개수 (기본: 100)</td></tr>
          </tbody>
        </Table>

        <SubTitle>예시 코드</SubTitle>
        <CodeBlock>{`// JavaScript
const params = new URLSearchParams({
  start_date: '2024-01-01',
  end_date: '2024-01-31',
  region_name: '서울'
});
const response = await fetch(\`\${API_BASE_URL}/api/kma/asos/range?\${params}\`);

// Python
import requests
response = requests.get('${API_BASE_URL}/api/kma/asos/range', params={
    'start_date': '2024-01-01',
    'end_date': '2024-01-31',
    'region_name': '서울'
})`}</CodeBlock>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 매일 1회 (전일 데이터)
        </UpdateFrequency>
      </ApiCard>

      {/* ASOS 관측소 목록 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> ASOS 관측소 목록</ApiTitle>
        <Endpoint>/api/kma/asos/stations</Endpoint>

        <SubTitle>응답 메시지</SubTitle>
        <Table>
          <thead>
            <tr><th>필드</th><th>타입</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>stn_id</code></td><td>string</td><td>관측소 ID</td></tr>
            <tr><td><code>region_name</code></td><td>string</td><td>지역명</td></tr>
            <tr><td><code>data_count</code></td><td>integer</td><td>데이터 수</td></tr>
          </tbody>
        </Table>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 고정적
        </UpdateFrequency>
      </ApiCard>
    </Section>

    <Section>
      <SectionTitle>RDA 일별 기상 API</SectionTitle>

      {/* RDA Daily 최신 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> RDA 최신 일별 데이터</ApiTitle>
        <Endpoint>/api/rda/daily/latest</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>province</code></td><td>string</td><td>선택</td><td>도명 필터</td></tr>
            <tr><td><code>stn_nm</code></td><td>string</td><td>선택</td><td>지점명 필터</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>선택</td><td>조회 개수 (기본: 100)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 메시지</SubTitle>
        <Table>
          <thead>
            <tr><th>필드</th><th>타입</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>stn_cd</code></td><td>string</td><td>지점 코드</td></tr>
            <tr><td><code>stn_nm</code></td><td>string</td><td>지점명</td></tr>
            <tr><td><code>province</code></td><td>string</td><td>도명</td></tr>
            <tr><td><code>obs_date</code></td><td>date</td><td>관측 일자</td></tr>
            <tr><td><code>avg_ta</code></td><td>float</td><td>평균기온 (°C)</td></tr>
            <tr><td><code>max_ta</code></td><td>float</td><td>최고기온 (°C)</td></tr>
            <tr><td><code>min_ta</code></td><td>float</td><td>최저기온 (°C)</td></tr>
            <tr><td><code>sum_rn</code></td><td>float</td><td>일강수량 (mm)</td></tr>
            <tr><td><code>avg_ws</code></td><td>float</td><td>평균풍속 (m/s)</td></tr>
            <tr><td><code>avg_hm</code></td><td>float</td><td>평균습도 (%)</td></tr>
            <tr><td><code>sum_ss</code></td><td>float</td><td>일조시간 (hr)</td></tr>
          </tbody>
        </Table>

        <SubTitle>지역 정보 파일</SubTitle>
        <InfoBox>
          <DownloadLink href="/region_files/rda_region_info.csv" download>
            📥 region_info.csv 다운로드
          </DownloadLink>
          <p style={{margin: '8px 0 0 0', fontSize: '13px', color: '#666'}}>
            도명, 지점명, 지점코드, 위도, 경도, 고도, 관측시작일 정보 포함
          </p>
        </InfoBox>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 매일 1회
        </UpdateFrequency>
      </ApiCard>

      {/* RDA Daily 특정일 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> RDA 특정일 일별 데이터</ApiTitle>
        <Endpoint>/api/rda/daily/date/{'{target_date}'}</Endpoint>

        <SubTitle>경로 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>target_date</code></td><td>date</td><td>필수</td><td>조회 날짜 (YYYY-MM-DD)</td></tr>
          </tbody>
        </Table>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 매일 1회
        </UpdateFrequency>
      </ApiCard>

      {/* RDA Daily 기간 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> RDA 일별 기간 조회</ApiTitle>
        <Endpoint>/api/rda/daily/range</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>start_date</code></td><td>date</td><td>필수</td><td>조회 시작일</td></tr>
            <tr><td><code>end_date</code></td><td>date</td><td>필수</td><td>조회 종료일</td></tr>
            <tr><td><code>province</code></td><td>string</td><td>선택</td><td>도명 필터</td></tr>
            <tr><td><code>stn_nm</code></td><td>string</td><td>선택</td><td>지점명 필터</td></tr>
            <tr><td><code>offset</code></td><td>integer</td><td>선택</td><td>페이지 오프셋</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>선택</td><td>조회 개수</td></tr>
          </tbody>
        </Table>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 매일 1회
        </UpdateFrequency>
      </ApiCard>
    </Section>

    <Section>
      <SectionTitle>RDA 월별 기상 API</SectionTitle>

      {/* RDA Monthly 최신 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> RDA 최신 월별 데이터</ApiTitle>
        <Endpoint>/api/rda/monthly/latest</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>province</code></td><td>string</td><td>선택</td><td>도명 필터</td></tr>
            <tr><td><code>stn_nm</code></td><td>string</td><td>선택</td><td>지점명 필터</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>선택</td><td>조회 개수 (기본: 100)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 메시지</SubTitle>
        <Table>
          <thead>
            <tr><th>필드</th><th>타입</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>stn_cd</code></td><td>string</td><td>지점 코드</td></tr>
            <tr><td><code>stn_nm</code></td><td>string</td><td>지점명</td></tr>
            <tr><td><code>province</code></td><td>string</td><td>도명</td></tr>
            <tr><td><code>year</code></td><td>integer</td><td>연도</td></tr>
            <tr><td><code>month</code></td><td>integer</td><td>월</td></tr>
            <tr><td><code>avg_ta</code></td><td>float</td><td>월평균기온 (°C)</td></tr>
            <tr><td><code>max_ta</code></td><td>float</td><td>월최고기온 (°C)</td></tr>
            <tr><td><code>min_ta</code></td><td>float</td><td>월최저기온 (°C)</td></tr>
            <tr><td><code>sum_rn</code></td><td>float</td><td>월강수량 (mm)</td></tr>
            <tr><td><code>avg_ws</code></td><td>float</td><td>월평균풍속 (m/s)</td></tr>
            <tr><td><code>avg_hm</code></td><td>float</td><td>월평균습도 (%)</td></tr>
          </tbody>
        </Table>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 매월 1회
        </UpdateFrequency>
      </ApiCard>

      {/* RDA Monthly 연도별 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> RDA 연도별 월별 데이터</ApiTitle>
        <Endpoint>/api/rda/monthly/year/{'{year}'}</Endpoint>

        <SubTitle>경로 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>year</code></td><td>integer</td><td>필수</td><td>조회 연도 (예: 2024)</td></tr>
          </tbody>
        </Table>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 매월 1회
        </UpdateFrequency>
      </ApiCard>

      {/* RDA Monthly 기간 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> RDA 월별 기간 조회</ApiTitle>
        <Endpoint>/api/rda/monthly/range</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>start_year</code></td><td>integer</td><td>필수</td><td>조회 시작 연도</td></tr>
            <tr><td><code>start_month</code></td><td>integer</td><td>필수</td><td>조회 시작 월</td></tr>
            <tr><td><code>end_year</code></td><td>integer</td><td>필수</td><td>조회 종료 연도</td></tr>
            <tr><td><code>end_month</code></td><td>integer</td><td>필수</td><td>조회 종료 월</td></tr>
            <tr><td><code>province</code></td><td>string</td><td>선택</td><td>도명 필터</td></tr>
            <tr><td><code>stn_nm</code></td><td>string</td><td>선택</td><td>지점명 필터</td></tr>
          </tbody>
        </Table>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 매월 1회
        </UpdateFrequency>
      </ApiCard>

      {/* RDA 관측소 목록 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> RDA 관측소 목록</ApiTitle>
        <Endpoint>/api/rda/stations</Endpoint>

        <SubTitle>응답 메시지</SubTitle>
        <Table>
          <thead>
            <tr><th>필드</th><th>타입</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>stn_cd</code></td><td>string</td><td>지점 코드</td></tr>
            <tr><td><code>stn_nm</code></td><td>string</td><td>지점명</td></tr>
            <tr><td><code>province</code></td><td>string</td><td>도명</td></tr>
            <tr><td><code>data_count</code></td><td>integer</td><td>데이터 수</td></tr>
          </tbody>
        </Table>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 고정적
        </UpdateFrequency>
      </ApiCard>
    </Section>
  </>
);

// ===== 기상예보 =====
const ForecastDocs: React.FC = () => (
  <>
    <Section>
      <SectionTitle>KMA 단기예보 API</SectionTitle>

      {/* 단기예보 최신 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 최신 단기예보</ApiTitle>
        <Endpoint>/api/kma/forecast/short/latest</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>region_name</code></td><td>string</td><td>선택</td><td>지역명 필터</td></tr>
            <tr><td><code>category</code></td><td>string</td><td>선택</td><td>자료구분 (TMP, POP, SKY 등)</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>선택</td><td>조회 개수 (기본: 1000, 최대: 1000)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 메시지</SubTitle>
        <Table>
          <thead>
            <tr><th>필드</th><th>타입</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>region_name</code></td><td>string</td><td>지역명</td></tr>
            <tr><td><code>base_date</code></td><td>string</td><td>발표일자 (YYYYMMDD)</td></tr>
            <tr><td><code>base_time</code></td><td>string</td><td>발표시각 (HHMM)</td></tr>
            <tr><td><code>fcst_date</code></td><td>string</td><td>예보일자 (YYYYMMDD)</td></tr>
            <tr><td><code>fcst_time</code></td><td>string</td><td>예보시각 (HHMM)</td></tr>
            <tr><td><code>category</code></td><td>string</td><td>자료구분</td></tr>
            <tr><td><code>fcst_value</code></td><td>string</td><td>예보값</td></tr>
          </tbody>
        </Table>

        <SubTitle>자료구분 (category) 설명</SubTitle>
        <Table>
          <thead>
            <tr><th>코드</th><th>설명</th><th>단위</th></tr>
          </thead>
          <tbody>
            <tr><td><code>TMP</code></td><td>기온</td><td>°C</td></tr>
            <tr><td><code>TMN</code></td><td>최저기온</td><td>°C</td></tr>
            <tr><td><code>TMX</code></td><td>최고기온</td><td>°C</td></tr>
            <tr><td><code>POP</code></td><td>강수확률</td><td>%</td></tr>
            <tr><td><code>PTY</code></td><td>강수형태</td><td>코드 (0:없음, 1:비, 2:비/눈, 3:눈, 4:소나기)</td></tr>
            <tr><td><code>SKY</code></td><td>하늘상태</td><td>코드 (1:맑음, 3:구름많음, 4:흐림)</td></tr>
            <tr><td><code>REH</code></td><td>습도</td><td>%</td></tr>
            <tr><td><code>WSD</code></td><td>풍속</td><td>m/s</td></tr>
          </tbody>
        </Table>

        <SubTitle>예시 코드</SubTitle>
        <CodeBlock>{`// JavaScript
const response = await fetch(
  '${API_BASE_URL}/api/kma/forecast/short/latest?region_name=서울&category=TMP&limit=100'
);
const data = await response.json();

// Python
import requests
response = requests.get('${API_BASE_URL}/api/kma/forecast/short/latest', params={
    'region_name': '서울',
    'category': 'TMP',
    'limit': 100
})`}</CodeBlock>

        <SubTitle>지역 정보 파일</SubTitle>
        <InfoBox>
          <DownloadLink href="/region_files/region_latitude_longitude.csv" download>
            📥 region_latitude_longitude.csv 다운로드
          </DownloadLink>
          <p style={{margin: '8px 0 0 0', fontSize: '13px', color: '#666'}}>
            행정구역코드, 1단계, 2단계, 3단계, 격자 X, 격자 Y, 위도, 경도 정보 포함
          </p>
        </InfoBox>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 1일 8회 (02, 05, 08, 11, 14, 17, 20, 23시)
        </UpdateFrequency>
      </ApiCard>

      {/* 지역별 단기예보 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 지역별 단기예보</ApiTitle>
        <Endpoint>/api/kma/forecast/short/region/{'{region_name}'}</Endpoint>

        <SubTitle>경로 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>region_name</code></td><td>string</td><td>필수</td><td>지역명</td></tr>
          </tbody>
        </Table>

        <SubTitle>쿼리 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>fcst_date</code></td><td>date</td><td>선택</td><td>예보일자 필터</td></tr>
            <tr><td><code>category</code></td><td>string</td><td>선택</td><td>자료구분 필터</td></tr>
            <tr><td><code>offset</code></td><td>integer</td><td>선택</td><td>페이지 오프셋</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>선택</td><td>조회 개수 (기본: 50)</td></tr>
          </tbody>
        </Table>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 1일 8회 (02, 05, 08, 11, 14, 17, 20, 23시)
        </UpdateFrequency>
      </ApiCard>

      {/* 단기예보 지역 목록 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 단기예보 지역 목록</ApiTitle>
        <Endpoint>/api/kma/forecast/short/regions</Endpoint>

        <SubTitle>응답 메시지</SubTitle>
        <Table>
          <thead>
            <tr><th>필드</th><th>타입</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>region_name</code></td><td>string</td><td>지역명</td></tr>
            <tr><td><code>data_count</code></td><td>integer</td><td>데이터 수</td></tr>
          </tbody>
        </Table>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 지역 목록은 고정적
        </UpdateFrequency>
      </ApiCard>
    </Section>

    <Section>
      <SectionTitle>KMA 중기예보 API</SectionTitle>

      {/* 중기예보 최신 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 최신 중기예보</ApiTitle>
        <Endpoint>/api/kma/forecast/mid/latest</Endpoint>

        <SubTitle>요청 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>region_name</code></td><td>string</td><td>선택</td><td>지역명 필터</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>선택</td><td>조회 개수 (기본: 50, 최대: 100)</td></tr>
          </tbody>
        </Table>

        <SubTitle>응답 메시지</SubTitle>
        <Table>
          <thead>
            <tr><th>필드</th><th>타입</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>reg_id</code></td><td>string</td><td>예보구역코드</td></tr>
            <tr><td><code>region_name</code></td><td>string</td><td>지역명</td></tr>
            <tr><td><code>tm_fc</code></td><td>string</td><td>발표시각 (YYYYMMDDHHMM)</td></tr>
            <tr><td><code>forecast_date</code></td><td>date</td><td>예보일자</td></tr>
            <tr><td><code>wf_am</code></td><td>string</td><td>오전 날씨</td></tr>
            <tr><td><code>wf_pm</code></td><td>string</td><td>오후 날씨</td></tr>
            <tr><td><code>rn_st_am</code></td><td>integer</td><td>오전 강수확률 (%)</td></tr>
            <tr><td><code>rn_st_pm</code></td><td>integer</td><td>오후 강수확률 (%)</td></tr>
            <tr><td><code>ta_min</code></td><td>integer</td><td>최저기온 (°C)</td></tr>
            <tr><td><code>ta_max</code></td><td>integer</td><td>최고기온 (°C)</td></tr>
          </tbody>
        </Table>

        <SubTitle>예시 코드</SubTitle>
        <CodeBlock>{`// JavaScript
const response = await fetch('${API_BASE_URL}/api/kma/forecast/mid/latest?region_name=서울');
const data = await response.json();

// Python
import requests
response = requests.get('${API_BASE_URL}/api/kma/forecast/mid/latest',
                        params={'region_name': '서울'})`}</CodeBlock>

        <SubTitle>지역 정보 파일</SubTitle>
        <InfoBox>
          <DownloadLink href="/region_files/region_info_mid.csv" download>
            📥 region_info_mid.csv 다운로드
          </DownloadLink>
          <p style={{margin: '8px 0 0 0', fontSize: '13px', color: '#666'}}>
            예보구역코드, 구역명, 특성 정보 포함
          </p>
        </InfoBox>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 1일 2회 (06시, 18시)
        </UpdateFrequency>
      </ApiCard>

      {/* 지역별 중기예보 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 지역별 중기예보</ApiTitle>
        <Endpoint>/api/kma/forecast/mid/region/{'{region_name}'}</Endpoint>

        <SubTitle>경로 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>region_name</code></td><td>string</td><td>필수</td><td>지역명</td></tr>
          </tbody>
        </Table>

        <SubTitle>쿼리 파라미터</SubTitle>
        <Table>
          <thead>
            <tr><th>파라미터</th><th>타입</th><th>필수</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>forecast_date</code></td><td>date</td><td>선택</td><td>예보일자 필터</td></tr>
            <tr><td><code>offset</code></td><td>integer</td><td>선택</td><td>페이지 오프셋</td></tr>
            <tr><td><code>limit</code></td><td>integer</td><td>선택</td><td>조회 개수 (기본: 50)</td></tr>
          </tbody>
        </Table>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 1일 2회 (06시, 18시)
        </UpdateFrequency>
      </ApiCard>

      {/* 중기예보 지역 목록 */}
      <ApiCard>
        <ApiTitle><Method>GET</Method> 중기예보 지역 목록</ApiTitle>
        <Endpoint>/api/kma/forecast/mid/regions</Endpoint>

        <SubTitle>응답 메시지</SubTitle>
        <Table>
          <thead>
            <tr><th>필드</th><th>타입</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>reg_id</code></td><td>string</td><td>예보구역코드</td></tr>
            <tr><td><code>region_name</code></td><td>string</td><td>지역명</td></tr>
            <tr><td><code>data_count</code></td><td>integer</td><td>데이터 수</td></tr>
          </tbody>
        </Table>

        <UpdateFrequency>
          <strong>업데이트 주기:</strong> 지역 목록은 고정적
        </UpdateFrequency>
      </ApiCard>
    </Section>
  </>
);

export default ApiDocs;
