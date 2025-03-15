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
    """Generate SRT format from ElevenLabs transcription object with proper subtitle splitting."""
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

    for i, word in enumerate(words):
        if word.type == 'word':
            # Initialize start time if this is the first word of a new entry
            if current_start is None:
                current_start = word.start
            current_end = word.end
            text += word.text + " "
            word_count += 1

            # Calculate current duration
            duration = current_end - current_start
            is_punctuation = ends_with_punctuation(word.text)

            # Conditions to end the current SRT entry
            if (duration >= max_duration or
                word_count >= max_words or
                (is_punctuation and duration >= min_duration)):
                srt_content += f"{index}\n{format_time(current_start)} --> {format_time(current_end)}\n{text.strip()}\n\n"
                index += 1
                current_start = None
                text = ""
                word_count = 0
            # Check for significant gaps between words
            elif i < len(words) - 1 and words[i + 1].type == 'word':
                gap = words[i + 1].start - word.end
                if gap > max_gap:
                    srt_content += f"{index}\n{format_time(current_start)} --> {format_time(current_end)}\n{text.strip()}\n\n"
                    index += 1
                    current_start = None
                    text = ""
                    word_count = 0

    # Append any remaining text as the final SRT entry
    if current_start is not None and text.strip():
        srt_content += f"{index}\n{format_time(current_start)} --> {format_time(current_end)}\n{text.strip()}\n\n"

    return srt_content

def convert_transcription_to_format(transcription, output_format):
    """Convert ElevenLabs transcription to the specified output format."""
    if output_format == 'txt':
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
    max_retries=8,
    retry_backoff=True,
    retry_jitter=True,
    task_time_limit=7200  # 2 hours max runtime
)
def transcribe_file(self, file_id: int, output_format: str, language: str, diarization: str):
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
        logger.info(f"[transcribe_file] Starting transcription. file_id={file_id}, user_id={user_id}, user_email={user_email}, output_format={output_format}, language={language}, diarization={diarization}")
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
        
        # Map language to ElevenLabs codes
        ELEVENLABS_LANGUAGE_MAP = {'fa': 'fas', 'en': 'eng', 'ar': 'ara', 'tr': 'tur', 'fr': 'fra'}
        language_code = ELEVENLABS_LANGUAGE_MAP.get(language, language)
        diarize = (diarization == 'speaker')
        
        client = ElevenLabs(api_key=api_key)
        with open(uploaded_file.filepath, 'rb') as f:
            audio_data = BytesIO(f.read())
        transcription = client.speech_to_text.convert(
            file=audio_data, model_id="scribe_v1", language_code=language_code,
            tag_audio_events=True, timestamps_granularity="word", diarize=diarize
        )
        transcription_text = convert_transcription_to_format(transcription, output_format)
        
        uploaded_file.transcription = transcription_text
        uploaded_file.status = 'transcribed'
        db.commit()
        
        if user:
            used_minutes = uploaded_file.media_duration / 60.0
            user.remaining_time = max(user.remaining_time - used_minutes, 0)
            db.commit()
        
        redis_client.publish(redis_channel, json.dumps({"file_id": uploaded_file.id, "status": "transcribed", "message": "Transcription completed successfully."}))
    except Exception as e:
        logger.exception(f"[transcribe_file] Transcription error. file_id={file_id}, user_id={user_id}: {e}")
        uploaded_file.status = 'error'
        db.commit()
        redis_client.publish(redis_channel, json.dumps({"file_id": file_id, "status": "error", "message": f"Transcription failed: {str(e)}"}))
    finally:
        end_time = time.time()
        logger.info(f"[transcribe_file] Done. file_id={file_id}, user_id={user_id}, user_email={user_email}, duration={end_time - start_time:.2f}s")
        db.close()

def get_media_duration(file_path: str) -> float:
    """Get media file duration in seconds."""
    try:
        probe = ffmpeg.probe(file_path)
        return float(probe['format']['duration'])
    except Exception as e:
        logger.error(f"Error getting media duration for {file_path}: {e}")
        return 0.0