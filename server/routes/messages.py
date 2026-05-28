# server/routes/messages.py  (MySQL версия)
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import uuid, sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from server.database import get_db
from server.utils import get_current_user
from server.routes.activity import add_activity, get_balance

router = APIRouter(prefix="/api/messages", tags=["messages"])

class MessageCreate(BaseModel):
    text: str
    reply_to: Optional[str] = None

@router.post("/send")
async def send_message(request: MessageCreate, user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            message_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO Messages (Id, UserId, Text, ReplyTo, IsEdited, CreatedAt)
                VALUES (%s, %s, %s, %s, 0, NOW())
            """, (message_id, user["id"], request.text, request.reply_to))
            cursor.execute("UPDATE Users SET MessagesCount = MessagesCount + 1, UpdatedAt = NOW() WHERE Id = %s", (user["id"],))
            add_activity(conn, user["id"], 2.0, "message")
            new_balance = get_balance(conn, user["id"])
            conn.commit()
            return {
                "success": True, "new_balance": new_balance,
                "message": {
                    "id": message_id, "user_id": user["id"],
                    "username": user["username"], "display_name": user["display_name"],
                    "text": request.text, "reply_to": request.reply_to, "is_edited": False
                }
            }
    except Exception as e:
        print(f"❌ send_message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get")
async def get_messages(limit: int = 50, offset: int = 0, user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT m.Id, m.UserId, u.Username, u.DisplayName, m.Text,
                    m.ReplyTo, m.IsEdited,
                    DATE_FORMAT(m.CreatedAt, '%%H:%%i') as Time,
                    DATE_FORMAT(m.CreatedAt, '%%Y-%%m-%%d %%H:%%i:%%s') as FullTime
                FROM Messages m JOIN Users u ON m.UserId = u.Id
                ORDER BY m.CreatedAt DESC
                LIMIT %s OFFSET %s
            """, (limit, offset))
            rows = cursor.fetchall()
            messages = []
            for row in reversed(rows):
                messages.append({
                    "id": row[0], "user_id": row[1], "username": row[2],
                    "display_name": row[3], "text": row[4], "reply_to": row[5],
                    "is_edited": row[6] == 1, "time": row[7], "created_at": row[8]
                })
            return {"success": True, "messages": messages}
    except Exception as e:
        return {"success": True, "messages": []}