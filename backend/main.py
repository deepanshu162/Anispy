 #python -m uvicorn main:app --reload
import os
import re
import httpx
import asyncio
from typing import List
from fastapi import FastAPI, HTTPException, Query
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


# ---------------------------------------------------------------------------
# SMART SEARCH — Helper functions (ported from frontend app.js)
# ---------------------------------------------------------------------------

def is_related_title(base: str, ext: str) -> bool:
    """Return True if two anime titles belong to the same franchise/series."""
    if not base or not ext:
        return False
    l_base = base.lower()
    l_ext = ext.lower()

    if l_ext == l_base:
        return True
    if l_ext.startswith(l_base + " ") or l_ext.startswith(l_base + ":") or l_ext.startswith(l_base + "-"):
        return True
    if l_base.startswith(l_ext + " ") or l_base.startswith(l_ext + ":") or l_base.startswith(l_ext + "-"):
        return True

    # Stripped prefix check: handles special chars like "Yu☆Gi☆Oh!" vs "Yu-Gi-Oh!"
    # Using startswith (not find) to avoid matching short words inside unrelated longer titles
    # e.g. "fantasy" should NOT match inside "tsukimichimoonlitfantasy"
    stripped_base = re.sub(r"[^a-z0-9]", "", l_base)
    stripped_ext = re.sub(r"[^a-z0-9]", "", l_ext)

    if len(stripped_base) >= 4 and stripped_ext.startswith(stripped_base):
        return True
    if len(stripped_ext) >= 4 and stripped_base.startswith(stripped_ext):
        return True

    return False


def get_season_label(main_anime: dict, season_anime: dict) -> str:
    """Derive a short human‑readable label for a season relative to the main entry."""
    main_title = main_anime.get("title_english") or main_anime.get("title", "")
    current_title = season_anime.get("title_english") or season_anime.get("title", "")

    if main_title.lower() == current_title.lower():
        return "Season 1"

    label = current_title
    if current_title.lower().startswith(main_title.lower()):
        label = re.sub(r"^[:\-\s]+", "", current_title[len(main_title):]).strip()
    elif season_anime.get("title", "").lower().startswith(main_anime.get("title", "").lower()):
        suffix = season_anime["title"][len(main_anime.get("title", "")):]
        label = re.sub(r"^[:\-\s]+", "", suffix).strip()

    return label or "Season 1"


def _build_season_payload(raw: dict) -> dict:
    """Extract only the fields the frontend needs from a raw Jikan anime object."""
    return {
        "mal_id": raw.get("mal_id"),
        "title": raw.get("title", ""),
        "title_english": raw.get("title_english"),
        "image": (raw.get("images") or {}).get("jpg", {}).get("image_url"),
        "large_image": (raw.get("images") or {}).get("jpg", {}).get("large_image_url"),
        "score": raw.get("score"),
        "type": raw.get("type"),
        "episodes": raw.get("episodes"),
        "status": raw.get("status"),
        "synopsis": raw.get("synopsis"),
        "popularity": raw.get("popularity"),
        "duration": raw.get("duration"),
        "year": raw.get("year"),
        "genres": [{"mal_id": g["mal_id"], "name": g["name"]} for g in (raw.get("genres") or [])],
        "studios": [{"mal_id": s["mal_id"], "name": s["name"]} for s in (raw.get("studios") or [])],
        "producers": [{"mal_id": p["mal_id"], "name": p["name"]} for p in (raw.get("producers") or [])],
        "themes": [{"mal_id": t["mal_id"], "name": t["name"]} for t in (raw.get("themes") or [])],
        "aired": (raw.get("aired") or {}).get("string"),
        "aired_from": (raw.get("aired") or {}).get("from"),
    }


def group_results(raw_list: list) -> list:
    """
    Group a flat list of Jikan anime objects into franchise groups.
    Returns a list of dicts: { main, seasons: [{label, ...fields}] }
    """
    groups = []

    for raw in raw_list:
        anime = _build_season_payload(raw)
        curr_eng = anime.get("title_english") or anime["title"]
        curr_rom = anime["title"]
        matched = False

        for g in groups:
            g_eng = g["main"].get("title_english") or g["main"]["title"]
            g_rom = g["main"]["title"]

            if is_related_title(g_eng, curr_eng) or is_related_title(g_rom, curr_rom):
                g["seasons"].append(anime)
                matched = True
                break

            if is_related_title(curr_eng, g_eng) or is_related_title(curr_rom, g_rom):
                g["seasons"].append(anime)
                g["main"] = anime  # current is more base-like
                matched = True
                break

        if not matched:
            groups.append({"main": anime, "seasons": [anime]})

    # Sort seasons within each group by air date (earliest first)
    for g in groups:
        g["seasons"].sort(
            key=lambda s: s.get("aired_from") or "2099"
        )
        g["main"] = g["seasons"][0]  # earliest becomes the main banner

    # Attach human-readable labels to each season
    for g in groups:
        for s in g["seasons"]:
            s["label"] = get_season_label(g["main"], s)

    return groups


# ---------------------------------------------------------------------------
# API ROUTES
# ---------------------------------------------------------------------------

class DeleteUserRequest(BaseModel):
    user_id: str


class RecommendationRequest(BaseModel):
    anime_ids: List[int]
    limit: int = 10


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
        res = supabase.auth.admin.delete_user(request.user_id)
        return {"success": True, "message": "User permanently deleted via Backend Admin SDK."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/search")
async def search_anime(q: str = Query(..., min_length=1), limit: int = 15):
    """
    Search for anime via Jikan and return pre-grouped results.
    The frontend no longer needs to call Jikan directly or run grouping logic.
    """
    jikan_url = f"https://api.jikan.moe/v4/anime?q={q}&limit={limit}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(jikan_url)
            resp.raise_for_status()
            raw_list = resp.json().get("data", [])
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Jikan API error: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach Jikan: {e}")

    return {"data": group_results(raw_list)}


@app.get("/api/anime/{mal_id}/seasons")
async def get_anime_seasons(mal_id: int):
    """
    Given a mal_id, find all related seasons and return them grouped.
    Used by the detail modal to populate season pills.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Step 1: Get the title of the requested anime
            detail_resp = await client.get(f"https://api.jikan.moe/v4/anime/{mal_id}")
            detail_resp.raise_for_status()
            detail_data = detail_resp.json().get("data", {})
            search_title = detail_data.get("title_english") or detail_data.get("title", "")

            # Step 2: Search for related titles using that name
            search_resp = await client.get(
                f"https://api.jikan.moe/v4/anime?q={search_title}&limit=15"
            )
            search_resp.raise_for_status()
            raw_list = search_resp.json().get("data", [])

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Jikan API error: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach Jikan: {e}")

    groups = group_results(raw_list)

    # Find the group that contains the requested mal_id
    target_group = next(
        (g for g in groups if any(s["mal_id"] == mal_id for s in g["seasons"])),
        None
    )

    if not target_group or len(target_group["seasons"]) <= 1:
        return {"data": []}  # No related seasons found

    return {"data": target_group["seasons"]}


@app.post("/api/recommendations")
async def get_recommendations(request: RecommendationRequest):
    """
    Given a list of anime IDs (e.g. from a user's watchlist),
    fetches recommendations for the top 5, aggregates and ranks them.
    """
    if not request.anime_ids:
        return {"data": []}

    # Take up to 5 IDs to avoid excessive API calls
    target_ids = request.anime_ids[:5]
    all_recommendations = {}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for mal_id in target_ids:
                jikan_url = f"https://api.jikan.moe/v4/anime/{mal_id}/recommendations"
                resp = await client.get(jikan_url)
                if resp.status_code == 429:
                    break
                if resp.status_code != 200:
                    continue
                
                data = resp.json().get("data", [])
                for rec in data:
                    entry = rec.get("entry", {})
                    rec_id = entry.get("mal_id")
                    votes = rec.get("votes", 0)
                    
                    if not rec_id or rec_id in request.anime_ids:
                        continue
                        
                    if rec_id in all_recommendations:
                        all_recommendations[rec_id]["votes"] += votes
                    else:
                        all_recommendations[rec_id] = {
                            "mal_id": rec_id,
                            "title": entry.get("title", ""),
                            "image": entry.get("images", {}).get("jpg", {}).get("image_url", ""),
                            "large_image": entry.get("images", {}).get("jpg", {}).get("large_image_url", ""),
                            "votes": votes
                        }
                
                await asyncio.sleep(0.35)
                
    except Exception as e:
        print(f"Error fetching recommendations: {e}")

    sorted_recs = sorted(all_recommendations.values(), key=lambda x: x["votes"], reverse=True)
    return {"data": sorted_recs[:request.limit]}


# ---------------------------------------------------------------------------
# FRONTEND MOUNT
# This ensures that visiting localhost:8000 loads the HTML frontend.
# IMPORTANT: This must be LAST — it catches all unmatched routes.
# ---------------------------------------------------------------------------

frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "anime-watchlist")

if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    print(f"ERROR: Frontend directory not found at {frontend_dir}. Ensure 'anime-watchlist' sits adjacent to 'backend'.")

