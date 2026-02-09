import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import pandas as pd
from pathlib import Path
import time

# 현재 스크립트 디렉토리
SCRIPT_DIR = Path(__file__).parent.absolute()
# .env 파일 경로: ../../API/backend/.env
ENV_PATH = SCRIPT_DIR.parent.parent / 'API' / 'backend' / '.env'
load_dotenv(ENV_PATH)

# 데이터베이스 연결 설정
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'ag_weather_db'),
    'user': os.getenv('DB_USER', 'smartfarm'),
    'password': os.getenv('DB_PASSWORD', 'smartfarm')
}

# API 설정
API_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
SERVICE_KEY = os.getenv('KMA_API_KEY')

# 요청 간격
REQUEST_DELAY = 1.5

# 발표시각 목록 (하루 8회)
BASE_TIMES = ['0200', '0500', '0800', '1100', '1400', '1700', '2000', '2300']


def create_short_forecast_table():
    """단기예보 데이터 테이블 생성 (UNIQUE 제약 제거)"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    create_table_query = """
    CREATE TABLE IF NOT EXISTS weather_short_forecast (
        id SERIAL PRIMARY KEY,
        region_name VARCHAR(100),
        nx INTEGER,
        ny INTEGER,
        base_date DATE,
        base_time VARCHAR(4),
        fcst_date DATE,
        fcst_time VARCHAR(4),
        category VARCHAR(10),
        fcst_value VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_short_base_date ON weather_short_forecast(base_date);
    CREATE INDEX IF NOT EXISTS idx_short_base_time ON weather_short_forecast(base_time);
    CREATE INDEX IF NOT EXISTS idx_short_fcst_date ON weather_short_forecast(fcst_date);
    CREATE INDEX IF NOT EXISTS idx_short_region ON weather_short_forecast(region_name);
    CREATE INDEX IF NOT EXISTS idx_short_category ON weather_short_forecast(category);
    """

    cur.execute(create_table_query)
    conn.commit()
    cur.close()
    conn.close()
    print("✅ 단기예보 테이블 생성 완료")


def clear_old_forecast_data():
    """기존 단기예보 데이터 전체 삭제"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    try:
        # 전체 데이터 삭제
        cur.execute("TRUNCATE TABLE weather_short_forecast;")
        conn.commit()
        print("🗑️  기존 단기예보 데이터 전체 삭제 완료")

        # VACUUM으로 디스크 공간 즉시 회수
        conn.set_isolation_level(0)  # autocommit 모드
        cur.execute("VACUUM FULL weather_short_forecast;")
        print("💾 디스크 공간 회수 완료")

    except Exception as e:
        print(f"❌ 데이터 삭제 실패: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


def get_base_datetime():
    """
    현재 시간 기준 가장 최근 발표시각 계산
    - 발표시각: 02:00, 05:00, 08:00, 11:00, 14:00, 17:00, 20:00, 23:00
    - API 제공: 발표시각 + 10분 이후
    """
    now = datetime.now()
    current_hour = now.hour
    current_minute = now.minute

    # 발표시각을 시간으로 변환 (02, 05, 08, 11, 14, 17, 20, 23)
    base_hours = [2, 5, 8, 11, 14, 17, 20, 23]

    # 현재 시간과 가장 가까운 이전 발표시각 찾기
    selected_hour = None
    for base_hour in reversed(base_hours):
        # 해당 발표시각 + 10분이 지났는지 확인
        if current_hour > base_hour or (current_hour == base_hour and current_minute >= 10):
            selected_hour = base_hour
            break

    # 만약 현재 시간이 02:10 이전이면 전날 23:00 사용
    if selected_hour is None:
        base_datetime = now - timedelta(days=1)
        selected_hour = 23
    else:
        base_datetime = now

    # 발표일자: YYYYMMDD
    base_date = base_datetime.strftime('%Y%m%d')

    # 발표시각: HH00
    base_time = f"{selected_hour:02d}00"

    return base_date, base_time


def fetch_short_forecast_data(base_date, base_time, nx, ny, page_no=1, max_retries=3):
    """API에서 단기예보 데이터 가져오기 (JSON)"""

    params = {
        'serviceKey': SERVICE_KEY,
        'numOfRows': 1000,  # 3일치 예보는 데이터가 많음
        'pageNo': page_no,
        'dataType': 'JSON',
        'base_date': base_date,
        'base_time': base_time,
        'nx': nx,
        'ny': ny
    }

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    for attempt in range(max_retries):
        try:
            response = requests.get(API_URL, params=params, headers=headers, timeout=30)

            if response.status_code == 429:
                wait_time = (attempt + 1) * 10
                print(f"⚠️ API 요청 제한 - {wait_time}초 후 재시도")
                time.sleep(wait_time)
                continue

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = (attempt + 1) * 3
                print(f"⏳ {wait_time}초 후 재시도...")
                time.sleep(wait_time)
            else:
                return None

    return None


def parse_short_forecast_json(json_data, region_name, nx, ny):
    """JSON 데이터 파싱"""
    try:
        response = json_data.get('response')
        if not response:
            return []

        header = response.get('header', {})
        result_code = header.get('resultCode')

        if result_code != '00':
            return []

        body = response.get('body', {})
        items = body.get('items', {}).get('item', [])

        if not items:
            return []

        parsed_items = []
        for item in items:
            parsed_item = {
                'region_name': region_name,
                'nx': nx,
                'ny': ny,
                'base_date': item.get('baseDate'),
                'base_time': item.get('baseTime'),
                'fcst_date': item.get('fcstDate'),
                'fcst_time': item.get('fcstTime'),
                'category': item.get('category'),
                'fcst_value': item.get('fcstValue')
            }
            parsed_items.append(parsed_item)

        return parsed_items

    except Exception as e:
        print(f"❌ JSON 파싱 실패: {e}")
        return []


def save_short_forecast_to_db(items):
    """단기예보 데이터를 데이터베이스에 저장 (단순 INSERT)"""
    if not items:
        return 0

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    insert_query = """
    INSERT INTO weather_short_forecast (
        region_name, nx, ny, base_date, base_time, fcst_date, fcst_time, category, fcst_value
    ) VALUES %s
    """

    values = [
        (
            item['region_name'],
            item['nx'],
            item['ny'],
            item['base_date'],
            item['base_time'],
            item['fcst_date'],
            item['fcst_time'],
            item['category'],
            item['fcst_value']
        )
        for item in items
    ]

    try:
        execute_values(cur, insert_query, values)
        conn.commit()
        return len(items)
    except Exception as e:
        conn.rollback()
        print(f"❌ DB 저장 실패: {e}")
        return 0
    finally:
        cur.close()
        conn.close()


def collect_region_forecast(region_name, nx, ny, base_date, base_time):
    """특정 지역의 단기예보 데이터 수집 (페이지네이션)"""
    all_items = []
    page = 1

    while True:
        json_data = fetch_short_forecast_data(base_date, base_time, nx, ny, page)

        if not json_data:
            print(f"\n   ❌ API 응답 없음")
            break

        items = parse_short_forecast_json(json_data, region_name, nx, ny)

        if not items:
            if not items:
                # 왜 items가 비었는지 확인
                response = json_data.get('response', {})
                header = response.get('header', {})
                result_code = header.get('resultCode')
                result_msg = header.get('resultMsg')
                print(f"\n   ⚠️ resultCode: {result_code}, msg: {result_msg}")  # 추가
                break

        all_items.extend(items)

        # totalCount 확인
        body = json_data.get('response', {}).get('body', {})
        total_count = body.get('totalCount', 0)

        if total_count > 0 and len(all_items) >= total_count:
            break

        # 1000개씩 가져오므로 1000개 미만이면 마지막 페이지
        if len(items) < 1000:
            break

        page += 1
        time.sleep(REQUEST_DELAY)

    return all_items


def main():
    """메인 실행 함수"""
    start_time = datetime.now()

    print("=" * 60)
    print(f"🚀 단기예보 데이터 수집 시작 (전체 갱신 모드)")
    print(f"   시작 시간: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 테이블 생성
    create_short_forecast_table()

    # ⭐ 기존 데이터 전체 삭제
    clear_old_forecast_data()

    # 발표 일시 계산
    base_date, base_time = get_base_datetime()
    print(f"📅 발표일자: {base_date}")
    print(f"🕐 발표시각: {base_time}")

    # CSV 파일에서 좌표 정보 읽기
    csv_path = SCRIPT_DIR / 'region_latitude_longitude.csv'

    if not csv_path.exists():
        print(f"❌ CSV 파일을 찾을 수 없습니다: {csv_path}")
        return

    df = pd.read_csv(csv_path, encoding='utf-8-sig')

    print(f"\n📋 원본 데이터: {len(df)}개 지역")

    # 2단계 기준으로 중복 제거 (각 2단계의 첫 번째 행만 선택)
    if '2단계' in df.columns:
        df_unique = df.groupby('2단계', as_index=False).first()
        print(f"📊 2단계 기준 중복 제거: {len(df_unique)}개 지역")
        print(f"전체 행: {len(df)}")
        print(f"2단계 고유값: {df['2단계'].nunique()}")
    else:
        print(f"❌ '2단계' 컬럼을 찾을 수 없습니다")
        return

    # 컬럼 확인
    if '격자 X' not in df_unique.columns or '격자 Y' not in df_unique.columns:
        print(f"❌ '격자 X', '격자 Y' 컬럼을 찾을 수 없습니다")
        return

    print("=" * 60)

    total_regions = len(df_unique)
    total_saved = 0
    success_count = 0
    fail_count = 0

    for idx, row in df_unique.iterrows():
        # 2단계를 지역명으로 사용
        region_name = str(row['2단계'])
        nx = int(row['격자 X'])
        ny = int(row['격자 Y'])

        print(f"[{idx + 1}/{total_regions}] {region_name} (nx:{nx}, ny:{ny})", end=" ")

        try:
            # 단기예보 데이터 수집
            items = collect_region_forecast(region_name, nx, ny, base_date, base_time)

            if items:
                saved = save_short_forecast_to_db(items)
                print(f"✅ {saved}개")

                if saved > 0:
                    success_count += 1
                    total_saved += saved
                else:
                    fail_count += 1
            else:
                print(f"⚠️")
                fail_count += 1

        except Exception as e:
            print(f"❌ {e}")
            fail_count += 1

        # 요청 간 딜레이
        if idx < total_regions - 1:
            time.sleep(REQUEST_DELAY)

        # 진행률 표시
        if (idx + 1) % 20 == 0:
            elapsed = (datetime.now() - start_time).total_seconds()
            avg_time = elapsed / (idx + 1)
            remaining = (total_regions - idx - 1) * avg_time

            print(f"\n{'=' * 60}")
            print(f"📈 진행률: {(idx + 1) / total_regions * 100:.1f}%")
            print(f"⏱️  경과: {elapsed / 60:.1f}분 | 남은시간: {remaining / 60:.1f}분")
            print(f"💾 누적: {total_saved:,}개 | ✅ {success_count} | ❌ {fail_count}")
            print(f"{'=' * 60}")

    end_time = datetime.now()
    elapsed_time = (end_time - start_time).total_seconds()

    print("\n" + "=" * 60)
    print(f"✨ 수집 완료!")
    print(f"   완료 시간: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   총 소요 시간: {elapsed_time / 60:.1f}분")
    print(f"📅 발표일시: {base_date} {base_time}")
    print(f"💾 총 저장 데이터: {total_saved:,}개")
    print(f"✅ 성공: {success_count}/{total_regions}")
    print(f"❌ 실패: {fail_count}/{total_regions}")
    print("=" * 60)


if __name__ == "__main__":
    main()