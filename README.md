# Agri-Weather API

농업 기상 데이터 API 서비스 - 기상청(KMA)과 국립농업과학원(RDA)의 기상 데이터를 제공하는 웹 애플리케이션

## 주요 기능

### 현재 기상 실황
- 기상청(KMA) 초단기 실황 데이터
- 국립농업과학원(RDA) 실시간 관측 데이터
- 지도 기반 시각화

### 과거 기상 현황
- 일별/월별 기상 데이터 조회
- 기간별 데이터 검색
- CSV/Excel 다운로드

### 기상 예보
- 단기예보 (3일)
- 중기예보 (10일)
- 지역별 예보 조회

### API 문서
- Swagger UI (`/docs`)
- ReDoc (`/redoc`)

## 기술 스택

### Backend
- **FastAPI** - Python 웹 프레임워크
- **PostgreSQL** - 데이터베이스
- **SQLAlchemy** - ORM
- **Uvicorn** - ASGI 서버

### Frontend
- **React 19** - UI 라이브러리
- **TypeScript** - 정적 타입
- **Vite** - 빌드 도구
- **Tailwind CSS** - 스타일링
- **Recharts** - 차트 라이브러리
- **D3.js** - 지도 시각화

### Infrastructure
- **Docker** - 컨테이너화
- **Nginx** - 웹 서버

## 프로젝트 구조

```
Agri-Weather_API/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI 앱
│   │   ├── config.py         # 설정
│   │   ├── database.py       # DB 연결
│   │   ├── models/           # SQLAlchemy 모델
│   │   ├── routers/          # API 라우터
│   │   └── schemas/          # Pydantic 스키마
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # React 컴포넌트
│   │   ├── pages/            # 페이지 컴포넌트
│   │   └── services/         # API 서비스
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

## 설치 및 실행

### 사전 요구사항
- Docker & Docker Compose
- PostgreSQL (별도 컨테이너 또는 외부 DB)

### 환경 변수 설정

`backend/.env` 파일 생성:

```env
# 앱 설정
APP_NAME=농업 기상 데이터 API
APP_VERSION=1.0.0
DEBUG=false

# 데이터베이스 설정
DB_HOST=postgres
DB_PORT=5432
DB_NAME=ag_weather_db
DB_USER=smartfarm
DB_PASSWORD=smartfarm

# CORS 설정
CORS_ORIGINS=*
```

### Docker로 실행

```bash
# PostgreSQL 컨테이너 실행 (최초 1회)
docker run -d \
  --name postgres \
  -e POSTGRES_DB=ag_weather_db \
  -e POSTGRES_USER=smartfarm \
  -e POSTGRES_PASSWORD=smartfarm \
  -p 5432:5432 \
  postgres:15

# PostgreSQL을 앱 네트워크에 연결
docker network create agri-weather_api_app-network
docker network connect agri-weather_api_app-network postgres

# 앱 빌드 및 실행
docker-compose up --build -d
```

### 접속 URL

| 서비스 | URL |
|--------|-----|
| 프론트엔드 | http://localhost:8005 |
| 백엔드 API | http://localhost:8001 |
| API 문서 (Swagger) | http://localhost:8001/docs |
| API 문서 (ReDoc) | http://localhost:8001/redoc |

## API 엔드포인트

### KMA (기상청)

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/kma/asos/stations` | ASOS 관측소 목록 |
| `GET /api/kma/asos/range` | ASOS 일별 데이터 조회 |
| `GET /api/kma/realtime/latest/pivot` | 실시간 실황 데이터 |
| `GET /api/kma/forecast/short/regions` | 단기예보 지역 목록 |
| `GET /api/kma/forecast/short/latest` | 단기예보 데이터 |
| `GET /api/kma/forecast/mid/land` | 중기육상예보 |
| `GET /api/kma/forecast/mid/temp` | 중기기온예보 |

### RDA (국립농업과학원)

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/rda/weather/stations` | 관측소 목록 |
| `GET /api/rda/weather/realtime/latest` | 실시간 데이터 |
| `GET /api/rda/weather/daily/range` | 일별 데이터 조회 |

## 개발 환경 실행

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 라이선스

MIT License
