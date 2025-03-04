# backend/webhook.py

import os
import json
import logging
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
import models
import redis

logger = logging.getLogger(__name__)
webhook_router = APIRouter()

redis_client = redis.Redis(host='redis', port=6379, db=0)

@webhook_router.post("/webhook/speechmatics", response_model=None)
async def speechmatics_webhook(
    request: Request,
    db: Session = Depends(get_db),  # <-- Use Depends here
):
    # Speechmatics sends job_id and status as query parameters
    job_id = request.query_params.get("id")
    status = request.query_params.get("status")

    if not job_id:
        raise HTTPException(status_code=400, detail="Missing job_id in query params")

    # Fetch the UploadedFile by transcription_job_id
    uploaded_file = db.query(models.UploadedFile).filter(
        models.UploadedFile.transcription_job_id == job_id
    ).first()
    if not uploaded_file:
        logger.error(f"Received webhook for unknown job_id {job_id}")
        raise HTTPException(status_code=404, detail="Unknown job_id")

    user_id = uploaded_file.user_id
    redis_channel = f"user_{user_id}_updates"

    if status == "success":
        # Transcript should be in the request body
        try:
            body = await request.body()
            transcript = body.decode('utf-8', errors='replace')

            # Store transcription
            uploaded_file.transcription = transcript
            uploaded_file.status = 'transcribed'
            db.commit()

            # Deduct used time from user
            user = db.query(models.User).filter(models.User.id == user_id).first()
            if user:
                used_minutes = uploaded_file.media_duration / 60.0
                user.remaining_time = max(user.remaining_time - used_minutes, 0)
                db.commit()

            # Clean up local file
            if os.path.exists(uploaded_file.filepath):
                os.remove(uploaded_file.filepath)

            # Notify user via SSE
            redis_client.publish(redis_channel, json.dumps({
                "file_id": uploaded_file.id,
                "status": "transcribed",
                "message": "Transcription completed successfully (via webhook)."
            }))

        except Exception as e:
            logger.exception(f"Error processing transcript for job {job_id}: {e}")
            uploaded_file.status = 'error'
            db.commit()
            redis_client.publish(redis_channel, json.dumps({
                "file_id": uploaded_file.id,
                "status": "error",
                "message": f"Error processing transcript from webhook: {str(e)}"
            }))
            raise HTTPException(status_code=500, detail="Error processing transcript")

    else:
        # status could be "error", "fetch_error", "trim_error"
        uploaded_file.status = 'error'
        db.commit()
        redis_client.publish(redis_channel, json.dumps({
            "file_id": uploaded_file.id,
            "status": "error",
            "message": f"Transcription failed with status {status}."
        }))

    return {"detail": "Webhook processed successfully"}
