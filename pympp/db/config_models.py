"""
Global config data model definitions
Single global configuration shared across all sessions
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


def _to_bool(value, default: bool = True) -> bool:
    """Normalize sqlite/json values to Python bool."""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {"1", "true", "yes", "on"}:
            return True
        if v in {"0", "false", "no", "off"}:
            return False
    return bool(value)


@dataclass
class GlobalConfig:
    """Global configuration singleton"""
    id: int = 1  # Single row, always id=1

    # Feature toggles
    show_quiz: bool = True
    show_exercise: bool = True
    show_exercise_part1: bool = True  # AT Method
    show_exercise_part2: bool = True  # Strategy Matrix

    # Editor config
    editor_fullscreen: bool = True
    editor_editing: bool = True

    # Controls config
    controls_step: bool = True
    controls_step_back: bool = True
    controls_run: bool = True
    controls_continue: bool = True
    controls_pause: bool = True
    controls_reset: bool = True

    # UI config
    ui_show_pipeline: bool = True
    ui_show_registers: bool = True
    ui_show_memory: bool = True
    ui_forwarding_visualization: bool = True
    ui_change_visualization: bool = True

    # Debug config
    debug_pc_input: bool = True
    debug_manual_pc: bool = True
    debug_cycle_slider: bool = True

    updated_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'show_quiz': self.show_quiz,
            'show_exercise': self.show_exercise,
            'show_exercise_part1': self.show_exercise_part1,
            'show_exercise_part2': self.show_exercise_part2,
            'editor_fullscreen': self.editor_fullscreen,
            'editor_editing': self.editor_editing,
            'controls_step': self.controls_step,
            'controls_step_back': self.controls_step_back,
            'controls_run': self.controls_run,
            'controls_continue': self.controls_continue,
            'controls_pause': self.controls_pause,
            'controls_reset': self.controls_reset,
            'ui_show_pipeline': self.ui_show_pipeline,
            'ui_show_registers': self.ui_show_registers,
            'ui_show_memory': self.ui_show_memory,
            'ui_forwarding_visualization': self.ui_forwarding_visualization,
            'ui_change_visualization': self.ui_change_visualization,
            'debug_pc_input': self.debug_pc_input,
            'debug_manual_pc': self.debug_manual_pc,
            'debug_cycle_slider': self.debug_cycle_slider,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'GlobalConfig':
        """Create from dictionary"""
        return cls(
            id=data.get('id', 1),
            show_quiz=_to_bool(data.get('show_quiz', True), True),
            show_exercise=_to_bool(data.get('show_exercise', True), True),
            show_exercise_part1=_to_bool(data.get('show_exercise_part1', True), True),
            show_exercise_part2=_to_bool(data.get('show_exercise_part2', True), True),
            editor_fullscreen=_to_bool(data.get('editor_fullscreen', True), True),
            editor_editing=_to_bool(data.get('editor_editing', True), True),
            controls_step=_to_bool(data.get('controls_step', True), True),
            controls_step_back=_to_bool(data.get('controls_step_back', True), True),
            controls_run=_to_bool(data.get('controls_run', True), True),
            controls_continue=_to_bool(data.get('controls_continue', True), True),
            controls_pause=_to_bool(data.get('controls_pause', True), True),
            controls_reset=_to_bool(data.get('controls_reset', True), True),
            ui_show_pipeline=_to_bool(data.get('ui_show_pipeline', True), True),
            ui_show_registers=_to_bool(data.get('ui_show_registers', True), True),
            ui_show_memory=_to_bool(data.get('ui_show_memory', True), True),
            ui_forwarding_visualization=_to_bool(data.get('ui_forwarding_visualization', True), True),
            ui_change_visualization=_to_bool(data.get('ui_change_visualization', True), True),
            debug_pc_input=_to_bool(data.get('debug_pc_input', True), True),
            debug_manual_pc=_to_bool(data.get('debug_manual_pc', True), True),
            debug_cycle_slider=_to_bool(data.get('debug_cycle_slider', True), True),
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None
        )