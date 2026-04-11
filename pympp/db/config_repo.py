"""
SQLite implementation of Global Config repository
Stores the singleton global configuration
"""
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

from .config_models import GlobalConfig


class ConfigRepository:
    """SQLite repository for global configuration"""

    _instance: Optional['ConfigRepository'] = None

    def __init__(self, db_path: str = "data/global_config.db"):
        self.db_path = db_path
        # Ensure data directory exists
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.init_db()

    @classmethod
    def get_instance(cls, db_path: str = "data/global_config.db") -> 'ConfigRepository':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls(db_path)
        return cls._instance

    def init_db(self) -> None:
        """Initialize database table structure"""
        cursor = self.conn.cursor()

        # Create global_config table (single row)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS global_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                show_quiz BOOLEAN DEFAULT TRUE,
                show_exercise BOOLEAN DEFAULT TRUE,
                show_exercise_part1 BOOLEAN DEFAULT TRUE,
                show_exercise_part2 BOOLEAN DEFAULT TRUE,
                editor_fullscreen BOOLEAN DEFAULT TRUE,
                editor_editing BOOLEAN DEFAULT TRUE,
                controls_step BOOLEAN DEFAULT TRUE,
                controls_step_back BOOLEAN DEFAULT TRUE,
                controls_run BOOLEAN DEFAULT TRUE,
                controls_continue BOOLEAN DEFAULT TRUE,
                controls_pause BOOLEAN DEFAULT TRUE,
                controls_reset BOOLEAN DEFAULT TRUE,
                ui_show_pipeline BOOLEAN DEFAULT TRUE,
                ui_show_registers BOOLEAN DEFAULT TRUE,
                ui_show_memory BOOLEAN DEFAULT TRUE,
                ui_forwarding_visualization BOOLEAN DEFAULT TRUE,
                ui_change_visualization BOOLEAN DEFAULT TRUE,
                debug_pc_input BOOLEAN DEFAULT TRUE,
                debug_manual_pc BOOLEAN DEFAULT TRUE,
                debug_cycle_slider BOOLEAN DEFAULT TRUE,
                updated_at TIMESTAMP
            )
        """)

        # Insert default config if not exists
        cursor.execute("""
            INSERT OR IGNORE INTO global_config (id, updated_at)
            VALUES (1, ?)
        """, (datetime.now(),))

        self.conn.commit()

    def get_config(self) -> GlobalConfig:
        """Get current global configuration"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM global_config WHERE id = 1")
        row = cursor.fetchone()

        if row is None:
            # Return default config
            return GlobalConfig()

        return GlobalConfig.from_dict(dict(row))

    def update_config(self, config: GlobalConfig) -> GlobalConfig:
        """Update global configuration"""
        now = datetime.now()
        cursor = self.conn.cursor()

        cursor.execute("""
            UPDATE global_config SET
                show_quiz = ?,
                show_exercise = ?,
                show_exercise_part1 = ?,
                show_exercise_part2 = ?,
                editor_fullscreen = ?,
                editor_editing = ?,
                controls_step = ?,
                controls_step_back = ?,
                controls_run = ?,
                controls_continue = ?,
                controls_pause = ?,
                controls_reset = ?,
                ui_show_pipeline = ?,
                ui_show_registers = ?,
                ui_show_memory = ?,
                ui_forwarding_visualization = ?,
                ui_change_visualization = ?,
                debug_pc_input = ?,
                debug_manual_pc = ?,
                debug_cycle_slider = ?,
                updated_at = ?
            WHERE id = 1
        """, (
            config.show_quiz,
            config.show_exercise,
            config.show_exercise_part1,
            config.show_exercise_part2,
            config.editor_fullscreen,
            config.editor_editing,
            config.controls_step,
            config.controls_step_back,
            config.controls_run,
            config.controls_continue,
            config.controls_pause,
            config.controls_reset,
            config.ui_show_pipeline,
            config.ui_show_registers,
            config.ui_show_memory,
            config.ui_forwarding_visualization,
            config.ui_change_visualization,
            config.debug_pc_input,
            config.debug_manual_pc,
            config.debug_cycle_slider,
            now
        ))

        self.conn.commit()

        # Return updated config
        return self.get_config()


def get_config_repository() -> ConfigRepository:
    """Get the singleton config repository instance"""
    return ConfigRepository.get_instance()