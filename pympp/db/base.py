"""
Quiz database abstraction interface
Defines Repository interface for easy switching between different database implementations
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

from .models import QuizSession, QuizRecord


class QuizRepository(ABC):
    """Quiz data repository abstract interface"""

    @abstractmethod
    def init_db(self) -> None:
        """Initialize database (create tables, etc.)"""
        pass

    @abstractmethod
    def create_session(self, session: QuizSession) -> str:
        """
        Create a new Quiz session
        Returns quiz_session_id
        """
        pass

    @abstractmethod
    def end_session(self, quiz_session_id: str, correct_count: int) -> QuizSession:
        """
        End Quiz session, update correct count and end time
        Returns updated session info
        """
        pass

    @abstractmethod
    def get_session(self, quiz_session_id: str) -> Optional[QuizSession]:
        """Get single Quiz session"""
        pass

    @abstractmethod
    def get_sessions_by_user(self, session_id: str, limit: int = 50) -> List[QuizSession]:
        """Get user's Quiz session list"""
        pass

    @abstractmethod
    def save_record(self, record: QuizRecord) -> int:
        """
        Save answer record
        Returns record ID
        """
        pass

    @abstractmethod
    def get_records_by_quiz_session(self, quiz_session_id: str) -> List[QuizRecord]:
        """Get all answer records for a Quiz session"""
        pass

    @abstractmethod
    def get_records_by_user(self, session_id: str, limit: int = 100) -> List[QuizRecord]:
        """Get all answer records for a user"""
        pass

    @abstractmethod
    def get_stats_by_user(self, session_id: str) -> Dict[str, Any]:
        """
        Get user statistics
        Returns: {
            'total_sessions': int,
            'total_questions': int,
            'correct_count': int,
            'accuracy_rate': float,
            'most_wrong_instructions': List[str],
        }
        """
        pass

    @abstractmethod
    def close(self) -> None:
        """Close database connection"""
        pass

    # === Admin methods (for global statistics) ===

    @abstractmethod
    def get_all_sessions(self, limit: int = 100) -> List[QuizSession]:
        """Get all quiz sessions (admin view)"""
        pass

    @abstractmethod
    def get_all_records(self, limit: int = 100) -> List[QuizRecord]:
        """Get all answer records (admin view)"""
        pass

    @abstractmethod
    def get_global_stats(self) -> Dict[str, Any]:
        """
        Get global statistics for all users
        Returns: {
            'total_sessions': int,
            'total_questions': int,
            'correct_count': int,
            'accuracy_rate': float,
            'most_wrong_instructions': List[str],
        }
        """
        pass