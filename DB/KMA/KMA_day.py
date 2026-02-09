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
API_URL = "http://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList"
SERVICE_KEY = os.getenv('KMA_API_KEY')

# 요청 간격 (초)
REQUEST_DELAY = 0.5

# API 응답 대기 시간 (초)
REQUEST_TIMEOUT = 30

# 기간 분할 단위 (년)
YEAR_CHUNK = 2


def convert_to_number(value):
    """값을 숫자로 변환 (빈 문자열은 None으로)"""
    if value is None or value == '' or value == ' ':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def convert_to_int(value):
    """값을 정수로 변환 (빈 문자열은 None으로)"""
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


def create_asos_table():
    """ASOS 일자료 테이블 생성 (필수 필드만)"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    create_table_query = """
    CREATE TABLE IF NOT EXISTS asos_daily_data (
        id SERIAL PRIMARY KEY,
        stn_id INTEGER NOT NULL,
        stn_nm VARCHAR(50),
        tm DATE NOT NULL,
        avg_ta FLOAT,
        min_ta FLOAT,
        min_ta_hrmt VARCHAR(4),
        max_ta FLOAT,
        max_ta_hrmt VARCHAR(4),
        sum_rn FLOAT,
        avg_ws FLOAT,
        avg_rhm FLOAT,
        sum_ss_hr FLOAT,
        sum_gsr FLOAT,
        avg_tca FLOAT,
        iscs TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stn_id, tm)
    );

    CREATE INDEX IF NOT EXISTS idx_asos_stn_id ON asos_daily_data(stn_id);
    CREATE INDEX IF NOT EXISTS idx_asos_tm ON asos_daily_data(tm);
    CREATE INDEX IF NOT EXISTS idx_asos_stn_tm ON asos_daily_data(stn_id, tm);
    """

    cur.execute(create_table_query)
    conn.commit()
    cur.close()
    conn.close()
    print("✅ ASOS 일자료 테이블 생성 완료 (필수 필드만)")


def get_collected_stations():
    """이미 수집 완료된 지점 목록 조회"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        query = """
        SELECT stn_id, COUNT(*) as count, MIN(tm) as start_date, MAX(tm) as end_date
        FROM asos_daily_data
        GROUP BY stn_id
        ORDER BY stn_id
        """

        cur.execute(query)
        results = cur.fetchall()

        collected_stations = {}
        for row in results:
            stn_id, count, start_date, end_date = row
            collected_stations[stn_id] = {
                'count': count,
                'start_date': start_date,
                'end_date': end_date
            }

        cur.close()
        conn.close()

        return collected_stations
    except Exception as e:
        print(f"⚠️ 수집 현황 조회 실패: {e}")
        return {}


def filter_incomplete_stations(station_list, collected_stations, end_date="20260105"):
    """미수집 또는 불완전한 지점만 필터링"""
    incomplete_stations = []
    end_dt = datetime.strptime(end_date, "%Y%m%d")

    for stn_id in station_list:
        if stn_id not in collected_stations:
            incomplete_stations.append(stn_id)
        else:
            station_end = collected_stations[stn_id]['end_date']
            if station_end < end_dt.date():
                incomplete_stations.append(stn_id)

    return incomplete_stations


def fetch_asos_data(stn_id, start_dt, end_dt, max_retries=3):
    """API에서 ASOS 일자료 가져오기"""
    params = {
        'serviceKey': SERVICE_KEY,
        'numOfRows': 999,
        'pageNo': 1,
        'dataType': 'JSON',
        'dataCd': 'ASOS',
        'dateCd': 'DAY',
        'startDt': start_dt,
        'endDt': end_dt,
        'stnIds': stn_id
    }

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    for attempt in range(max_retries):
        try:
            response = requests.get(API_URL, params=params, headers=headers, timeout=REQUEST_TIMEOUT)

            if response.status_code == 429:
                wait_time = (attempt + 1) * 10
                print(f"⚠️ API 요청 제한 - {wait_time}초 후 재시도")
                time.sleep(wait_time)
                continue

            response.raise_for_status()
            data = response.json()

            header = data.get('response', {}).get('header', {})
            result_code = header.get('resultCode')

            if result_code != '00':
                result_msg = header.get('resultMsg', 'UNKNOWN')
                return None, result_msg

            items = data.get('response', {}).get('body', {}).get('items', {}).get('item', [])

            if isinstance(items, dict):
                items = [items]

            return items, None

        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                wait_time = (attempt + 1) * 3
                print(f"⏳ 타임아웃 - {wait_time}초 후 재시도...")
                time.sleep(wait_time)
            else:
                return None, "TIMEOUT"
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = (attempt + 1) * 3
                print(f"⏳ {wait_time}초 후 재시도...")
                time.sleep(wait_time)
            else:
                return None, str(e)

    return None, "MAX_RETRIES_EXCEEDED"


def save_asos_to_db(data_list, max_retries=3):
    """ASOS 데이터를 PostgreSQL에 저장 (필수 필드만)"""
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
            failed_count = 0

            for idx, item in enumerate(data_list):
                try:
                    tm_raw = item.get('tm')
                    tm_formatted = format_date(tm_raw)

                    if not tm_formatted:
                        failed_count += 1
                        if failed_count <= 3:  # 처음 3개만 출력
                            print(f"\n⚠️ 날짜 변환 실패: tm_raw='{tm_raw}' (타입: {type(tm_raw)})")
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
                    failed_count += 1
                    if failed_count <= 3:
                        print(f"\n❌ 데이터 변환 실패 (인덱스: {idx}, 날짜: {item.get('tm')})")
                        print(f"   에러: {e}")
                        print(f"   원본 데이터: {item}")
                    continue

            if failed_count > 3:
                print(f"\n⚠️ 총 {failed_count}건 변환 실패")

            if not values:
                return 0

            execute_values(cur, insert_query, values)
            conn.commit()
            cur.close()
            conn.close()

            return len(values)

        except psycopg2.OperationalError as e:
            if retry < max_retries - 1:
                wait_time = (retry + 1) * 5
                print(f"\n⚠️ DB 연결 에러 (재시도 {retry + 1}/{max_retries}) - {wait_time}초 후 재시도")
                print(f"   에러: {e}")
                time.sleep(wait_time)
                continue
            else:
                print(f"\n❌ DB 저장 실패 (최대 재시도 초과): {e}")
                return 0

        except Exception as e:
            if 'conn' in locals():
                conn.rollback()
            print(f"❌ DB 저장 실패: {e}")
            return 0

        finally:
            if 'cur' in locals() and cur:
                cur.close()
            if 'conn' in locals() and conn:
                conn.close()

    return 0


def collect_asos_data(station_list, start_date="19040101", end_date="20260105", year_chunk=2):
    """전체 ASOS 데이터 수집 (기간을 나눠서 요청)"""
    start_dt = datetime.strptime(start_date, "%Y%m%d")
    end_dt = datetime.strptime(end_date, "%Y%m%d")

    total_stations = len(station_list)
    total_saved = 0
    success_count = 0
    fail_count = 0

    for idx, stn_id in enumerate(station_list, 1):
        print(f"\n{'=' * 60}")
        print(f"📍 [{idx}/{total_stations}] 지점 {stn_id} 데이터 수집 시작")
        print(f"{'=' * 60}")

        current_start = start_dt
        station_saved = 0

        while current_start <= end_dt:
            current_end = min(
                current_start + timedelta(days=365 * year_chunk - 1),
                end_dt
            )

            start_str = current_start.strftime("%Y%m%d")
            end_str = current_end.strftime("%Y%m%d")

            print(f"📅 기간: {start_str} ~ {end_str}", end=" ")

            data, error = fetch_asos_data(stn_id, start_str, end_str)

            if data and len(data) > 0:
                saved = save_asos_to_db(data)
                station_saved += saved
                print(f"✅ {len(data)}건 조회, {saved}건 저장")
            elif error:
                print(f"❌ 실패: {error}")
            else:
                print(f"⚠️ 데이터 없음")

            current_start = current_end + timedelta(days=1)
            time.sleep(REQUEST_DELAY)

        if station_saved > 0:
            success_count += 1
            total_saved += station_saved
            print(f"✨ 지점 {stn_id} 완료: 총 {station_saved}건 저장")
        else:
            fail_count += 1
            print(f"⚠️ 지점 {stn_id} 완료: 데이터 없음")

    return total_saved, success_count, fail_count


def main():
    """메인 실행 함수"""
    start_time = datetime.now()

    print("=" * 60)
    print(f"🚀 ASOS 일자료 데이터 수집 시작 (필수 컬럼만)")
    print(f"   시작 시간: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 테이블 생성
    create_asos_table()

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

        ALL_STATIONS = df['지점번호'].dropna().astype(int).tolist()

        print(f"✅ CSV 파일 로드 완료: {csv_path.name}")
        print(f"📊 전체 지점 수: {len(ALL_STATIONS)}개")

    except Exception as e:
        print(f"❌ CSV 파일 읽기 실패: {e}")
        return

    # 이미 수집된 지점 확인
    print("\n🔍 기존 수집 현황 확인 중...")
    collected_stations = get_collected_stations()

    if collected_stations:
        print(f"✅ 이미 수집된 지점: {len(collected_stations)}개")
        print(f"\n📋 수집 완료 지점 상위 5개:")
        for stn_id in sorted(collected_stations.keys())[:5]:
            info = collected_stations[stn_id]
            print(f"   - 지점 {stn_id}: {info['count']:,}건 "
                  f"({info['start_date']} ~ {info['end_date']})")
    else:
        print(f"⚠️ 수집된 데이터 없음 (처음부터 시작)")

    # 미완료 지점 필터링
    END_DATE = "20260125"
    incomplete_stations = filter_incomplete_stations(ALL_STATIONS, collected_stations, END_DATE)

    if not incomplete_stations:
        print(f"\n✨ 모든 지점 수집 완료!")
        return

    print(f"\n📌 수집 대상 지점: {len(incomplete_stations)}개")
    print(f"   미수집: {len([s for s in incomplete_stations if s not in collected_stations])}개")
    print(f"   불완전: {len([s for s in incomplete_stations if s in collected_stations])}개")

    # 시작 인덱스 설정 (0부터 시작, 70번째는 인덱스 69)
    START_INDEX = 0  # 70번째 지점부터 시작

    if START_INDEX > 0:
        print(f"\n⚡ 건너뛰기: 처음 {START_INDEX}개 지점은 생략")
        print(f"   건너뛴 지점: {incomplete_stations[:START_INDEX]}")
        incomplete_stations = incomplete_stations[START_INDEX:]
        print(f"   실제 수집: {len(incomplete_stations)}개 지점")

    print(f"📅 기간: 1904-01-01 ~ 2026-01-05")
    print(f"⏱️ 요청 간격: {REQUEST_DELAY}초")
    print(f"⏰ API 타임아웃: {REQUEST_TIMEOUT}초")
    print(f"📆 기간 분할: {YEAR_CHUNK}년 단위\n")

    # 수집 시작 전 확인
    user_input = input(f"🔄 {len(incomplete_stations)}개 지점 수집을 시작하시겠습니까? (y/n): ")
    if user_input.lower() != 'y':
        print("❌ 수집 취소")
        return

    # 데이터 수집
    total_saved, success_count, fail_count = collect_asos_data(
        station_list=incomplete_stations,
        start_date="20260124",
        end_date=END_DATE,
        year_chunk=YEAR_CHUNK
    )

    end_time = datetime.now()
    elapsed_time = (end_time - start_time).total_seconds()

    print("\n" + "=" * 60)
    print(f"✨ 전체 수집 완료!")
    print(f"   완료 시간: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   총 소요 시간: {elapsed_time / 60:.1f}분 ({elapsed_time:.0f}초)")
    print(f"💾 총 저장 데이터: {total_saved:,}건")
    print(f"✅ 성공: {success_count}/{len(incomplete_stations)}")
    print(f"❌ 실패: {fail_count}/{len(incomplete_stations)}")
    print("=" * 60)


if __name__ == "__main__":
    main()