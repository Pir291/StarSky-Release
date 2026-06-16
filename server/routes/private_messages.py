# server/routes/private_messages.py  (MySQL версия)
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import uuid, sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from server.database import get_db
from server.utils import get_current_user

router = APIRouter(prefix="/api/private", tags=["private_messages"])

class PrivateMessageSend(BaseModel):
    to_username: str
    text: str

@router.post("/send")
async def send_private_message(request: PrivateMessageSend, current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT Id FROM Users WHERE Username = %s", (request.to_username,))
            to_user = cursor.fetchone()
            if not to_user:
                raise HTTPException(status_code=404, detail="Получатель не найден")
            to_user_id = to_user[0]
            cursor.execute("""
                INSERT INTO PrivateMessages (Id, FromUserId, ToUserId, Text, IsRead, IsEdited, CreatedAt)
                VALUES (%s, %s, %s, %s, 0, 0, NOW())
            """, (str(uuid.uuid4()), current_user["id"], to_user_id, request.text))
            conn.commit()
            return {"success": True, "message": "Сообщение отправлено"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chat/{username}")
async def get_private_chat(username: str, current_user: dict = Depends(get_current_user), limit: int = 50):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT Id FROM Users WHERE Username = %s", (username,))
            other_user = cursor.fetchone()
            if not other_user:
                raise HTTPException(status_code=404, detail="Пользователь не найден")
            other_user_id = other_user[0]
            cursor.execute("""
                SELECT
                    pm.Id, pm.FromUserId, pm.ToUserId, pm.Text, pm.IsRead, pm.IsEdited,
                    DATE_FORMAT(pm.CreatedAt, '%%H:%%i') as Time,
                    u.Username, u.DisplayName
                FROM PrivateMessages pm
                JOIN Users u ON pm.FromUserId = u.Id
                WHERE (pm.FromUserId = %s AND pm.ToUserId = %s)
                   OR (pm.FromUserId = %s AND pm.ToUserId = %s)
                ORDER BY pm.CreatedAt DESC
                LIMIT %s
            """, (current_user["id"], other_user_id, other_user_id, current_user["id"], limit))
            messages = []
            for row in cursor.fetchall():
                messages.append({
                    "id": row[0], "from_user_id": row[1], "to_user_id": row[2],
                    "text": row[3], "is_read": row[4] == 1, "is_edited": row[5] == 1,
                    "time": row[6], "from_username": row[7], "from_display_name": row[8],
                    "is_me": row[1] == current_user["id"]
                })
            messages.reverse()
            return {"success": True, "messages": messages}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": True, "messages": []}

@router.get("/dialogs")
async def get_dialogs(current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT
                    u.Id, u.Username, u.DisplayName, u.StarColor, u.IsOnline,
                    pm.Text as LastMessage,
                    DATE_FORMAT(pm.CreatedAt, '%%H:%%i') as LastTime
                FROM (
                    SELECT
                        CASE WHEN FromUserId = %s THEN ToUserId ELSE FromUserId END as OtherUserId,
                        MAX(CreatedAt) as MaxDate
                    FROM PrivateMessages
                    WHERE FromUserId = %s OR ToUserId = %s
                    GROUP BY OtherUserId
                ) last
                JOIN PrivateMessages pm ON (
                    pm.CreatedAt = last.MaxDate AND
                    (pm.FromUserId = last.OtherUserId OR pm.ToUserId = last.OtherUserId)
                )
                JOIN Users u ON u.Id = last.OtherUserId
                ORDER BY last.MaxDate DESC
            """, (current_user["id"], current_user["id"], current_user["id"]))
            dialogs = []
            for row in cursor.fetchall():
                dialogs.append({
                    "id": row[0], "username": row[1], "display_name": row[2],
                    "star_color": row[3] or "#ffffff", "is_online": row[4] == 1,
                    "last_message": row[5] or "", "last_time": row[6] or ""
                })
            return {"success": True, "dialogs": dialogs}
    except Exception as e:
        return {"success": True, "dialogs": []}
