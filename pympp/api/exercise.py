"""
Exercise API endpoints
Provides backend API interfaces for Exercise functionality (课后练习)
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
from datetime import datetime

from ..db.exercise_repo import get_exercise_repository, ExerciseRepository
from ..db.exercise_models import ExerciseSession as ExerciseSessionModel
from ..db.exercise_models import ExerciseRecord as ExerciseRecordModel
from .schema import (
    ExerciseStartRequest, ExerciseStartResponse,
    ExerciseAnswerRequest, ExerciseAnswerResponse,
    ExerciseSessionSummary, ExerciseRecordItem,
    ExerciseHistoryResponse, ExerciseStatsResponse
)
from ..log import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/exercise", tags=["exercise"])


def get_exercise_repo() -> ExerciseRepository:
    """Get Exercise repository instance"""
    return get_exercise_repository()


def get_session_id(x_session_id: Optional[str] = Header(None, alias="X-Session-ID")) -> str:
    """Get user session ID"""
    if not x_session_id:
        raise HTTPException(status_code=400, detail="Session ID is required")
    return x_session_id


@router.post("/start", response_model=ExerciseStartResponse)
def start_exercise(
    req: ExerciseStartRequest,
    session_id: str = Depends(get_session_id),
    repo: ExerciseRepository = Depends(get_exercise_repo)
):
    """Start a new Exercise session"""
    exercise_session = ExerciseSessionModel(
        id="",
        session_id=session_id,
        total_questions=req.total_questions,
        part=req.part,
    )

    exercise_session_id = repo.create_session(exercise_session)
    session = repo.get_session(exercise_session_id)

    logger.info(f"Started exercise session {exercise_session_id} for user {session_id}, part={req.part}")

    return ExerciseStartResponse(
        exercise_session_id=exercise_session_id,
        part=req.part,
        started_at=session.started_at or datetime.now()
    )


@router.post("/record_answer", response_model=ExerciseAnswerResponse)
def record_answer(
    req: ExerciseAnswerRequest,
    session_id: str = Depends(get_session_id),
    repo: ExerciseRepository = Depends(get_exercise_repo)
):
    """Record a single exercise answer"""
    exercise_session = repo.get_session(req.exercise_session_id)
    if exercise_session is None:
        raise HTTPException(status_code=404, detail="Exercise session not found")

    if exercise_session.session_id != session_id:
        raise HTTPException(status_code=403, detail="Exercise session does not belong to this user")

    record = ExerciseRecordModel(
        exercise_session_id=req.exercise_session_id,
        session_id=session_id,
        instruction_name=req.instruction_name,
        question_index=req.question_index,
        part=req.part,
        user_tuse_rs=req.user_tuse_rs,
        user_tuse_rt=req.user_tuse_rt,
        user_tnew=req.user_tnew,
        correct_tuse_rs=req.correct_tuse_rs,
        correct_tuse_rt=req.correct_tuse_rt,
        correct_tnew=req.correct_tnew,
        matrix_row=req.matrix_row,
        matrix_col=req.matrix_col,
        user_answer=req.user_answer,
        correct_answer=req.correct_answer,
        is_correct=req.is_correct,
    )

    record_id = repo.save_record(record)
    logger.info(f"Recorded exercise answer for {req.instruction_name}: correct={req.is_correct}")

    return ExerciseAnswerResponse(record_id=record_id, success=True)


@router.post("/end", response_model=ExerciseSessionSummary)
def end_exercise(
    exercise_session_id: str,
    session_id: str = Depends(get_session_id),
    repo: ExerciseRepository = Depends(get_exercise_repo)
):
    """End Exercise session"""
    exercise_session = repo.get_session(exercise_session_id)
    if exercise_session is None:
        raise HTTPException(status_code=404, detail="Exercise session not found")

    if exercise_session.session_id != session_id:
        raise HTTPException(status_code=403, detail="Exercise session does not belong to this user")

    updated_session = repo.end_session(exercise_session_id)
    records = repo.get_records_by_session(exercise_session_id)
    actual_answered = len(records)

    logger.info(f"Ended exercise session {exercise_session_id}: score={updated_session.correct_count}")

    return ExerciseSessionSummary(
        exercise_session_id=exercise_session_id,
        session_id=session_id,
        total_questions=updated_session.total_questions,
        actual_answered=actual_answered,
        correct_count=updated_session.correct_count,
        part=updated_session.part,
        started_at=updated_session.started_at,
        ended_at=updated_session.ended_at
    )


@router.get("/history", response_model=ExerciseHistoryResponse)
def get_history(
    session_id: str = Depends(get_session_id),
    repo: ExerciseRepository = Depends(get_exercise_repo)
):
    """Get user's Exercise history"""
    sessions = repo.get_sessions_by_user(session_id)
    records = repo.get_records_by_user(session_id, limit=100)

    session_summaries = [
        ExerciseSessionSummary(
            exercise_session_id=s.id,
            session_id=s.session_id,
            total_questions=s.total_questions,
            actual_answered=len(repo.get_records_by_session(s.id)),
            correct_count=s.correct_count,
            part=s.part,
            started_at=s.started_at,
            ended_at=s.ended_at
        )
        for s in sessions
    ]

    record_items = [
        ExerciseRecordItem(
            id=r.id,
            instruction_name=r.instruction_name,
            question_index=r.question_index,
            part=r.part,
            user_tuse_rs=r.user_tuse_rs,
            user_tuse_rt=r.user_tuse_rt,
            user_tnew=r.user_tnew,
            correct_tuse_rs=r.correct_tuse_rs,
            correct_tuse_rt=r.correct_tuse_rt,
            correct_tnew=r.correct_tnew,
            matrix_row=r.matrix_row,
            matrix_col=r.matrix_col,
            user_answer=r.user_answer,
            correct_answer=r.correct_answer,
            is_correct=r.is_correct,
            created_at=r.created_at
        )
        for r in records
    ]

    return ExerciseHistoryResponse(sessions=session_summaries, records=record_items)


@router.get("/stats", response_model=ExerciseStatsResponse)
def get_stats(
    session_id: str = Depends(get_session_id),
    repo: ExerciseRepository = Depends(get_exercise_repo)
):
    """Get user's Exercise statistics"""
    stats = repo.get_stats_by_user(session_id)
    return ExerciseStatsResponse(**stats)


# === Admin APIs ===

@router.get("/admin/sessions")
def get_all_sessions(
    repo: ExerciseRepository = Depends(get_exercise_repo)
):
    """Get all exercise sessions (admin view)"""
    sessions = repo.get_all_sessions()
    result = []
    for s in sessions:
        records = repo.get_records_by_session(s.id)
        result.append({
            "exercise_session_id": s.id,
            "session_id": s.session_id,
            "total_questions": s.total_questions,
            "actual_answered": len(records),
            "correct_count": s.correct_count,
            "part": s.part,
            "started_at": s.started_at,
            "ended_at": s.ended_at,
        })
    return result


@router.get("/admin/stats", response_model=ExerciseStatsResponse)
def get_global_stats(
    repo: ExerciseRepository = Depends(get_exercise_repo)
):
    """Get global statistics for all students"""
    stats = repo.get_global_stats()
    return ExerciseStatsResponse(**stats)


@router.get("/admin/records")
def get_all_records(
    limit: int = 100,
    repo: ExerciseRepository = Depends(get_exercise_repo)
):
    """Get all exercise records (admin view)"""
    records = repo.get_all_records(limit)
    return [
        ExerciseRecordItem(
            id=r.id,
            instruction_name=r.instruction_name,
            question_index=r.question_index,
            part=r.part,
            user_tuse_rs=r.user_tuse_rs,
            user_tuse_rt=r.user_tuse_rt,
            user_tnew=r.user_tnew,
            correct_tuse_rs=r.correct_tuse_rs,
            correct_tuse_rt=r.correct_tuse_rt,
            correct_tnew=r.correct_tnew,
            matrix_row=r.matrix_row,
            matrix_col=r.matrix_col,
            user_answer=r.user_answer,
            correct_answer=r.correct_answer,
            is_correct=r.is_correct,
            created_at=r.created_at
        )
        for r in records
    ]