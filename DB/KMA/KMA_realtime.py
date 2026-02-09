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
API_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst"
SERVICE_KEY = os.getenv('KMA_API_KEY')

# 요청 간격
REQUEST_DELAY = 1.5


def create_ultra_short_table():
    """초단기 실황 데이터 테이블 생성"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    create_table_query = """
    CREATE TABLE IF NOT EXISTS weather_realtime (
        id SERIAL PRIMARY KEY,
        sido VARCHAR(50),
        region_name VARCHAR(100),
        nx INTEGER,
        ny INTEGER,
        base_date DATE,
        base_time VARCHAR(4),
        category VARCHAR(10),
        obsrvalue FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(region_name, base_date, base_time, category)
    );

    CREATE INDEX IF NOT EXISTS idx_ultra_base_date ON weather_realtime(base_date);
    CREATE INDEX IF NOT EXISTS idx_ultra_base_time ON weather_realtime(base_time);
    CREATE INDEX IF NOT EXISTS idx_ultra_region ON weather_realtime(region_name);
    CREATE INDEX IF NOT EXISTS idx_ultra_category ON weather_realtime(category);
    CREATE INDEX IF NOT EXISTS idx_ultra_sido ON weather_realtime(sido);

    -- 기존 테이블에 sido 컬럼이 없으면 추가
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='weather_realtime' AND column_name='sido') THEN
            ALTER TABLE weather_realtime ADD COLUMN sido VARCHAR(50);
        END IF;
    END $$;
    """

    cur.execute(create_table_query)
    conn.commit()
    cur.close()
    conn.close()
    print("✅ 초단기 실황 테이블 생성 완료")


def clear_previous_day_data(today_date):
    """오늘 날짜가 아닌 데이터 삭제"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    try:
        cur.execute(
            "DELETE FROM weather_realtime WHERE base_date != %s;",
            (today_date,)
        )
        deleted_count = cur.rowcount
        conn.commit()
        print(f"🗑️ 이전 날짜 데이터 {deleted_count}개 삭제 완료")
        return deleted_count
    except Exception as e:
        conn.rollback()
        print(f"❌ 이전 데이터 삭제 실패: {e}")
        return 0
    finally:
        cur.close()
        conn.close()


def check_if_midnight_run(base_date, base_time):
    """
    0시 15분에 실행되는지 확인
    Returns: True if it's the first run of the day (00:15)
    """
    return base_time == "0000"


def fetch_ultra_short_data(base_date, base_time, nx, ny, max_retries=3):
    """API에서 초단기 실황 데이터 가져오기 (JSON)"""

    params = {
        'serviceKey': SERVICE_KEY,
        'numOfRows': 10,
        'pageNo': 1,
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


def parse_ultra_short_json(json_data, sido, region_name, nx, ny):
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
            try:
                obsrvalue = float(item.get('obsrValue', 0)) if item.get('obsrValue') else None
            except (ValueError, TypeError):
                obsrvalue = None

            parsed_item = {
                'sido': sido,
                'region_name': region_name,
                'nx': nx,
                'ny': ny,
                'base_date': item.get('baseDate'),
                'base_time': item.get('baseTime'),
                'category': item.get('category'),
                'obsrvalue': obsrvalue
            }
            parsed_items.append(parsed_item)

        return parsed_items

    except Exception as e:
        print(f"❌ JSON 파싱 실패: {e}")
        return []


def save_ultra_short_to_db(items):
    """초단기 실황 데이터를 데이터베이스에 저장 (중복 시 무시)"""
    if not items:
        return 0

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    insert_query = """
    INSERT INTO weather_realtime (
        sido, region_name, nx, ny, base_date, base_time, category, obsrvalue
    ) VALUES %s
    ON CONFLICT (region_name, base_date, base_time, category) DO NOTHING
    """

    values = [
        (
            item['sido'],
            item['region_name'],
            item['nx'],
            item['ny'],
            item['base_date'],
            item['base_time'],
            item['category'],
            item['obsrvalue']
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


def get_base_datetime():
    """
    현재 시간 기준 발표 시각 계산
    - 매시각 정시(00분)에 데이터 생성
    - 10분 이후부터 API 제공

    예시:
    - 12:05 → 11시 데이터 (1100)
    - 12:10 → 12시 데이터 (1200)
    - 12:45 → 12시 데이터 (1200)
    """
    now = datetime.now()

    # 현재 분이 10분 미만이면 이전 시간 데이터 사용
    if now.minute < 10:
        base_datetime = now - timedelta(hours=1)
    else:
        base_datetime = now

    # 발표일자: YYYYMMDD
    base_date = base_datetime.strftime('%Y%m%d')

    # 발표시각: HH00 (정시)
    base_time = base_datetime.strftime('%H00')

    return base_date, base_time


def main():
    """메인 실행 함수"""
    start_time = datetime.now()

    print("=" * 60)
    print(f"🚀 초단기 실황 데이터 수집 시작")
    print(f"   시작 시간: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 테이블 생성
    create_ultra_short_table()

    # 발표 일시 계산
    base_date, base_time = get_base_datetime()
    print(f"📅 발표일자: {base_date}")
    print(f"🕐 발표시각: {base_time}")

    # 0시 15분 실행 시 전날 데이터 삭제
    if check_if_midnight_run(base_date, base_time):
        print(f"🌙 자정 데이터 수집 - 이전 날짜 데이터 삭제 중...")
        clear_previous_day_data(base_date)
    else:
        print(f"➕ 오늘 데이터에 추가 저장")

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
        # 1단계를 시도명으로 사용
        sido = str(row['1단계'])

        # 2단계를 지역명으로 사용
        region_name = str(row['2단계'])
        nx = int(row['격자 X'])
        ny = int(row['격자 Y'])

        print(f"[{idx + 1}/{total_regions}] {sido} {region_name} (nx:{nx}, ny:{ny})", end=" ")

        try:
            # API 호출
            json_data = fetch_ultra_short_data(base_date, base_time, nx, ny)

            if not json_data:
                print(f"❌")
                fail_count += 1
                continue

            # JSON 파싱
            items = parse_ultra_short_json(json_data, sido, region_name, nx, ny)

            if items:
                saved = save_ultra_short_to_db(items)
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