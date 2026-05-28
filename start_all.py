# start_all.py — продакшн запуск
import subprocess, sys, os, time, threading, signal

def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip())

def run_server():
    print("🚀 ЗАПУСК СЕРВЕРА")
    # --workers 2: два процесса для надёжности
    # без --reload в продакшне
    os.system('python -m uvicorn server.main:app --host 0.0.0.0 --port 8000 --workers 2')

def run_bot():
    time.sleep(5)
    print("🤖 ЗАПУСК TELEGRAM БОТА")
    os.system('python bot/bot.py')

def signal_handler(sig, frame):
    print("👋 Остановка...")
    sys.exit(0)

if __name__ == "__main__":
    load_env()
    signal.signal(signal.SIGINT, signal_handler)

    domain = os.environ.get("DOMAIN", "localhost:8000")
    print("=" * 60)
    print("🌟 STAR SKY — ПРОДАКШН ЗАПУСК")
    print("=" * 60)
    print(f"📡 Сайт:  https://{domain}")
    print(f"🗄️  БД:    {os.environ.get('DB_HOST','?')}:{os.environ.get('DB_PORT','3306')}/{os.environ.get('DB_NAME','?')}")
    print("⏸️  Ctrl+C для остановки\n")

    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    run_bot()