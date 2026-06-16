# server/database.py
import pymysql
import os
from contextlib import contextmanager

def get_db_config():
    return {
        "host":     os.environ.get("DB_HOST", "109.73.199.178"),
        "port":     int(os.environ.get("DB_PORT", 3306)),
        "user":     os.environ.get("DB_USER", "gen_user"),
        "password": os.environ.get("DB_PASSWORD", ""),
        "database": os.environ.get("DB_NAME", "default_db"),
        "charset":  "utf8mb4",
        "autocommit": False,
    }

def init_pool():
    """Проверяем подключение при старте."""
    try:
        conn = pymysql.connect(**get_db_config())
        conn.close()
        print("✅ MySQL подключён успешно")
    except Exception as e:
        print(f"❌ Ошибка подключения к MySQL: {e}")

def get_connection():
    return pymysql.connect(**get_db_config())

@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()
