# backend/tasks.py

import os
import json
import redis
import ffmpeg
import time
from logging_config import logger
from celery_config import celery_app
from database import SessionLocal
import models
from elevenlabs.client import ElevenLabs
from io import BytesIO
from sqlalchemy import update, func  # Added for atomic updates
from httpx import Timeout

redis_client = redis.Redis(host='redis', port=6379, db=0)

def format_time(seconds):
    """Convert seconds to SRT time format (HH:MM:SS,MMM)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    seconds_int = int(seconds % 60)
    milliseconds = int((seconds - int(seconds)) * 1000)
    return f"{hours:02}:{minutes:02}:{seconds_int:02},{milliseconds:03}"

def ends_with_punctuation(word_text):
    """Check if a word ends with punctuation indicating a sentence boundary."""
    return word_text.strip().endswith(('.', '!', '?'))

def generate_srt(transcription):
    """
    Generate SRT format from ElevenLabs transcription object with proper subtitle splitting.
    If diarization is enabled (i.e. words have a 'speaker_id' attribute),
    include speaker labels at the start of a new block when the speaker changes.
    """
    words = transcription.words
    srt_content = ""
    index = 1
    max_duration = 7.0    # Maximum duration per SRT entry in seconds
    min_duration = 1.0    # Minimum duration to avoid very short entries
    max_words = 15        # Maximum number of words per entry
    max_gap = 0.5         # Maximum gap between words to start a new entry in seconds
    current_start = None
    current_end = None
    text = ""
    word_count = 0
    current_speaker = None

    for i, word in enumerate(words):
        if word.type == 'word':
            # If starting a new block, initialize start time and speaker
            if current_start is None:
                current_start = word.start
                current_speaker = getattr(word, 'speaker_id', None)
                if current_speaker:
                    text += f"{current_speaker}: "
            else:
                # Check if the speaker has changed
                speaker = getattr(word, 'speaker_id', None)
                if speaker and speaker != current_speaker:
                    # End the current block and start a new one with the new speaker label
                    srt_content += f"{index}\n{format_time(current_start)} --> {format_time(current_end)}\n{text.strip()}\n\n"
                    index += 1
                    current_start = word.start
                    text = ""
                    current_speaker = speaker
                    if current_speaker:
                        text += f"{current_speaker}: "

            current_end = word.end
            text += word.text + " "
            word_count += 1

            # Calculate the duration of the current block
            duration = current_end - current_start
            is_punctuation = ends_with_punctuation(word.text)

            # Conditions to end the current SRT entry:
            if (duration >= max_duration or
                word_count >= max_words or
                (is_punctuation and duration >= min_duration)):
                srt_content += f"{index}\n{format_time(current_start)} --> {format_time(current_end)}\n{text.strip()}\n\n"
                index += 1
                current_start = None
                text = ""
                word_count = 0
                current_speaker = None
            # Check for significant gaps between words
            elif i < len(words) - 1 and words[i + 1].type == 'word':
                gap = words[i + 1].start - word.end
                if gap > max_gap:
                    srt_content += f"{index}\n{format_time(current_start)} --> {format_time(current_end)}\n{text.strip()}\n\n"
                    index += 1
                    current_start = None
                    text = ""
                    word_count = 0
                    current_speaker = None

    # Append any remaining text as the final SRT entry
    if current_start is not None and text.strip():
        srt_content += f"{index}\n{format_time(current_start)} --> {format_time(current_end)}\n{text.strip()}\n\n"

    return srt_content

def convert_transcription_to_format(transcription, output_format):
    """Convert ElevenLabs transcription to the specified output format."""
    if output_format == 'txt':
        # Check if diarization is enabled by looking for speaker_id in words
        if any(hasattr(word, 'speaker_id') for word in transcription.words):
            # Generate txt with speaker labels
            text = ""
            current_speaker = None
            for word in transcription.words:
                if word.type == 'word':
                    speaker = getattr(word, 'speaker_id', None)
                    if speaker != current_speaker:
                        if current_speaker is not None:
                            text += "\n"
                        text += f"{speaker}: "
                        current_speaker = speaker
                    text += word.text + " "
            return text.strip()
        else:
            return transcription.text
    elif output_format == 'srt':
        return generate_srt(transcription)
    elif output_format == 'json':
        return transcription.json()
    else:
        raise ValueError(f"Unsupported output format: {output_format}")

@celery_app.task(
    bind=True,
    default_retry_delay=60,
    max_retries=3,  # Reduced from 8 to limit retries
    retry_backoff=True,
    retry_jitter=True,
    task_time_limit=7200  # 2 hours max runtime
)
def transcribe_file(self, file_id: int, output_format: str, language: str, tag_audio_events: bool, diarize: bool):
    """Transcribe file using ElevenLabs scribe_v1 model."""
    start_time = time.time()
    db = SessionLocal()
    try:
        uploaded_file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if not uploaded_file:
            logger.error(f"[transcribe_file] File not found in DB. file_id={file_id}")
            return

        user_id = uploaded_file.user_id
        user = db.query(models.User).filter(models.User.id == user_id).first()
        user_email = user.email if user else "unknown"
        redis_channel = f"user_{user_id}_updates"

        # Idempotency Check: Skip if already transcribed
        if uploaded_file.status == 'transcribed':
            logger.info(f"[transcribe_file] File already transcribed. file_id={file_id}, user_id={user_id}, user_email={user_email}")
            redis_client.publish(redis_channel, json.dumps({"file_id": file_id, "status": "transcribed", "message": "Transcription already completed."}))
            return

        logger.info(f"[transcribe_file] Starting transcription. file_id={file_id}, user_id={user_id}, user_email={user_email}, output_format={output_format}, language={language}, tag_audio_events={tag_audio_events}, diarize={diarize}")
        redis_client.publish(redis_channel, json.dumps({"file_id": file_id, "status": "processing", "message": "Transcription job started."}))

        api_key = os.getenv('ELEVENLABS_API_KEY')
        if not api_key:
            logger.error(f"[transcribe_file] No ElevenLabs API key. file_id={file_id}, user_id={user_id}")
            uploaded_file.status = 'error'
            db.commit()
            redis_client.publish(redis_channel, json.dumps({"file_id": file_id, "status": "error", "message": "ElevenLabs API key not found."}))
            return

        if not os.path.exists(uploaded_file.filepath):
            logger.error(f"[transcribe_file] File not found on disk. path={uploaded_file.filepath}, user_id={user_id}")
            uploaded_file.status = 'error'
            db.commit()
            redis_client.publish(redis_channel, json.dumps({"file_id": file_id, "status": "error", "message": "Uploaded file not found on server."}))
            return

        file_size = os.path.getsize(uploaded_file.filepath)
        if file_size == 0:
            logger.error(f"[transcribe_file] File is empty. file_id={file_id}, user_id={user_id}")
            uploaded_file.status = 'error'
            db.commit()
            redis_client.publish(redis_channel, json.dumps({"file_id": file_id, "status": "error", "message": "Uploaded file is empty."}))
            return

        if uploaded_file.is_video:
            original_file_path = uploaded_file.filepath
            audio_file_path = os.path.splitext(original_file_path)[0] + ".mp3"
            try:
                logger.info(f"[transcribe_file] Extracting audio. file_id={file_id}, user_id={user_id}")
                ffmpeg.input(original_file_path).output(audio_file_path, format='mp3', acodec='libmp3lame', ac=2, ar='44100').run(overwrite_output=True)
                uploaded_file.filepath = audio_file_path
                uploaded_file.filename = os.path.basename(audio_file_path)
                uploaded_file.media_duration = get_media_duration(audio_file_path)
                uploaded_file.is_video = False
                db.commit()
                if os.path.exists(original_file_path):
                    os.remove(original_file_path)
                redis_client.publish(redis_channel, json.dumps({"file_id": file_id, "status": "processing", "message": "Audio extracted from video file."}))
            except Exception as e:
                logger.exception(f"[transcribe_file] Audio extraction error. file_id={file_id}, user_id={user_id}")
                uploaded_file.status = 'error'
                db.commit()
                redis_client.publish(redis_channel, json.dumps({"file_id": file_id, "status": "error", "message": "Failed to extract audio from video file."}))
                return

        # Dynamic Timeout: Base timeout + 2x media duration (in seconds)
        media_duration = uploaded_file.media_duration or get_media_duration(uploaded_file.filepath)
        timeout_seconds = max(180, media_duration / 20)  # Minimum 5 minutes, or 2x duration
        client = ElevenLabs(api_key=api_key, timeout=Timeout(timeout=timeout_seconds, connect=10.0))
        logger.info(f"[transcribe_file] Set timeout to {timeout_seconds} seconds for file_id={file_id}")

        # Map language to ElevenLabs codes
        ELEVENLABS_LANGUAGE_MAP = {'fa': 'fas', 'en': 'eng', 'ar': 'ara', 'tr': 'tur', 'fr': 'fra'}
        mapped_language = ELEVENLABS_LANGUAGE_MAP.get(language, language)

        with open(uploaded_file.filepath, 'rb') as file_stream:
            transcription = client.speech_to_text.convert(
                file=file_stream,
                model_id="scribe_v1",
                language_code=mapped_language if language != 'auto' else None,
                tag_audio_events=tag_audio_events,
                diarize=diarize,
                timestamps_granularity="word"
            )

        output = convert_transcription_to_format(transcription, output_format)
        uploaded_file.transcription = output
        uploaded_file.status = 'transcribed'

        if user:
            deduction = uploaded_file.media_duration / 60
            logger.info(f"[transcribe_file] Deducting {deduction} minutes from user_id={user_id}, user_email={user_email}")
            db.execute(
                update(models.User)
                .where(models.User.id == user_id)
                .values(remaining_time=func.greatest(models.User.remaining_time - deduction, 0))
            )
            db.commit()

        db.commit()
        processing_time = time.time() - start_time
        logger.info(f"[transcribe_file] Completed. file_id={file_id}, user_id={user_id}, user_email={user_email}, duration={processing_time:.2f}s")
        redis_client.publish(redis_channel, json.dumps({"file_id": file_id, "status": "transcribed", "message": "Transcription completed."}))

    except Exception as e:
        logger.exception(f"[transcribe_file] Error transcribing file_id={file_id}: {e}")
        uploaded_file.status = 'error'
        db.commit()
        redis_client.publish(redis_channel, json.dumps({"file_id": file_id, "status": "error", "message": f"Transcription failed: {str(e)}"}))
        if isinstance(e, Exception):
            self.retry(exc=e)
    finally:
        db.close()

def get_media_duration(file_path: str) -> float:
    """Get media file duration in seconds."""
    try:
        probe = ffmpeg.probe(file_path)
        return float(probe['format']['duration'])
    except Exception as e:
        logger.error(f"Error getting media duration for {file_path}: {e}")
        return 0.0