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
            cursor.execute("""
                INSERT INTO PrivateMessages (Id, FromUserId, ToUserId, Text, IsRead, IsEdited, CreatedAt)
                VALUES (%s, %s, %s, %s, 0, 0, NOW())
            """, (str(uuid.uuid4()), current_user["id"], to_user["Id"], request.text))
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
            other_user_id = other_user["Id"]
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
            messages = [{
                "id": r["Id"], "from_user_id": r["FromUserId"], "to_user_id": r["ToUserId"],
                "text": r["Text"], "is_read": r["IsRead"] == 1, "is_edited": r["IsEdited"] == 1,
                "time": r["Time"], "from_username": r["Username"],
                "from_display_name": r["DisplayName"],
                "is_me": r["FromUserId"] == current_user["id"]
            } for r in cursor.fetchall()]
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
            return {"success": True, "dialogs": [{
                "id": r["Id"], "username": r["Username"], "display_name": r["DisplayName"],
                "star_color": r["StarColor"] or "#ffffff", "is_online": r["IsOnline"] == 1,
                "last_message": r["LastMessage"] or "", "last_time": r["LastTime"] or ""
            } for r in cursor.fetchall()]}
    except Exception as e:
        return {"success": True, "dialogs": []}
