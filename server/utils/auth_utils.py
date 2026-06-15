# server/utils/auth_utils.py
# Общая утилита авторизации — импортируется из users.py, activity.py и т.д.
from fastapi import HTTPException, Request
from server.database import get_db


def get_current_user(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Токен не предоставлен")
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("""
                SELECT u.Id, u.Username, u.DisplayName, u.Email,
                       u.StarColor, u.StarEffect, u.ActivityScore,
                       u.Provider, u.AvatarUrl, u.Bio, u.IsOnline
                FROM Sessions s
                JOIN Users u ON s.UserId = u.Id
                WHERE s.Token = %s AND s.ExpiresAt > NOW()
            """, (token,))
            row = c.fetchone()
            if not row:
                raise HTTPException(status_code=401, detail="Недействительный токен")
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
                "is_online": row[10] == 1
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка авторизации: {str(e)}")
