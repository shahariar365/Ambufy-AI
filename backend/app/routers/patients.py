import os
import math
import pandas as pd
from datetime import datetime
from fastapi import APIRouter, HTTPException
from supabase import create_client, Client
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional

# ETA মডেল লোড করার জন্য prediction মডিউল থেকে ফাংশন ইম্পোর্ট
from .prediction import eta_model

load_dotenv()
supabase: Client = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY"))
router = APIRouter()

# --- Helpers ---
# দুই কোঅর্ডিনেটের সরলরৈখিক দূরত্ব (Haversine formula)
def get_distance_km(lat1, lon1, lat2, lon2):
    R = 6371 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2) * math.sin(dlat/2) + math.cos(math.radians(lat1)) \
        * math.cos(math.radians(lat2)) * math.sin(dlon/2) * math.sin(dlon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# CatBoost মডেল দিয়ে ETA ক্যালকুলেট করার ফাংশন
def calculate_eta_with_model(start_lat, start_lng, end_lat, end_lng, zone_name):
    try:
        now = datetime.now()
        # বেসিক ফিচার
        dist_km = get_distance_km(start_lat, start_lng, end_lat, end_lng)
        
        # আপনার মডেলের জন্য ডামি/ডিফল্ট ফিচার (যেহেতু আমাদের রিয়েল ওয়েদার/ট্রাফিক এখানে নেই)
        # বাস্তবে এগুলোও রিয়েল-টাইমে আনা উচিত
        input_df = pd.DataFrame([{
            'initial_route_distance_km': dist_km * 1.3, # রাস্তার দূরত্ব সরলরেখার চেয়ে বেশি হয়
            'zone_name': zone_name,
            'hour_of_day': now.hour,
            'day_of_week': now.weekday(),
            'weather_condition': 'Clear',
            'is_peak_hour': 1 if now.hour in [8,9,10,17,18,19] else 0,
            'is_weekend': 1 if now.weekday() >= 5 else 0,
            'traffic_stress': 0.9,
            'zone_hour_combo': f"{zone_name}_{now.hour}"
        }])
        
        pred = eta_model.predict(input_df)
        return max(1, int(pred[0])) # সর্বনিম্ন ১ মিনিট
    except Exception as e:
        print(f"ETA Model Error: {e}")
        dist = get_distance_km(start_lat, start_lng, end_lat, end_lng)
        realistic_eta = int((dist * 1.5) * 8)
        return max(5, realistic_eta)

def adjust_eta_for_dhaka(base_eta, distance_km):
    if distance_km <= 1.0:
        return base_eta # ১ কিমির নিচে হলে মডেলের অরিজিনাল টাইম (কাছাকাছি আছে)
    elif 1.0 < distance_km <= 3.0:
        return base_eta + 10 # ১-৩ কিমি হলে ১০ মিনিট যোগ
    elif 3.0 < distance_km <= 6.0:
        return base_eta + 20 # ৩-৬ কিমি হলে ২০ মিনিট যোগ
    else:
        return base_eta + 30 

# --- Models ---
class EmergencyRequest(BaseModel):
    phone: str
    patient_lat: float
    patient_lng: float
    zone_name: str
    emergency_type: str
    required_ambulance_type: str
    hospital_id: Optional[int] = None

# --- API Endpoint ---
@router.post("/api/patients/request-ambulance")
async def request_smart_ambulance(req: EmergencyRequest):
    try:
        # ১. পেশেন্ট ভেরিফিকেশন বা তৈরি
        p_res = supabase.table("patients").select("id").eq("phone_number", req.phone).execute()
        if p_res.data:
            patient_id = p_res.data[0]['id']
        else:
            new_p = supabase.table("patients").insert({"phone_number": req.phone}).execute()
            patient_id = new_p.data[0]['id']

        # ২. হসপিটাল সিলেকশন (Auto-Routing)
        target_hospital_id = req.hospital_id
        target_hospital = None
        
        h_res = supabase.table("hospitals").select("*").execute()
        hospitals = h_res.data
        
        if not target_hospital_id and hospitals:
            # যদি পেশেন্ট হসপিটাল না দেয়, তবে সবচেয়ে কম ETA-র হসপিটাল খুঁজুন
            best_h_eta = float('inf')
            
            for h in hospitals:
                dist = get_distance_km(req.patient_lat, req.patient_lng, h['latitude'], h['longitude'])
                if dist <= 10.0: # ১০ কিমি রেঞ্জের মধ্যে
                    eta = calculate_eta_with_model(req.patient_lat, req.patient_lng, h['latitude'], h['longitude'], req.zone_name)
                    if eta < best_h_eta:
                        best_h_eta = eta
                        target_hospital = h
            
            if target_hospital:
                target_hospital_id = target_hospital['id']
            else:
                target_hospital = hospitals[0] # রেঞ্জে না পেলে ডিফল্ট প্রথমটা
                target_hospital_id = target_hospital['id']
        elif target_hospital_id:
            target_hospital = next((h for h in hospitals if h['id'] == target_hospital_id), None)
            if not target_hospital and hospitals:
                target_hospital = hospitals[0]

        # ৩. অ্যাম্বুলেন্স সিলেকশন (Smart Dispatch by ETA)
        # প্রথমে 'available' অ্যাম্বুলেন্স আনুন
        query = supabase.table("ambulances").select("*, profiles(full_name)").eq("status", "available")
        if req.required_ambulance_type != 'Any':
            query = query.eq("type", req.required_ambulance_type)
            
        amb_res = query.execute()
        available_ambulances = amb_res.data
        
        if not available_ambulances:
             return {"status": "failed", "message": "No available ambulances found nearby."}

        best_ambulance = None
        best_total_eta = float('inf')
        patient_to_hospital_eta = 0
        ambulance_to_patient_eta = 0

        # প্রতিটি অ্যাম্বুলেন্সের জন্য ETA ক্যালকুলেট করা
        for amb in available_ambulances:
            dist_to_patient = get_distance_km(amb['current_lat'], amb['current_lng'], req.patient_lat, req.patient_lng)
            
            # রেঞ্জ ৭ থেকে বাড়িয়ে ১৫ কিমি করে দিলাম, নাহলে একটু দূরের গাড়িগুলো সার্চে আসবে না
            if dist_to_patient <= 15.0: 
                # মডেল থেকে অরিজিনাল ETA
                raw_eta_1 = calculate_eta_with_model(amb['current_lat'], amb['current_lng'], req.patient_lat, req.patient_lng, req.zone_name)
                # রিয়েলিস্টিক বাফার যোগ করা
                eta_1 = adjust_eta_for_dhaka(raw_eta_1, dist_to_patient)
                
                eta_2 = 0
                if target_hospital:
                    dist_to_hospital = get_distance_km(req.patient_lat, req.patient_lng, target_hospital['latitude'], target_hospital['longitude'])
                    raw_eta_2 = calculate_eta_with_model(req.patient_lat, req.patient_lng, target_hospital['latitude'], target_hospital['longitude'], req.zone_name)
                    # রিয়েলিস্টিক বাফার যোগ করা
                    eta_2 = adjust_eta_for_dhaka(raw_eta_2, dist_to_hospital)
                
                total_eta = eta_1 + eta_2
                
                if total_eta < best_total_eta:
                    best_total_eta = total_eta
                    best_ambulance = amb
                    ambulance_to_patient_eta = eta_1
                    patient_to_hospital_eta = eta_2

        if not best_ambulance:
            return {"status": "failed", "message": "All ambulances are too far away."}

        # ৪. রিকোয়েস্ট (Trip) তৈরি করা
        # ভাড়া ক্যালকুলেশন (ডামি লজিক: Base Fare + (Total ETA * 15 taka))
        estimated_fare = best_ambulance['base_fare'] + (best_total_eta * 15)

        trip_data = {
            "patient_id": patient_id,
            "ambulance_id": best_ambulance['id'],
            "destination_hospital_id": target_hospital_id,
            "start_location_lat": req.patient_lat,
            "start_location_lng": req.patient_lng,
            "estimated_fare": estimated_fare,
            "status": "searching",
            "trip_type": "instant"
        }
        
        trip_res = supabase.table("trips").insert(trip_data).execute()
        new_trip = trip_res.data[0]

        return {
            "status": "success",
            "message": "Ambulance found and request sent to driver.",
            "trip_id": new_trip['id'],
            "ambulance": best_ambulance,
            "hospital": target_hospital,
            "arrival_eta_mins": ambulance_to_patient_eta,
            "total_eta_mins": best_total_eta,
            "estimated_fare": estimated_fare
        }

    except Exception as e:
        print(f"Error in booking flow: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
class ConfirmTrip(BaseModel):
    trip_id: int

@router.post("/api/patients/confirm-trip")
async def confirm_patient_trip(req: ConfirmTrip):
    try:
        response = supabase.table("trips").update({
            "status": "pending_driver"
        }).eq("id", req.trip_id).execute()
        
        if response.data:
            return {"status": "success", "message": "Trip confirmed and sent to driver."}
        else:
            raise HTTPException(status_code=404, detail="Trip not found.")
            
    except Exception as e:
        print(f"Confirm Trip Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))