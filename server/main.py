# server/main.py — FIX #5: раздельный rate-limit для polling-эндпоинтов
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response
from contextlib import asynccontextmanager
from server.routes import telegram, auth, messages, friends, private_messages, users, shop, activity, tasks
from server.database import init_pool
import os, time
from collections import defaultdict

# Обычный лимит: 120 запросов/мин для большинства эндпоинтов
RATE_LIMIT = 120
RATE_WINDOW = 60

# Мягкий лимит для polling-эндпоинтов (чат + онлайн): 240/мин ≈ 4/сек
POLL_RATE_LIMIT = 240
POLL_PATHS = {"/api/messages/get", "/api/users/online", "/api/users/list"}

_request_counts: dict = defaultdict(list)
_poll_counts: dict = defaultdict(list)

def _is_limited(store: dict, key: str, limit: int, window: int) -> bool:
    now = time.time()
    store[key] = [t for t in store[key] if now - t < window]
    store[key].append(now)
    return len(store[key]) > limit

@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_env()
    init_pool()
    print("🚀 Сервер Star Sky запущен!")
    yield
    print("👋 Сервер остановлен")

def _load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    if not os.path.exists(env_path):
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

app = FastAPI(title="Star Sky API", lifespan=lifespan, docs_url=None, redoc_url=None)

ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if not request.url.path.startswith("/api/"):
        return await call_next(request)

    ip = request.client.host
    path = request.url.path

    if path in POLL_PATHS:
        # Мягкий лимит для polling-эндпоинтов
        if _is_limited(_poll_counts, ip, POLL_RATE_LIMIT, RATE_WINDOW):
            return JSONResponse(status_code=429, content={"detail": "Слишком много запросов"})
    else:
        if _is_limited(_request_counts, ip, RATE_LIMIT, RATE_WINDOW):
            return JSONResponse(status_code=429, content={"detail": "Слишком много запросов"})

    return await call_next(request)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

app.include_router(telegram.router)
app.include_router(auth.router)
app.include_router(messages.router)
app.include_router(friends.router)
app.include_router(private_messages.router)
app.include_router(users.router)
app.include_router(shop.router)
app.include_router(activity.router)
app.include_router(tasks.router)

static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    return Response(status_code=200)

@app.api_route("/", methods=["GET", "HEAD"])
async def serve_index():
    return FileResponse(os.path.join(static_dir, "index.html"))

@app.get("/auth")
@app.get("/auth.html")
async def serve_auth():
    return FileResponse(os.path.join(static_dir, "auth.html"))

@app.get("/styles.css")
async def serve_css():
    return FileResponse(os.path.join(static_dir, "styles.css"), media_type="text/css")

@app.get("/script.js")
async def serve_js():
    return FileResponse(os.path.join(static_dir, "script.js"), media_type="application/javascript")

@app.get("/patchnotes.json")
async def serve_patchnotes():
    return FileResponse(os.path.join(static_dir, "patchnotes.json"), media_type="application/json")

@app.get("/IconStarSky.ico")
async def serve_favicon():
    return FileResponse(os.path.join(static_dir, "IconStarSky.ico"), media_type="image/x-icon")

@app.get("/robots.txt")
async def robots():
    return FileResponse(os.path.join(static_dir, "robots.txt"), media_type="text/plain")
