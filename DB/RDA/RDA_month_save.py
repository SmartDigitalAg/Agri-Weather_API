import requests
import psycopg2
from psycopg2.extras import execute_values
import xml.etree.ElementTree as ET
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
API_URL = "http://apis.data.go.kr/1390802/AgriWeather/WeatherObsrInfo/V3/GnrlWeather/getWeatherYearMonList3"
SERVICE_KEY = os.getenv('RDA_API_KEY')

# 요청 간격
REQUEST_DELAY = 1.5


def create_monthly_table():
    """월별 기상 데이터 테이블 생성"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    create_table_query = """
    CREATE TABLE IF NOT EXISTS weather_data_monthly (
        id SERIAL PRIMARY KEY,
        no INTEGER,
        stn_cd VARCHAR(20),
        stn_name VARCHAR(100),
        date VARCHAR(7),
        temp FLOAT,
        hghst_artmp FLOAT,
        lowst_artmp FLOAT,
        hum FLOAT,
        widdir FLOAT,
        wind FLOAT,
        max_wind FLOAT,
        rn FLOAT,
        sun_time FLOAT,
        srqty FLOAT,
        condens_time FLOAT,
        gr_temp FLOAT,
        soil_temp FLOAT,
        soil_wt FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stn_cd, date)
    );

    CREATE INDEX IF NOT EXISTS idx_monthly_date ON weather_data_monthly(date);
    CREATE INDEX IF NOT EXISTS idx_monthly_stn_cd ON weather_data_monthly(stn_cd);
    CREATE INDEX IF NOT EXISTS idx_monthly_stn_date ON weather_data_monthly(stn_cd, date);
    """

    cur.execute(create_table_query)
    conn.commit()
    cur.close()
    conn.close()
    print("✅ 월별 데이터 테이블 생성 완료")


def fetch_monthly_data_with_retry(page_no=1, page_size=100, search_year='2018',
                                  obsr_spot_cd=None, max_retries=3):
    """API에서 월별 기상 데이터 가져오기 (재시도 포함)"""

    url_with_key = f"{API_URL}?serviceKey={SERVICE_KEY}"

    params = {
        'Page_No': page_no,
        'Page_Size': page_size,
        'search_Year': search_year,
    }

    if obsr_spot_cd:
        params['obsr_Spot_Cd'] = obsr_spot_cd

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    for attempt in range(max_retries):
        try:
            response = requests.get(url_with_key, params=params, headers=headers, timeout=30)

            if response.status_code == 429:
                wait_time = (attempt + 1) * 10
                print(f"⚠️ API 요청 제한 - {wait_time}초 후 재시도 ({attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                continue

            response.raise_for_status()
            return response.text

        except requests.exceptions.RequestException as e:
            if 'response' in locals() and response.status_code != 429:
                print(f"❌ API 요청 실패 ({attempt + 1}/{max_retries}): {e}")

            if attempt < max_retries - 1:
                wait_time = (attempt + 1) * 3
                print(f"⏳ {wait_time}초 후 재시도...")
                time.sleep(wait_time)
            else:
                print(f"❌ 최대 재시도 횟수 초과")
                return None

    return None


def parse_monthly_xml_data(xml_data):
    """월별 XML 데이터 파싱"""
    try:
        root = ET.fromstring(xml_data)
        items = []

        # total_count 확인
        total_count_elem = root.find('.//total_Count')
        total_count = int(total_count_elem.text) if total_count_elem is not None else 0

        for item in root.findall('.//item'):
            item_data = {}
            for child in item:
                tag = child.tag.lower()
                text = child.text

                if not text or text.strip() == '':
                    item_data[tag] = None
                    continue

                text = text.strip()

                if text == '-':
                    item_data[tag] = None
                    continue

                numeric_fields = ['no', 'temp', 'hghst_artmp', 'lowst_artmp', 'hum',
                                  'widdir', 'wind', 'max_wind', 'rn', 'sun_time',
                                  'srqty', 'condens_time', 'gr_temp', 'soil_temp', 'soil_wt']

                if tag in numeric_fields:
                    try:
                        item_data[tag] = float(text)
                    except ValueError:
                        item_data[tag] = None

                elif tag == 'date':
                    # 'YYYY-MM' 형식 유지
                    item_data[tag] = text

                else:
                    item_data[tag] = text

            if item_data:
                items.append(item_data)

        return items, total_count

    except ET.ParseError as e:
        print(f"❌ XML 파싱 실패: {e}")
        return [], 0
    except Exception as e:
        print(f"❌ 예상치 못한 오류: {e}")
        return [], 0


def save_to_database_monthly(items):
    """월별 데이터를 데이터베이스에 저장"""
    if not items:
        return 0

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    insert_query = """
    INSERT INTO weather_data_monthly (
        no, stn_cd, stn_name, date, temp, hghst_artmp, lowst_artmp,
        hum, widdir, wind, max_wind, rn, sun_time, srqty,
        condens_time, gr_temp, soil_temp, soil_wt
    ) VALUES %s
    ON CONFLICT (stn_cd, date) DO UPDATE SET
        temp = EXCLUDED.temp,
        hghst_artmp = EXCLUDED.hghst_artmp,
        lowst_artmp = EXCLUDED.lowst_artmp,
        hum = EXCLUDED.hum,
        widdir = EXCLUDED.widdir,
        wind = EXCLUDED.wind,
        max_wind = EXCLUDED.max_wind,
        rn = EXCLUDED.rn,
        sun_time = EXCLUDED.sun_time,
        srqty = EXCLUDED.srqty,
        condens_time = EXCLUDED.condens_time,
        gr_temp = EXCLUDED.gr_temp,
        soil_temp = EXCLUDED.soil_temp,
        soil_wt = EXCLUDED.soil_wt
    """

    values = [
        (
            item.get('no'),
            item.get('stn_cd'),
            item.get('stn_name'),
            item.get('date'),
            item.get('temp'),
            item.get('hghst_artmp'),
            item.get('lowst_artmp'),
            item.get('hum'),
            item.get('widdir'),
            item.get('wind'),
            item.get('max_wind'),
            item.get('rn'),
            item.get('sun_time'),
            item.get('srqty'),
            item.get('condens_time'),
            item.get('gr_temp'),
            item.get('soil_temp'),
            item.get('soil_wt')
        )
        for item in items
    ]

    try:
        execute_values(cur, insert_query, values)
        conn.commit()
        saved_count = len(items)
        return saved_count
    except Exception as e:
        conn.rollback()
        print(f"❌ DB 저장 실패: {e}")
        return 0
    finally:
        cur.close()
        conn.close()


def collect_last_month_data(region_code, target_year_month):
    """특정 지역의 지난달 데이터만 수집"""

    # 연도와 월 추출
    target_year = int(target_year_month.split('-')[0])
    target_month = int(target_year_month.split('-')[1])

    # 해당 연도 데이터 조회
    all_items = []
    page = 1

    while True:
        xml_data = fetch_monthly_data_with_retry(
            page_no=page,
            page_size=100,
            search_year=str(target_year),
            obsr_spot_cd=region_code
        )

        if not xml_data:
            break

        items, total_count = parse_monthly_xml_data(xml_data)

        if not items:
            break

        # 지난달 데이터만 필터링
        for item in items:
            item_date = item.get('date')
            if not item_date:
                continue

            # YYYY-MM 형식에서 연도와 월 추출
            item_year = int(item_date.split('-')[0])
            item_month = int(item_date.split('-')[1])

            # 지난달 데이터만 추가
            if item_year == target_year and item_month == target_month:
                all_items.append(item)

        # 페이지네이션 체크
        if total_count > 0 and len(all_items) >= total_count:
            break

        if len(items) < 100:
            break

        page += 1
        time.sleep(REQUEST_DELAY)

    return all_items


def main():
    """메인 실행 함수 - 지난달 데이터만 수집"""
    start_time = datetime.now()

    print("=" * 60)
    print(f"🚀 월별 기상 데이터 수집 시작 (지난달만)")
    print(f"   시작 시간: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 테이블 생성
    create_monthly_table()

    # 지난달 계산 (YYYY-MM 형식)
    last_month = (datetime.now().replace(day=1) - timedelta(days=1))
    target_year_month = last_month.strftime('%Y-%m')

    print(f"📅 수집 대상: {target_year_month} (지난달)")

    # CSV 파일 읽기
    csv_path = SCRIPT_DIR / 'region_info.csv'

    if not csv_path.exists():
        print(f"❌ CSV 파일을 찾을 수 없습니다: {csv_path}")
        return

    df = pd.read_csv(csv_path, encoding='UTF-8')
    total_regions = len(df)

    print(f"📊 총 {total_regions}개 지역")
    print("=" * 60)

    total_saved = 0
    success_count = 0
    fail_count = 0

    for idx, row in df.iterrows():
        region_code = row['지점코드']
        region_name = row['지점명']

        print(f"\n[{idx + 1}/{total_regions}] {region_name} ({region_code})", end=" ")

        try:
            # 지난달 데이터만 수집
            items = collect_last_month_data(region_code, target_year_month)

            if items:
                print(f"✅ {len(items)}개", end=" ")
                saved = save_to_database_monthly(items)
                print(f"💾 {saved}개 저장")

                if saved > 0:
                    success_count += 1
                    total_saved += saved
                else:
                    fail_count += 1
            else:
                print(f"⚠️ 데이터 없음")
                fail_count += 1

        except Exception as e:
            print(f"❌ 오류: {e}")
            fail_count += 1

        # 요청 간 딜레이
        if idx < total_regions - 1:
            time.sleep(REQUEST_DELAY)

        # 진행률 표시
        if (idx + 1) % 50 == 0:
            elapsed = (datetime.now() - start_time).total_seconds()
            avg_time = elapsed / (idx + 1)
            remaining = (total_regions - idx - 1) * avg_time

            print(f"\n{'=' * 60}")
            print(f"📈 진행률: {(idx + 1) / total_regions * 100:.1f}%")
            print(f"⏱️  경과 시간: {elapsed / 60:.1f}분")
            print(f"⏱️  예상 남은 시간: {remaining / 60:.1f}분")
            print(f"💾 누적 저장: {total_saved:,}개")
            print(f"✅ 성공: {success_count} | ❌ 실패: {fail_count}")
            print(f"{'=' * 60}")

    end_time = datetime.now()
    elapsed_time = (end_time - start_time).total_seconds()

    print("\n" + "=" * 60)
    print(f"✨ 수집 완료!")
    print(f"   완료 시간: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   총 소요 시간: {elapsed_time / 60:.1f}분")
    print(f"📅 수집 대상: {target_year_month}")
    print(f"💾 총 저장 데이터: {total_saved:,}개")
    print(f"✅ 성공: {success_count}/{total_regions}")
    print(f"❌ 실패: {fail_count}/{total_regions}")
    print("=" * 60)


if __name__ == "__main__":
    main()