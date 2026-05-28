# server/routes/private_messages.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import uuid
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from server.database import get_db
from server.utils import get_current_user

router = APIRouter(prefix="/api/private", tags=["private_messages"])

class PrivateMessageSend(BaseModel):
    to_username: str
    text: str

@router.post("/send")
async def send_private_message(request: PrivateMessageSend, current_user: dict = Depends(get_current_user)):
    """Отправляет личное сообщение пользователю"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT Id FROM Users WHERE Username = ?", (request.to_username,))
            to_user = cursor.fetchone()
            
            if not to_user:
                raise HTTPException(status_code=404, detail="Получатель не найден")
            
            to_user_id = to_user[0]
            
            message_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO PrivateMessages (Id, FromUserId, ToUserId, Text, IsRead, IsEdited, CreatedAt)
                VALUES (?, ?, ?, ?, 0, 0, GETDATE())
            """, (message_id, current_user["id"], to_user_id, request.text))
            
            conn.commit()
            
            return {"success": True, "message": "Сообщение отправлено"}
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка отправки сообщения: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chat/{username}")
async def get_private_chat(username: str, current_user: dict = Depends(get_current_user), limit: int = 50):
    """Получает диалог с пользователем"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT Id FROM Users WHERE Username = ?", (username,))
            other_user = cursor.fetchone()
            
            if not other_user:
                raise HTTPException(status_code=404, detail="Пользователь не найден")
            
            other_user_id = other_user[0]
            
            cursor.execute("""
                SELECT TOP (?)
                    pm.Id, pm.FromUserId, pm.ToUserId, pm.Text, pm.IsRead, pm.IsEdited,
                    FORMAT(pm.CreatedAt, 'HH:mm') as Time,
                    u.Username, u.DisplayName
                FROM PrivateMessages pm
                JOIN Users u ON pm.FromUserId = u.Id
                WHERE (pm.FromUserId = ? AND pm.ToUserId = ?) 
                   OR (pm.FromUserId = ? AND pm.ToUserId = ?)
                ORDER BY pm.CreatedAt DESC
            """, (limit, current_user["id"], other_user_id, other_user_id, current_user["id"]))
            
            messages = []
            for row in cursor.fetchall():
                messages.append({
                    "id": row[0],
                    "from_user_id": row[1],
                    "to_user_id": row[2],
                    "text": row[3],
                    "is_read": row[4] == 1,
                    "is_edited": row[5] == 1,
                    "time": row[6],
                    "from_username": row[7],
                    "from_display_name": row[8],
                    "is_me": row[1] == current_user["id"]
                })
            
            messages.reverse()
            
            return {"success": True, "messages": messages}
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка получения диалога: {e}")
        return {"success": True, "messages": []}

@router.get("/dialogs")
async def get_dialogs(current_user: dict = Depends(get_current_user)):
    """Возвращает список диалогов пользователя"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                WITH UserMessages AS (
                    SELECT 
                        CASE 
                            WHEN FromUserId = ? THEN ToUserId
                            ELSE FromUserId
                        END as OtherUserId,
                        Text as LastMessage,
                        CreatedAt,
                        ROW_NUMBER() OVER (PARTITION BY 
                            CASE 
                                WHEN FromUserId = ? THEN ToUserId
                                ELSE FromUserId
                            END 
                            ORDER BY CreatedAt DESC) as rn
                    FROM PrivateMessages
                    WHERE FromUserId = ? OR ToUserId = ?
                )
                SELECT 
                    u.Id, u.Username, u.DisplayName, u.StarColor, u.IsOnline,
                    um.LastMessage,
                    FORMAT(um.CreatedAt, 'HH:mm') as LastTime
                FROM UserMessages um
                JOIN Users u ON um.OtherUserId = u.Id
                WHERE um.rn = 1
                ORDER BY um.CreatedAt DESC
            """, (current_user["id"], current_user["id"], current_user["id"], current_user["id"]))
            
            dialogs = []
            for row in cursor.fetchall():
                dialogs.append({
                    "id": row[0],
                    "username": row[1],
                    "display_name": row[2],
                    "star_color": row[3] or "#ffffff",
                    "is_online": row[4] == 1,
                    "last_message": row[5] or "",
                    "last_time": row[6] or ""
                })
            
            return {"success": True, "dialogs": dialogs}
            
    except Exception as e:
        print(f"❌ Ошибка получения диалогов: {e}")
        return {"success": True, "dialogs": []}