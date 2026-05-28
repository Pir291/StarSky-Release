# server/routes/activity.py  (MySQL версия)
from fastapi import APIRouter, HTTPException, Depends
import uuid, sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from server.database import get_db
from server.utils import get_current_user

router = APIRouter(prefix="/api/activity", tags=["activity"])

def add_activity(conn, user_id: str, amount: float, reason: str):
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO ActivityLog (Id, UserId, Amount, Reason, CreatedAt)
        VALUES (%s, %s, %s, %s, NOW())
    """, (str(uuid.uuid4()), user_id, amount, reason))
    cursor.execute("""
        UPDATE Users SET ActivityScore = (
            SELECT COALESCE(SUM(Amount), 0) FROM ActivityLog WHERE UserId = %s
        ), UpdatedAt = NOW() WHERE Id = %s
    """, (user_id, user_id))

def get_balance(conn, user_id: str) -> float:
    cursor = conn.cursor()
    cursor.execute("SELECT ActivityScore FROM Users WHERE Id = %s", (user_id,))
    row = cursor.fetchone()
    return float(row[0] or 0) if row else 0.0

@router.get("/balance")
async def get_my_balance(current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            return {"success": True, "balance": get_balance(conn, current_user["id"])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/log")
async def get_activity_log(current_user: dict = Depends(get_current_user), limit: int = 50):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT Amount, Reason, DATE_FORMAT(CreatedAt, '%%d.%%m.%%Y %%H:%%i')
                FROM ActivityLog WHERE UserId = %s
                ORDER BY CreatedAt DESC LIMIT %s
            """, (current_user["id"], limit))
            return {"success": True, "log": [
                {"amount": float(r[0]), "reason": r[1], "date": r[2]}
                for r in cursor.fetchall()
            ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))