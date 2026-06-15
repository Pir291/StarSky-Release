# server/routes/friends.py  (MySQL версия)
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import uuid, sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from server.database import get_db
from server.utils import get_current_user

router = APIRouter(prefix="/api/friends", tags=["friends"])

class FriendRequest(BaseModel):
    friend_username: str

@router.post("/request")
async def send_friend_request(request: FriendRequest, current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT Id, DisplayName FROM Users WHERE Username = %s", (request.friend_username,))
            friend = cursor.fetchone()
            if not friend:
                raise HTTPException(status_code=404, detail="Пользователь не найден")
            friend_id = friend["Id"]
            if friend_id == current_user["id"]:
                raise HTTPException(status_code=400, detail="Нельзя добавить себя")

            cursor.execute("""
                SELECT Id, UserId, FriendId, Status FROM Friends
                WHERE (UserId = %s AND FriendId = %s) OR (UserId = %s AND FriendId = %s)
            """, (current_user["id"], friend_id, friend_id, current_user["id"]))
            existing = cursor.fetchone()

            if existing:
                if existing["Status"] == 'friends':
                    raise HTTPException(status_code=400, detail="Уже в друзьях")
                if existing["Status"] == 'pending':
                    if existing["UserId"] == friend_id:
                        cursor.execute("""
                            UPDATE Friends SET Status = 'friends', UpdatedAt = NOW()
                            WHERE Id = %s
                        """, (existing["Id"],))
                        conn.commit()
                        return {"success": True, "message": "Запрос принят — вы теперь друзья", "became_friends": True}
                    else:
                        return {"success": False, "message": "Запрос уже отправлен"}

            cursor.execute("""
                INSERT INTO Friends (Id, UserId, FriendId, Status, CreatedAt, UpdatedAt)
                VALUES (%s, %s, %s, 'pending', NOW(), NOW())
            """, (str(uuid.uuid4()), current_user["id"], friend_id))
            conn.commit()
            return {"success": True, "message": "Запрос в друзья отправлен", "became_friends": False}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/accept/{friend_id}")
async def accept_friend_request(friend_id: str, current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT Id FROM Friends
                WHERE UserId = %s AND FriendId = %s AND Status = 'pending'
            """, (friend_id, current_user["id"]))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Запрос не найден")
            cursor.execute("UPDATE Friends SET Status = 'friends', UpdatedAt = NOW() WHERE Id = %s", (row["Id"],))
            conn.commit()
            return {"success": True, "message": "Запрос принят"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/reject/{friend_id}")
async def reject_friend_request(friend_id: str, current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                DELETE FROM Friends
                WHERE UserId = %s AND FriendId = %s AND Status = 'pending'
            """, (friend_id, current_user["id"]))
            conn.commit()
            return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/remove/{friend_id}")
async def remove_friend(friend_id: str, current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                DELETE FROM Friends
                WHERE (UserId = %s AND FriendId = %s) OR (UserId = %s AND FriendId = %s)
            """, (current_user["id"], friend_id, friend_id, current_user["id"]))
            conn.commit()
            return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def get_friends(current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.Id, u.Username, u.DisplayName, u.StarColor, u.IsOnline
                FROM Friends f
                JOIN Users u ON (
                    CASE WHEN f.UserId = %s THEN f.FriendId ELSE f.UserId END = u.Id
                )
                WHERE (f.UserId = %s OR f.FriendId = %s) AND f.Status = 'friends'
            """, (current_user["id"], current_user["id"], current_user["id"]))
            return {"success": True, "friends": [
                {"id": r["Id"], "username": r["Username"], "display_name": r["DisplayName"],
                 "star_color": r["StarColor"] or "#ffffff", "is_online": r["IsOnline"] == 1}
                for r in cursor.fetchall()
            ]}
    except Exception as e:
        return {"success": True, "friends": []}

@router.get("/pending")
async def get_pending_requests(current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.Id, u.Username, u.DisplayName, u.StarColor
                FROM Friends f
                JOIN Users u ON f.UserId = u.Id
                WHERE f.FriendId = %s AND f.Status = 'pending'
                ORDER BY f.CreatedAt DESC
            """, (current_user["id"],))
            return {"success": True, "pending": [
                {"id": r["Id"], "username": r["Username"],
                 "display_name": r["DisplayName"], "star_color": r["StarColor"] or "#ffffff"}
                for r in cursor.fetchall()
            ]}
    except Exception as e:
        return {"success": True, "pending": []}
