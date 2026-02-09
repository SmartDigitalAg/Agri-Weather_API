import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from pathlib import Path
import time
import pandas as pd

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
API_URL = "http://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList"
SERVICE_KEY = os.getenv('KMA_API_KEY')

# 요청 간격 (초)
REQUEST_DELAY = 0.5

# 최대 재시도 횟수
MAX_RETRIES = 3


def convert_to_number(value):
    """값을 숫자로 변환"""
    if value is None or value == '' or value == ' ':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def convert_to_int(value):
    """값을 정수로 변환"""
    if value is None or value == '' or value == ' ':
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def convert_to_string(value, max_length=None):
    """문자열 변환 및 길이 제한"""
    if value is None or value == '' or value == ' ':
        return None

    str_value = str(value).strip()

    if not str_value:
        return None

    if max_length and len(str_value) > max_length:
        return str_value[:max_length]

    return str_value


def format_date(date_str):
    """날짜 문자열을 DATE 타입으로 변환"""
    if not date_str:
        return None

    date_str = str(date_str).strip()

    # 이미 YYYY-MM-DD 형식인 경우 (10자리)
    if len(date_str) == 10 and date_str[4] == '-' and date_str[7] == '-':
        return date_str

    # YYYYMMDD 형식인 경우 (8자리)
    if len(date_str) == 8:
        try:
            year = date_str[:4]
            month = date_str[4:6]
            day = date_str[6:8]

            if not (year.isdigit() and month.isdigit() and day.isdigit()):
                return None

            return f"{year}-{month}-{day}"
        except Exception:
            return None

    return None


def fetch_yesterday_data(stn_id, target_date, max_retries=MAX_RETRIES):
    """특정 날짜의 데이터 가져오기 (재시도 포함)"""
    params = {
        'serviceKey': SERVICE_KEY,
        'numOfRows': 10,
        'pageNo': 1,
        'dataType': 'JSON',
        'dataCd': 'ASOS',
        'dateCd': 'DAY',
        'startDt': target_date,
        'endDt': target_date,
        'stnIds': stn_id
    }

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    for attempt in range(max_retries):
        try:
            response = requests.get(API_URL, params=params, headers=headers, timeout=30)

            # API 요청 제한 처리
            if response.status_code == 429:
                wait_time = (attempt + 1) * 10
                print(f"⚠️ API 제한 - {wait_time}초 대기", end=" ")
                time.sleep(wait_time)
                continue

            response.raise_for_status()
            data = response.json()

            # 에러 체크
            header = data.get('response', {}).get('header', {})
            result_code = header.get('resultCode')

            if result_code != '00':
                return None

            # 데이터 추출
            items = data.get('response', {}).get('body', {}).get('items', {}).get('item', [])

            if isinstance(items, dict):
                items = [items]

            return items

        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                print(f"⏳ 재시도", end=" ")
                time.sleep(3)
                continue
            else:
                return None

        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(3)
                continue
            else:
                print(f"❌ API 오류: {e}", end=" ")
                return None

    return None


def save_to_db(data_list, max_retries=MAX_RETRIES):
    """데이터를 DB에 저장 (필수 컬럼만)"""
    if not data_list:
        return 0

    for retry in range(max_retries):
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            cur = conn.cursor()

            insert_query = """
            INSERT INTO asos_daily_data (
                stn_id, stn_nm, tm, avg_ta, min_ta, min_ta_hrmt, max_ta, max_ta_hrmt,
                sum_rn, avg_ws, avg_rhm, sum_ss_hr, sum_gsr, avg_tca, iscs
            ) VALUES %s
            ON CONFLICT (stn_id, tm) DO UPDATE SET
                avg_ta = EXCLUDED.avg_ta,
                min_ta = EXCLUDED.min_ta,
                max_ta = EXCLUDED.max_ta,
                sum_rn = EXCLUDED.sum_rn,
                avg_ws = EXCLUDED.avg_ws,
                avg_rhm = EXCLUDED.avg_rhm,
                sum_ss_hr = EXCLUDED.sum_ss_hr,
                sum_gsr = EXCLUDED.sum_gsr,
                avg_tca = EXCLUDED.avg_tca
            """

            values = []
            for item in data_list:
                try:
                    tm_raw = item.get('tm')
                    tm_formatted = format_date(tm_raw)

                    if not tm_formatted:
                        continue

                    values.append((
                        convert_to_int(item.get('stnId')),
                        convert_to_string(item.get('stnNm'), 50),
                        tm_formatted,
                        convert_to_number(item.get('avgTa')),
                        convert_to_number(item.get('minTa')),
                        convert_to_string(item.get('minTaHrmt'), 4),
                        convert_to_number(item.get('maxTa')),
                        convert_to_string(item.get('maxTaHrmt'), 4),
                        convert_to_number(item.get('sumRn')),
                        convert_to_number(item.get('avgWs')),
                        convert_to_number(item.get('avgRhm')),
                        convert_to_number(item.get('sumSsHr')),
                        convert_to_number(item.get('sumGsr')),
                        convert_to_number(item.get('avgTca')),
                        convert_to_string(item.get('iscs'), None)
                    ))
                except Exception as e:
                    continue

            if not values:
                return 0

            execute_values(cur, insert_query, values)
            conn.commit()
            cur.close()
            conn.close()

            return len(values)

        except psycopg2.OperationalError as e:
            if retry < max_retries - 1:
                time.sleep(5)
                continue
            else:
                return 0

        except Exception as e:
            if 'conn' in locals():
                conn.rollback()
            return 0

        finally:
            if 'cur' in locals() and cur:
                cur.close()
            if 'conn' in locals() and conn:
                conn.close()

    return 0


def main():
    """메인 실행 함수"""
    start_time = datetime.now()

    # 어제 날짜 계산
    yesterday = datetime.now() - timedelta(days=1)
    target_date = yesterday.strftime('%Y%m%d')
    target_date_display = yesterday.strftime('%Y-%m-%d')

    print("=" * 60)
    print(f"🚀 ASOS 일자료 일일 업데이트 (필수 컬럼만)")
    print(f"   실행 시간: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   대상 날짜: {target_date_display} (어제)")
    print("=" * 60)

    # 실행 시간 체크 (권장: 오전 9시 이후)
    current_hour = start_time.hour
    if current_hour < 9:
        print(f"\n⚠️ 주의: 현재 시각 {current_hour}시")
        print(f"   KMA API는 보통 오전 8-9시에 전날 데이터를 업데이트합니다.")
        print(f"   데이터가 없을 수 있습니다.\n")

    # CSV 파일에서 지점 번호 읽기
    csv_path = SCRIPT_DIR / 'kma_region.csv'

    if not csv_path.exists():
        print(f"❌ CSV 파일을 찾을 수 없습니다: {csv_path}")
        return

    try:
        df = pd.read_csv(csv_path, encoding='utf-8-sig')

        if '지점번호' not in df.columns:
            print(f"❌ '지점번호' 컬럼을 찾을 수 없습니다")
            return

        station_list = df['지점번호'].dropna().astype(int).tolist()
        print(f"✅ 수집 대상: {len(station_list)}개 지점\n")

    except Exception as e:
        print(f"❌ CSV 파일 읽기 실패: {e}")
        return

    # 데이터 수집
    total_stations = len(station_list)
    success_count = 0
    fail_count = 0
    total_saved = 0

    for idx, stn_id in enumerate(station_list, 1):
        print(f"[{idx}/{total_stations}] 지점 {stn_id:3d}", end=" ")

        # 데이터 조회
        data = fetch_yesterday_data(stn_id, target_date)

        if data and len(data) > 0:
            # DB 저장
            saved = save_to_db(data)
            if saved > 0:
                print(f"✅ {saved}건 저장")
                success_count += 1
                total_saved += saved
            else:
                print(f"❌ 저장 실패")
                fail_count += 1
        else:
            print(f"⚠️ 데이터 없음")
            fail_count += 1

        # API 호출 제한 고려
        if idx < total_stations:
            time.sleep(REQUEST_DELAY)

    end_time = datetime.now()
    elapsed_time = (end_time - start_time).total_seconds()

    print("\n" + "=" * 60)
    print(f"✨ 업데이트 완료!")
    print(f"   완료 시간: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   소요 시간: {elapsed_time:.1f}초")
    print(f"   대상 날짜: {target_date_display}")
    print(f"💾 저장: {total_saved}건")
    print(f"✅ 성공: {success_count}/{total_stations}")
    print(f"❌ 실패: {fail_count}/{total_stations}")
    print("=" * 60)


if __name__ == "__main__":
    main()