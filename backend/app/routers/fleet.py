import os
from fastapi import APIRouter, HTTPException
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

router = APIRouter()

# --- Pydantic Models ---
class LocationUpdate(BaseModel):
    lat: float
    lng: float

class StatusUpdate(BaseModel):
    status: str

# ১. লাইভ ফ্লিট ডেটা পাওয়ার API
@router.get("/api/fleet/live")
async def get_live_fleet():
    try:
        response = supabase.table("ambulances").select("*").execute()
        return {"ambulances": response.data}
    except Exception as e:
        return {"error": str(e), "ambulances": []}

# ২. ড্রাইভারের লাইভ লোকেশন আপডেট করার API
@router.put("/api/fleet/{ambulance_id}/location")
async def update_ambulance_location(ambulance_id: int, location: LocationUpdate):
    try:
        response = supabase.table("ambulances").update({
            "current_lat": location.lat,
            "current_lng": location.lng
        }).eq("id", ambulance_id).execute()
        
        if response.data:
            return {"message": "Location updated successfully"}
        raise HTTPException(status_code=404, detail="Ambulance not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ৩. ড্রাইভারের অনলাইন/অফলাইন স্ট্যাটাস আপডেট করার API
@router.put("/api/fleet/{ambulance_id}/status")
async def update_ambulance_status(ambulance_id: int, status_data: StatusUpdate):
    try:
        # শুধু valid status allow করা হবে
        if status_data.status not in ['available', 'on_trip', 'offline']:
            raise ValueError("Invalid status")
            
        response = supabase.table("ambulances").update({
            "status": status_data.status
        }).eq("id", ambulance_id).execute()
        
        if response.data:
            return {"message": f"Status updated to {status_data.status}"}
        raise HTTPException(status_code=404, detail="Ambulance not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))