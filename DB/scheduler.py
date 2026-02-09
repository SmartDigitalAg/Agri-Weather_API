import schedule
import time
import subprocess
import os
from datetime import datetime
import sys

# 로그 출력을 위한 설정
def log(message):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}", file=sys.stdout)
    sys.stdout.flush()

def run_script(script_path):
    """스크립트 실행 함수"""
    try:
        log(f"🚀 실행 시작: {script_path}")
        # 루트 디렉토리 기준이 아니라 DB 디렉토리 기준이므로 상대 경로 주의
        # Docker 컨테이너 내부는 /app 이 WORKDIR
        # 스크립트는 /app/RDA/..., /app/KMA/... 에 위치
        
        full_path = os.path.join(os.getcwd(), script_path)
        
        result = subprocess.run(
            ["python", full_path], 
            capture_output=True, 
            text=True, 
            check=False
        )
        
        if result.returncode == 0:
            log(f"✅ 실행 완료: {script_path}")
        else:
            log(f"❌ 실행 실패: {script_path}")
            log(f"   에러: {result.stderr}")
            
    except Exception as e:
        log(f"❌ 실행 중 예외 발생: {e}")

# 작업 정의
def job_rda_min():
    run_script("RDA/RDA_min_save.py")

def job_rda_day():
    run_script("RDA/RDA_day_save.py")

def job_rda_month():
    # 매월 1일에만 실행되도록 체크
    if datetime.now().day == 1:
        run_script("RDA/RDA_month_save.py")

def job_kma_day():
    run_script("KMA/KMA_day.py")

def job_kma_forecast():
    run_script("KMA/KMA_forecast_mid.py")

# 스케줄 설정
log("⏳ 스케줄러 시작...")

# 1. 10분 단위 수집
schedule.every(10).minutes.do(job_rda_min)
log("   - [10분마다] RDA 10분 관측 데이터 (RDA/RDA_min_save.py)")

# 2. 일별 데이터 (매일 01:00)
schedule.every().day.at("01:00").do(job_rda_day)
schedule.every().day.at("01:10").do(job_kma_day)
log("   - [01:00] RDA 일별 데이터 (RDA/RDA_day_save.py)")
log("   - [01:10] KMA 일별 데이터 (KMA/KMA_day.py)")

# 3. 중기예보 (매일 06:10, 18:10)
schedule.every().day.at("06:10").do(job_kma_forecast)
schedule.every().day.at("18:10").do(job_kma_forecast)
log("   - [06:10, 18:10] KMA 중기예보 (KMA/KMA_forecast_mid.py)")

# 4. 월별 데이터 (매일 02:00에 체크 -> 1일인 경우 실행)
schedule.every().day.at("02:00").do(job_rda_month)
log("   - [매월 1일 02:00] RDA 월별 데이터 (RDA/RDA_month_save.py)")

# 최초 실행 시 즉시 한 번 실행할지 여부는 선택사항 (여기서는 스케줄만 등록)

while True:
    schedule.run_pending()
    time.sleep(1)
