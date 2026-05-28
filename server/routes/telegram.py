# server/routes/telegram.py  (MySQL версия)
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import secrets, uuid
import sys, os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from server.database import get_db

router = APIRouter(prefix="/api/telegram", tags=["telegram"])

def generate_token():
    return secrets.token_hex(32)

class TelegramAuthRequest(BaseModel):
    telegram_id: int
    username: str
    first_name: str
    code: str

class CodeVerifyRequest(BaseModel):
    telegram_id: int
    code: str

class CodeOnlyRequest(BaseModel):
    code: str


@router.post("/send_code")
async def send_telegram_code(request: TelegramAuthRequest):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT Id FROM Users WHERE TelegramId = %s", (request.telegram_id,))
            existing = cursor.fetchone()
            if not existing:
                user_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO Users (Id, TelegramId, Username, DisplayName, Provider, StarColor, ActivityScore, CreatedAt, UpdatedAt)
                    VALUES (%s, %s, %s, %s, 'telegram', '#ffffff', 0, NOW(), NOW())
                """, (user_id, request.telegram_id, request.username, request.first_name))
                conn.commit()
            else:
                user_id = existing[0]

            cursor.execute("DELETE FROM AuthCodes WHERE UserId = %s AND IsUsed = 0", (user_id,))
            code_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO AuthCodes (Id, Code, UserId, ExpiresAt, IsUsed, CreatedAt)
                VALUES (%s, %s, %s, DATE_ADD(NOW(), INTERVAL 5 MINUTE), 0, NOW())
            """, (code_id, request.code, user_id))
            conn.commit()
            return {"success": True, "code": request.code, "expires_in": 300}
    except Exception as e:
        print(f"❌ send_code: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify_code")
async def verify_telegram_code(request: CodeVerifyRequest):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT Id, UserId FROM AuthCodes
                WHERE Code = %s AND IsUsed = 0 AND ExpiresAt > NOW()
            """, (request.code,))
            row = cursor.fetchone()
            if not row:
                return {"success": False, "message": "Неверный или просроченный код"}
            code_id, user_id = row

            cursor.execute("SELECT Id FROM Users WHERE Id = %s AND TelegramId = %s", (user_id, request.telegram_id))
            if not cursor.fetchone():
                return {"success": False, "message": "Код не соответствует пользователю"}

            cursor.execute("UPDATE AuthCodes SET IsUsed = 1 WHERE Id = %s", (code_id,))
            cursor.execute("SELECT Id, Username, DisplayName, StarColor, ActivityScore FROM Users WHERE Id = %s", (user_id,))
            user_data = cursor.fetchone()
            if not user_data:
                return {"success": False, "message": "Пользователь не найден"}

            token = generate_token()
            cursor.execute("DELETE FROM Sessions WHERE UserId = %s", (user_id,))
            cursor.execute("""
                INSERT INTO Sessions (Id, UserId, Token, ExpiresAt, CreatedAt)
                VALUES (%s, %s, %s, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW())
            """, (str(uuid.uuid4()), user_id, token))
            cursor.execute("UPDATE Users SET IsOnline = 1, UpdatedAt = NOW() WHERE Id = %s", (user_id,))
            conn.commit()
            return {"success": True, "token": token, "user": {
                "id": str(user_data[0]), "username": user_data[1],
                "display_name": user_data[2], "star_color": user_data[3] or "#ffffff",
                "activity_score": float(user_data[4] or 0)
            }}
    except Exception as e:
        print(f"❌ verify_code: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify_code_only")
async def verify_code_only(request: CodeOnlyRequest):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT ac.UserId, u.Username, u.DisplayName, u.StarColor, u.ActivityScore
                FROM AuthCodes ac JOIN Users u ON ac.UserId = u.Id
                WHERE ac.Code = %s AND ac.IsUsed = 0 AND ac.ExpiresAt > NOW()
            """, (request.code,))
            row = cursor.fetchone()
            if not row:
                return {"success": False, "message": "Неверный или просроченный код"}
            user_id, username, display_name, star_color, activity_score = row

            cursor.execute("UPDATE AuthCodes SET IsUsed = 1 WHERE Code = %s", (request.code,))
            token = generate_token()
            cursor.execute("DELETE FROM Sessions WHERE UserId = %s", (user_id,))
            cursor.execute("""
                INSERT INTO Sessions (Id, UserId, Token, ExpiresAt, CreatedAt)
                VALUES (%s, %s, %s, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW())
            """, (str(uuid.uuid4()), user_id, token))
            cursor.execute("UPDATE Users SET IsOnline = 1, UpdatedAt = NOW() WHERE Id = %s", (user_id,))
            conn.commit()
            return {"success": True, "token": token, "user": {
                "id": user_id, "username": username, "display_name": display_name,
                "star_color": star_color or "#ffffff", "activity_score": float(activity_score or 0)
            }}
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.get("/user/{telegram_id}")
async def get_user_by_telegram(telegram_id: int):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT Id, Username, DisplayName, StarColor, ActivityScore
                FROM Users WHERE TelegramId = %s
            """, (telegram_id,))
            row = cursor.fetchone()
            if not row:
                return {"success": False, "user": None}
            return {"success": True, "user": {
                "id": str(row[0]), "username": row[1], "display_name": row[2],
                "star_color": row[3] or "#ffffff", "activity_score": float(row[4] or 0)
            }}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))