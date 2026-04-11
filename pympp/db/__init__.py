"""
Quiz database abstraction layer module
"""
from .base import QuizRepository, QuizSession, QuizRecord
from .sqlite_repo import SQLiteQuizRepository, get_repository

__all__ = [
    'QuizRepository',
    'QuizSession',
    'QuizRecord',
    'SQLiteQuizRepository',
    'get_repository',
]