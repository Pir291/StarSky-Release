import asyncio
import random
import pyodbc
import os
import uuid
from datetime import datetime, timedelta
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

BOT_TOKEN = "8127084344:AAHPVcpT2-USGSUQftgSR0OzCXlhO1fi5TA"

# SQL Server подключение
DB_CONFIG = {
    "server": "localhost",
    "database": "StarSkyDB",
    "driver": "ODBC Driver 18 for SQL Server",
    "trusted_connection": "yes",
    "encrypt": "no",
    "timeout": 30
}

def get_db_connection():
    """Получает соединение с SQL Server"""
    conn_str = (
        f"DRIVER={{{DB_CONFIG['driver']}}};"
        f"SERVER={DB_CONFIG['server']};"
        f"DATABASE={DB_CONFIG['database']};"
        f"Trusted_Connection={DB_CONFIG['trusted_connection']};"
        f"Encrypt={DB_CONFIG['encrypt']};"
        f"Connection Timeout={DB_CONFIG['timeout']};"
    )
    return pyodbc.connect(conn_str)

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

def generate_random_code():
    """Генерирует 6-значный код"""
    return f"{random.randint(0, 999999):06d}"

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    user = message.from_user
    telegram_id = user.id
    username = user.username or f"user_{telegram_id}"
    first_name = user.first_name or "Пользователь"
    
    print(f"📨 /start от {telegram_id} (@{username})")
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 1. Находим или создаём пользователя
        cursor.execute("SELECT Id, Username, DisplayName FROM Users WHERE TelegramId = ?", (telegram_id,))
        row = cursor.fetchone()
        
        if row:
            user_id = row[0]
            print(f"✅ Найден пользователь: {row[2]} (ID: {user_id})")
        else:
            # Создаём нового пользователя
            user_id = str(uuid.uuid4())
            final_username = username
            counter = 1
            
            while True:
                cursor.execute("SELECT Id FROM Users WHERE Username = ?", (final_username,))
                if not cursor.fetchone():
                    break
                final_username = f"{username}{counter}"
                counter += 1
            
            cursor.execute("""
                INSERT INTO Users (Id, TelegramId, Username, DisplayName, Provider, 
                                   StarColor, ActivityScore, CreatedAt, UpdatedAt)
                VALUES (?, ?, ?, ?, 'telegram', '#ffffff', 150, GETDATE(), GETDATE())
            """, (user_id, telegram_id, final_username, first_name))
            conn.commit()
            print(f"✅ Создан новый пользователь: {first_name} (@{final_username})")
        
        # 2. Генерируем код для входа
        code = generate_random_code()
        code_id = str(uuid.uuid4())
        
        # Удаляем старые неиспользованные коды этого пользователя
        cursor.execute("DELETE FROM AuthCodes WHERE UserId = ? AND IsUsed = 0", (user_id,))
        
        # Сохраняем новый код в БД
        cursor.execute("""
            INSERT INTO AuthCodes (Id, Code, UserId, ExpiresAt, IsUsed, CreatedAt)
            VALUES (?, ?, ?, DATEADD(MINUTE, 5, GETDATE()), 0, GETDATE())
        """, (code_id, code, user_id))
        
        conn.commit()
        conn.close()
        
        print(f"🔐 Сгенерирован код {code} для пользователя {telegram_id}")
        
        # 3. Отправляем код пользователю
        auth_url = "http://127.0.0.1:8000/auth"
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🌐 Перейти на сайт", url=auth_url)],
            [InlineKeyboardButton(text="🔄 Получить новый код", callback_data="new_code")]
        ])
        
        await message.answer(
            f"✨ *Добро пожаловать в Star Sky, {first_name}!* ✨\n\n"
            f"🔐 *Ваш код для входа:*\n"
            f"`{code}`\n\n"
            f"⏰ Код действителен *5 минут*\n\n"
            f"👉 Нажмите на кнопку ниже, чтобы перейти на сайт и ввести код\n\n"
            f"⚠️ *Никому не сообщайте этот код!*",
            parse_mode="Markdown",
            reply_markup=keyboard
        )
        print(f"✅ Код {code} отправлен")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        await message.answer(f"❌ Ошибка сервера. Попробуйте позже.")

@dp.callback_query()
async def handle_callback(callback: types.CallbackQuery):
    if callback.data == "new_code":
        await callback.answer("🔄 Генерируем новый код...")
        # Передаём оригинальное сообщение от пользователя через callback.message
        # from_user у callback — это сам пользователь, создаём псевдо-message
        class _FakeMsg:
            def __init__(self, cb):
                self.from_user = cb.from_user
                self.answer = cb.message.answer
        await cmd_start(_FakeMsg(callback))
    else:
        await callback.answer()

@dp.message(Command("help"))
async def cmd_help(message: types.Message):
    await message.answer(
        "🤖 *Помощь по боту Star Sky*\n\n"
        "📌 *Команды:*\n"
        "• `/start` — получить код для входа\n"
        "• `/help` — эта справка\n\n"
        "🔐 *Как войти:*\n"
        "1. Нажмите /start\n"
        "2. Скопируйте полученный 6-значный код\n"
        "3. Перейдите на сайт по кнопке\n"
        "4. Введите код в форму входа\n\n"
        "⚠️ Код действителен только 5 минут!",
        parse_mode="Markdown"
    )

@dp.message()
async def echo(message: types.Message):
    await message.answer(
        "🌟 *Star Sky Bot*\n\n"
        "Используйте `/start` чтобы получить код для входа на сайт.\n\n"
        "Напишите `/help` для справки.",
        parse_mode="Markdown"
    )

async def main():
    print("=" * 50)
    print("🤖 STAR SKY БОТ")
    print("=" * 50)
    
    try:
        bot_info = await bot.get_me()
        print(f"✅ Бот: @{bot_info.username}")
        print("✅ Бот запущен и готов к работе!")
        print("=" * 50)
        
        await dp.start_polling(bot)
    except Exception as e:
        print(f"❌ Ошибка запуска бота: {e}")
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())