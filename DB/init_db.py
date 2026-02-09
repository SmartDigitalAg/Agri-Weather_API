import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).parent.parent.absolute()
sys.path.append(str(PROJECT_ROOT))
sys.path.append(str(PROJECT_ROOT / 'DB'))

try:
    from DB.KMA.KMA_day import create_asos_table
    from DB.KMA.KMA_realtime import create_ultra_short_table
    from DB.KMA.KMA_forecast_short import create_short_forecast_table
    from DB.KMA.KMA_forecast_mid import create_mid_forecast_table
    from DB.RDA.RDA_day_save import create_daily_table
    print("✅ Modules imported successfully.")
except ImportError as e:
    print(f"❌ Import failed: {e}")
    sys.exit(1)

def main():
    print("🚀 Initializing Database Tables...")
    
    print("\n[1/5] KMA ASOS Table")
    try:
        create_asos_table()
    except Exception as e:
        print(f"⚠️ Failed: {e}")

    print("\n[2/5] KMA Realtime Table")
    try:
        create_ultra_short_table()
    except Exception as e:
        print(f"⚠️ Failed: {e}")

    print("\n[3/5] KMA Short Forecast Table")
    try:
        create_short_forecast_table()
    except Exception as e:
        print(f"⚠️ Failed: {e}")

    print("\n[4/5] KMA Mid Forecast Table")
    try:
        create_mid_forecast_table()
        # Note: mid forecast table creation might need arguments or check
    except Exception as e:
        print(f"⚠️ Failed: {e}")

    print("\n[5/5] RDA Daily Table")
    try:
        create_daily_table()
    except Exception as e:
        print(f"⚠️ Failed: {e}")

    print("\n✨ Database initialization complete.")

if __name__ == "__main__":
    main()
