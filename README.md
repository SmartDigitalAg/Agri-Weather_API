# Agri-Weather

통합 농업 기상 데이터 수집 및 API 서비스 프로젝트입니다. 국내 기상청(KMA)과 농촌진흥청(RDA)의 데이터를 수집하여 저장하고, 통합된 RESTful API로 제공합니다.

## 주요 기능

### 1. 데이터 수집 (Agri-Weather-DB)
- **기상청(KMA)**
  - ASOS 일 관측 데이터(1904년~현재)
  - 초단기 실황, 단기예보, 중기예보
- **농촌진흥청(RDA)**
  - 농업 기상 관측(10분/일/월)
- **자동화**
  - Docker 기반 스케줄러로 정기 수집

### 2. 데이터 서비스 (Agri-Weather-API)
- **실시간 조회**: 현재 기상 상황 및 실황 데이터 조회
- **통계/이력**: 일/월 기상 데이터 조회 및 다운로드
- **예보 서비스**: 단기/중기 예보 정보 제공
- **시각화**: 지도 및 차트 기반 데이터 시각화(React Frontend)

## 기술 스택

| 분류 | 기술 |
|------|------|
| **Infrastructure** | Docker, Docker Compose, Nginx |
| **Database** | PostgreSQL 15 |
| **Backend** | Python: FastAPI (API), Requests (Collector) |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS |
| **Automation** | Python `schedule` Library |

## 프로젝트 구조

```
weather-api/
├── API/
│   ├── backend/              # FastAPI 백엔드
│   └── frontend/             # React 프론트엔드
├── DB/
│   ├── KMA/                  # KMA 수집 스크립트
│   └── RDA/                  # RDA 수집 스크립트
├── Dockerfile                # 통합 Multi-stage Dockerfile
├── docker-compose.yml        # 통합 Docker 구성
├── scheduler.py              # 데이터 수집 스케줄러
└── README.md
```

## 설치 및 실행

### 1. 리포지토리 클론

```bash
git clone https://github.com/your-repo/weather-api.git
cd weather-api
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 아래 내용을 설정합니다.

```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=ag_weather_db
DB_USER=smartfarm
DB_PASSWORD=smartfarm

# API & Server
APP_NAME=농업 기상 데이터 API
APP_VERSION=1.0.0
DEBUG=false
CORS_ORIGINS=*

# API Keys (공공데이터포털)
KMA_API_KEY=your_kma_api_key_here
RDA_API_KEY=your_rda_api_key_here
```

### 3. Docker 실행

전체 서비스(DB, Scheduler, Backend, Frontend)를 한 번에 실행합니다.

```bash
docker-compose up -d --build
```

### 4. 접속 정보

| 서비스 | URL | 비고 |
|--------|-----|------|
| **Frontend** | http://localhost:8005 | 웹 인터페이스 |
| **Backend API** | http://localhost:8001 | REST API |
| **API Docs** | http://localhost:8001/docs | Swagger UI |

### 5. 데이터베이스 초기화 (최초 1회)

테이블 스키마를 생성하기 위해 초기화 스크립트를 실행합니다.

```bash
docker-compose exec scheduler python init_db.py
```

### 6. 초기 데이터 수집 (수동)

스케줄러를 기다리지 않고 즉시 데이터를 수집하려면 아래 스크립트를 실행합니다.
(기본값: 최근 2개월 데이터 수집)

```bash
docker-compose exec -it scheduler python passivity_collect.py
```

## 자동화(스케줄러)

Docker 컨테이너(`scheduler`)에서 아래 주기로 데이터 수집이 자동 실행됩니다.

| 종류 | 실행 주기 |
|------|----------|
| RDA 10분 관측 | 10분마다 |
| RDA 일/월 | 매일 01:00 / 매월 1일 02:00 |
| KMA 일 | 매일 01:10 |
| KMA 중기예보 | 매일 06:10, 18:10 |

로그 확인:
```bash
docker-compose logs -f scheduler
```

## 데이터베이스 스키마

- **KMA**: `asos_daily_data`, `weather_realtime`, `weather_short_forecast`, `weather_mid_forecast`
- **RDA**: `weather_data` (10분), `weather_data_daily` (일), `weather_data_monthly` (월)
