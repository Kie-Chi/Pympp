"""
Exercise data model definitions
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class ExerciseSession:
    """Exercise session record"""
    id: str                              # UUID
    session_id: str                      # User session ID
    total_questions: int                 # Total number of questions
    correct_count: int = 0               # Number of correct answers
    part: int = 1                        # Part 1: AT method, Part 2: Strategy matrix
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


@dataclass
class ExerciseRecord:
    """Single exercise answer record"""
    exercise_session_id: str             # Exercise session ID
    session_id: str                      # User session ID
    instruction_name: str = ""           # Instruction name (for Part 1)
    question_index: int = 0              # Question index
    part: int = 1                        # Part 1 or Part 2
    # Part 1: AT method fields
    user_tuse_rs: Optional[int] = None
    user_tuse_rt: Optional[int] = None
    user_tnew: Optional[int] = None
    correct_tuse_rs: str = ""
    correct_tuse_rt: str = ""
    correct_tnew: str = ""
    # Part 2: Strategy matrix fields (to be defined later)
    matrix_row: Optional[int] = None     # Row index in matrix
    matrix_col: Optional[int] = None     # Column index in matrix
    user_answer: str = ""                # User's answer for matrix cell
    correct_answer: str = ""             # Correct answer for matrix cell
    # Common fields
    is_correct: bool = False
    id: Optional[int] = None
    created_at: Optional[datetime] = None