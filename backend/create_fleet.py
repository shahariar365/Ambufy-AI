import os
import random
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    raise ValueError("Supabase URL or Key not found in .env file")

supabase: Client = create_client(url, key)

# ২০টি জোন এবং তাদের সেন্ট্রাল কোঅর্ডিনেট (AdminDashboard-এ ব্যবহৃত)
ZONE_CENTERS = {
    "Old Dhaka - West": [23.715, 90.395], "Old Dhaka - East": [23.712, 90.418], 
    "South-East Gateway": [23.735, 90.435], "Central CBD": [23.730, 90.410],
    "University & Shahbag Hub": [23.738, 90.395], "Dhanmondi & Green Road": [23.746, 90.376],
    "Mohammadpur & Lalmatia": [23.760, 90.365], "West Gateway": [23.775, 90.355], 
    "Mirpur - South": [23.790, 90.360], "Mirpur - Central": [23.805, 90.368],
    "Mirpur - North": [23.825, 90.370], "Cantonment & Airport": [23.840, 90.400],
    "Uttara - South": [23.860, 90.405], "Uttara - North": [23.875, 90.390], 
    "Bashundhara & Kuril": [23.815, 90.425], "Gulshan & Banani": [23.795, 90.415],
    "Banani & Mohakhali": [23.785, 90.405], "Tejgaon & Farmgate": [23.765, 90.395],
    "Rampura & Badda": [23.775, 90.420], "Khilgaon & Banasree": [23.755, 90.430]
}

# জোন অনুযায়ী অ্যাম্বুলেন্স বরাদ্দের একটি ডামি লজিক (Total = 50)
ALLOCATION_PLAN = {
    # হাই ডিমান্ড জোন (৪-৫টি করে)
    "Mirpur - Central": 5, "Uttara - North": 4, "Gulshan & Banani": 4, "Dhanmondi & Green Road": 4,
    # মিডিয়াম ডিমান্ড জোন (২-৩টি করে)
    "Old Dhaka - East": 3, "Mohammadpur & Lalmatia": 3, "Tejgaon & Farmgate": 3, "Rampura & Badda": 3,
    "Mirpur - South": 2, "Mirpur - North": 2, "Uttara - South": 2, "Cantonment & Airport": 2,
    "Bashundhara & Kuril": 2, "Banani & Mohakhali": 2, "Khilgaon & Banasree": 2, "Central CBD": 2,
    # লো ডিমান্ড জোন (১টি করে)
    "Old Dhaka - West": 1, "South-East Gateway": 1, "University & Shahbag Hub": 1, "West Gateway": 1
}

def generate_smart_fleet():
    ambulances = []
    vehicle_counter = 1001
    
    print("Generating 50 smart dummy ambulances based on zone allocation...")

    for zone_name, count in ALLOCATION_PLAN.items():
        center_lat, center_lng = ZONE_CENTERS[zone_name]
        
        for _ in range(count):
            # জোনের সেন্টারের আশেপাশে (প্রায় ১-১.৫ কিমি ব্যাসার্ধে) র‍্যান্ডম লোকেশন তৈরি
            lat = center_lat + random.uniform(-0.015, 0.015)
            lng = center_lng + random.uniform(-0.015, 0.015)
            
            # Fleet Mix Logic (BLS/AC বেশি, ICU/ALS কম)
            amb_type = random.choices(
                population=['BLS', 'AC', 'Non-AC', 'ICU', 'ALS', 'Frezer'],
                weights=[30, 30, 10, 15, 10, 5], # শতকরা হার
                k=1
            )[0]
            
            # ভাড়া নির্ধারণ
            if amb_type in ['ICU', 'ALS']:
                base_fare = random.choice([1500, 2000])
                per_km = random.choice([80, 100])
            elif amb_type in ['AC', 'BLS']:
                base_fare = random.choice([800, 1000])
                per_km = random.choice([50, 60])
            else:
                base_fare = random.choice([500, 600])
                per_km = random.choice([30, 40])
                
            ambulances.append({
                "vehicle_number": f"AMB-DHK-{vehicle_counter}",
                "type": amb_type,
                "base_fare": base_fare,
                "per_km_fare": per_km,
                "current_lat": round(lat, 6),
                "current_lng": round(lng, 6),
                "status": "available"
            })
            vehicle_counter += 1
            
    return ambulances

def main():
    print("--- Starting Smart Fleet Generator ---")
    fleet_data = generate_smart_fleet()
    
    try:
        # আগের কোনো ডামি ডেটা থাকলে তা মুছে ফেলা (অপশনাল, ক্লিন আপের জন্য)
        # supabase.table("ambulances").delete().neq("id", 0).execute()
        
        print(f"Inserting {len(fleet_data)} ambulances into Supabase...")
        response = supabase.table("ambulances").insert(fleet_data).execute()
        print("Success! Smart fleet deployed.")
    except Exception as e:
        print(f"Error inserting fleet data: {e}")

if __name__ == "__main__":
    main()