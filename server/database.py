# server/database.py
import pymysql
import os
from contextlib import contextmanager

# Данные из Timeweb — замените на свои!
DB_CONFIG = {
    "host": "192.168.x.x",        # Приватный IP вашей базы
    "user": "star_sky_user",      # Имя пользователя
    "password": "ВАШ_ПАРОЛЬ",     # Пароль
    "database": "star_sky_db",    # Имя базы данных
    "port": 3306,
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor
}

_pool = None

def init_pool():
    global _pool
    _pool = pymysql.connect(**DB_CONFIG)
    print("✅ MySQL подключен к Timeweb")

@contextmanager
def get_db():
    conn = _pool
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
