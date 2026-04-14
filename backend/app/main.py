from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import prediction, fleet, auth, patients, hospitals

app = FastAPI(title="Ambufy AI Backend")

origins = [
    "http://localhost:5173", # আপনার লোকাল কম্পিউটারের জন্য
    "https://ambufy-ai.vercel.app" # আপনার লাইভ ওয়েবসাইটের জন্য
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prediction.router)
app.include_router(fleet.router)
app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(hospitals.router)

@app.get("/")
def root():
    return {"message": "Welcome to ResponTime AI Backend!"}