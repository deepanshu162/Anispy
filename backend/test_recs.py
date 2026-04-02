import asyncio
from main import app
from httpx import AsyncClient

async def test():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/api/recommendations", json={"anime_ids": [21, 1535], "limit": 2})
        print(f"Status Code: {response.status_code}")
        print("Response JSON:")
        import json
        print(json.dumps(response.json(), indent=2))

asyncio.run(test())
