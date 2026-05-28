# server/db_models.py
"""Полная модель базы данных Star Sky для SQL Server"""

import uuid
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

# ===== ФУНКЦИИ ДЛЯ РАБОТЫ С БД =====

def create_all_tables(conn):
    """Создаёт все таблицы, если их нет"""
    cursor = conn.cursor()
    
    # 1. Таблица пользователей
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
        BEGIN
            CREATE TABLE Users (
                Id NVARCHAR(36) PRIMARY KEY,
                TelegramId BIGINT NULL,
                GoogleId NVARCHAR(100) NULL,
                Username NVARCHAR(50) UNIQUE NOT NULL,
                DisplayName NVARCHAR(100) NOT NULL,
                Email NVARCHAR(100) NULL,
                PasswordHash NVARCHAR(255) NULL,
                AvatarUrl NVARCHAR(500) NULL,
                Bio NVARCHAR(500) NULL,
                StarColor NVARCHAR(20) DEFAULT '#ffffff',
                StarEffect NVARCHAR(50) NULL,
                ActivityScore FLOAT DEFAULT 0,
                MessagesCount INT DEFAULT 0,
                DaysActive INT DEFAULT 0,
                FriendsCount INT DEFAULT 0,
                IsOnline INT DEFAULT 0,
                LastSeen DATETIME NULL,
                SelectedStatusId NVARCHAR(50) NULL,
                CursorStarEnabled INT DEFAULT 0,
                Provider NVARCHAR(20) DEFAULT 'telegram',
                CreatedAt DATETIME DEFAULT GETDATE(),
                UpdatedAt DATETIME DEFAULT GETDATE()
            )
        END
    ''')
    
    # 2. Таблица сессий
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Sessions' AND xtype='U')
        BEGIN
            CREATE TABLE Sessions (
                Id NVARCHAR(36) PRIMARY KEY,
                UserId NVARCHAR(36) NOT NULL,
                Token NVARCHAR(255) NOT NULL UNIQUE,
                ExpiresAt DATETIME NOT NULL,
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
            )
        END
    ''')
    
    # 3. Таблица кодов авторизации
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AuthCodes' AND xtype='U')
        BEGIN
            CREATE TABLE AuthCodes (
                Id NVARCHAR(36) PRIMARY KEY,
                Code NVARCHAR(10) NOT NULL UNIQUE,
                UserId NVARCHAR(36) NOT NULL,
                ExpiresAt DATETIME NOT NULL,
                IsUsed INT DEFAULT 0,
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
            )
        END
    ''')
    
    # 4. Таблица друзей
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Friends' AND xtype='U')
        BEGIN
            CREATE TABLE Friends (
                Id NVARCHAR(36) PRIMARY KEY,
                UserId NVARCHAR(36) NOT NULL,
                FriendId NVARCHAR(36) NOT NULL,
                Status NVARCHAR(20) DEFAULT 'pending',
                CreatedAt DATETIME DEFAULT GETDATE(),
                UpdatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
                FOREIGN KEY (FriendId) REFERENCES Users(Id),
                UNIQUE(UserId, FriendId)
            )
        END
    ''')
    
    # 5. Таблица сообщений (общий чат)
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Messages' AND xtype='U')
        BEGIN
            CREATE TABLE Messages (
                Id NVARCHAR(36) PRIMARY KEY,
                UserId NVARCHAR(36) NOT NULL,
                Text NVARCHAR(MAX) NOT NULL,
                ReplyTo NVARCHAR(36) NULL,
                IsEdited INT DEFAULT 0,
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
            )
        END
    ''')
    
    # 6. Таблица личных сообщений
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PrivateMessages' AND xtype='U')
        BEGIN
            CREATE TABLE PrivateMessages (
                Id NVARCHAR(36) PRIMARY KEY,
                FromUserId NVARCHAR(36) NOT NULL,
                ToUserId NVARCHAR(36) NOT NULL,
                Text NVARCHAR(MAX) NOT NULL,
                IsRead INT DEFAULT 0,
                IsEdited INT DEFAULT 0,
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (FromUserId) REFERENCES Users(Id),
                FOREIGN KEY (ToUserId) REFERENCES Users(Id)
            )
        END
    ''')
    
    # 7. Таблица избранных сообщений
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Favorites' AND xtype='U')
        BEGIN
            CREATE TABLE Favorites (
                Id NVARCHAR(36) PRIMARY KEY,
                UserId NVARCHAR(36) NOT NULL,
                MessageId NVARCHAR(36) NULL,
                Text NVARCHAR(MAX) NULL,
                ImageUrl NVARCHAR(500) NULL,
                SourceUsername NVARCHAR(50) NULL,
                SourceDisplayName NVARCHAR(100) NULL,
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
            )
        END
    ''')
    
    # 8. Таблица покупок в магазине
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserItems' AND xtype='U')
        BEGIN
            CREATE TABLE UserItems (
                Id NVARCHAR(36) PRIMARY KEY,
                UserId NVARCHAR(36) NOT NULL,
                ItemId NVARCHAR(50) NOT NULL,
                ItemType NVARCHAR(20) NOT NULL,
                ItemName NVARCHAR(50) NOT NULL,
                Cost INT NOT NULL,
                PurchasedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
                UNIQUE(UserId, ItemId)
            )
        END
    ''')
    
    # 9. Таблица созвездий
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Constellations' AND xtype='U')
        BEGIN
            CREATE TABLE Constellations (
                Id NVARCHAR(36) PRIMARY KEY,
                Name NVARCHAR(100) NOT NULL,
                CreatorId NVARCHAR(36) NOT NULL,
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (CreatorId) REFERENCES Users(Id)
            )
        END
    ''')
    
    # 10. Таблица участников созвездий
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ConstellationMembers' AND xtype='U')
        BEGIN
            CREATE TABLE ConstellationMembers (
                Id NVARCHAR(36) PRIMARY KEY,
                ConstellationId NVARCHAR(36) NOT NULL,
                UserId NVARCHAR(36) NOT NULL,
                JoinedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (ConstellationId) REFERENCES Constellations(Id) ON DELETE CASCADE,
                FOREIGN KEY (UserId) REFERENCES Users(Id),
                UNIQUE(ConstellationId, UserId)
            )
        END
    ''')
    
    # 11. Таблица сообщений созвездий
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ConstellationMessages' AND xtype='U')
        BEGIN
            CREATE TABLE ConstellationMessages (
                Id NVARCHAR(36) PRIMARY KEY,
                ConstellationId NVARCHAR(36) NOT NULL,
                UserId NVARCHAR(36) NOT NULL,
                Text NVARCHAR(MAX) NOT NULL,
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (ConstellationId) REFERENCES Constellations(Id) ON DELETE CASCADE,
                FOREIGN KEY (UserId) REFERENCES Users(Id)
            )
        END
    ''')
    
    # 12. Таблица статусов пользователей
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserStatuses' AND xtype='U')
        BEGIN
            CREATE TABLE UserStatuses (
                Id NVARCHAR(36) PRIMARY KEY,
                UserId NVARCHAR(36) NOT NULL,
                StatusId NVARCHAR(50) NOT NULL,
                EarnedAt DATETIME DEFAULT GETDATE(),
                IsSelected INT DEFAULT 0,
                FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
                UNIQUE(UserId, StatusId)
            )
        END
    ''')
    
    # 13. Таблица реакций на сообщения
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MessageReactions' AND xtype='U')
        BEGIN
            CREATE TABLE MessageReactions (
                Id NVARCHAR(36) PRIMARY KEY,
                MessageId NVARCHAR(36) NOT NULL,
                MessageType NVARCHAR(20) NOT NULL,
                UserId NVARCHAR(36) NOT NULL,
                Reaction NVARCHAR(10) NOT NULL,
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (UserId) REFERENCES Users(Id),
                UNIQUE(MessageId, MessageType, UserId)
            )
        END
    ''')

    # 14. Таблица истории очков активности
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ActivityLog' AND xtype='U')
        BEGIN
            CREATE TABLE ActivityLog (
                Id NVARCHAR(36) PRIMARY KEY,
                UserId NVARCHAR(36) NOT NULL,
                Amount FLOAT NOT NULL,
                Reason NVARCHAR(100) NOT NULL,
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
            )
        END
    ''')

    # 15. Таблица прогресса заданий (сбрасывается ежедневно)
    cursor.execute('''
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserTasks' AND xtype='U')
        BEGIN
            CREATE TABLE UserTasks (
                Id NVARCHAR(36) PRIMARY KEY,
                UserId NVARCHAR(36) NOT NULL,
                TaskId NVARCHAR(50) NOT NULL,
                Progress INT DEFAULT 0,
                Completed INT DEFAULT 0,
                Claimed INT DEFAULT 0,
                LastReset DATE DEFAULT CAST(GETDATE() AS DATE),
                ClaimedAt DATETIME NULL,
                FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
                UNIQUE(UserId, TaskId)
            )
        END
    ''')

    conn.commit()
    print("✅ Все таблицы созданы/проверены")


def create_indexes(conn):
    """Создаёт индексы для ускорения запросов"""
    cursor = conn.cursor()
    
    indexes = [
        ("idx_users_username", "Users", "CREATE INDEX idx_users_username ON Users(Username)"),
        ("idx_users_telegram", "Users", "CREATE INDEX idx_users_telegram ON Users(TelegramId)"),
        ("idx_sessions_token", "Sessions", "CREATE INDEX idx_sessions_token ON Sessions(Token)"),
        ("idx_sessions_user", "Sessions", "CREATE INDEX idx_sessions_user ON Sessions(UserId)"),
        ("idx_authcodes_code", "AuthCodes", "CREATE INDEX idx_authcodes_code ON AuthCodes(Code)"),
        ("idx_messages_created", "Messages", "CREATE INDEX idx_messages_created ON Messages(CreatedAt)"),
        ("idx_messages_user", "Messages", "CREATE INDEX idx_messages_user ON Messages(UserId)"),
        ("idx_privatemessages_from", "PrivateMessages", "CREATE INDEX idx_privatemessages_from ON PrivateMessages(FromUserId)"),
        ("idx_privatemessages_to", "PrivateMessages", "CREATE INDEX idx_privatemessages_to ON PrivateMessages(ToUserId)"),
        ("idx_privatemessages_created", "PrivateMessages", "CREATE INDEX idx_privatemessages_created ON PrivateMessages(CreatedAt)"),
        ("idx_favorites_user", "Favorites", "CREATE INDEX idx_favorites_user ON Favorites(UserId)"),
        ("idx_friends_user", "Friends", "CREATE INDEX idx_friends_user ON Friends(UserId)"),
        ("idx_friends_friend", "Friends", "CREATE INDEX idx_friends_friend ON Friends(FriendId)"),
        ("idx_constellationmembers_constellation", "ConstellationMembers", "CREATE INDEX idx_constellationmembers_constellation ON ConstellationMembers(ConstellationId)"),
        ("idx_constellationmessages_constellation", "ConstellationMessages", "CREATE INDEX idx_constellationmessages_constellation ON ConstellationMessages(ConstellationId)"),
        ("idx_useritems_user", "UserItems", "CREATE INDEX idx_useritems_user ON UserItems(UserId)"),
        ("idx_userstatuses_user", "UserStatuses", "CREATE INDEX idx_userstatuses_user ON UserStatuses(UserId)"),
        ("idx_messagereactions_message", "MessageReactions", "CREATE INDEX idx_messagereactions_message ON MessageReactions(MessageId, MessageType)"),
        ("idx_activitylog_user", "ActivityLog", "CREATE INDEX idx_activitylog_user ON ActivityLog(UserId)"),
        ("idx_activitylog_created", "ActivityLog", "CREATE INDEX idx_activitylog_created ON ActivityLog(UserId, CreatedAt DESC)"),
        ("idx_usertasks_user", "UserTasks", "CREATE INDEX idx_usertasks_user ON UserTasks(UserId)"),
    ]
    
    for idx_name, table_name, idx_sql in indexes:
        try:
            # SQL Server корректный синтаксис проверки существования индекса
            cursor.execute(f"""
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = ? AND object_id = OBJECT_ID(?))
                    DROP INDEX [{idx_name}] ON [{table_name}]
            """, (idx_name, table_name))
            cursor.execute(idx_sql)
            print(f"   ✅ Создан индекс: {idx_name}")
        except Exception as e:
            print(f"   ⚠️ Индекс {idx_name}: {e}")
    
    conn.commit()
    print("✅ Индексы созданы")


def init_full_db():
    """Полная инициализация базы данных"""
    from server.database import get_db
    
    print("🔄 Инициализация полной структуры БД...")
    
    with get_db() as conn:
        create_all_tables(conn)
        create_indexes(conn)

    print("✅ Полная инициализация БД завершена")