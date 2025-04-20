import logging
import os
from concurrent_log_handler import ConcurrentRotatingFileHandler

# Ensure the 'logs' directory exists at the project root
os.makedirs("logs", exist_ok=True)

# Set up a ConcurrentRotatingFileHandler
# - Rotates when the file reaches 10MB
# - Keeps up to 30 backup log files
file_handler = ConcurrentRotatingFileHandler(
    filename="logs/tootty.log",
    mode="a",                  # Append mode
    maxBytes=10 * 1024 * 1024, # 10MB
    backupCount=30,            # Keep 30 backup files
    encoding="utf-8",
    delay=False                # Write logs immediately
)
file_handler.setLevel(logging.INFO)

# Define a formatter (unchanged from original)
formatter = logging.Formatter(
    fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
file_handler.setFormatter(formatter)

# Set up console handler (unchanged from original)
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)

# Create a top-level logger (unchanged from original)
logger = logging.getLogger("tootty")  # Name matches your project
logger.setLevel(logging.INFO)

# Attach both handlers
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# Usage: Import 'logger' in other files to log messages
#   from logging_config import logger
#   logger.info("Your message here")