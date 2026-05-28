# server/db_models.py (MySQL версия)
"""Схема базы данных Star Sky для MySQL 5.7+"""

def create_all_tables(conn):
    cursor = conn.cursor()

    tables = [
        # 1. Пользователи
        """CREATE TABLE IF NOT EXISTS Users (
            Id VARCHAR(36) PRIMARY KEY,
            TelegramId BIGINT NULL,
            GoogleId VARCHAR(100) NULL,
            Username VARCHAR(50) NOT NULL,
            DisplayName VARCHAR(100) NOT NULL,
            Email VARCHAR(100) NULL,
            PasswordHash VARCHAR(255) NULL,
            AvatarUrl VARCHAR(500) NULL,
            Bio VARCHAR(500) NULL,
            StarColor VARCHAR(20) DEFAULT '#ffffff',
            StarEffect VARCHAR(50) NULL,
            ActivityScore FLOAT DEFAULT 0,
            MessagesCount INT DEFAULT 0,
            DaysActive INT DEFAULT 0,
            FriendsCount INT DEFAULT 0,
            IsOnline TINYINT(1) DEFAULT 0,
            LastSeen DATETIME NULL,
            SelectedStatusId VARCHAR(50) NULL,
            CursorStarEnabled TINYINT(1) DEFAULT 0,
            Provider VARCHAR(20) DEFAULT 'telegram',
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_username (Username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",

        # 2. Сессии
        """CREATE TABLE IF NOT EXISTS Sessions (
            Id VARCHAR(36) PRIMARY KEY,
            UserId VARCHAR(36) NOT NULL,
            Token VARCHAR(255) NOT NULL,
            ExpiresAt DATETIME NOT NULL,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_token (Token),
            FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

        # 3. Коды авторизации
        """CREATE TABLE IF NOT EXISTS AuthCodes (
            Id VARCHAR(36) PRIMARY KEY,
            Code VARCHAR(10) NOT NULL,
            UserId VARCHAR(36) NOT NULL,
            ExpiresAt DATETIME NOT NULL,
            IsUsed TINYINT(1) DEFAULT 0,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_code (Code),
            FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

        # 4. Друзья
        """CREATE TABLE IF NOT EXISTS Friends (
            Id VARCHAR(36) PRIMARY KEY,
            UserId VARCHAR(36) NOT NULL,
            FriendId VARCHAR(36) NOT NULL,
            Status VARCHAR(20) DEFAULT 'pending',
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_friendship (UserId, FriendId),
            FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
            FOREIGN KEY (FriendId) REFERENCES Users(Id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

        # 5. Сообщения (общий чат)
        """CREATE TABLE IF NOT EXISTS Messages (
            Id VARCHAR(36) PRIMARY KEY,
            UserId VARCHAR(36) NOT NULL,
            Text TEXT NOT NULL,
            ReplyTo VARCHAR(36) NULL,
            IsEdited TINYINT(1) DEFAULT 0,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",

        # 6. Личные сообщения
        """CREATE TABLE IF NOT EXISTS PrivateMessages (
            Id VARCHAR(36) PRIMARY KEY,
            FromUserId VARCHAR(36) NOT NULL,
            ToUserId VARCHAR(36) NOT NULL,
            Text TEXT NOT NULL,
            IsRead TINYINT(1) DEFAULT 0,
            IsEdited TINYINT(1) DEFAULT 0,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (FromUserId) REFERENCES Users(Id),
            FOREIGN KEY (ToUserId) REFERENCES Users(Id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",

        # 7. Избранное
        """CREATE TABLE IF NOT EXISTS Favorites (
            Id VARCHAR(36) PRIMARY KEY,
            UserId VARCHAR(36) NOT NULL,
            MessageId VARCHAR(36) NULL,
            Text TEXT NULL,
            ImageUrl VARCHAR(500) NULL,
            SourceUsername VARCHAR(50) NULL,
            SourceDisplayName VARCHAR(100) NULL,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

        # 8. Покупки в магазине
        """CREATE TABLE IF NOT EXISTS UserItems (
            Id VARCHAR(36) PRIMARY KEY,
            UserId VARCHAR(36) NOT NULL,
            ItemId VARCHAR(50) NOT NULL,
            ItemType VARCHAR(20) NOT NULL,
            ItemName VARCHAR(50) NOT NULL,
            Cost INT NOT NULL,
            PurchasedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_item (UserId, ItemId),
            FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

        # 9. Статусы пользователей
        """CREATE TABLE IF NOT EXISTS UserStatuses (
            Id VARCHAR(36) PRIMARY KEY,
            UserId VARCHAR(36) NOT NULL,
            StatusId VARCHAR(50) NOT NULL,
            EarnedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            IsSelected TINYINT(1) DEFAULT 0,
            UNIQUE KEY uq_user_status (UserId, StatusId),
            FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

        # 10. Реакции на сообщения
        """CREATE TABLE IF NOT EXISTS MessageReactions (
            Id VARCHAR(36) PRIMARY KEY,
            MessageId VARCHAR(36) NOT NULL,
            MessageType VARCHAR(20) NOT NULL,
            UserId VARCHAR(36) NOT NULL,
            Reaction VARCHAR(10) NOT NULL,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_reaction (MessageId, MessageType, UserId),
            FOREIGN KEY (UserId) REFERENCES Users(Id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

        # 11. Лог активности (очки)
        """CREATE TABLE IF NOT EXISTS ActivityLog (
            Id VARCHAR(36) PRIMARY KEY,
            UserId VARCHAR(36) NOT NULL,
            Amount FLOAT NOT NULL,
            Reason VARCHAR(100) NOT NULL,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

        # 12. Задания
        """CREATE TABLE IF NOT EXISTS UserTasks (
            Id VARCHAR(36) PRIMARY KEY,
            UserId VARCHAR(36) NOT NULL,
            TaskId VARCHAR(50) NOT NULL,
            Progress INT DEFAULT 0,
            Completed TINYINT(1) DEFAULT 0,
            Claimed TINYINT(1) DEFAULT 0,
            LastReset DATE DEFAULT (CURRENT_DATE),
            ClaimedAt DATETIME NULL,
            UNIQUE KEY uq_user_task (UserId, TaskId),
            FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    ]

    for sql in tables:
        try:
            cursor.execute(sql)
        except Exception as e:
            print(f"⚠️  Таблица: {e}")

    conn.commit()
    print("✅ Все таблицы созданы/проверены")


def create_indexes(conn):
    cursor = conn.cursor()
    indexes = [
        ("idx_users_telegram",   "Users",           "CREATE INDEX idx_users_telegram ON Users(TelegramId)"),
        ("idx_sessions_token",   "Sessions",         "CREATE INDEX idx_sessions_token ON Sessions(Token)"),
        ("idx_sessions_user",    "Sessions",         "CREATE INDEX idx_sessions_user ON Sessions(UserId)"),
        ("idx_authcodes_code",   "AuthCodes",        "CREATE INDEX idx_authcodes_code ON AuthCodes(Code)"),
        ("idx_messages_created", "Messages",         "CREATE INDEX idx_messages_created ON Messages(CreatedAt)"),
        ("idx_pm_from",          "PrivateMessages",  "CREATE INDEX idx_pm_from ON PrivateMessages(FromUserId)"),
        ("idx_pm_to",            "PrivateMessages",  "CREATE INDEX idx_pm_to ON PrivateMessages(ToUserId)"),
        ("idx_friends_user",     "Friends",          "CREATE INDEX idx_friends_user ON Friends(UserId)"),
        ("idx_friends_friend",   "Friends",          "CREATE INDEX idx_friends_friend ON Friends(FriendId)"),
        ("idx_activity_user",    "ActivityLog",      "CREATE INDEX idx_activity_user ON ActivityLog(UserId)"),
        ("idx_tasks_user",       "UserTasks",        "CREATE INDEX idx_tasks_user ON UserTasks(UserId)"),
    ]
    for idx_name, table, sql in indexes:
        try:
            cursor.execute(f"SHOW INDEX FROM {table} WHERE Key_name = %s", (idx_name,))
            if not cursor.fetchone():
                cursor.execute(sql)
                print(f"   ✅ Индекс {idx_name}")
        except Exception as e:
            print(f"   ⚠️  Индекс {idx_name}: {e}")
    conn.commit()
    print("✅ Индексы созданы")


def init_full_db():
    from server.database import get_db
    print("🔄 Инициализация структуры БД (MySQL)...")
    with get_db() as conn:
        create_all_tables(conn)
        create_indexes(conn)
    print("✅ БД инициализирована")
