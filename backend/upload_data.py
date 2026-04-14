import os
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv
import math
import time

load_dotenv()
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Supabase URL or Key not found.")
    exit()

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Failed to create Supabase client: {e}")
    exit()

CSV_FILE_PATH = 'dhaka_ambulance_high_demand_dataset.csv'
TABLE_NAME = 'historical_logs'

# --- আপনি যেখান থেকে রিজ্যুম করতে চান, সেই নম্বরটি এখানে দিন ---
START_CHUNK = 192  # যেহেতু ১২৮ পর্যন্ত সফল হয়েছে

def upload_data_in_chunks(df, table_name, chunk_size=5000):
    total_rows = len(df)
    if total_rows == 0:
        return
        
    num_chunks = math.ceil(total_rows / chunk_size)
    print(f"Total rows: {total_rows}. Total chunks: {num_chunks}")
    print(f"Resuming upload from chunk {START_CHUNK}...\n")

    for i in range(num_chunks):
        chunk_number = i + 1
        
        # যদি চাঙ্ক নম্বর আমাদের স্টার্ট চাঙ্কের চেয়ে ছোট হয়, তবে সেটি স্কিপ (Skip) করে যাও
        if chunk_number < START_CHUNK:
            continue

        start_index = i * chunk_size
        end_index = start_index + chunk_size
        chunk_df = df.iloc[start_index:end_index]
        records_to_insert = chunk_df.to_dict(orient='records')
        
        max_retries = 3 # যদি ফেইল করে, ৩ বার চেষ্টা করবে
        
        for attempt in range(max_retries):
            try:
                response = supabase.table(table_name).insert(records_to_insert).execute()
                if len(response.data) > 0:
                     print(f"Chunk {chunk_number}/{num_chunks} uploaded successfully.")
                     time.sleep(1.5) # সার্ভারকে বিশ্রাম দেওয়ার জন্য ১.৫ সেকেন্ড ডিলে
                     break # সফল হলে Retry লুপ থেকে বের হয়ে যাবে
            except Exception as e:
                print(f"Warning: Error on chunk {chunk_number}, attempt {attempt+1} - {e}")
                if attempt < max_retries - 1:
                    print("Waiting 5 seconds before retrying...")
                    time.sleep(5) # ৫ সেকেন্ড পর আবার চেষ্টা করবে
                else:
                    print(f"CRITICAL ERROR: Failed to upload chunk {chunk_number} after {max_retries} attempts.")
                    print("Stopping script. Update START_CHUNK and run again later.")
                    return # ৩ বার ফেইল করলে স্ক্রিপ্ট বন্ধ হয়ে যাবে

def main():
    print("--- Starting Data Upload Script (Resume Mode) ---")
    try:
        df = pd.read_csv(CSV_FILE_PATH)
    except FileNotFoundError:
        print("FATAL ERROR: CSV file not found.")
        return

    columns_to_keep = [
        'incident_id', 'call_timestamp', 'zone_name', 'emergency_type', 'reported_severity',
        'emergency_lat', 'emergency_lon', 'travel_time_minutes', 'initial_route_distance_km',
        'weather_condition', 'temperature_celsius', 'emergency_location_name', 'population_density_per_sq_km',
        'assigned_vehicle_id', 'vehicle_type', 'vehicle_start_location_name', 'vehicle_start_lat',
        'vehicle_start_lon', 'dispatch_timestamp', 'enroute_timestamp', 'arrival_at_scene_timestamp',
        'destination_hospital_name', 'scene_to_hospital_minutes', 'straight_line_distance_km',
        'hour_of_day', 'is_peak_hour', 'is_night_time'
    ]
    
    df_for_upload = df[columns_to_keep].copy()
    df_for_upload = df_for_upload.astype(object).where(pd.notnull(df_for_upload), None)
    
    upload_data_in_chunks(df_for_upload, TABLE_NAME)
    print("\n--- Data Upload Script Finished ---")

if __name__ == "__main__":
    main()