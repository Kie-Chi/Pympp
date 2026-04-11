"""
SQLite implementation of Quiz data repository
Uses Python standard library sqlite3, no extra dependencies needed
"""
import sqlite3
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from .base import QuizRepository
from .models import QuizSession, QuizRecord


class SQLiteQuizRepository(QuizRepository):
    """SQLite implementation of Quiz data repository"""

    def __init__(self, db_path: str = "data/quiz_records.db"):
        self.db_path = db_path
        # Ensure data directory exists
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.init_db()

    def init_db(self) -> None:
        """Initialize database table structure"""
        cursor = self.conn.cursor()

        # Create quiz_sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS quiz_sessions (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                total_questions INTEGER,
                correct_count INTEGER DEFAULT 0,
                started_at TIMESTAMP,
                ended_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create quiz_records table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS quiz_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                quiz_session_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                instruction_name TEXT NOT NULL,
                question_index INTEGER,
                user_tuse_rs INTEGER,
                user_tuse_rt INTEGER,
                user_tnew INTEGER,
                correct_tuse_rs TEXT,
                correct_tuse_rt TEXT,
                correct_tnew TEXT,
                is_correct BOOLEAN,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (quiz_session_id) REFERENCES quiz_sessions(id)
            )
        """)

        # Create indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_quiz_records_session
            ON quiz_records(session_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_quiz_records_quiz_session
            ON quiz_records(quiz_session_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_quiz_sessions_session
            ON quiz_sessions(session_id)
        """)

        self.conn.commit()

    def create_session(self, session: QuizSession) -> str:
        """Create a new Quiz session"""
        quiz_session_id = str(uuid.uuid4())
        now = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO quiz_sessions
            (id, session_id, total_questions, correct_count, started_at, created_at)
            VALUES (?, ?, ?, 0, ?, ?)
        """, (
            quiz_session_id,
            session.session_id,
            session.total_questions,
            now,
            now
        ))
        self.conn.commit()

        return quiz_session_id

    def end_session(self, quiz_session_id: str, correct_count: int) -> QuizSession:
        """End Quiz session - calculate correct_count from actual records"""
        now = datetime.now()

        # Calculate actual correct count from quiz_records
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) as correct_count
            FROM quiz_records
            WHERE quiz_session_id = ? AND is_correct = 1
        """, (quiz_session_id,))
        actual_correct = cursor.fetchone()['correct_count']

        # Calculate actual total answered
        cursor.execute("""
            SELECT COUNT(*) as total_answered
            FROM quiz_records
            WHERE quiz_session_id = ?
        """, (quiz_session_id,))
        total_answered = cursor.fetchone()['total_answered']

        # Update session with actual values
        cursor.execute("""
            UPDATE quiz_sessions
            SET correct_count = ?, ended_at = ?
            WHERE id = ?
        """, (actual_correct, now, quiz_session_id))
        self.conn.commit()

        return self.get_session(quiz_session_id)

    def get_session(self, quiz_session_id: str) -> Optional[QuizSession]:
        """Get single Quiz session"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM quiz_sessions WHERE id = ?
        """, (quiz_session_id,))
        row = cursor.fetchone()

        if row is None:
            return None

        return self._row_to_session(row)

    def get_sessions_by_user(self, session_id: str, limit: int = 50) -> List[QuizSession]:
        """Get user's Quiz session list"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM quiz_sessions
            WHERE session_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (session_id, limit))
        rows = cursor.fetchall()

        return [self._row_to_session(row) for row in rows]

    def save_record(self, record: QuizRecord) -> int:
        """Save answer record"""
        now = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO quiz_records
            (quiz_session_id, session_id, instruction_name, question_index,
             user_tuse_rs, user_tuse_rt, user_tnew,
             correct_tuse_rs, correct_tuse_rt, correct_tnew,
             is_correct, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record.quiz_session_id,
            record.session_id,
            record.instruction_name,
            record.question_index,
            record.user_tuse_rs,
            record.user_tuse_rt,
            record.user_tnew,
            record.correct_tuse_rs,
            record.correct_tuse_rt,
            record.correct_tnew,
            record.is_correct,
            now
        ))
        self.conn.commit()

        return cursor.lastrowid

    def get_records_by_quiz_session(self, quiz_session_id: str) -> List[QuizRecord]:
        """Get all answer records for a Quiz session"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM quiz_records
            WHERE quiz_session_id = ?
            ORDER BY question_index
        """, (quiz_session_id,))
        rows = cursor.fetchall()

        return [self._row_to_record(row) for row in rows]

    def get_records_by_user(self, session_id: str, limit: int = 100) -> List[QuizRecord]:
        """Get all answer records for a user"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM quiz_records
            WHERE session_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (session_id, limit))
        rows = cursor.fetchall()

        return [self._row_to_record(row) for row in rows]

    def get_stats_by_user(self, session_id: str) -> Dict[str, Any]:
        """Get user statistics"""
        cursor = self.conn.cursor()

        # Total sessions count
        cursor.execute("""
            SELECT COUNT(*) as count FROM quiz_sessions WHERE session_id = ?
        """, (session_id,))
        total_sessions = cursor.fetchone()['count']

        # Total questions and correct count
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct
            FROM quiz_records WHERE session_id = ?
        """, (session_id,))
        row = cursor.fetchone()
        total_questions = row['total']
        correct_count = row['correct'] if row['correct'] else 0

        # Accuracy rate
        accuracy_rate = correct_count / total_questions if total_questions > 0 else 0.0

        # Most frequently wrong instructions (top 5)
        cursor.execute("""
            SELECT instruction_name, COUNT(*) as wrong_count
            FROM quiz_records
            WHERE session_id = ? AND is_correct = 0
            GROUP BY instruction_name
            ORDER BY wrong_count DESC
            LIMIT 5
        """, (session_id,))
        most_wrong = [row['instruction_name'] for row in cursor.fetchall()]

        return {
            'total_sessions': total_sessions,
            'total_questions': total_questions,
            'correct_count': correct_count,
            'accuracy_rate': accuracy_rate,
            'most_wrong_instructions': most_wrong,
        }

    def _row_to_session(self, row: sqlite3.Row) -> QuizSession:
        """Convert database row to QuizSession"""
        return QuizSession(
            id=row['id'],
            session_id=row['session_id'],
            total_questions=row['total_questions'],
            correct_count=row['correct_count'],
            started_at=self._parse_datetime(row['started_at']),
            ended_at=self._parse_datetime(row['ended_at']),
            created_at=self._parse_datetime(row['created_at']),
        )

    def _row_to_record(self, row: sqlite3.Row) -> QuizRecord:
        """Convert database row to QuizRecord"""
        return QuizRecord(
            id=row['id'],
            quiz_session_id=row['quiz_session_id'],
            session_id=row['session_id'],
            instruction_name=row['instruction_name'],
            question_index=row['question_index'],
            user_tuse_rs=row['user_tuse_rs'],
            user_tuse_rt=row['user_tuse_rt'],
            user_tnew=row['user_tnew'],
            correct_tuse_rs=row['correct_tuse_rs'],
            correct_tuse_rt=row['correct_tuse_rt'],
            correct_tnew=row['correct_tnew'],
            is_correct=bool(row['is_correct']),
            created_at=self._parse_datetime(row['created_at']),
        )

    def _parse_datetime(self, value: Optional[str]) -> Optional[datetime]:
        """Parse datetime string from database"""
        if value is None:
            return None
        try:
            return datetime.fromisoformat(value)
        except (ValueError, TypeError):
            return None

    def close(self) -> None:
        """Close database connection"""
        self.conn.close()

    # === Admin methods (for global statistics) ===

    def get_all_sessions(self, limit: int = 100) -> List[QuizSession]:
        """Get all quiz sessions (admin view)"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM quiz_sessions
            ORDER BY created_at DESC
            LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        return [self._row_to_session(row) for row in rows]

    def get_all_records(self, limit: int = 100) -> List[QuizRecord]:
        """Get all answer records (admin view)"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM quiz_records
            ORDER BY created_at DESC
            LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        return [self._row_to_record(row) for row in rows]

    def get_global_stats(self) -> Dict[str, Any]:
        """Get global statistics for all users"""
        cursor = self.conn.cursor()

        # Total sessions count
        cursor.execute("SELECT COUNT(*) as count FROM quiz_sessions")
        total_sessions = cursor.fetchone()['count']

        # Total questions and correct count
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct
            FROM quiz_records
        """)
        row = cursor.fetchone()
        total_questions = row['total']
        correct_count = row['correct'] if row['correct'] else 0

        # Accuracy rate
        accuracy_rate = correct_count / total_questions if total_questions > 0 else 0.0

        # Most frequently wrong instructions (top 5)
        cursor.execute("""
            SELECT instruction_name, COUNT(*) as wrong_count
            FROM quiz_records
            WHERE is_correct = 0
            GROUP BY instruction_name
            ORDER BY wrong_count DESC
            LIMIT 5
        """)
        most_wrong = [row['instruction_name'] for row in cursor.fetchall()]

        return {
            'total_sessions': total_sessions,
            'total_questions': total_questions,
            'correct_count': correct_count,
            'accuracy_rate': accuracy_rate,
            'most_wrong_instructions': most_wrong,
        }


# Default repository instance (lazy initialization)
_default_repo: Optional[SQLiteQuizRepository] = None


def get_repository(db_path: str = "data/quiz_records.db") -> QuizRepository:
    """Get repository instance (singleton pattern)"""
    global _default_repo
    if _default_repo is None:
        _default_repo = SQLiteQuizRepository(db_path)
    return _default_repo