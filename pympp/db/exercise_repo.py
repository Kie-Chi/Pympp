"""
SQLite implementation of Exercise data repository
Separate database from Quiz for independent tracking
"""
import sqlite3
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from .exercise_models import ExerciseSession, ExerciseRecord


class ExerciseRepository:
    """SQLite implementation of Exercise data repository"""

    def __init__(self, db_path: str = "data/exercise_records.db"):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.init_db()

    def init_db(self) -> None:
        """Initialize database table structure"""
        cursor = self.conn.cursor()

        # Create exercise_sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS exercise_sessions (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                total_questions INTEGER,
                correct_count INTEGER DEFAULT 0,
                part INTEGER DEFAULT 1,
                started_at TIMESTAMP,
                ended_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create exercise_records table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS exercise_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                exercise_session_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                instruction_name TEXT,
                question_index INTEGER,
                part INTEGER DEFAULT 1,
                user_tuse_rs INTEGER,
                user_tuse_rt INTEGER,
                user_tnew INTEGER,
                correct_tuse_rs TEXT,
                correct_tuse_rt TEXT,
                correct_tnew TEXT,
                matrix_row INTEGER,
                matrix_col INTEGER,
                user_answer TEXT,
                correct_answer TEXT,
                is_correct BOOLEAN,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (exercise_session_id) REFERENCES exercise_sessions(id)
            )
        """)

        # Create indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_exercise_records_session
            ON exercise_records(session_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_exercise_sessions_session
            ON exercise_sessions(session_id)
        """)

        self.conn.commit()

    def create_session(self, session: ExerciseSession) -> str:
        """Create a new Exercise session"""
        exercise_session_id = str(uuid.uuid4())
        now = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO exercise_sessions
            (id, session_id, total_questions, correct_count, part, started_at, created_at)
            VALUES (?, ?, ?, 0, ?, ?, ?)
        """, (
            exercise_session_id,
            session.session_id,
            session.total_questions,
            session.part,
            now,
            now
        ))
        self.conn.commit()

        return exercise_session_id

    def end_session(self, exercise_session_id: str) -> ExerciseSession:
        """End Exercise session - calculate correct_count from actual records"""
        now = datetime.now()

        cursor = self.conn.cursor()

        # Calculate actual correct count
        cursor.execute("""
            SELECT COUNT(*) as correct_count
            FROM exercise_records
            WHERE exercise_session_id = ? AND is_correct = 1
        """, (exercise_session_id,))
        actual_correct = cursor.fetchone()['correct_count']

        cursor.execute("""
            UPDATE exercise_sessions
            SET correct_count = ?, ended_at = ?
            WHERE id = ?
        """, (actual_correct, now, exercise_session_id))
        self.conn.commit()

        return self.get_session(exercise_session_id)

    def get_session(self, exercise_session_id: str) -> Optional[ExerciseSession]:
        """Get single Exercise session"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM exercise_sessions WHERE id = ?", (exercise_session_id,))
        row = cursor.fetchone()
        if row is None:
            return None
        return self._row_to_session(row)

    def get_sessions_by_user(self, session_id: str, limit: int = 50) -> List[ExerciseSession]:
        """Get user's Exercise session list"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM exercise_sessions
            WHERE session_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (session_id, limit))
        return [self._row_to_session(row) for row in cursor.fetchall()]

    def save_record(self, record: ExerciseRecord) -> int:
        """Save exercise answer record"""
        now = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO exercise_records
            (exercise_session_id, session_id, instruction_name, question_index, part,
             user_tuse_rs, user_tuse_rt, user_tnew,
             correct_tuse_rs, correct_tuse_rt, correct_tnew,
             matrix_row, matrix_col, user_answer, correct_answer,
             is_correct, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record.exercise_session_id,
            record.session_id,
            record.instruction_name,
            record.question_index,
            record.part,
            record.user_tuse_rs,
            record.user_tuse_rt,
            record.user_tnew,
            record.correct_tuse_rs,
            record.correct_tuse_rt,
            record.correct_tnew,
            record.matrix_row,
            record.matrix_col,
            record.user_answer,
            record.correct_answer,
            record.is_correct,
            now
        ))
        self.conn.commit()

        return cursor.lastrowid

    def get_records_by_session(self, exercise_session_id: str) -> List[ExerciseRecord]:
        """Get all records for an Exercise session"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM exercise_records
            WHERE exercise_session_id = ?
            ORDER BY question_index
        """, (exercise_session_id,))
        return [self._row_to_record(row) for row in cursor.fetchall()]

    def get_records_by_user(self, session_id: str, limit: int = 100) -> List[ExerciseRecord]:
        """Get all records for a user"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM exercise_records
            WHERE session_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (session_id, limit))
        return [self._row_to_record(row) for row in cursor.fetchall()]

    def get_stats_by_user(self, session_id: str) -> Dict[str, Any]:
        """Get user statistics"""
        cursor = self.conn.cursor()

        cursor.execute("SELECT COUNT(*) as count FROM exercise_sessions WHERE session_id = ?", (session_id,))
        total_sessions = cursor.fetchone()['count']

        cursor.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct
            FROM exercise_records WHERE session_id = ?
        """, (session_id,))
        row = cursor.fetchone()
        total_questions = row['total'] or 0
        correct_count = row['correct'] or 0
        accuracy_rate = correct_count / total_questions if total_questions > 0 else 0.0

        cursor.execute("""
            SELECT instruction_name, COUNT(*) as wrong_count
            FROM exercise_records
            WHERE session_id = ? AND is_correct = 0 AND part = 1
            GROUP BY instruction_name
            ORDER BY wrong_count DESC
            LIMIT 5
        """, (session_id,))
        most_wrong = [row['instruction_name'] for row in cursor.fetchall() if row['instruction_name']]

        return {
            'total_sessions': total_sessions,
            'total_questions': total_questions,
            'correct_count': correct_count,
            'accuracy_rate': accuracy_rate,
            'most_wrong_instructions': most_wrong,
        }

    # Admin methods
    def get_all_sessions(self, limit: int = 100) -> List[ExerciseSession]:
        """Get all exercise sessions"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM exercise_sessions ORDER BY created_at DESC LIMIT ?", (limit,))
        return [self._row_to_session(row) for row in cursor.fetchall()]

    def get_all_records(self, limit: int = 100) -> List[ExerciseRecord]:
        """Get all exercise records"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM exercise_records ORDER BY created_at DESC LIMIT ?", (limit,))
        return [self._row_to_record(row) for row in cursor.fetchall()]

    def get_global_stats(self) -> Dict[str, Any]:
        """Get global statistics"""
        cursor = self.conn.cursor()

        cursor.execute("SELECT COUNT(*) as count FROM exercise_sessions")
        total_sessions = cursor.fetchone()['count']

        cursor.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct
            FROM exercise_records
        """)
        row = cursor.fetchone()
        total_questions = row['total'] or 0
        correct_count = row['correct'] or 0
        accuracy_rate = correct_count / total_questions if total_questions > 0 else 0.0

        cursor.execute("""
            SELECT instruction_name, COUNT(*) as wrong_count
            FROM exercise_records
            WHERE is_correct = 0 AND part = 1 AND instruction_name IS NOT NULL
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

    def close(self) -> None:
        """Close database connection"""
        self.conn.close()

    def _row_to_session(self, row: sqlite3.Row) -> ExerciseSession:
        return ExerciseSession(
            id=row['id'],
            session_id=row['session_id'],
            total_questions=row['total_questions'],
            correct_count=row['correct_count'],
            part=row['part'],
            started_at=self._parse_datetime(row['started_at']),
            ended_at=self._parse_datetime(row['ended_at']),
            created_at=self._parse_datetime(row['created_at']),
        )

    def _row_to_record(self, row: sqlite3.Row) -> ExerciseRecord:
        return ExerciseRecord(
            id=row['id'],
            exercise_session_id=row['exercise_session_id'],
            session_id=row['session_id'],
            instruction_name=row['instruction_name'] or "",
            question_index=row['question_index'] or 0,
            part=row['part'] or 1,
            user_tuse_rs=row['user_tuse_rs'],
            user_tuse_rt=row['user_tuse_rt'],
            user_tnew=row['user_tnew'],
            correct_tuse_rs=row['correct_tuse_rs'] or "",
            correct_tuse_rt=row['correct_tuse_rt'] or "",
            correct_tnew=row['correct_tnew'] or "",
            matrix_row=row['matrix_row'],
            matrix_col=row['matrix_col'],
            user_answer=row['user_answer'] or "",
            correct_answer=row['correct_answer'] or "",
            is_correct=bool(row['is_correct']),
            created_at=self._parse_datetime(row['created_at']),
        )

    def _parse_datetime(self, value: Optional[str]) -> Optional[datetime]:
        if value is None:
            return None
        try:
            return datetime.fromisoformat(value)
        except (ValueError, TypeError):
            return None


# Singleton instance
_default_repo: Optional[ExerciseRepository] = None


def get_exercise_repository(db_path: str = "data/exercise_records.db") -> ExerciseRepository:
    """Get repository instance (singleton)"""
    global _default_repo
    if _default_repo is None:
        _default_repo = ExerciseRepository(db_path)
    return _default_repo