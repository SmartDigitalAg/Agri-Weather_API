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
API_URL = "http://apis.data.go.kr/1390802/AgriWeather/WeatherObsrInfo/V3/GnrlWeather/getWeatherTenMinList3"
SERVICE_KEY = os.getenv('RDA_API_KEY')


def table_exists():
    """테이블 존재 여부 확인"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'weather_data'
            );
        """)
        return cur.fetchone()[0]
    finally:
        cur.close()
        conn.close()


def create_table():
    """테이블 생성"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    create_table_query = """
    CREATE TABLE IF NOT EXISTS weather_data (
        id SERIAL PRIMARY KEY,
        no INTEGER,
        stn_cd VARCHAR(20),
        stn_name VARCHAR(100),
        province VARCHAR(50),
        datetime TIMESTAMP,
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
        UNIQUE(stn_cd, datetime)
    );

    CREATE INDEX IF NOT EXISTS idx_date ON weather_data(datetime);
    CREATE INDEX IF NOT EXISTS idx_stn_cd ON weather_data(stn_cd);
    CREATE INDEX IF NOT EXISTS idx_province ON weather_data(province);
    """

    cur.execute(create_table_query)
    conn.commit()
    cur.close()
    conn.close()
    print("✅ 테이블 생성 완료")


def clear_table():
    """테이블 데이터 삭제 (새로 업데이트용)"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    try:
        cur.execute("TRUNCATE TABLE weather_data RESTART IDENTITY;")
        conn.commit()
        print("🗑️ 기존 데이터 삭제 완료")
    except Exception as e:
        conn.rollback()
        print(f"❌ 테이블 초기화 실패: {e}")
    finally:
        cur.close()
        conn.close()


def fetch_weather_data(page_no=1, page_size=20, date='2018-01-01',
                       time='1300', obsr_spot_nm=None, obsr_spot_cd=None):
    """API에서 기상 데이터 가져오기"""

    url_with_key = f"{API_URL}?serviceKey={SERVICE_KEY}"

    params = {
        'Page_No': page_no,
        'Page_Size': page_size,
        'date': date,
    }

    if time:
        params['time'] = time
    if obsr_spot_nm:
        params['obsr_Spot_Nm'] = obsr_spot_nm
    if obsr_spot_cd:
        params['obsr_Spot_Cd'] = obsr_spot_cd

    try:
        response = requests.get(url_with_key, params=params, timeout=30)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"❌ API 요청 실패: {e}")
        if 'response' in locals():
            print(f"응답 내용: {response.text[:200]}")
        return None


def parse_xml_data(xml_data, province):
    """XML 데이터 파싱 - 도명 추가"""
    try:
        root = ET.fromstring(xml_data)
        items = []

        for item in root.findall('.//item'):
            item_data = {}
            for child in item:
                tag = child.tag.lower()
                text = child.text

                # None 또는 빈 문자열 처리
                if not text or text.strip() == '':
                    item_data[tag] = None
                    continue

                text = text.strip()

                # '-'는 결측값으로 처리
                if text == '-':
                    item_data[tag] = None
                    continue

                # 숫자 필드 리스트
                numeric_fields = ['no', 'temp', 'hghst_artmp', 'lowst_artmp', 'hum',
                                  'widdir', 'wind', 'max_wind', 'rn', 'sun_time',
                                  'srqty', 'condens_time', 'gr_temp', 'soil_temp', 'soil_wt']

                # 숫자 필드 처리
                if tag in numeric_fields:
                    try:
                        item_data[tag] = float(text)
                    except ValueError:
                        print(f"⚠️ 숫자 변환 실패: {tag} = '{text}'")
                        item_data[tag] = None

                # date 필드: 날짜 + 시간
                elif tag == 'date':
                    item_data['datetime'] = text

                # 그 외 문자열 필드
                else:
                    item_data[tag] = text

            # 도명 추가
            if item_data:
                item_data['province'] = province
                items.append(item_data)

        return items

    except ET.ParseError as e:
        print(f"❌ XML 파싱 실패: {e}")
        print(f"📄 받은 데이터 일부:\n{xml_data[:500]}...")
        return []
    except Exception as e:
        print(f"❌ 예상치 못한 오류: {e}")
        return []


def save_to_database(items):
    """데이터베이스에 저장"""
    if not items:
        print("⚠️  저장할 데이터가 없습니다")
        return

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    insert_query = """
    INSERT INTO weather_data (
        no, stn_cd, stn_name, province, datetime, temp, hghst_artmp, lowst_artmp,
        hum, widdir, wind, max_wind, rn, sun_time, srqty,
        condens_time, gr_temp, soil_temp, soil_wt
    ) VALUES %s
    """

    values = [
        (
            item.get('no'),
            item.get('stn_cd'),
            item.get('stn_name'),
            item.get('province'),
            item.get('datetime'),
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
        print(f"✅ {len(items)}개 데이터 저장 완료")
    except Exception as e:
        conn.rollback()
        print(f"❌ 데이터 저장 실패: {e}")
    finally:
        cur.close()
        conn.close()


def main():
    """메인 실행 함수"""
    print("🚀 기상 데이터 수집 시작")

    if not table_exists():
        create_table()
    else:
        print("⚠️ 테이블 'weather_data'가 이미 존재합니다.")

    # 기존 데이터 삭제 (새로 업데이트)
    clear_table()

    now = datetime.now()
    target_time = now - timedelta(minutes=10)
    current_date = target_time.strftime('%Y-%m-%d')
    hour = target_time.hour
    minute = (target_time.minute // 10) * 10
    current_time = f"{hour:02d}{minute:02d}"

    print(f"📅 수집 날짜: {current_date}")
    print(f"🕐 수집 시간: {current_time}")

    csv_path = SCRIPT_DIR / 'region_info.csv'
    df = pd.read_csv(f'{csv_path}', encoding='UTF-8')

    for i in df.index:
        time.sleep(1.5)
        region_code = df['지점코드'][i]
        region_name = df['지점명'][i]
        province = df['도명'][i]  # 도명 읽기

        print(f"\n🌍 [{i + 1}/{len(df)}] {province} - {region_name} ({region_code})")

        xml_data = fetch_weather_data(
            page_no=1,
            page_size=100,
            date=current_date,
            time=current_time,
            obsr_spot_nm=region_name,
            obsr_spot_cd=region_code
        )

        if not xml_data:
            print(f"❌ {region_name} 데이터를 가져올 수 없습니다")
            continue

        items = parse_xml_data(xml_data, province)  # 도명 전달
        print(f"📊 파싱된 데이터: {len(items)}개")

        save_to_database(items)

    print("\n✨ 전체 완료!")


if __name__ == "__main__":
    main()