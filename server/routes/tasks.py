# server/routes/tasks.py  (MySQL версия)
from fastapi import APIRouter, HTTPException, Depends
import uuid, sys, os, datetime
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from server.database import get_db
from server.utils import get_current_user
from server.routes.activity import add_activity, get_balance

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

TASK_DEFINITIONS = [
    {"id": "daily_message", "name": "Ежедневное сообщение", "description": "Отправьте 5 сообщений в чат",  "reward": 10, "target": 5,  "type": "daily"},
    {"id": "daily_private", "name": "Приватный разговор",   "description": "Отправьте 3 личных сообщения", "reward": 20, "target": 3,  "type": "daily"},
    {"id": "daily_visits",  "name": "Ежедневный визит",     "description": "Войдите в Star Sky сегодня",   "reward": 5,  "target": 1,  "type": "daily"},
]
TASK_MAP = {t["id"]: t for t in TASK_DEFINITIONS}

def _ensure_table(conn):
    conn.cursor().execute("""
        CREATE TABLE IF NOT EXISTS UserTasks (
            Id VARCHAR(36) PRIMARY KEY,
            UserId VARCHAR(36) NOT NULL,
            TaskId VARCHAR(50) NOT NULL,
            Progress INT DEFAULT 0,
            Completed TINYINT(1) DEFAULT 0,
            Claimed TINYINT(1) DEFAULT 0,
            LastReset DATE,
            ClaimedAt DATETIME NULL,
            UNIQUE KEY uq_user_task (UserId, TaskId),
            FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    conn.commit()

def _get_or_create_task(conn, user_id, task_id):
    cursor = conn.cursor()
    today = datetime.date.today().isoformat()
    cursor.execute("SELECT Id,Progress,Completed,Claimed,LastReset FROM UserTasks WHERE UserId=%s AND TaskId=%s", (user_id, task_id))
    row = cursor.fetchone()
    if not row:
        row_id = str(uuid.uuid4())
        cursor.execute("INSERT INTO UserTasks (Id,UserId,TaskId,Progress,Completed,Claimed,LastReset) VALUES (%s,%s,%s,0,0,0,%s)", (row_id, user_id, task_id, today))
        return {"id": row_id, "progress": 0, "completed": False, "claimed": False, "is_new": True}
    row_id, progress, completed, claimed, last_reset = row
    last_reset_str = str(last_reset)[:10] if last_reset else "2000-01-01"
    if last_reset_str < today:
        cursor.execute("UPDATE UserTasks SET Progress=0,Completed=0,Claimed=0,LastReset=%s WHERE Id=%s", (today, row_id))
        return {"id": row_id, "progress": 0, "completed": False, "claimed": False, "is_new": True}
    return {"id": row_id, "progress": int(progress or 0), "completed": bool(completed), "claimed": bool(claimed), "is_new": False}

@router.get("/list")
async def get_tasks(current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            _ensure_table(conn)
            result = []
            for t in TASK_DEFINITIONS:
                state = _get_or_create_task(conn, current_user["id"], t["id"])
                if t["id"] == "daily_visits" and state.get("is_new"):
                    state["progress"] = 1; state["completed"] = True
                    conn.cursor().execute("UPDATE UserTasks SET Progress=1,Completed=1 WHERE Id=%s", (state["id"],))
                result.append({**t, "progress": state["progress"], "completed": state["completed"], "claimed": state["claimed"]})
            conn.commit()
            return {"success": True, "tasks": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/progress/{task_id}")
async def update_progress(task_id: str, current_user: dict = Depends(get_current_user)):
    if task_id not in TASK_MAP: raise HTTPException(status_code=404, detail="Не найдено")
    try:
        with get_db() as conn:
            _ensure_table(conn)
            t = TASK_MAP[task_id]
            state = _get_or_create_task(conn, current_user["id"], task_id)
            if state["claimed"]: return {"success": True, "already_claimed": True}
            new_p = min(state["progress"] + 1, t["target"])
            completed = new_p >= t["target"]
            conn.cursor().execute("UPDATE UserTasks SET Progress=%s,Completed=%s WHERE Id=%s", (new_p, 1 if completed else 0, state["id"]))
            conn.commit()
            return {"success": True, "progress": new_p, "completed": completed, "claimed": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/claim/{task_id}")
async def claim_reward(task_id: str, current_user: dict = Depends(get_current_user)):
    if task_id not in TASK_MAP: raise HTTPException(status_code=404, detail="Не найдено")
    try:
        with get_db() as conn:
            _ensure_table(conn)
            t = TASK_MAP[task_id]
            state = _get_or_create_task(conn, current_user["id"], task_id)
            if state["claimed"]: return {"success": False, "message": "Уже получено"}
            if not state["completed"]: return {"success": False, "message": "Не выполнено"}
            add_activity(conn, current_user["id"], float(t["reward"]), f"task:{task_id}")
            conn.cursor().execute("UPDATE UserTasks SET Claimed=1,ClaimedAt=NOW() WHERE Id=%s", (state["id"],))
            balance = get_balance(conn, current_user["id"])
            conn.commit()
            return {"success": True, "reward": t["reward"], "new_balance": balance}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))