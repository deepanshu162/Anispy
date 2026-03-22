import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

# Load variables from .env if present
load_dotenv()

app = FastAPI(title="Anispy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase Admin client
supabase_url = os.environ.get("SUPABASE_URL")
# CRITICAL: This MUST be the Service Role Key to perform admin actions like bypassing RLS and deleting users
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = None
if supabase_url and supabase_key and "your_service_role" not in supabase_key:
    supabase = create_client(supabase_url, supabase_key)
    print("Supabase admin client initialized.")
else:
    print("WARNING: Valid SUPABASE_SERVICE_ROLE_KEY not found in .env. Admin backend features (like account deletion) will fail.")

# --- API ROUTES ---

class DeleteUserRequest(BaseModel):
    user_id: str

@app.post("/api/admin/delete_user")
async def delete_user(request: DeleteUserRequest):
    """
    Secure backend endpoint to completely remove a user from the Supabase auth system.
    This eliminates the need for frontend users to have deletion privileges via SQL RPC.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase Admin Python SDK is not configured with a valid service role key.")
        
    try:
        # Remove user dependencies to prevent Foreign Key constraint "Database error deleting user"
        supabase.table("watchlist").delete().eq("user_id", request.user_id).execute()

        # Calls the secure Admin API endpoint utilizing the Service Role Key
        res = supabase.auth.admin.delete_user(request.user_id)
        return {"success": True, "message": "User permanently deleted via Backend Admin SDK."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- FRONTEND MOUNT ---
# This ensures that visiting localhost:8000 loads the Vue/HTML frontend.

frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "anime-watchlist")

if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    print(f"ERROR: Frontend directory not found at {frontend_dir}. Ensure 'anime-watchlist' sits adjacent to 'backend'.")
