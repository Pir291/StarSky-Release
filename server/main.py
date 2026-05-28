# server/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
from server.routes import telegram, auth, messages, friends, private_messages, users, shop, activity, tasks
from server.database import init_pool
import os, time
from collections import defaultdict

# ===== RATE LIMITING =====
_request_counts = defaultdict(list)
RATE_LIMIT = 60       # запросов
RATE_WINDOW = 60      # за 60 секунд

def is_rate_limited(ip: str) -> bool:
    now = time.time()
    _request_counts[ip] = [t for t in _request_counts[ip] if now - t < RATE_WINDOW]
    _request_counts[ip].append(now)
    return len(_request_counts[ip]) > RATE_LIMIT

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Загружаем .env если есть
    _load_env()
    init_pool()
    print("🚀 Сервер Star Sky запущен!")
    yield
    print("👋 Сервер остановлен")

def _load_env():
    """Читает .env файл и ставит переменные окружения."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    if not os.path.exists(env_path):
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

app = FastAPI(title="Star Sky API", docs_url=None, redoc_url=None)  # отключаем /docs в продакшне

# ===== CORS — только ваш домен =====
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ===== RATE LIMIT MIDDLEWARE =====
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    ip = request.client.host
    if request.url.path.startswith("/api/") and is_rate_limited(ip):
        return JSONResponse(status_code=429, content={"detail": "Слишком много запросов"})
    return await call_next(request)

# ===== XSS защита заголовки =====
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# ===== РОУТЕРЫ =====
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

@app.get("/")
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