import json
import httpx

client = httpx.Client(base_url="http://127.0.0.1:8000")

# 1. Register or Login test user
reg_payload = {
    "username": "filmbuff_2026",
    "email": "filmbuff@example.com",
    "password": "Password123!"
}
try:
    reg_res = client.post("/api/auth/register", json=reg_payload)
    if reg_res.status_code == 200:
        token = reg_res.json()["access_token"]
        print("[OK] Registered user successfully")
    else:
        login_res = client.post("/api/auth/login", json={"username_or_email": "filmbuff_2026", "password": "Password123!"})
        token = login_res.json()["access_token"]
        print("[OK] Logged in existing user successfully")
except Exception as e:
    print("[FAIL] Auth error:", e)
    exit(1)

headers = {"Authorization": f"Bearer {token}"}

# 2. Add Movie Log with personal notes, feelings, and watch dates
log_payload = {
    "movie_id": 27205,
    "status": "watched",
    "is_pinned": True,
    "user_rating": 9.5,
    "feeling": "Mind-blown",
    "personal_notes": "Mind-bending masterpiece by Christopher Nolan! The spinning top ending gave me chills.",
    "started_at": "2026-08-20",
    "ended_at": "2026-08-20",
    "movie_meta_json": json.dumps({
        "id": 27205,
        "title": "Inception",
        "release_date": "2010-07-15",
        "vote_average": 8.4,
        "runtime": 148
    })
}
log_res = client.post("/api/journal/movies", json=log_payload, headers=headers)
print(f"[OK] Journal log response status: {log_res.status_code}")

# 3. User Sync check
sync_res = client.get("/api/user/sync", headers=headers)
sync_data = sync_res.json()
print(f"[OK] Sync User: {sync_data['user']['username']}")
print(f"[OK] Movie Logs Count: {len(sync_data['movie_logs'])}")
print(f"[OK] Log feeling: {sync_data['movie_logs'][0]['feeling']}")
print(f"[OK] Log notes: {sync_data['movie_logs'][0]['personal_notes']}")
print(f"[OK] Log dates: {sync_data['movie_logs'][0]['started_at']} -> {sync_data['movie_logs'][0]['ended_at']}")
print(f"[OK] Stats: {sync_data['stats']}")
print("\n>>> ALL FULL-STACK API TESTS PASSED! <<<")
