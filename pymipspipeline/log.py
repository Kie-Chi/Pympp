import logging
import os
from enum import Enum, auto

class LogLevel(Enum):
    DEBUG = auto()
    INFO = auto()
    WARNING = auto()
    ERROR = auto()
    CRITICAL = auto()

class LogConfig:
    DEFAULT_LOG_FILE = "simulator.log"
    DEFAULT_LOG_LEVEL = LogLevel.INFO
    DEFAULT_CONSOLE_LEVEL = LogLevel.INFO
    DEFAULT_FILE_LEVEL = LogLevel.DEBUG
    DEFAULT_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    DEFAULT_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

    def __init__(self,
                 log_file: str = DEFAULT_LOG_FILE,
                 log_level: LogLevel = DEFAULT_LOG_LEVEL,
                 console_level: LogLevel = DEFAULT_CONSOLE_LEVEL,
                 file_level: LogLevel = DEFAULT_FILE_LEVEL,
                 format: str = DEFAULT_FORMAT,
                 date_format: str = DEFAULT_DATE_FORMAT,
                 enable_console_output: bool = True,
                 enable_file_output: bool = True,
                 clear_log_file: bool = False):
        self.log_file = log_file
        self.log_level = log_level
        self.console_level = console_level
        self.file_level = file_level
        self.format = format
        self.date_format = date_format
        self.enable_console_output = enable_console_output
        self.enable_file_output = enable_file_output
        self.clear_log_file = clear_log_file

def _get_logging_level(log_level: LogLevel) -> int:
    return {
        LogLevel.DEBUG: logging.DEBUG,
        LogLevel.INFO: logging.INFO,
        LogLevel.WARNING: logging.WARNING,
        LogLevel.ERROR: logging.ERROR,
        LogLevel.CRITICAL: logging.CRITICAL,
    }.get(log_level, logging.INFO)

def setup_logging(config: LogConfig = LogConfig()):
    logger = logging.getLogger()
    if logger.handlers:
        for handler in logger.handlers:
            logger.removeHandler(handler)
        logger.handlers.clear()
    logger.setLevel(_get_logging_level(config.log_level))

    formatter = logging.Formatter(config.format, datefmt=config.date_format)
    if config.enable_file_output and config.clear_log_file and os.path.exists(config.log_file):
        try:
            with open(config.log_file, 'w') as f:
                f.truncate(0)
            print(f"Cleared existing log file: {config.log_file}")
        except IOError as e:
            print(f"Warning: Could not clear log file {config.log_file}: {e}")

    if config.enable_console_output:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(_get_logging_level(config.console_level))
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
    if config.enable_file_output:
        file_handler = logging.FileHandler(config.log_file, mode='a', encoding='utf-8')
        file_handler.setLevel(_get_logging_level(config.file_level))
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    logging.captureWarnings(True)
    logger.info("Logging system initialized.")
    if config.enable_file_output:
        logger.info(f"Log outputting to file: {config.log_file} (level: {config.file_level.name})")
    if config.enable_console_output:
        logger.info(f"Log outputting to console (level: {config.console_level.name})")

def get_logger(name: str = None) -> logging.Logger:
    return logging.getLogger(name)

