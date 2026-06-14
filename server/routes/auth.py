# server/routes/auth.py  (MySQL версия)
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, EmailStr
import hashlib, secrets, random, uuid, re, sys, os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from server.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ===== УТИЛИТЫ =====
def hash_password(p): return hashlib.sha256(p.encode()).hexdigest()
def verify_password(p, h): return hash_password(p) == h
def generate_token(): return secrets.token_hex(32)
def generate_id(): return str(uuid.uuid4())
def generate_code(): return ''.join(random.choices('0123456789', k=6))

def validate_username(u):
    if len(u) < 2 or len(u) > 50: return False, "Имя: 2–50 символов"
    return True, ""

def validate_login(l):
    if len(l) < 3 or len(l) > 30: return False, "Юзернейм: 3–30 символов"
    if not re.match(r'^[a-zA-Z][a-zA-Z0-9_]*$', l): return False, "Юзернейм: латиница, цифры, _"
    if l.lower() in ['admin','root','user','test','demo','system']: return False, "Юзернейм зарезервирован"
    return True, ""

def validate_password(p):
    if len(p) < 6: return False, "Пароль: минимум 6 символов"
    if not re.search(r'[A-Za-z]', p): return False, "Пароль должен содержать букву"
    if not re.search(r'[0-9]', p): return False, "Пароль должен содержать цифру"
    return True, ""

def create_session(user_id, token, conn):
    c = conn.cursor()
    c.execute("DELETE FROM Sessions WHERE UserId = %s", (user_id,))
    c.execute("""
        INSERT INTO Sessions (Id, UserId, Token, ExpiresAt, CreatedAt)
        VALUES (%s, %s, %s, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW())
    """, (generate_id(), user_id, token))

def get_user_by_email(email, conn):
    c = conn.cursor()
    c.execute("""
        SELECT Id, Username, DisplayName, Email, StarColor, StarEffect,
               ActivityScore, Provider, AvatarUrl, Bio, PasswordHash
        FROM Users WHERE Email = %s
    """, (email,))
    row = c.fetchone()
    if not row: return None
    return {"id": str(row[0]), "username": row[1], "display_name": row[2],
            "email": row[3], "star_color": row[4] or "#ffffff", "star_effect": row[5],
            "activity_score": float(row[6] or 0), "provider": row[7],
            "avatar_url": row[8], "bio": row[9] or "", "password_hash": row[10]}

def get_user_by_id(user_id, conn):
    c = conn.cursor()
    c.execute("""
        SELECT Id, Username, DisplayName, Email, StarColor, StarEffect,
               ActivityScore, Provider, AvatarUrl, Bio
        FROM Users WHERE Id = %s
    """, (user_id,))
    row = c.fetchone()
    if not row: return None
    return {"id": str(row[0]), "username": row[1], "display_name": row[2],
            "email": row[3], "star_color": row[4] or "#ffffff", "star_effect": row[5],
            "activity_score": float(row[6] or 0), "provider": row[7],
            "avatar_url": row[8], "bio": row[9] or ""}

def get_current_user(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token: raise HTTPException(status_code=401, detail="Токен не предоставлен")
    with get_db() as conn:
        c = conn.cursor()
        c.execute("""
            SELECT u.Id, u.Username, u.DisplayName, u.Email, u.StarColor, u.StarEffect,
                   u.ActivityScore, u.Provider, u.AvatarUrl, u.Bio, u.IsOnline
            FROM Sessions s JOIN Users u ON s.UserId = u.Id
            WHERE s.Token = %s AND s.ExpiresAt > NOW()
        """, (token,))
        row = c.fetchone()
        if not row: raise HTTPException(status_code=401, detail="Недействительный токен")
        return {"id": row[0], "username": row[1], "display_name": row[2],
                "email": row[3], "star_color": row[4] or "#ffffff", "star_effect": row[5],
                "activity_score": float(row[6] or 0), "provider": row[7],
                "avatar_url": row[8], "bio": row[9] or "", "is_online": row[10] == 1}

# ===== МОДЕЛИ =====
class RegisterRequest(BaseModel):
    username: str; login: str; email: EmailStr; password: str

class LoginRequest(BaseModel):
    email: EmailStr; password: str

class ResetRequestModel(BaseModel):
    email: EmailStr

class ResetConfirmModel(BaseModel):
    email: EmailStr; code: str; new_password: str

class CodeVerifyRequest(BaseModel):
    code: str

class CodeGenerateRequest(BaseModel):
    user_id: str

# ===== ЭНДПОИНТЫ =====

@router.post("/generate-code")
async def generate_auth_code_ep(request: CodeGenerateRequest):
    code = generate_code()
    try:
        with get_db() as conn:
            c = conn.cursor()
            user = get_user_by_id(request.user_id, conn)
            if not user: raise HTTPException(status_code=404, detail="Пользователь не найден")
            c.execute("DELETE FROM AuthCodes WHERE UserId = %s AND IsUsed = 0", (request.user_id,))
            c.execute("""
                INSERT INTO AuthCodes (Id, Code, UserId, ExpiresAt, IsUsed, CreatedAt)
                VALUES (%s, %s, %s, DATE_ADD(NOW(), INTERVAL 5 MINUTE), 0, NOW())
            """, (generate_id(), code, request.user_id))
            conn.commit()
        return {"success": True, "code": code, "expires_in": 300, "user_id": request.user_id}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify-code")
async def verify_auth_code(request: CodeVerifyRequest):
    if not request.code or len(request.code) != 6 or not request.code.isdigit():
        raise HTTPException(status_code=400, detail="Код: 6 цифр")
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("""
                SELECT ac.UserId, u.Username, u.DisplayName, u.StarColor, u.ActivityScore
                FROM AuthCodes ac JOIN Users u ON ac.UserId = u.Id
                WHERE ac.Code = %s AND ac.IsUsed = 0 AND ac.ExpiresAt > NOW()
            """, (request.code,))
            row = c.fetchone()
            if not row: return {"success": False, "message": "Неверный или просроченный код"}
            user_id, username, display_name, star_color, activity_score = row
            c.execute("UPDATE AuthCodes SET IsUsed = 1 WHERE Code = %s", (request.code,))
            token = generate_token()
            create_session(user_id, token, conn)
            c.execute("UPDATE Users SET IsOnline = 1, UpdatedAt = NOW() WHERE Id = %s", (user_id,))
            conn.commit()
            return {"success": True, "token": token, "user": {
                "id": user_id, "username": username, "display_name": display_name,
                "star_color": star_color or "#ffffff",
                "activity_score": float(activity_score or 0), "provider": "telegram"
            }}
    except HTTPException: raise
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.post("/register")
async def email_register(request: RegisterRequest):
    valid, msg = validate_username(request.username)
    if not valid: raise HTTPException(status_code=400, detail=msg)
    valid, msg = validate_login(request.login)
    if not valid: raise HTTPException(status_code=400, detail=msg)
    valid, msg = validate_password(request.password)
    if not valid: raise HTTPException(status_code=400, detail=msg)
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT Id FROM Users WHERE Email = %s", (request.email,))
            if c.fetchone(): raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
            c.execute("SELECT Id FROM Users WHERE Username = %s", (request.login,))
            if c.fetchone(): raise HTTPException(status_code=400, detail="Юзернейм уже занят")
            user_id = generate_id()
            c.execute("""
                INSERT INTO Users (Id, Email, Username, DisplayName, PasswordHash, Provider,
                                   StarColor, ActivityScore, CreatedAt, UpdatedAt)
                VALUES (%s, %s, %s, %s, %s, 'email', '#ffffff', 0, NOW(), NOW())
            """, (user_id, request.email, request.login, request.username, hash_password(request.password)))
            token = generate_token()
            create_session(user_id, token, conn)
            conn.commit()
            return {"success": True, "token": token, "user": {
                "id": user_id, "username": request.login, "display_name": request.username,
                "email": request.email, "star_color": "#ffffff",
                "activity_score": 0, "provider": "email"
            }}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login")
async def email_login(request: LoginRequest):
    try:
        with get_db() as conn:
            user = get_user_by_email(request.email, conn)
            if not user: raise HTTPException(status_code=401, detail="Неверный email или пароль")
            if user["provider"] != "email":
                raise HTTPException(status_code=401, detail=f"Используйте вход через {user['provider']}")
            if not user.get("password_hash") or not verify_password(request.password, user["password_hash"]):
                raise HTTPException(status_code=401, detail="Неверный email или пароль")
            token = generate_token()
            create_session(user["id"], token, conn)
            conn.cursor().execute("UPDATE Users SET IsOnline=1, UpdatedAt=NOW() WHERE Id=%s", (user["id"],))
            conn.commit()
            return {"success": True, "token": token, "user": {
                "id": user["id"], "username": user["username"], "display_name": user["display_name"],
                "email": user["email"], "star_color": user["star_color"],
                "activity_score": user["activity_score"], "provider": user["provider"],
                "avatar_url": user.get("avatar_url"), "bio": user.get("bio", "")
            }}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset/request")
async def reset_request(request: ResetRequestModel):
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT Id FROM Users WHERE Email = %s AND Provider = 'email'", (request.email,))
            row = c.fetchone()
            if not row:
                return {"success": True, "message": "Если email зарегистрирован, код отправлен"}
            code = generate_code()
            c.execute("DELETE FROM AuthCodes WHERE UserId = %s AND IsUsed = 0", (row[0],))
            c.execute("""
                INSERT INTO AuthCodes (Id, Code, UserId, ExpiresAt, IsUsed, CreatedAt)
                VALUES (%s, %s, %s, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0, NOW())
            """, (generate_id(), code, row[0]))
            conn.commit()
            print(f"✅ Код сброса для {request.email}: {code}")
            return {"success": True, "message": "Код отправлен", "demo_code": code}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset/confirm")
async def reset_confirm(request: ResetConfirmModel):
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("""
                SELECT ac.Id, ac.UserId FROM AuthCodes ac
                JOIN Users u ON ac.UserId = u.Id
                WHERE u.Email = %s AND ac.Code = %s AND ac.IsUsed = 0 AND ac.ExpiresAt > NOW()
            """, (request.email, request.code))
            row = c.fetchone()
            if not row: raise HTTPException(status_code=400, detail="Неверный или просроченный код")
            valid, msg = validate_password(request.new_password)
            if not valid: raise HTTPException(status_code=400, detail=msg)
            c.execute("UPDATE AuthCodes SET IsUsed = 1 WHERE Id = %s", (row[0],))
            c.execute("UPDATE Users SET PasswordHash = %s, UpdatedAt = NOW() WHERE Id = %s",
                      (hash_password(request.new_password), row[1]))
            conn.commit()
            return {"success": True, "message": "Пароль изменён"}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/logout")
async def logout(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token: raise HTTPException(status_code=401, detail="Токен не предоставлен")
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT UserId FROM Sessions WHERE Token = %s", (token,))
            row = c.fetchone()
            if row:
                c.execute("DELETE FROM Sessions WHERE Token = %s", (token,))
                c.execute("UPDATE Users SET IsOnline=0, UpdatedAt=NOW() WHERE Id=%s", (row[0],))
                conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verify")
async def verify_token(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token: return {"valid": False}
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("""
                SELECT u.Id, u.Username, u.DisplayName, u.Email, u.StarColor, u.StarEffect,
                       u.ActivityScore, u.Provider, u.AvatarUrl, u.Bio
                FROM Sessions s JOIN Users u ON s.UserId = u.Id
                WHERE s.Token = %s AND s.ExpiresAt > NOW()
            """, (token,))
            row = c.fetchone()
            if not row: return {"valid": False}
            return {"valid": True, "user": {
                "id": str(row[0]), "username": row[1], "display_name": row[2],
                "email": row[3], "star_color": row[4] or "#ffffff", "star_effect": row[5],
                "activity_score": float(row[6] or 0), "provider": row[7],
                "avatar_url": row[8], "bio": row[9] or ""
            }}
    except Exception as e:
        return {"valid": False}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("""
                SELECT Id, Username, DisplayName, Email, StarColor, StarEffect,
                       ActivityScore, MessagesCount, DaysActive, FriendsCount,
                       AvatarUrl, Bio, IsOnline, Provider
                FROM Users WHERE Id = %s
            """, (current_user["id"],))
            row = c.fetchone()
            if not row: raise HTTPException(status_code=404, detail="Не найден")
            return {"success": True, "user": {
                "id": str(row[0]), "username": row[1], "display_name": row[2],
                "email": row[3], "star_color": row[4] or "#ffffff", "star_effect": row[5],
                "activity_score": float(row[6] or 0), "messages_count": row[7] or 0,
                "days_active": row[8] or 0, "friends_count": row[9] or 0,
                "avatar_url": row[10], "bio": row[11] or "",
                "is_online": row[12] == 1, "provider": row[13]
            }}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users")
async def get_all_users(current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("""
                SELECT Id, Username, DisplayName, StarColor, StarEffect,
                       ActivityScore, MessagesCount, DaysActive, FriendsCount,
                       IsOnline, Bio, AvatarUrl
                FROM Users ORDER BY ActivityScore DESC
            """)
            return {"success": True, "users": [{
                "id": str(r[0]), "username": r[1], "display_name": r[2],
                "star_color": r[3] or "#ffffff", "star_effect": r[4],
                "activity_score": float(r[5] or 0), "messages_count": r[6] or 0,
                "days_active": r[7] or 0, "friends_count": r[8] or 0,
                "is_online": r[9] == 1, "bio": r[10] or "", "avatar_url": r[11]
            } for r in c.fetchall()]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/profile")
async def update_profile(request: Request, current_user: dict = Depends(get_current_user)):
    try:
        data = await request.json()
        allowed = {}
        if "bio" in data: allowed["Bio"] = str(data["bio"])[:500]
        if "star_color" in data:
            c = str(data["star_color"])
            if c.startswith("#") and len(c) in (4, 7): allowed["StarColor"] = c
        if "star_effect" in data:
            allowed["StarEffect"] = str(data["star_effect"]) if data["star_effect"] else None
        if "display_name" in data and data["display_name"]:
            allowed["DisplayName"] = str(data["display_name"])[:100]
        if not allowed: return {"success": False, "message": "Нет данных"}
        set_clause = ", ".join(f"{k} = %s" for k in allowed.keys())
        values = list(allowed.values()) + [current_user["id"]]
        with get_db() as conn:
            conn.cursor().execute(
                f"UPDATE Users SET {set_clause}, UpdatedAt = NOW() WHERE Id = %s", values)
            conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/google/url")
async def google_url():
    return {"url": None, "message": "Google OAuth в разработке"}


@router.post("/google")
async def google_auth():
    raise HTTPException(status_code=501, detail="Google OAuth в разработке")
