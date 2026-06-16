# server/routes/shop.py  (MySQL версия)
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import uuid, sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from server.database import get_db
from server.utils import get_current_user
from server.routes.activity import add_activity, get_balance

router = APIRouter(prefix="/api/shop", tags=["shop"])

class PurchaseRequest(BaseModel):
    item_id: str
    item_type: str
    item_name: str
    cost: int

class EquipRequest(BaseModel):
    star_color: str = None
    star_effect: str = None

@router.post("/purchase")
async def purchase_item(request: PurchaseRequest, current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT Id FROM UserItems WHERE UserId = %s AND ItemId = %s",
                (current_user["id"], request.item_id)
            )
            if cursor.fetchone():
                return {"success": False, "message": "Предмет уже куплен"}

            balance = get_balance(conn, current_user["id"])
            if request.cost > 0 and balance < request.cost:
                return {"success": False, "message": "Недостаточно очков"}

            if request.cost > 0:
                add_activity(conn, current_user["id"], -float(request.cost),
                             f"purchase:{request.item_id}")

            cursor.execute("""
                INSERT INTO UserItems (Id, UserId, ItemId, ItemType, ItemName, Cost, PurchasedAt)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """, (str(uuid.uuid4()), current_user["id"], request.item_id,
                  request.item_type, request.item_name, request.cost))

            new_balance = get_balance(conn, current_user["id"])
            conn.commit()
            return {"success": True, "new_balance": new_balance, "message": f"Куплено: {request.item_name}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/owned")
async def get_owned_items(current_user: dict = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT ItemId, ItemType, ItemName, Cost
                FROM UserItems WHERE UserId = %s
                ORDER BY PurchasedAt DESC
            """, (current_user["id"],))
            items = []
            for row in cursor.fetchall():
                items.append({
                    "item_id": row[0], "item_type": row[1],
                    "item_name": row[2], "cost": row[3]
                })
            return {"success": True, "items": items, "item_ids": [i["item_id"] for i in items]}
    except Exception as e:
        return {"success": True, "items": [], "item_ids": []}

@router.post("/equip")
async def equip_item(request: EquipRequest, current_user: dict = Depends(get_current_user)):
    try:
        updates = {}
        if request.star_color is not None:
            c = str(request.star_color)
            if c.startswith("#") and len(c) in (4, 7):
                updates["StarColor"] = c
        if request.star_effect is not None:
            updates["StarEffect"] = request.star_effect if request.star_effect else None
        if not updates:
            return {"success": False, "message": "Нет данных для обновления"}

        set_clause = ", ".join(f"{k} = %s" for k in updates.keys())
        values = list(updates.values()) + [current_user["id"]]
        with get_db() as conn:
            conn.cursor().execute(
                f"UPDATE Users SET {set_clause}, UpdatedAt = NOW() WHERE Id = %s", values)
            conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
