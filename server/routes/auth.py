from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
import hashlib
import secrets
import random
import httpx
from datetime import datetime, timedelta
import sys
import os
import uuid
import re

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from server.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])
 

# Конфигурация Google OAuth
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "your_google_client_id")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "your_google_client_secret")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")

# ===== МОДЕЛИ =====
class RegisterRequest(BaseModel):
    username: str
    login: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ResetRequestRequest(BaseModel):
    email: EmailStr

class ResetConfirmRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class GoogleAuthRequest(BaseModel):
    code: str

class CodeVerifyRequest(BaseModel):
    code: str

class CodeGenerateRequest(BaseModel):
    user_id: str

# ===== ФУНКЦИИ =====
def get_current_user(request: Request):
    """Получает текущего пользователя из токена (для Dependency Injection)"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Токен не предоставлен")
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.Id, u.Username, u.DisplayName, u.Email, u.StarColor, u.StarEffect,
                   u.ActivityScore, u.Provider, u.AvatarUrl, u.Bio, u.IsOnline
            FROM Sessions s
            JOIN Users u ON s.UserId = u.Id
            WHERE s.Token = ? AND s.ExpiresAt > GETDATE()
        """, (token,))
        
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Недействительный токен")
        
        return {
            "id": row[0],
            "username": row[1],
            "display_name": row[2],
            "email": row[3],
            "star_color": row[4] or "#ffffff",
            "star_effect": row[5],
            "activity_score": float(row[6] or 0),
            "provider": row[7],
            "avatar_url": row[8],
            "bio": row[9] or "",
            "is_online": row[10] == 1
        }
    
def hash_password(password: str) -> str:
    """SHA-256 хэширование пароля"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hash_value: str) -> bool:
    """Проверка пароля"""
    return hash_password(password) == hash_value

def generate_reset_code() -> str:
    """Генерация 6-значного кода"""
    return ''.join([str(random.randint(0, 9)) for _ in range(6)])

def generate_token() -> str:
    """Генерация токена сессии"""
    return secrets.token_hex(32)

def generate_id() -> str:
    """Генерация UUID для записей"""
    return str(uuid.uuid4())

def generate_auth_code() -> str:
    """Генерация 6-значного кода для входа"""
    return ''.join(random.choices('0123456789', k=6))

# ===== ВАЛИДАЦИЯ =====
def validate_username(username: str) -> tuple[bool, str]:
    if len(username) < 2 or len(username) > 50:
        return False, "Имя должно быть от 2 до 50 символов"
    return True, ""

def validate_login(login: str) -> tuple[bool, str]:
    if len(login) < 3 or len(login) > 30:
        return False, "Юзернейм должен быть от 3 до 30 символов"
    if not re.match(r'^[a-zA-Z][a-zA-Z0-9_]*$', login):
        return False, "Юзернейм: латиница, цифры, _, начинается с буквы"
    if login.lower() in ['admin', 'root', 'user', 'test', 'demo', 'system']:
        return False, "Этот юзернейм зарезервирован"
    return True, ""

def validate_password(password: str) -> tuple[bool, str]:
    if len(password) < 6:
        return False, "Пароль должен быть не короче 6 символов"
    if not re.search(r'[A-Za-z]', password):
        return False, "Пароль должен содержать хотя бы одну букву"
    if not re.search(r'[0-9]', password):
        return False, "Пароль должен содержать хотя бы одну цифру"
    return True, ""

# ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
def create_session(user_id: str, token: str, conn) -> str:
    """Создаёт сессию в SQL Server"""
    cursor = conn.cursor()
    
    # Удаляем старые сессии
    cursor.execute("DELETE FROM Sessions WHERE UserId = ?", (user_id,))
    
    # Создаём новую сессию
    session_id = generate_id()
    cursor.execute("""
        INSERT INTO Sessions (Id, UserId, Token, ExpiresAt, CreatedAt)
        VALUES (?, ?, ?, DATEADD(DAY, 30, GETDATE()), GETDATE())
    """, (session_id, user_id, token))
    
    return token

def get_user_by_email(email: str, conn):
    """Получает пользователя по email"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT Id, Username, DisplayName, Email, StarColor, StarEffect, 
               ActivityScore, Provider, AvatarUrl, Bio, PasswordHash
        FROM Users WHERE Email = ?
    """, (email,))
    row = cursor.fetchone()
    if not row:
        return None
    return {
        "id": str(row[0]),
        "username": row[1],
        "display_name": row[2],
        "email": row[3],
        "star_color": row[4] or "#ffffff",
        "star_effect": row[5],
        "activity_score": float(row[6] or 0),
        "provider": row[7],
        "avatar_url": row[8],
        "bio": row[9] or "",
        "password_hash": row[10]
    }

def get_user_by_id(user_id: str, conn):
    """Получает пользователя по ID"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT Id, Username, DisplayName, Email, StarColor, StarEffect, 
               ActivityScore, Provider, AvatarUrl, Bio
        FROM Users WHERE Id = ?
    """, (user_id,))
    row = cursor.fetchone()
    if not row:
        return None
    return {
        "id": str(row[0]),
        "username": row[1],
        "display_name": row[2],
        "email": row[3],
        "star_color": row[4] or "#ffffff",
        "star_effect": row[5],
        "activity_score": float(row[6] or 0),
        "provider": row[7],
        "avatar_url": row[8],
        "bio": row[9] or ""
    }

# ===== ГЕНЕРАЦИЯ КОДА ДЛЯ ВХОДА =====
@router.post("/generate-code")
async def generate_auth_code(request: CodeGenerateRequest):
    """Генерирует 6-значный код для входа"""
    user_id = request.user_id
    
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id обязателен")
    
    code = generate_auth_code()
    code_id = generate_id()
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Проверяем существование пользователя
            user = get_user_by_id(user_id, conn)
            if not user:
                raise HTTPException(status_code=404, detail="Пользователь не найден")
            
            # Удаляем старые неиспользованные коды этого пользователя
            cursor.execute("DELETE FROM AuthCodes WHERE UserId = ? AND IsUsed = 0", (user_id,))
            
            # Сохраняем новый код
            cursor.execute("""
                INSERT INTO AuthCodes (Id, Code, UserId, ExpiresAt, IsUsed, CreatedAt)
                VALUES (?, ?, ?, DATEADD(MINUTE, 5, GETDATE()), 0, GETDATE())
            """, (code_id, code, user_id))
            
            conn.commit()
        
        print(f"🔐 Сгенерирован код {code} для пользователя {user['display_name']}")
        
        return {
            "success": True, 
            "code": code, 
            "expires_in": 300, 
            "user_id": user_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка генерации кода: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ПРОВЕРКА КОДА И ВХОД =====
@router.post("/verify-code")
async def verify_auth_code(request: CodeVerifyRequest):
    """Проверяет код и возвращает токен доступа"""
    code = request.code
    
    if not code:
        raise HTTPException(status_code=400, detail="Код обязателен")
    
    if len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="Код должен состоять из 6 цифр")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Ищем код (SQL Server синтаксис)
            cursor.execute("""
                SELECT ac.UserId, ac.ExpiresAt, ac.IsUsed, u.Username, u.DisplayName,
                       u.StarColor, u.ActivityScore
                FROM AuthCodes ac
                JOIN Users u ON ac.UserId = u.Id
                WHERE ac.Code = ? AND ac.IsUsed = 0 AND ac.ExpiresAt > GETDATE()
            """, (code,))
            
            row = cursor.fetchone()
            
            if not row:
                return {"success": False, "message": "Неверный или просроченный код"}
            
            user_id, expires_at, is_used, username, display_name, star_color, activity_score = row
            
            # Помечаем код как использованный
            cursor.execute("UPDATE AuthCodes SET IsUsed = 1 WHERE Code = ?", (code,))
            
            # Генерируем токен
            token = generate_token()
            create_session(user_id, token, conn)
            
            # Обновляем статус онлайн
            cursor.execute("""
                UPDATE Users SET IsOnline = 1, UpdatedAt = GETDATE()
                WHERE Id = ?
            """, (user_id,))
            
            conn.commit()
            
            print(f"✅ Успешный вход по коду: {display_name}")
            
            return {
                "success": True,
                "token": token,
                "user": {
                    "id": user_id,
                    "username": username,
                    "display_name": display_name,
                    "star_color": star_color or "#ffffff",
                    "activity_score": float(activity_score or 0),
                    "provider": "telegram"
                }
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка проверки кода: {e}")
        return {"success": False, "message": str(e)}

# ===== РЕГИСТРАЦИЯ =====
@router.post("/register")
async def email_register(request: RegisterRequest):
    print(f"📝 Регистрация: {request.email}")
    
    # Валидация
    valid, msg = validate_username(request.username)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    
    valid, msg = validate_login(request.login)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    
    valid, msg = validate_password(request.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Проверяем email
            cursor.execute("SELECT Id FROM Users WHERE Email = ?", (request.email,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
            
            # Проверяем юзернейм
            cursor.execute("SELECT Id FROM Users WHERE Username = ?", (request.login,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Юзернейм уже занят")
            
            # Создаём пользователя
            user_id = generate_id()
            password_hash = hash_password(request.password)
            cursor.execute("""
                INSERT INTO Users (Id, Email, Username, DisplayName, PasswordHash, Provider, 
                                   StarColor, ActivityScore, CreatedAt, UpdatedAt)
                VALUES (?, ?, ?, ?, ?, 'email', '#ffffff', 0, GETDATE(), GETDATE())
            """, (user_id, request.email, request.login, request.username, password_hash))
            
            conn.commit()
            
            # Генерируем токен
            token = generate_token()
            create_session(user_id, token, conn)
            conn.commit()
            
            print(f"✅ Пользователь {request.username} зарегистрирован")
            
            return {
                "success": True,
                "message": "Регистрация успешна",
                "token": token,
                "user": {
                    "id": user_id,
                    "username": request.login,
                    "display_name": request.username,
                    "email": request.email,
                    "star_color": "#ffffff",
                    "activity_score": 0,
                    "provider": "email"
                }
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка регистрации: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ВХОД ПО EMAIL =====
@router.post("/login")
async def email_login(request: LoginRequest):
    print(f"🔐 Вход: {request.email}")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            user = get_user_by_email(request.email, conn)
            if not user:
                raise HTTPException(status_code=401, detail="Неверный email или пароль")
            
            if user["provider"] != "email":
                raise HTTPException(status_code=401, detail=f"Используйте вход через {user['provider']}")
            
            # Проверяем пароль
            if not user.get("password_hash") or not verify_password(request.password, user["password_hash"]):
                raise HTTPException(status_code=401, detail="Неверный email или пароль")
            
            # Генерируем токен
            token = generate_token()
            create_session(user["id"], token, conn)
            
            cursor.execute("""
                UPDATE Users SET IsOnline = 1, UpdatedAt = GETDATE()
                WHERE Id = ?
            """, (user["id"],))
            conn.commit()
            
            print(f"✅ Успешный вход: {user['display_name']}")
            
            return {
                "success": True,
                "token": token,
                "user": {
                    "id": user["id"],
                    "username": user["username"],
                    "display_name": user["display_name"],
                    "email": user["email"],
                    "star_color": user["star_color"],
                    "activity_score": user["activity_score"],
                    "provider": user["provider"],
                    "avatar_url": user.get("avatar_url"),
                    "bio": user.get("bio", "")
                }
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка входа: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ВХОД ЧЕРЕЗ GOOGLE =====
@router.post("/google")
async def google_auth(request: GoogleAuthRequest):
    """Обмен кода Google на токен и вход/регистрация"""
    print(f"🔐 Google OAuth: получен код")
    
    try:
        # Обмениваем код на токен доступа
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": request.code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code"
                }
            )
            
            if token_response.status_code != 200:
                print(f"❌ Ошибка получения токена: {token_response.text}")
                raise HTTPException(status_code=400, detail="Невалидный код Google")
            
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            if not access_token:
                raise HTTPException(status_code=400, detail="Не удалось получить access_token")
            
            # Получаем информацию о пользователе
            user_info_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if user_info_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Не удалось получить данные пользователя")
            
            google_user = user_info_response.json()
            google_id = google_user.get("id")
            email = google_user.get("email")
            name = google_user.get("name", email.split("@")[0] if email else "User")
            avatar_url = google_user.get("picture")
            
            print(f"📧 Google пользователь: {email} ({google_id})")
            
            with get_db() as conn:
                cursor = conn.cursor()
                
                # Ищем пользователя по GoogleId
                cursor.execute("SELECT Id, Username, DisplayName FROM Users WHERE GoogleId = ?", (google_id,))
                row = cursor.fetchone()
                
                if not row and email:
                    # Ищем по email
                    cursor.execute("SELECT Id, Username, DisplayName FROM Users WHERE Email = ?", (email,))
                    row = cursor.fetchone()
                
                if row:
                    # Пользователь существует
                    user_id = row[0]
                    username = row[1]
                    display_name = row[2]
                    
                    # Обновляем GoogleId и аватар, если их не было
                    cursor.execute("""
                        UPDATE Users SET GoogleId = ?, AvatarUrl = COALESCE(?, AvatarUrl), 
                               UpdatedAt = GETDATE()
                        WHERE Id = ?
                    """, (google_id, avatar_url, user_id))
                    
                    print(f"✅ Вход через Google: {display_name}")
                    
                else:
                    # Создаём нового пользователя
                    user_id = generate_id()
                    # Генерируем уникальный username
                    base_username = re.sub(r'[^a-zA-Z0-9_]', '', email.split("@")[0]) if email else f"user_{random.randint(1000, 9999)}"
                    username = base_username
                    counter = 1
                    while True:
                        cursor.execute("SELECT Id FROM Users WHERE Username = ?", (username,))
                        if not cursor.fetchone():
                            break
                        username = f"{base_username}{counter}"
                        counter += 1
                    
                    cursor.execute("""
                        INSERT INTO Users (Id, GoogleId, Email, Username, DisplayName, AvatarUrl, 
                                           Provider, StarColor, ActivityScore, CreatedAt, UpdatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, 'google', '#ffffff', 0, GETDATE(), GETDATE())
                    """, (user_id, google_id, email, username, name, avatar_url))
                    
                    print(f"✅ Новый пользователь через Google: {username}")
                
                # Создаём сессию
                token = generate_token()
                create_session(user_id, token, conn)
                
                cursor.execute("""
                    UPDATE Users SET IsOnline = 1, UpdatedAt = GETDATE()
                    WHERE Id = ?
                """, (user_id,))
                conn.commit()
                
                # Получаем полные данные пользователя
                user_data = get_user_by_id(user_id, conn)
                
                return {
                    "success": True,
                    "token": token,
                    "user": user_data
                }
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка Google OAuth: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/google/url")
async def get_google_auth_url():
    """Возвращает URL для редиректа на Google OAuth"""
    import urllib.parse
    
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "email profile",
        "access_type": "offline",
        "prompt": "consent"
    }
    
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return {"url": url}

# ===== ЗАПРОС СБРОСА ПАРОЛЯ =====
@router.post("/reset/request")
async def reset_request(request: ResetRequestRequest):
    print(f"📧 Запрос сброса пароля: {request.email}")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Проверяем существование пользователя
            cursor.execute("SELECT Id FROM Users WHERE Email = ? AND Provider = 'email'", (request.email,))
            row = cursor.fetchone()
            if not row:
                # Для безопасности не сообщаем, существует email или нет
                return {
                    "success": True,
                    "message": "Если email зарегистрирован, код отправлен",
                    "demo_code": None
                }
            
            # Генерируем код
            code = generate_reset_code()
            
            cursor.execute("""
                UPDATE Users SET ResetCode = ?, ResetCodeExpires = DATEADD(MINUTE, 10, GETDATE()), UpdatedAt = GETDATE()
                WHERE Id = ?
            """, (code, row[0]))
            conn.commit()
            
            print(f"✅ Код сброса для {request.email}: {code}")
            
            return {
                "success": True,
                "message": "Код отправлен на email",
                "demo_code": code
            }
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ПОДТВЕРЖДЕНИЕ СБРОСА =====
@router.post("/reset/confirm")
async def reset_confirm(request: ResetConfirmRequest):
    print(f"🔐 Подтверждение сброса для: {request.email}")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Проверяем код
            cursor.execute("""
                SELECT Id FROM Users 
                WHERE Email = ? AND ResetCode = ? AND ResetCodeExpires > GETDATE()
            """, (request.email, request.code))
            
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=400, detail="Неверный или просроченный код")
            
            # Проверяем новый пароль
            valid, msg = validate_password(request.new_password)
            if not valid:
                raise HTTPException(status_code=400, detail=msg)
            
            # Обновляем пароль
            new_hash = hash_password(request.new_password)
            cursor.execute("""
                UPDATE Users 
                SET PasswordHash = ?, ResetCode = NULL, ResetCodeExpires = NULL, UpdatedAt = GETDATE()
                WHERE Id = ?
            """, (new_hash, row[0]))
            conn.commit()
            
            print(f"✅ Пароль изменён для {request.email}")
            
            return {"success": True, "message": "Пароль успешно изменён"}
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ВЫХОД =====
@router.post("/logout")
async def logout(request: Request):
    """Выход из аккаунта (удаление сессии)"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    
    if not token:
        raise HTTPException(status_code=401, detail="Токен не предоставлен")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Получаем user_id по токену
            cursor.execute("SELECT UserId FROM Sessions WHERE Token = ?", (token,))
            row = cursor.fetchone()
            
            if row:
                # Удаляем сессию
                cursor.execute("DELETE FROM Sessions WHERE Token = ?", (token,))
                
                # Обновляем статус пользователя
                cursor.execute("""
                    UPDATE Users SET IsOnline = 0, UpdatedAt = GETDATE()
                    WHERE Id = ?
                """, (row[0],))
                conn.commit()
            
            return {"success": True, "message": "Выход выполнен"}
            
    except Exception as e:
        print(f"❌ Ошибка выхода: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ПРОВЕРКА ТОКЕНА =====
@router.get("/verify")
async def verify_token(request: Request):
    """Проверка валидности токена"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    
    if not token:
        return {"valid": False, "message": "Токен не предоставлен"}
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.Id, u.Username, u.DisplayName, u.Email, u.StarColor, u.StarEffect,
                       u.ActivityScore, u.Provider, u.AvatarUrl, u.Bio
                FROM Sessions s
                JOIN Users u ON s.UserId = u.Id
                WHERE s.Token = ? AND s.ExpiresAt > GETDATE()
            """, (token,))
            
            row = cursor.fetchone()
            if not row:
                return {"valid": False, "message": "Сессия истекла или не найдена"}
            
            return {
                "valid": True,
                "user": {
                    "id": str(row[0]),
                    "username": row[1],
                    "display_name": row[2],
                    "email": row[3],
                    "star_color": row[4] or "#ffffff",
                    "star_effect": row[5],
                    "activity_score": float(row[6] or 0),
                    "provider": row[7],
                    "avatar_url": row[8],
                    "bio": row[9] or ""
                }
            }
            
    except Exception as e:
        print(f"❌ Ошибка проверки: {e}")
        return {"valid": False, "message": str(e)}

# ===== ПРОФИЛЬ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ =====
@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Возвращает профиль текущего авторизованного пользователя"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT Id, Username, DisplayName, Email, StarColor, StarEffect,
                       ActivityScore, MessagesCount, DaysActive, FriendsCount,
                       AvatarUrl, Bio, IsOnline, Provider
                FROM Users WHERE Id = ?
            """, (current_user["id"],))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Пользователь не найден")
            return {
                "success": True,
                "user": {
                    "id": str(row[0]),
                    "username": row[1],
                    "display_name": row[2],
                    "email": row[3],
                    "star_color": row[4] or "#ffffff",
                    "star_effect": row[5],
                    "activity_score": float(row[6] or 0),
                    "messages_count": row[7] or 0,
                    "days_active": row[8] or 0,
                    "friends_count": row[9] or 0,
                    "avatar_url": row[10],
                    "bio": row[11] or "",
                    "is_online": row[12] == 1,
                    "provider": row[13]
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== СПИСОК ВСЕХ ПОЛЬЗОВАТЕЛЕЙ (для карты звёзд) =====
@router.get("/users")
async def get_all_users(current_user: dict = Depends(get_current_user)):
    """Возвращает список всех пользователей для отображения на карте"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT Id, Username, DisplayName, StarColor, StarEffect,
                       ActivityScore, MessagesCount, DaysActive, FriendsCount,
                       IsOnline, Bio, AvatarUrl
                FROM Users
                ORDER BY ActivityScore DESC
            """)
            users = []
            for row in cursor.fetchall():
                users.append({
                    "id": str(row[0]),
                    "username": row[1],
                    "display_name": row[2],
                    "star_color": row[3] or "#ffffff",
                    "star_effect": row[4],
                    "activity_score": float(row[5] or 0),
                    "messages_count": row[6] or 0,
                    "days_active": row[7] or 0,
                    "friends_count": row[8] or 0,
                    "is_online": row[9] == 1,
                    "bio": row[10] or "",
                    "avatar_url": row[11]
                })
            return {"success": True, "users": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== ОБНОВЛЕНИЕ ПРОФИЛЯ =====
@router.patch("/profile")
async def update_profile(request: Request, current_user: dict = Depends(get_current_user)):
    """Обновляет профиль пользователя: bio, star_color, star_effect"""
    try:
        data = await request.json()
        allowed = {}
        if "bio" in data:
            allowed["Bio"] = str(data["bio"])[:500]
        if "star_color" in data:
            c = str(data["star_color"])
            if c.startswith("#") and len(c) in (4, 7):
                allowed["StarColor"] = c
        if "star_effect" in data:
            allowed["StarEffect"] = str(data["star_effect"]) if data["star_effect"] else None

        if not allowed:
            return {"success": False, "message": "Нет данных для обновления"}

        set_clause = ", ".join(f"{k} = ?" for k in allowed.keys())
        values = list(allowed.values()) + [current_user["id"]]

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"UPDATE Users SET {set_clause}, UpdatedAt = GETDATE() WHERE Id = ?",
                values
            )
            conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))