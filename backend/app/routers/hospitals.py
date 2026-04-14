import os
from fastapi import APIRouter
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

router = APIRouter()

@router.get("/api/hospitals")
async def get_all_hospitals():
    try:
        response = supabase.table("hospitals").select("id, hospital_name, latitude, longitude").execute()
        return response.data
    except Exception as e:
        print(f"Error fetching hospitals: {e}")
        return []