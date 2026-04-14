from datetime import datetime, timedelta
from fastapi import APIRouter, Query
import joblib
import os
import pandas as pd
import numpy as np
from pydantic import BaseModel
import math
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)


# --- ডেটা ইনপুটের জন্য একটি মডেল তৈরি করা ---
class EtaInput(BaseModel):
    initial_route_distance_km: float
    zone_name: str
    hour_of_day: int
    day_of_week: int
    weather_condition: str
    is_peak_hour: bool
    is_weekend: bool
    traffic_stress: float

router = APIRouter()

# --- লাইভ আবহাওয়া আনার ফাংশন ---
def get_live_weather():
    try:
        # Open-Meteo API (ঢাকার ল্যাটিচিউড ও লংগিচিউড)
        url = "https://api.open-meteo.com/v1/forecast?latitude=23.8103&longitude=90.4125&current=temperature_2m,weather_code"
        response = requests.get(url, timeout=5)
        data = response.json()
        
        temp = data['current']['temperature_2m']
        code = data['current']['weather_code']
        
        # WMO Weather code থেকে আমাদের মডেলের ক্যাটাগরিতে কনভার্ট করা
        if code == 0: weather = 'Clear'
        elif 1 <= code <= 3: weather = 'Cloudy'
        elif 45 <= code <= 67: weather = 'Drizzle'
        elif 71 <= code <= 99: weather = 'Rain'
        else: weather = 'Clear' # Default
        
        print(f"Live Weather Fetched: {weather}, {temp}°C")
        return weather, temp
    except Exception as e:
        print(f"Failed to fetch live weather: {e}")
        return 'Clear', 32.0 # API ফেইল করলে ডিফল্ট ভ্যালু

# মডেল ফাইলগুলোর পাথ
MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
demand_model_path = os.path.join(MODEL_DIR, 'lgbm_demand_model.pkl')
eta_model_path = os.path.join(MODEL_DIR, 'catboost_eta_model.pkl')

# মডেল লোড করা
demand_model = joblib.load(demand_model_path)
eta_model = joblib.load(eta_model_path)
print("AI Models are live and ready for prediction!")

# --- API এন্ডপয়েন্ট ---

# --- predict_demand
@router.get("/api/predict/demand")
async def predict_demand(time_window: int = Query(1, description="Time window in hours")):
    try:
        t_start = datetime.now()
        live_weather, live_temp = get_live_weather()
        real_now = datetime.now()
        anchor_date = datetime(2024, 5, 28)
        simulated_now = anchor_date.replace(hour=real_now.hour, minute=real_now.minute)

        # ১. ডেটাবেস থেকে জোনের তথ্য আনা
        zone_response = supabase.table("zones").select("zone_name, population_density, latitude, longitude, geojson_boundary").execute()
        db_zones = zone_response.data
        if not db_zones: return {"error": "No zones found in database."}

        predictions = []
        master_input_rows = []
        
        # মডেলের ফিচার লিস্ট
        model_features = ['zone_name', 'population_density_per_sq_km', 'weather_condition', 'temperature_celsius', 'hour', 'day_of_week', 'month', 'hour_sin', 'hour_cos', 'day_of_week_sin', 'day_of_week_cos', 'month_sin', 'month_cos', 'demand_lag_24', 'demand_lag_48', 'demand_lag_72', 'demand_lag_168', 'demand_lag_336', 'demand_rolling_mean_24', 'demand_rolling_max_24', 'demand_rolling_std_24', 'demand_rolling_mean_168', 'demand_rolling_max_168', 'demand_rolling_std_168', 'cardiac_calls_lag_24', 'cardiac_calls_rolling_mean_168', 'trauma_calls_lag_24', 'trauma_calls_rolling_mean_168', 'respiratory_calls_lag_24', 'respiratory_calls_rolling_mean_168', 'critical_calls_lag_24', 'critical_calls_rolling_mean_168', 'serious_calls_lag_24', 'serious_calls_rolling_mean_168']
        categorical_features_for_model = ['zone_name', 'hour', 'day_of_week', 'month', 'weather_condition']

        for zone_data in db_zones:
            zone = zone_data['zone_name']
            
            # ২. RPC কল
            rpc_res = supabase.rpc('get_aggregated_history', {
                'p_zone_name': zone, 
                'p_target_time': simulated_now.isoformat()
            }).execute()

            df_hist = pd.DataFrame(rpc_res.data)
            
            # যদি কোনো জোনের ইতিহাস না থাকে, তাহলে সব ফিচার 0.0 হবে
            if df_hist.empty:
                real_features = {k: 0.0 for k in model_features if 'lag' in k or 'rolling' in k}
            else:
                df_hist['time_bucket'] = pd.to_datetime(df_hist['time_bucket'])
                df_hist = df_hist.set_index('time_bucket').sort_index()
                
                real_features = {
                    'demand_lag_24': df_hist['calls_count'].shift(24).iloc[-1], 'demand_lag_48': df_hist['calls_count'].shift(48).iloc[-1],
                    'demand_lag_72': df_hist['calls_count'].shift(72).iloc[-1], 'demand_lag_168': df_hist['calls_count'].shift(168).iloc[-1],
                    'demand_lag_336': df_hist['calls_count'].shift(336).iloc[-1] if len(df_hist) > 336 else 0,
                    'demand_rolling_mean_24': df_hist['calls_count'].shift(24).rolling(24).mean().iloc[-1],
                    'demand_rolling_max_24': df_hist['calls_count'].shift(24).rolling(24).max().iloc[-1], 'demand_rolling_std_24': df_hist['calls_count'].shift(24).rolling(24).std().iloc[-1],
                    'demand_rolling_mean_168': df_hist['calls_count'].shift(24).rolling(168).mean().iloc[-1],
                    'demand_rolling_max_168': df_hist['calls_count'].shift(24).rolling(168).max().iloc[-1], 'demand_rolling_std_168': df_hist['calls_count'].shift(24).rolling(168).std().iloc[-1],
                    'cardiac_calls_lag_24': df_hist['cardiac_count'].shift(24).iloc[-1], 'cardiac_calls_rolling_mean_168': df_hist['cardiac_count'].shift(24).rolling(168).mean().iloc[-1],
                    'trauma_calls_lag_24': df_hist['trauma_count'].shift(24).iloc[-1], 'trauma_calls_rolling_mean_168': df_hist['trauma_count'].shift(24).rolling(168).mean().iloc[-1],
                    'respiratory_calls_lag_24': df_hist['respiratory_count'].shift(24).iloc[-1], 'respiratory_calls_rolling_mean_168': df_hist['respiratory_count'].shift(24).rolling(168).mean().iloc[-1],
                    'critical_calls_lag_24': df_hist['critical_count'].shift(24).iloc[-1], 'critical_calls_rolling_mean_168': df_hist['critical_count'].shift(24).rolling(168).mean().iloc[-1],
                    'serious_calls_lag_24': df_hist['serious_count'].shift(24).iloc[-1], 'serious_calls_rolling_mean_168': df_hist['serious_count'].shift(24).rolling(168).mean().iloc[-1],
                }
                real_features = {k: (v if pd.notna(v) else 0) for k, v in real_features.items()}

            # ৩. ফিউচার প্রেডিকশনের জন্য Row তৈরি
            for offset in range(time_window):
                target_time = simulated_now + timedelta(hours=offset)
                h, d, m = target_time.hour, target_time.weekday(), target_time.month
                row = {
                    'zone_name': zone, 'population_density_per_sq_km': zone_data['population_density'], 
                    'weather_condition': live_weather, 'temperature_celsius': live_temp,
                    'hour': h, 'day_of_week': d, 'month': m,
                    'hour_sin': np.sin(2 * np.pi * h/23.0), 'hour_cos': np.cos(2 * np.pi * h/23.0),
                    'day_of_week_sin': np.sin(2 * np.pi * d/6.0), 'day_of_week_cos': np.cos(2 * np.pi * d/6.0),
                    'month_sin': np.sin(2 * np.pi * m/12.0), 'month_cos': np.cos(2 * np.pi * m/12.0),
                    **real_features
                }
                master_input_rows.append(row)
        
        # ৪. লুপের বাইরে একবারে প্রেডিকশন
        if not master_input_rows:
            return {"zones": [], "message": "No data to predict."}
            
        input_df = pd.DataFrame(master_input_rows)[model_features]
        for col in categorical_features_for_model:
            input_df[col] = input_df[col].astype("category")

        preds = demand_model.predict(input_df)
        input_df['predicted_calls'] = [max(0, round(p)) for p in preds]

        # ৫. ফাইনাল রেজাল্ট তৈরি
        for zone_data in db_zones:
            zone_preds = input_df[input_df['zone_name'] == zone_data['zone_name']]['predicted_calls']
            total_prediction = int(zone_preds.sum())
            avg_hourly_demand = total_prediction / time_window if time_window > 0 else 0
            
            demand_level = "High" if avg_hourly_demand > 3.99 else "Medium" if avg_hourly_demand > 2.5 else "Low"
            required_ambulances = math.ceil(avg_hourly_demand * 0.75) + 1

            predictions.append({
                "name": zone_data['zone_name'], 
                "coords": [zone_data['latitude'], zone_data['longitude']], 
                "demand": demand_level, "total_prediction": total_prediction,
                "avg_hourly_demand": round(avg_hourly_demand, 1), 
                "required_ambulances": required_ambulances,
                "boundary": zone_data['geojson_boundary']
            })

        print(f"API execution time: {(datetime.now() - t_start).total_seconds():.2f} seconds")
        return {"zones": predictions}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

# --- ETA API এখন POST হবে এবং রিয়েল প্রেডিকশন দিবে ---
@router.post("/api/calculate/eta")
async def calculate_eta(data: EtaInput):
    try:
        # ফ্রন্টএন্ড থেকে আসা ডেটা দিয়ে zone_hour_combo তৈরি করা
        zone_hour_combo = f"{data.zone_name}_{data.hour_of_day}"

        # DataFrame তৈরি করা (কলামের নামগুলো আপনার FINAL_FEATURES অনুযায়ী)
        input_df = pd.DataFrame([{
            'initial_route_distance_km': data.initial_route_distance_km,
            'zone_name': data.zone_name,
            'hour_of_day': data.hour_of_day,
            'day_of_week': data.day_of_week,
            'weather_condition': data.weather_condition,
            'is_peak_hour': data.is_peak_hour,
            'is_weekend': data.is_weekend,
            'traffic_stress': data.traffic_stress,
            'zone_hour_combo': zone_hour_combo
        }])

        # CatBoost মডেল ব্যবহার করে প্রেডিকশন করা
        prediction_minutes = eta_model.predict(input_df)
        
        # প্রেডিকশনটি int-এ কনভার্ট করে পাঠানো
        return {"eta_minutes": int(prediction_minutes[0])}

    except Exception as e:
        print(f"Error during ETA prediction: {e}")
        # কোনো সমস্যা হলে একটি ডিফল্ট ভ্যালু পাঠানো
        return {"eta_minutes": 15, "error": str(e)}