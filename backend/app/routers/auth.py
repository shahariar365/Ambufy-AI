import os
from fastapi import APIRouter, HTTPException
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
# এডমিন কাজ করার জন্য সবসময় SERVICE_ROLE_KEY ব্যবহার করতে হয়
key: str = os.environ.get("SUPABASE_SERVICE_KEY") 
supabase: Client = create_client(url, key)

router = APIRouter()

class DriverCreate(BaseModel):
    phone: str
    password: str
    full_name: str

@router.post("/api/auth/create-driver", status_code=201)
async def create_driver_user(driver_data: DriverCreate):
    try:
        # --- Phone কে একটি ভ্যালিড দেখতে ডামি ইমেইলে কনভার্ট করা ---
        # শুধু নম্বর থাকলে অনেক সময় Supabase এরর দেয়, তাই 'p' যুক্ত করা হলো
        dummy_email = f"p{driver_data.phone}@ambufy.com"

        # ১. Supabase Auth তে ইউজার তৈরি
        user_response = supabase.auth.admin.create_user({
            "email": dummy_email,
            "password": driver_data.password,
            "email_confirm": True # কনফার্মেশন স্কিপ করার জন্য
        })
        
        if user_response.user:
            user_id = user_response.user.id
            
            # ২. 'profiles' টেবিলে ডেটা ইনসার্ট করা
            profile_response = supabase.table("profiles").insert({
                "id": user_id,
                "full_name": driver_data.full_name,
                "role": "driver" # ডিফল্টভাবে ড্রাইভার তৈরি হবে
            }).execute()

            # প্রোফাইল তৈরি না হলে Auth থেকে ইউজারটিকেও মুছে ফেলা
            if not profile_response.data:
                supabase.auth.admin.delete_user(user_id)
                raise HTTPException(status_code=500, detail="Failed to create driver profile in database.")
            
            return {"message": f"Account for '{driver_data.full_name}' created successfully", "user_id": user_id}
        else:
            raise HTTPException(status_code=400, detail="Could not create authentication user.")

    except Exception as e:
        # টার্মিনালে আসল এররটি প্রিন্ট করবে
        print(f"🔥 ACTUAL SUPABASE ERROR: {str(e)}") 
        
        error_msg = str(e).lower()
        if 'already exists' in error_msg or 'duplicate' in error_msg:
             raise HTTPException(status_code=409, detail=f"An account with phone '{driver_data.phone}' already exists.")
        
        # আমরা আসল এররটি ফ্রন্টএন্ডেও পাঠিয়ে দিচ্ছি দেখার জন্য
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# --- লগইন API ---
class DriverLogin(BaseModel):
    phone: str
    password: str

@router.post("/api/auth/login-driver")
async def login_driver(credentials: DriverLogin):
    try:
        # লগইন করার সময়ও একই ডামি ইমেইল ফরম্যাট ব্যবহার করতে হবে
        dummy_email = f"p{credentials.phone}@ambufy.com"

        auth_response = supabase.auth.sign_in_with_password({
            "email": dummy_email,
            "password": credentials.password,
        })
        
        user_id = auth_response.user.id
        
        profile_res = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if not profile_res.data:
            raise HTTPException(status_code=404, detail="User profile not found.")
            
        profile_data = profile_res.data[0]
        
        # ড্রাইভার হলে তার অ্যাম্বুলেন্স আছে কিনা চেক করা (এডমিন হলে এটা null আসবে)
        amb_res = supabase.table("ambulances").select("*").eq("driver_id", user_id).execute()
        assigned_ambulance = amb_res.data[0] if amb_res.data else None

        return {
            "message": "Login successful",
            "access_token": auth_response.session.access_token,
            "driver": profile_data,
            "ambulance": assigned_ambulance
        }

    except Exception as e:
        if 'invalid login credentials' in str(e).lower():
             raise HTTPException(status_code=401, detail="Invalid phone number or password.")
        raise HTTPException(status_code=500, detail=str(e))