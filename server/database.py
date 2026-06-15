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
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": False,
    }

def get_connection():
    try:
        conn = pymysql.connect(**get_db_config())
        return conn
    except Exception as e:
        print(f"❌ Ошибка подключения к MySQL: {e}")
        return None

@contextmanager
def get_db():
    conn = get_connection()
    if conn is None:
        raise Exception("Не удалось подключиться к базе данных")
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()
