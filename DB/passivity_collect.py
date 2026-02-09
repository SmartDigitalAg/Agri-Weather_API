import sys
import os
from datetime import datetime, timedelta
from pathlib import Path

# 프로젝트 루트 경로 추가 (DB 모듈 import를 위해)
# 파일이 DB/ 내부에 있으므로 parent.parent가 프로젝트 루트
PROJECT_ROOT = Path(__file__).parent.parent.absolute()
sys.path.append(str(PROJECT_ROOT))
sys.path.append(str(PROJECT_ROOT / 'DB'))

try:
    from DB.KMA.KMA_day import collect_asos_data, create_asos_table, SCRIPT_DIR as KMA_DIR
    from DB.RDA.RDA_day_save import collect_region_data, create_daily_table, SCRIPT_DIR as RDA_DIR
    import pandas as pd
except ImportError as e:
    print(f"❌ 모듈 임포트 실패: {e}")
    print("   DB/KMA/KMA_day.py 또는 DB/RDA/RDA_day_save.py를 확인하세요.")
    sys.exit(1)

def main():
    print("=" * 60)
    print("🚀 초기 데이터 수집 도구 (Passive Collector)")
    print("=" * 60)
    print("이 도구는 최근 데이터를 수동으로 수집하여 DB를 채웁니다.")
    print("기본값: 최근 2개월 데이터 수집\n")

    # 날짜 입력 받기
    default_end = (datetime.now() - timedelta(days=1))
    default_start = default_end - timedelta(days=60)
    
    start_str = input(f"시작일 (YYYYMMDD, 기본값: {default_start.strftime('%Y%m%d')}): ").strip()
    end_str = input(f"종료일 (YYYYMMDD, 기본값: {default_end.strftime('%Y%m%d')}): ").strip()

    if not start_str:
        start_str = default_start.strftime('%Y%m%d')
    if not end_str:
        end_str = default_end.strftime('%Y%m%d')

    # YYYYMMDD -> YYYY-MM-DD 변환
    try:
        start_dt = datetime.strptime(start_str, "%Y%m%d")
        end_dt = datetime.strptime(end_str, "%Y%m%d")
        
        kma_start = start_str
        kma_end = end_str
        
        rda_start = start_dt.strftime("%Y-%m-%d")
        rda_end = end_dt.strftime("%Y-%m-%d")
        
    except ValueError:
        print("❌ 날짜 형식이 올바르지 않습니다.")
        return

    print(f"\n📅 수집 기간: {start_str} ~ {end_str}")
    confirm = input("실행하시겠습니까? (y/n): ")
    if confirm.lower() != 'y':
        print("취소되었습니다.")
        return

    # 1. KMA 데이터 수집
    print("\n" + "="*30)
    print("📡 1. KMA (기상청) 데이터 수집")
    print("="*30)
    
    create_asos_table()
    
    # KMA 지점 목록 로드
    kma_csv = KMA_DIR / 'kma_region.csv'
    if kma_csv.exists():
        try:
            df_kma = pd.read_csv(kma_csv, encoding='utf-8-sig')
            kma_stations = df_kma['지점번호'].dropna().astype(int).tolist()
            print(f"📊 KMA 대상 지점: {len(kma_stations)}개")
            
            collect_asos_data(kma_stations, start_date=kma_start, end_date=kma_end)
            
        except Exception as e:
            print(f"❌ KMA 지점 목록 로드 실패: {e}")
    else:
        print(f"❌ 파일 없음: {kma_csv}")

    # 2. RDA 데이터 수집
    print("\n" + "="*30)
    print("🌱 2. RDA (농촌진흥청) 데이터 수집")
    print("="*30)
    
    create_daily_table()
    
    # RDA 지점 목록 로드
    rda_csv = RDA_DIR / 'region_info.csv'
    if rda_csv.exists():
        try:
            df_rda = pd.read_csv(rda_csv, encoding='UTF-8')
            print(f"📊 RDA 대상 지점: {len(df_rda)}개")
            
            total = len(df_rda)
            for idx, row in df_rda.iterrows():
                print(f"\n[{idx+1}/{total}] {row['지점명']} ({row['지점코드']}) 데이터 수집...")
                collect_region_data(
                    region_code=row['지점코드'],
                    region_name=row['지점명'],
                    start_date=rda_start,
                    end_date=rda_end
                )
                
        except Exception as e:
            print(f"❌ RDA 지점 목록 로드 실패: {e}")
    else:
        print(f"❌ 파일 없음: {rda_csv}")

    print("\n✨ 모든 작업이 완료되었습니다.")

if __name__ == "__main__":
    main()
