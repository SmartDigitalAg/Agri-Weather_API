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


def format_date(date_str):
    """날짜 문자열을 DATE 타입으로 변환"""
    if not date_str:
        return None

    # 문자열로 변환 및 공백 제거
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

            # 유효성 체크
            if not (year.isdigit() and month.isdigit() and day.isdigit()):
                return None

            return f"{year}-{month}-{day}"
        except Exception:
            return None

    return None


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

            # 에러 체크
            header = data.get('response', {}).get('header', {})
            result_code = header.get('resultCode')

            if result_code != '00':
                result_msg = header.get('resultMsg', 'UNKNOWN')
                return None, result_msg

            # 데이터 추출
            items = data.get('response', {}).get('body', {}).get('items', {}).get('item', [])

            # 단일 항목인 경우 리스트로 변환
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


def update_rhm_only(data_list, max_retries=3):
    """avg_rhm 컬럼만 업데이트 (기존 데이터 유지)"""
    if not data_list:
        return 0

    for retry in range(max_retries):
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            cur = conn.cursor()

            # avg_rhm만 업데이트하는 쿼리 (타입 명시)
            update_query = """
            UPDATE asos_daily_data
            SET avg_rhm = data.avg_rhm::float
            FROM (VALUES %s) AS data(stn_id, tm, avg_rhm)
            WHERE asos_daily_data.stn_id = data.stn_id::integer
              AND asos_daily_data.tm = data.tm::date
            """

            # avg_rhm 데이터만 추출
            values = []
            debug_info = []  # 🔍 디버깅용
            failed_dates = []  # 🔍 실패한 날짜들

            for item in data_list:
                try:
                    stn_id = convert_to_int(item.get('stnId'))
                    tm_raw = item.get('tm')
                    tm_formatted = format_date(tm_raw)  # 날짜 형식 변환
                    avg_rhm = convert_to_number(item.get('avgRhm'))

                    # 🔍 날짜 변환 실패 추적
                    if not tm_formatted and len(failed_dates) < 3:
                        failed_dates.append({
                            'tm_raw': tm_raw,
                            'tm_raw_type': type(tm_raw),
                            'tm_raw_len': len(str(tm_raw)) if tm_raw else 0
                        })

                    # 필수 값 체크
                    if stn_id and tm_formatted:
                        values.append((stn_id, tm_formatted, avg_rhm))

                        # 🔍 첫 3개만 디버깅 정보 저장
                        if len(debug_info) < 3:
                            debug_info.append({
                                'stn_id': stn_id,
                                'tm_raw': tm_raw,
                                'tm_formatted': tm_formatted,
                                'avg_rhm': avg_rhm
                            })

                except Exception as e:
                    print(f"⚠️ 데이터 변환 실패 (tm: {item.get('tm')}): {e}")
                    continue

            # 🔍 날짜 변환 실패 출력
            if failed_dates:
                print(f"\n   [날짜 변환 실패] {len(failed_dates)}개 샘플:")
                for fd in failed_dates:
                    print(f"   - tm_raw='{fd['tm_raw']}' (타입: {fd['tm_raw_type']}, 길이: {fd['tm_raw_len']})")

            if not values:
                print(f"\n   ⚠️ 변환된 값이 0개! 총 {len(data_list)}건 중 모두 실패")
                return 0

            # 🔍 디버깅: 변환된 값 출력
            if debug_info:
                print(f"\n   [변환된 데이터 샘플 {len(values)}개 중 3개]")
                for d in debug_info:
                    print(
                        f"   - stn_id={d['stn_id']}, tm_raw='{d['tm_raw']}' → tm_formatted='{d['tm_formatted']}', avg_rhm={d['avg_rhm']}")

                # 🔍 DB에 해당 데이터 존재하는지 확인
                first = debug_info[0]
                check_query = """
                SELECT stn_id, tm, avg_rhm 
                FROM asos_daily_data 
                WHERE stn_id = %s AND tm = %s
                """
                cur.execute(check_query, (first['stn_id'], first['tm_formatted']))
                db_result = cur.fetchone()

                if db_result:
                    print(f"   [DB 기존 데이터] stn_id={db_result[0]}, tm={db_result[1]}, avg_rhm={db_result[2]}")
                else:
                    print(f"   [DB 기존 데이터] ❌ 해당 행이 DB에 없음! (UPDATE 불가)")

            # DB 업데이트
            execute_values(cur, update_query, values)
            updated_count = cur.rowcount
            print(f"   [UPDATE 결과] {updated_count}건 업데이트됨")

            conn.commit()
            cur.close()
            conn.close()

            return updated_count

        except psycopg2.OperationalError as e:
            if retry < max_retries - 1:
                wait_time = (retry + 1) * 5
                print(f"\n⚠️ DB 연결 에러 (재시도 {retry + 1}/{max_retries}) - {wait_time}초 후 재시도")
                time.sleep(wait_time)
                continue
            else:
                print(f"\n❌ DB 업데이트 실패: {e}")
                return 0

        except Exception as e:
            if 'conn' in locals():
                conn.rollback()
            print(f"\n❌ DB 업데이트 실패: {e}")
            import traceback
            traceback.print_exc()
            return 0

        finally:
            if 'cur' in locals() and cur:
                cur.close()
            if 'conn' in locals() and conn:
                conn.close()

    return 0


def get_stations_with_null_rhm():
    """avg_rhm이 NULL인 지점 목록 조회"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        query = """
        SELECT DISTINCT stn_id, COUNT(*) as null_count
        FROM asos_daily_data
        WHERE avg_rhm IS NULL
        GROUP BY stn_id
        ORDER BY stn_id
        """

        cur.execute(query)
        results = cur.fetchall()

        stations_info = {}
        for row in results:
            stn_id, null_count = row
            stations_info[stn_id] = null_count

        cur.close()
        conn.close()

        return stations_info
    except Exception as e:
        print(f"⚠️ NULL 데이터 조회 실패: {e}")
        return {}


def collect_rhm_data(station_list, start_date="19040101", end_date="20260119"):
    """avg_rhm 데이터만 수집 및 업데이트"""
    start_dt = datetime.strptime(start_date, "%Y%m%d")
    end_dt = datetime.strptime(end_date, "%Y%m%d")

    total_stations = len(station_list)
    total_updated = 0
    success_count = 0
    fail_count = 0

    for idx, stn_id in enumerate(station_list, 1):
        print(f"\n{'=' * 60}")
        print(f"📍 [{idx}/{total_stations}] 지점 {stn_id} 습도 데이터 업데이트 시작")
        print(f"{'=' * 60}")

        current_start = start_dt
        station_updated = 0

        while current_start <= end_dt:
            current_end = min(
                current_start + timedelta(days=365 * YEAR_CHUNK - 1),
                end_dt
            )

            start_str = current_start.strftime("%Y%m%d")
            end_str = current_end.strftime("%Y%m%d")

            print(f"📅 기간: {start_str} ~ {end_str}", end=" ")

            # 데이터 조회
            data, error = fetch_asos_data(stn_id, start_str, end_str)

            if data and len(data) > 0:
                # avg_rhm만 업데이트
                updated = update_rhm_only(data)
                station_updated += updated
                print(f"✅ {len(data)}건 조회, {updated}건 업데이트")
            elif error:
                print(f"❌ 실패: {error}")
            else:
                print(f"⚠️ 데이터 없음")

            # 다음 기간으로 이동
            current_start = current_end + timedelta(days=1)

            # API 호출 제한 고려
            time.sleep(REQUEST_DELAY)

        if station_updated > 0:
            success_count += 1
            total_updated += station_updated
            print(f"✨ 지점 {stn_id} 완료: 총 {station_updated}건 업데이트")
        else:
            fail_count += 1
            print(f"⚠️ 지점 {stn_id} 완료: 업데이트 없음")

    return total_updated, success_count, fail_count


def main():
    """메인 실행 함수"""
    start_time = datetime.now()

    print("=" * 60)
    print(f"🌡️ ASOS 습도(avg_rhm) 데이터 업데이트 시작")
    print(f"   시작 시간: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

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

    # avg_rhm이 NULL인 지점 확인
    print("\n🔍 습도 데이터 NULL 현황 확인 중...")
    null_stations = get_stations_with_null_rhm()

    if null_stations:
        print(f"⚠️ 습도 데이터 NULL인 지점: {len(null_stations)}개")
        print(f"\n📋 상위 5개 지점:")
        for stn_id in sorted(null_stations.keys())[:5]:
            print(f"   - 지점 {stn_id}: {null_stations[stn_id]:,}건")

        # NULL 데이터가 있는 지점만 필터링
        target_stations = [s for s in ALL_STATIONS if s in null_stations]
    else:
        print(f"✅ 모든 지점에 습도 데이터 존재!")
        return

    print(f"\n📌 업데이트 대상 지점: {len(target_stations)}개")
    print(f"📅 기간: 1904-01-01 ~ 2026-01-19")
    print(f"⏱️ 요청 간격: {REQUEST_DELAY}초\n")

    # 업데이트 시작 전 확인
    user_input = input(f"🔄 {len(target_stations)}개 지점 습도 업데이트를 시작하시겠습니까? (y/n): ")
    if user_input.lower() != 'y':
        print("❌ 업데이트 취소")
        return

    # 데이터 수집 및 업데이트
    total_updated, success_count, fail_count = collect_rhm_data(
        station_list=target_stations,
        start_date="2026120",
        end_date="20260121"
    )

    end_time = datetime.now()
    elapsed_time = (end_time - start_time).total_seconds()

    print("\n" + "=" * 60)
    print(f"✨ 습도 데이터 업데이트 완료!")
    print(f"   완료 시간: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   총 소요 시간: {elapsed_time / 60:.1f}분 ({elapsed_time:.0f}초)")
    print(f"💾 총 업데이트: {total_updated:,}건")
    print(f"✅ 성공: {success_count}/{len(target_stations)}")
    print(f"❌ 실패: {fail_count}/{len(target_stations)}")
    print("=" * 60)


if __name__ == "__main__":
    main()