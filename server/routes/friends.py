# server/routes/friends.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import uuid
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from server.database import get_db
from server.utils import get_current_user

router = APIRouter(prefix="/api/friends", tags=["friends"])

class FriendRequest(BaseModel):
    friend_username: str


@router.post("/request")
async def send_friend_request(request: FriendRequest, current_user: dict = Depends(get_current_user)):
    """Отправляет запрос в друзья. Если другой уже отправил заявку — принимается взаимно."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT Id, DisplayName FROM Users WHERE Username = ?", (request.friend_username,))
            friend = cursor.fetchone()
            if not friend:
                raise HTTPException(status_code=404, detail="Пользователь не найден")

            friend_id = friend[0]
            if friend_id == current_user["id"]:
                raise HTTPException(status_code=400, detail="Нельзя добавить себя")

            # Проверяем существующие записи
            cursor.execute("""
                SELECT Id, UserId, FriendId, Status FROM Friends
                WHERE (UserId = ? AND FriendId = ?) OR (UserId = ? AND FriendId = ?)
            """, (current_user["id"], friend_id, friend_id, current_user["id"]))
            existing = cursor.fetchone()

            if existing:
                ex_id, ex_user, ex_friend, ex_status = existing
                if ex_status == 'friends':
                    raise HTTPException(status_code=400, detail="Уже в друзьях")
                if ex_status == 'pending':
                    # Уже есть pending — кто отправил?
                    if ex_user == friend_id:
                        # Другой пользователь уже отправил нам заявку — принимаем
                        cursor.execute("""
                            UPDATE Friends SET Status = 'friends', UpdatedAt = GETDATE()
                            WHERE Id = ?
                        """, (ex_id,))
                        conn.commit()
                        return {"success": True, "message": "Запрос принят — вы теперь друзья", "became_friends": True}
                    else:
                        # Мы уже отправили заявку
                        return {"success": False, "message": "Запрос уже отправлен"}

            # Создаём новую заявку
            req_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO Friends (Id, UserId, FriendId, Status, CreatedAt, UpdatedAt)
                VALUES (?, ?, ?, 'pending', GETDATE(), GETDATE())
            """, (req_id, current_user["id"], friend_id))
            conn.commit()

            return {"success": True, "message": "Запрос в друзья отправлен", "became_friends": False}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка запроса в друзья: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/accept/{friend_id}")
async def accept_friend_request(friend_id: str, current_user: dict = Depends(get_current_user)):
    """Принимает входящий запрос в друзья."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            # Ищем pending запрос ОТ friend_id КО мне
            cursor.execute("""
                SELECT Id FROM Friends
                WHERE UserId = ? AND FriendId = ? AND Status = 'pending'
            """, (friend_id, current_user["id"]))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Запрос не найден")

            cursor.execute("""
                UPDATE Friends SET Status = 'friends', UpdatedAt = GETDATE() WHERE Id = ?
            """, (row[0],))
            conn.commit()
            return {"success": True, "message": "Запрос принят"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/reject/{friend_id}")
async def reject_friend_request(friend_id: str, current_user: dict = Depends(get_current_user)):
    """Отклоняет входящий запрос в друзья."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                DELETE FROM Friends
                WHERE UserId = ? AND FriendId = ? AND Status = 'pending'
            """, (friend_id, current_user["id"]))
            conn.commit()
            return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/remove/{friend_id}")
async def remove_friend(friend_id: str, current_user: dict = Depends(get_current_user)):
    """Удаляет из друзей."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                DELETE FROM Friends
                WHERE (UserId = ? AND FriendId = ?) OR (UserId = ? AND FriendId = ?)
            """, (current_user["id"], friend_id, friend_id, current_user["id"]))
            conn.commit()
            return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def get_friends(current_user: dict = Depends(get_current_user)):
    """Список принятых друзей."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.Id, u.Username, u.DisplayName, u.StarColor, u.IsOnline
                FROM Friends f
                JOIN Users u ON (
                    CASE WHEN f.UserId = ? THEN f.FriendId ELSE f.UserId END = u.Id
                )
                WHERE (f.UserId = ? OR f.FriendId = ?) AND f.Status = 'friends'
            """, (current_user["id"], current_user["id"], current_user["id"]))
            friends = []
            for row in cursor.fetchall():
                friends.append({
                    "id": row[0], "username": row[1], "display_name": row[2],
                    "star_color": row[3] or "#ffffff", "is_online": row[4] == 1
                })
            return {"success": True, "friends": friends}
    except Exception as e:
        print(f"❌ Ошибка списка друзей: {e}")
        return {"success": True, "friends": []}


@router.get("/pending")
async def get_pending_requests(current_user: dict = Depends(get_current_user)):
    """Входящие запросы в друзья (от других пользователей ко мне)."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.Id, u.Username, u.DisplayName, u.StarColor
                FROM Friends f
                JOIN Users u ON f.UserId = u.Id
                WHERE f.FriendId = ? AND f.Status = 'pending'
                ORDER BY f.CreatedAt DESC
            """, (current_user["id"],))
            pending = []
            for row in cursor.fetchall():
                pending.append({
                    "id": row[0], "username": row[1],
                    "display_name": row[2], "star_color": row[3] or "#ffffff"
                })
            return {"success": True, "pending": pending}
    except Exception as e:
        return {"success": True, "pending": []}