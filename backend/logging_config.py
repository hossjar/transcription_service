import logging
import os
import time
from logging.handlers import TimedRotatingFileHandler

# 1) Ensure there's a 'logs' directory in the same folder as 'backend' or at project root
os.makedirs("logs", exist_ok=True)

# 2) Set up a TimedRotatingFileHandler
#    - Rotates at midnight
#    - Keeps up to 30 backup log files
file_handler = TimedRotatingFileHandler(
    filename="logs/tutty.log",
    when="midnight",   # rotate daily at midnight
    interval=1,        # every 1 day
    backupCount=30,    # keep 30 days of logs
    encoding="utf-8"
)
file_handler.setLevel(logging.INFO)

# 3) Define a formatter
formatter = logging.Formatter(
    fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
file_handler.setFormatter(formatter)

# 4) (Optional) Also log to console
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)

# 5) Create a top-level logger
logger = logging.getLogger("tutty")   # The name 'tutty' is arbitrary
logger.setLevel(logging.INFO)

# 6) Attach both handlers
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# You can now import 'logger' from this file to log messages:
#   from logging_config import logger
#   logger.info("Your message here")
