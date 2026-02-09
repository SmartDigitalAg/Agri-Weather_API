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
# .env 파일 경로: ../../.env
ENV_PATH = SCRIPT_DIR.parent.parent / '.env'
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
API_URL_LAND = "http://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst"
API_URL_TEMP = "http://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa"
SERVICE_KEY = os.getenv('KMA_API_KEY')

# 요청 간격
REQUEST_DELAY = 1.5


def create_mid_forecast_table():
    """중기예보 데이터 테이블 생성"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    create_table_query = """
    CREATE TABLE IF NOT EXISTS weather_mid_forecast (
        id SERIAL PRIMARY KEY,
        reg_id VARCHAR(20),
        region_name VARCHAR(100),
        tm_fc VARCHAR(12),
        forecast_date DATE,
        time_period VARCHAR(10),
        rain_prob INTEGER,
        weather_condition VARCHAR(50),
        temp_min FLOAT,
        temp_min_low FLOAT,
        temp_min_high FLOAT,
        temp_max FLOAT,
        temp_max_low FLOAT,
        temp_max_high FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(reg_id, tm_fc, forecast_date, time_period)
    );

    CREATE INDEX IF NOT EXISTS idx_mid_reg_id ON weather_mid_forecast(reg_id);
    CREATE INDEX IF NOT EXISTS idx_mid_tm_fc ON weather_mid_forecast(tm_fc);
    CREATE INDEX IF NOT EXISTS idx_mid_forecast_date ON weather_mid_forecast(forecast_date);
    CREATE INDEX IF NOT EXISTS idx_mid_region ON weather_mid_forecast(region_name);
    """

    cur.execute(create_table_query)
    conn.commit()
    cur.close()
    conn.close()
    print("✅ 중기예보 테이블 생성 완료")


def get_tm_fc():
    """
    발표시각 계산
    - 06시 발표: 당일 06:00 (4~10일 예보)
    - 18시 발표: 당일 18:00 (5~10일 예보)

    현재 시각 기준 가장 최근 발표시각 반환
    """
    now = datetime.now()

    # 06시 발표 (06:00 ~ 17:59)
    if 6 <= now.hour < 18:
        tm_fc = now.replace(hour=6, minute=0, second=0, microsecond=0)
    # 18시 발표 (18:00 ~ 익일 05:59)
    else:
        if now.hour >= 18:
            tm_fc = now.replace(hour=18, minute=0, second=0, microsecond=0)
        else:  # 자정~06시 사이는 전날 18시 발표
            tm_fc = (now - timedelta(days=1)).replace(hour=18, minute=0, second=0, microsecond=0)

    return tm_fc.strftime('%Y%m%d%H%M')


def fetch_api_data(url, reg_id, tm_fc, max_retries=3):
    """API에서 데이터 가져오기"""

    params = {
        'serviceKey': SERVICE_KEY,
        'numOfRows': 10,
        'pageNo': 1,
        'dataType': 'JSON',
        'regId': reg_id,
        'tmFc': tm_fc
    }

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    for attempt in range(max_retries):
        try:
            response = requests.get(url, params=params, headers=headers, timeout=30)

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


def parse_mid_forecast_json(land_data, temp_data, region_name, tm_fc):  # tm_fc 파라미터 추가
    """중기예보 + 중기기온 JSON 데이터 파싱 및 병합"""
    try:
        # tm_fc를 datetime으로 변환 (여기서 한 번만)
        tm_fc_dt = datetime.strptime(tm_fc, '%Y%m%d%H%M')

        # 육상예보 파싱
        land_items = {}
        if land_data:
            response = land_data.get('response')
            if not response:
                return []

            header = response.get('header', {})
            result_code = header.get('resultCode')

            if result_code != '00':
                result_msg = header.get('resultMsg', 'Unknown error')
                print(f"⚠️ 육상예보 오류: {result_code} - {result_msg}")
                return []

            body = response.get('body', {})
            items = body.get('items', {}).get('item', [])

            if isinstance(items, dict):
                items = [items]

            if items and len(items) > 0:
                item = items[0]
                reg_id = item.get('regId')

                # 3~10일 예보 데이터
                forecast_days = [
                    (3, 'Am', item.get('rnSt3Am'), item.get('wf3Am')),
                    (3, 'Pm', item.get('rnSt3Pm'), item.get('wf3Pm')),
                    (4, 'Am', item.get('rnSt4Am'), item.get('wf4Am')),
                    (4, 'Pm', item.get('rnSt4Pm'), item.get('wf4Pm')),
                    (5, 'Am', item.get('rnSt5Am'), item.get('wf5Am')),
                    (5, 'Pm', item.get('rnSt5Pm'), item.get('wf5Pm')),
                    (6, 'Am', item.get('rnSt6Am'), item.get('wf6Am')),
                    (6, 'Pm', item.get('rnSt6Pm'), item.get('wf6Pm')),
                    (7, 'Am', item.get('rnSt7Am'), item.get('wf7Am')),
                    (7, 'Pm', item.get('rnSt7Pm'), item.get('wf7Pm')),
                    (8, 'All', item.get('rnSt8'), item.get('wf8')),
                    (9, 'All', item.get('rnSt9'), item.get('wf9')),
                    (10, 'All', item.get('rnSt10'), item.get('wf10')),
                ]

                for day, period, rain_prob, weather in forecast_days:
                    forecast_date = (tm_fc_dt + timedelta(days=day)).strftime('%Y-%m-%d')
                    key = (forecast_date, period)

                    try:
                        rain_prob_value = int(rain_prob) if rain_prob else None
                    except (ValueError, TypeError):
                        rain_prob_value = None

                    land_items[key] = {
                        'reg_id': reg_id,
                        'region_name': region_name,
                        'tm_fc': tm_fc,  # 파라미터로 받은 tm_fc 사용
                        'forecast_date': forecast_date,
                        'time_period': period,
                        'rain_prob': rain_prob_value,
                        'weather_condition': weather
                    }

        # 기온예보 파싱
        temp_items = {}
        if temp_data:
            response = temp_data.get('response')
            if not response:
                # 육상예보만 있어도 진행
                if land_items:
                    return list(land_items.values())
                return []

            header = response.get('header', {})
            result_code = header.get('resultCode')

            if result_code != '00':
                result_msg = header.get('resultMsg', 'Unknown error')
                print(f"⚠️ 기온예보 오류: {result_code} - {result_msg}")
                # 육상예보만 있어도 진행
                if land_items:
                    return list(land_items.values())
                return []

            body = response.get('body', {})
            items = body.get('items', {}).get('item', [])

            if isinstance(items, dict):
                items = [items]

            if items and len(items) > 0:
                item = items[0]

                # 3~10일 기온 데이터
                temp_days = []
                for day in range(3, 11):
                    forecast_date = (tm_fc_dt + timedelta(days=day)).strftime('%Y-%m-%d')

                    # 3~7일: Am/Pm 구분
                    if day <= 7:
                        temp_days.append((
                            forecast_date, 'Am',
                            item.get(f'taMin{day}'), item.get(f'taMin{day}Low'), item.get(f'taMin{day}High'),
                            None, None, None  # 오전은 최저기온만
                        ))
                        temp_days.append((
                            forecast_date, 'Pm',
                            None, None, None,  # 오후는 최고기온만
                            item.get(f'taMax{day}'), item.get(f'taMax{day}Low'), item.get(f'taMax{day}High')
                        ))
                    # 8~10일: All (하루 단위)
                    else:
                        temp_days.append((
                            forecast_date, 'All',
                            item.get(f'taMin{day}'), item.get(f'taMin{day}Low'), item.get(f'taMin{day}High'),
                            item.get(f'taMax{day}'), item.get(f'taMax{day}Low'), item.get(f'taMax{day}High')
                        ))

                for date, period, t_min, t_min_low, t_min_high, t_max, t_max_low, t_max_high in temp_days:
                    key = (date, period)

                    def safe_float(val):
                        try:
                            return float(val) if val else None
                        except (ValueError, TypeError):
                            return None

                    temp_items[key] = {
                        'temp_min': safe_float(t_min),
                        'temp_min_low': safe_float(t_min_low),
                        'temp_min_high': safe_float(t_min_high),
                        'temp_max': safe_float(t_max),
                        'temp_max_low': safe_float(t_max_low),
                        'temp_max_high': safe_float(t_max_high)
                    }

        # 육상예보와 기온예보 병합
        merged_items = []
        for key, land_item in land_items.items():
            temp_item = temp_items.get(key, {})
            merged_item = {**land_item, **temp_item}
            merged_items.append(merged_item)

        return merged_items

    except Exception as e:
        print(f"❌ 파싱 실패: {e}")
        import traceback
        traceback.print_exc()
        return []


def save_mid_forecast_to_db(items):
    """중기예보 데이터를 데이터베이스에 저장"""
    if not items:
        return 0

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    insert_query = """
    INSERT INTO weather_mid_forecast (
        reg_id, region_name, tm_fc, forecast_date, time_period, 
        rain_prob, weather_condition,
        temp_min, temp_min_low, temp_min_high,
        temp_max, temp_max_low, temp_max_high
    ) VALUES %s
    ON CONFLICT (reg_id, tm_fc, forecast_date, time_period) DO UPDATE SET
        rain_prob = EXCLUDED.rain_prob,
        weather_condition = EXCLUDED.weather_condition,
        temp_min = EXCLUDED.temp_min,
        temp_min_low = EXCLUDED.temp_min_low,
        temp_min_high = EXCLUDED.temp_min_high,
        temp_max = EXCLUDED.temp_max,
        temp_max_low = EXCLUDED.temp_max_low,
        temp_max_high = EXCLUDED.temp_max_high
    """

    values = [
        (
            item.get('reg_id'),
            item.get('region_name'),
            item.get('tm_fc'),
            item.get('forecast_date'),
            item.get('time_period'),
            item.get('rain_prob'),
            item.get('weather_condition'),
            item.get('temp_min'),
            item.get('temp_min_low'),
            item.get('temp_min_high'),
            item.get('temp_max'),
            item.get('temp_max_low'),
            item.get('temp_max_high')
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


def main():
    """메인 실행 함수"""
    start_time = datetime.now()

    print("=" * 60)
    print(f"🚀 중기예보 데이터 수집 시작 (육상예보 + 기온예보)")
    print(f"   시작 시간: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 테이블 생성
    create_mid_forecast_table()

    # 발표시각 계산
    tm_fc = get_tm_fc()
    print(f"📅 발표시각: {tm_fc}")

    # CSV 파일에서 지역코드 정보 읽기
    csv_path = SCRIPT_DIR / 'region_info_mid.csv'

    if not csv_path.exists():
        print(f"❌ CSV 파일을 찾을 수 없습니다: {csv_path}")
        return

    df = pd.read_csv(csv_path, encoding='utf-8')

    print(f"\n📋 CSV 파일 정보:")
    print(f"   컬럼: {list(df.columns)}")
    print(f"   행 수: {len(df)}")

    # 컬럼명 확인
    if '예보구역코드' not in df.columns or '구역명' not in df.columns:
        print(f"❌ 필수 컬럼을 찾을 수 없습니다")
        return

    print(f"   지역코드 컬럼: 예보구역코드")
    print(f"   지역명 컬럼: 구역명")
    print("=" * 60)

    # 중복 제거 (같은 예보구역코드는 하나만)
    df_unique = df.drop_duplicates(subset=['예보구역코드'])

    total_regions = len(df_unique)
    total_saved = 0
    success_count = 0
    fail_count = 0

    for idx, row in df_unique.iterrows():
        reg_id = str(row['예보구역코드'])
        region_name = str(row['구역명'])

        print(f"[{idx + 1}/{total_regions}] {region_name} ({reg_id})", end=" ")

        try:
            # 육상예보 API 호출
            land_data = fetch_api_data(API_URL_LAND, reg_id, tm_fc)
            time.sleep(0.5)  # API 간 딜레이

            # 기온예보 API 호출
            temp_data = fetch_api_data(API_URL_TEMP, reg_id, tm_fc)

            if not land_data and not temp_data:
                print(f"❌")
                fail_count += 1
                continue

            # JSON 파싱 및 병합
            items = parse_mid_forecast_json(land_data, temp_data, region_name, tm_fc)

            if items:
                saved = save_mid_forecast_to_db(items)
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
    print(f"📅 발표시각: {tm_fc}")
    print(f"💾 총 저장 데이터: {total_saved:,}개")
    print(f"✅ 성공: {success_count}/{total_regions}")
    print(f"❌ 실패: {fail_count}/{total_regions}")
    print("=" * 60)


if __name__ == "__main__":
    main()