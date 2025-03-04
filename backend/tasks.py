# backend/tasks.py

import os
import json
import redis
import ffmpeg
import time

# Instead of using get_task_logger, we import the main logger from our logging_config.py
from logging_config import logger

from celery_config import celery_app
from celery.exceptions import MaxRetriesExceededError
from database import SessionLocal
import models
from speechmatics.models import ConnectionSettings
from speechmatics.batch_client import BatchClient
from httpx import HTTPStatusError, ConnectError

# Redis client for SSE notifications
redis_client = redis.Redis(host='redis', port=6379, db=0)


@celery_app.task(
    bind=True,
    default_retry_delay=60,
    max_retries=8,
    autoretry_for=(ConnectError, HTTPStatusError),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={'max_retries': 8}
)

def transcribe_file(self, file_id: int, output_format: str, language: str, diarization: str):
    """
    Celery task that handles the actual transcription process using Speechmatics.
    Now includes explicit user_id/email in logs, plus speed measurement for performance.
    """

    start_time = time.time()  # start performance timer

    db = SessionLocal()
    try:
        # Fetch the UploadedFile from DB
        uploaded_file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if not uploaded_file:
            logger.error(f"[transcribe_file] File not found in DB. file_id={file_id}")
            return

        user_id = uploaded_file.user_id
        user = db.query(models.User).filter(models.User.id == user_id).first()
        user_email = user.email if user else "unknown"

        redis_channel = f"user_{user_id}_updates"

        # Log that we are starting the transcription process
        logger.info(
            f"[transcribe_file] Starting transcription. file_id={file_id}, "
            f"user_id={user_id}, user_email={user_email}, "
            f"output_format={output_format}, language={language}, diarization={diarization}"
        )

        # Notify user that transcription has started
        redis_client.publish(redis_channel, json.dumps({
            "file_id": file_id,
            "status": "processing",
            "message": "Transcription job started."
        }))

        # Check Speechmatics API key
        api_key = os.getenv('SPEECHMATICS_API_KEY')
        if not api_key:
            logger.error(f"[transcribe_file] No Speechmatics API key. file_id={file_id}, user_id={user_id}")
            uploaded_file.status = 'error'
            db.commit()

            redis_client.publish(redis_channel, json.dumps({
                "file_id": file_id,
                "status": "error",
                "message": "Speechmatics API key not found."
            }))
            return

        # Check if file path exists
        if not os.path.exists(uploaded_file.filepath):
            logger.error(f"[transcribe_file] File not found on disk. path={uploaded_file.filepath}, user_id={user_id}")
            uploaded_file.status = 'error'
            db.commit()

            redis_client.publish(redis_channel, json.dumps({
                "file_id": file_id,
                "status": "error",
                "message": "Uploaded file not found on server."
            }))
            return

        # Check if file is empty
        file_size = os.path.getsize(uploaded_file.filepath)
        if file_size == 0:
            logger.error(f"[transcribe_file] File is empty. file_id={file_id}, user_id={user_id}")
            uploaded_file.status = 'error'
            db.commit()

            redis_client.publish(redis_channel, json.dumps({
                "file_id": file_id,
                "status": "error",
                "message": "Uploaded file is empty."
            }))
            return

        # If the file is a video, extract audio
        if uploaded_file.is_video:
            original_file_path = uploaded_file.filepath
            audio_file_path = os.path.splitext(original_file_path)[0] + ".mp3"
            try:
                logger.info(f"[transcribe_file] Extracting audio. file_id={file_id}, user_id={user_id}")
                (
                    ffmpeg
                    .input(original_file_path)
                    .output(audio_file_path, format='mp3', acodec='libmp3lame', ac=2, ar='44100')
                    .run(overwrite_output=True)
                )

                # Update DB to reflect the new audio file
                uploaded_file.filepath = audio_file_path
                uploaded_file.filename = os.path.basename(audio_file_path)

                # Update media duration
                uploaded_file.media_duration = get_media_duration(audio_file_path)
                uploaded_file.is_video = False
                db.commit()

                # Remove original video
                if os.path.exists(original_file_path):
                    os.remove(original_file_path)

                # Publish status update
                redis_client.publish(redis_channel, json.dumps({
                    "file_id": file_id,
                    "status": "processing",
                    "message": "Audio extracted from video file."
                }))

            except Exception as e:
                logger.exception(f"[transcribe_file] Error extracting audio. file_id={file_id}, user_id={user_id}")
                uploaded_file.status = 'error'
                db.commit()

                redis_client.publish(redis_channel, json.dumps({
                    "file_id": file_id,
                    "status": "error",
                    "message": "Failed to extract audio from video file."
                }))
                return

        # Map user selection to Speechmatics format
        if output_format == 'json':
            sm_format = 'json-v2'
        elif output_format in ['txt', 'srt', 'json-v2']:
            sm_format = output_format
        else:
            sm_format = 'txt'  # default

        # Prepare Speechmatics connection
        settings = ConnectionSettings(
            url="https://asr.api.speechmatics.com/v2",
            auth_token=api_key
        )
        webhook_url = os.getenv('SPEECHMATICS_WEBHOOK_URL', 'https://tutty.ir/api/webhook/speechmatics')

        # Create transcription config
        transcription_conf = {
            "type": "transcription",
            "transcription_config": {
                "language": language,
                "operating_point": "enhanced"
            },
            "notification_config": [
                {
                    "url": webhook_url,
                    "contents": [f"transcript.{sm_format}"]
                }
            ]
        }

        # Handle diarization
        if diarization == "speaker":
            transcription_conf["transcription_config"]["diarization"] = "speaker"
        elif diarization == "channel":
            transcription_conf["transcription_config"]["diarization"] = "channel"
            # Possibly set channel labels here

        # Submit job to Speechmatics
        with BatchClient(settings) as client:
            job_id = client.submit_job(
                audio=uploaded_file.filepath,
                transcription_config=transcription_conf,
            )
            uploaded_file.transcription_job_id = job_id
            uploaded_file.status = 'processing'
            uploaded_file.output_format = output_format
            db.commit()

            logger.info(
                f"[transcribe_file] Job submitted. job_id={job_id}, file_id={file_id}, "
                f"user_id={user_id}, user_email={user_email}. Awaiting webhook."
            )

            redis_client.publish(redis_channel, json.dumps({
                "file_id": file_id,
                "status": "processing",
                "message": f"Transcription job submitted to Speechmatics (job_id={job_id})."
            }))

    except MaxRetriesExceededError:
        logger.error(
            f"[transcribe_file] MaxRetriesExceededError. Could not connect to Speechmatics. file_id={file_id}, user_id={user_id}"
        )
        uploaded_file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if uploaded_file:
            uploaded_file.status = 'error'
            db.commit()
            redis_client.publish(f"user_{uploaded_file.user_id}_updates", json.dumps({
                "file_id": file_id,
                "status": "error",
                "message": "Failed to connect to Speechmatics API after multiple attempts."
            }))

    except Exception as e:
        logger.exception(f"[transcribe_file] Unexpected error. file_id={file_id}, user_id={user_id}: {e}")
        uploaded_file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if uploaded_file:
            uploaded_file.status = 'error'
            db.commit()
            redis_client.publish(f"user_{uploaded_file.user_id}_updates", json.dumps({
                "file_id": file_id,
                "status": "error",
                "message": f"Unexpected error occurred: {str(e)}"
            }))
        raise e

    finally:
        # Stop performance timer
        end_time = time.time()
        elapsed_sec = end_time - start_time
        logger.info(
            f"[transcribe_file] Done (or error). file_id={file_id}, user_id={user_id}, "
            f"user_email={user_email}, duration={elapsed_sec:.2f}s"
        )
        db.close()



def get_media_duration(file_path: str) -> float:
    """
    Extracts the duration of a media file in seconds.
    """
    try:
        probe = ffmpeg.probe(file_path)
        duration = float(probe['format']['duration'])
        return duration
    except Exception as e:
        logger.error(f"[transcribe_file] Error getting media duration for {file_path}: {e}")
        return 0.0
