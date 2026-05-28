# server/routes/__init__.py
from . import telegram
from . import auth
from . import messages
from . import friends
from . import private_messages
from . import users
from . import shop
from . import activity
from . import tasks

__all__ = ['telegram', 'auth', 'messages', 'friends', 'private_messages', 'users', 'shop', 'activity', 'tasks']