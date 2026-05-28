# server/routes/users.py  (MySQL версия)
from fastapi import APIRouter, HTTPException, Depends
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from server.database import get_db
from server.utils.auth_utils import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT Id, Username, DisplayName, StarColor, ActivityScore,
                       IsOnline, Bio, AvatarUrl,
                       DATE_FORMAT(CreatedAt, '%%d.%%m.%%Y') as RegDate, StarEffect
                FROM Users WHERE Id = %s
            """, (current_user["id"],))
            row = cursor.fetchone()
            if not row:
                return {"success": True, "user": current_user}
            return {"success": True, "user": {
                "id": row[0], "username": row[1], "display_name": row[2],
                "star_color": row[3] or "#ffffff", "activity_score": float(row[4] or 0),
                "is_online": row[5] == 1, "bio": row[6] or "",
                "avatar_url": row[7], "created_at": row[8] or "", "star_effect": row[9]
            }}
    except Exception as e:
        return {"success": True, "user": current_user}

@router.post("/heartbeat")
async def heartbeat(current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            conn.cursor().execute(
                "UPDATE Users SET IsOnline=1, LastSeen=NOW(), UpdatedAt=NOW() WHERE Id=%s",
                (current_user["id"],)
            )
            conn.commit()
        return {"success": True}
    except:
        return {"success": False}

@router.get("/online")
async def get_online_users(current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE Users SET IsOnline=0
                WHERE IsOnline=1
                  AND (LastSeen IS NULL OR LastSeen < DATE_SUB(NOW(), INTERVAL 60 SECOND))
                  AND Id != %s
            """, (current_user["id"],))
            cursor.execute("""
                SELECT Id, Username, DisplayName, StarColor FROM Users
                WHERE IsOnline=1 AND LastSeen >= DATE_SUB(NOW(), INTERVAL 60 SECOND)
                ORDER BY LastSeen DESC
            """)
            online = [{"id": r[0], "username": r[1], "display_name": r[2], "star_color": r[3] or "#ffffff"}
                      for r in cursor.fetchall()]
            conn.commit()
            return {"success": True, "online": online, "count": len(online)}
    except Exception as e:
        return {"success": True, "online": [], "count": 0}

@router.get("/list")
async def get_users(current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT Id,Username,DisplayName,StarColor,ActivityScore,IsOnline,AvatarUrl FROM Users ORDER BY ActivityScore DESC")
            return {"success": True, "users": [
                {"id": r[0], "username": r[1], "display_name": r[2],
                 "star_color": r[3] or "#ffffff", "activity_score": float(r[4] or 0),
                 "is_online": r[5]==1, "avatar_url": r[6]}
                for r in cursor.fetchall()
            ]}
    except:
        return {"success": True, "users": []}

@router.get("/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT Id,Username,DisplayName,StarColor,ActivityScore,IsOnline,Bio,AvatarUrl,
                       DATE_FORMAT(CreatedAt,'%%d.%%m.%%Y')
                FROM Users WHERE Id=%s
            """, (user_id,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Не найден")
            return {"success": True, "user": {
                "id": row[0], "username": row[1], "display_name": row[2],
                "star_color": row[3] or "#ffffff", "activity_score": float(row[4] or 0),
                "is_online": row[5]==1, "bio": row[6] or "",
                "avatar_url": row[7], "created_at": row[8] or ""
            }}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))