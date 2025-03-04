# backend/main.py

from datetime import datetime, timezone
import os
import uuid
from fastapi import FastAPI, Request, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Form, Query
import requests
from fastapi.responses import RedirectResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models
from starlette.middleware.sessions import SessionMiddleware
import time
from pydantic import BaseModel

from database import engine, get_db
from models import User, Base, UploadedFile, UserActivity
import tasks
from tasks import get_media_duration
from admin_routes import admin_router
from dependencies import get_current_user
from webhook import webhook_router
from payment_routes import payment_router
from logging_config import logger

import redis.asyncio as aioredis 
import asyncio
import redis

app = FastAPI()
app.include_router(admin_router)
app.include_router(webhook_router)  
app.include_router(payment_router)

# Session Middleware
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv('SECRET_KEY'),  # Ensure to set a strong secret key
    session_cookie='session',
    same_site='none',
    https_only=True,
    max_age=90000,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://127.0.0.1",
        "http://frontend",
        "https://tutty.ir",
        "https://www.tutty.ir"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Type"],  # For SSE
)

UPLOAD_DIRECTORY = "/app/uploads"
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

models.Base.metadata.create_all(bind=engine)

redis_client = redis.Redis(host='redis', port=6379, db=0)

# -------------------
# Whitelist of endpoints for performance logs
# (method, path) pairs we consider "critical" to log
# -------------------
IMPORTANT_ENDPOINTS = {
    ("POST", "/auth/google"),
    ("POST", "/upload"),
    ("POST", "/webhook/speechmatics"),
    ("POST", "/payment/purchase"),
    ("GET",  "/payment/verify"),
    ("POST", "/logout"),
}

# ---------------------------
# Enhanced Performance Logging Middleware
# ---------------------------
@app.middleware("http")
async def selective_perf_log(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time

    method = request.method
    path = request.url.path

    # Only log for endpoints in our "important" list
    if (method, path) in IMPORTANT_ENDPOINTS:
        # Attempt to figure out the user
        user_id = None
        user_email = None

        # 1) If session-based user is available
        session_user_id = request.session.get('user_id')
        if session_user_id:
            db = next(get_db())
            user = db.query(User).filter(User.id == session_user_id).first()
            if user:
                user_id = user.id
                user_email = user.email

        # 2) If it's the Speechmatics webhook, we may need to parse job_id
        if path == "/webhook/speechmatics":
            job_id = request.query_params.get("id")  # e.g. ?id=some_job
            if job_id and not user_id:
                db = next(get_db())
                uf = db.query(UploadedFile).filter(
                    UploadedFile.transcription_job_id == job_id
                ).first()
                if uf and uf.user_id:
                    user = db.query(User).filter(User.id == uf.user_id).first()
                    if user:
                        user_id = user.id
                        user_email = user.email

        user_str = f"user_id={user_id}, user_email={user_email}" if user_id else "user=unknown"

        # Example log:  [PERF] POST /upload took 0.123 sec (user_id=5, user_email=test@...)
        logger.info(f"[PERF] {method} {path} took {process_time:.3f} sec ({user_str})")

    # Otherwise, skip or keep a debug-level log if you prefer:
    # else:
    #     logger.debug(f"[PERF-IGNORED] {method} {path} took {process_time:.3f} sec")

    return response

class GoogleAuthToken(BaseModel):
    id_token: str
    next_url: str = '/dashboard'

@app.post("/auth/google")
async def auth_google(token: GoogleAuthToken, request: Request, db: Session = Depends(get_db)):
    """
    Authenticate user via Google ID token with the tokeninfo endpoint.
    """
    try:
        id_token_str = token.id_token
        next_url = token.next_url or '/dashboard'

        if not id_token_str:
            logger.error("ID token missing in request.")
            raise HTTPException(status_code=400, detail="ID token is missing.")

        client_id = os.getenv('GOOGLE_CLIENT_ID')
        if not client_id:
            logger.error("GOOGLE_CLIENT_ID is not set.")
            raise HTTPException(status_code=500, detail="Server configuration error.")

        # Verify the ID token (with tokeninfo)
        verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token_str}"
        response = requests.get(verify_url)
        if response.status_code != 200:
            logger.error(f"Failed to verify ID token with tokeninfo endpoint: {response.text}")
            raise HTTPException(status_code=400, detail="Invalid ID token.")

        claims = response.json()

        # Basic validation of claims
        if claims.get('aud') != client_id:
            logger.error("Token audience does not match our client_id.")
            raise HTTPException(status_code=400, detail="Invalid token audience.")
        if claims.get('iss') not in ['accounts.google.com', 'https://accounts.google.com']:
            logger.error("Invalid token issuer.")
            raise HTTPException(status_code=400, detail="Invalid token issuer.")

        # Extract user info
        email = claims.get('email')
        name = claims.get('name')
        picture = claims.get('picture')
        google_id = claims.get('sub')

        if not email:
            logger.error("Email not found in token.")
            raise HTTPException(status_code=400, detail="Email not found in token.")

        # Retrieve or create user
        user = db.query(User).filter(User.email == email).first()
        if not user:
            logger.info(f"Creating new user: {email}")
            user = User(
                email=email,
                name=name,
                picture=picture,
                google_id=google_id,
                remaining_time=5  # minutes
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info(f"New user created with ID: {user.id}")

        # Store user ID in session
        request.session['user_id'] = user.id
        logger.info(f"User ID {user.id} stored in session (login success).")

        # Log login activity
        activity = UserActivity(
            user_id=user.id,
            activity_type='login',
            details='User logged in via Google OAuth'
        )
        db.add(activity)
        db.commit()
        logger.info(f"Login activity recorded for user ID: {user.id}")

        # Validate next_url
        if not next_url.startswith('/'):
            logger.warning(f"Invalid next_url received: {next_url}. Redirecting to /dashboard.")
            next_url = '/dashboard'

        # Instead of redirecting, return a JSON response
        return JSONResponse(content={"detail": "Authenticated successfully", "next_url": next_url})

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.exception(f"Unexpected error during Google authentication: {e}")
        raise HTTPException(status_code=500, detail="Internal server error.")

@app.post("/logout")
async def logout(request: Request, db: Session = Depends(get_db)):
    user_id = request.session.get('user_id')
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            logger.info(f"User logging out: {user.email}")
        else:
            logger.info("Unknown user_id logging out.")

        activity = UserActivity(
            user_id=user_id,
            activity_type='logout',
            details='User logged out'
        )
        db.add(activity)
        db.commit()

    request.session.pop('user_id', None)
    return JSONResponse(status_code=200, content={"detail": "Logged out successfully"})

@app.get("/me")
async def read_me(request: Request, db: Session = Depends(get_db)):
    """
    Removed the frequent 'logger.info(f"User /me endpoint: {user.email}")' 
    to avoid excessive logging on every dashboard refresh.
    """
    user = get_current_user(request, db)
    if not user:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED,
                            content={"detail": "Not authenticated"})
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "remaining_time": user.remaining_time,
        "is_admin": user.is_admin
    }

@app.get("/")
async def read_root():
    return {"message": "Welcome to Tutty Backend!"}

async def save_upload_file(upload_file: UploadFile, content: bytes) -> str:
    """Asynchronously save uploaded file and return the path."""
    import aiofiles

    file_extension = upload_file.filename.split(".")[-1].lower()
    file_name = f"{uuid.uuid4()}.{file_extension}"
    file_location = os.path.join(UPLOAD_DIRECTORY, file_name)

    async with aiofiles.open(file_location, 'wb') as out_file:
        await out_file.write(content)

    return file_location

ALLOWED_AUDIO_EXTENSIONS = ["wav", "mp3", "m4a", "flac", "aac", "ogg"]
ALLOWED_VIDEO_EXTENSIONS = ["mp4", "avi", "mkv", "mov", "wmv", "webm", "flv", "mpg", "mpeg"]
ALLOWED_EXTENSIONS = ALLOWED_AUDIO_EXTENSIONS + ALLOWED_VIDEO_EXTENSIONS

@app.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    output_format: str = Form('txt'),
    language: str = Form('fa'),
    diarization: str = Form('none'),
    db: Session = Depends(get_db)
):
    try:
        user = get_current_user(request, db)
        if not user:
            logger.warning("Unauthorized file upload attempt.")
            raise HTTPException(status_code=401, detail="Not authenticated")

        # Determine file extension and type
        file_extension = file.filename.split(".")[-1].lower()
        if file_extension not in ALLOWED_EXTENSIONS:
            logger.error(f"Unsupported file type by user {user.email}: {file.filename}")
            raise HTTPException(status_code=400, detail="Unsupported file type")

        is_video = file_extension in ALLOWED_VIDEO_EXTENSIONS

        # Limit file size to 250MB
        MAX_FILE_SIZE = 250 * 1024 * 1024  # 250MB
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            logger.error(f"File too large by user {user.email}: {file.filename}")
            raise HTTPException(status_code=400, detail="File size exceeds limit")

        file_location = await save_upload_file(file, content)

        # Calculate media duration
        media_duration = get_media_duration(file_location)  # in seconds
        if media_duration <= 0:
            if os.path.exists(file_location):
                os.remove(file_location)
            logger.error(f"Invalid media duration for {file.filename}")
            raise HTTPException(status_code=400, detail="Could not determine media duration")

        media_duration_minutes = media_duration / 60

        # Check user time
        if user.remaining_time <= 0 or user.remaining_time < media_duration_minutes:
            if os.path.exists(file_location):
                os.remove(file_location)
            logger.info(f"User {user.email} has insufficient time for transcription.")
            return JSONResponse(status_code=400,
                                content={"detail": "Insufficient transcription time. Please buy more time."})

        uploaded_file = UploadedFile(
            user_id=user.id,
            filename=file.filename,
            filepath=file_location,
            upload_time=datetime.now(timezone.utc),
            status='pending',
            output_format=output_format,
            language=language,
            media_duration=media_duration,
            is_video=is_video
        )
        db.add(uploaded_file)
        db.commit()
        db.refresh(uploaded_file)

        logger.info(f"User {user.email} uploaded file {file.filename} (id={uploaded_file.id}) for transcription.")

        # Submit to Celery
        tasks.transcribe_file.delay(uploaded_file.id, output_format, language, diarization)
        return JSONResponse(
            status_code=200,
            content={"detail": "File uploaded successfully", "file_id": uploaded_file.id}
        )

    except Exception as e:
        logger.exception(f"Error in upload_file: {e}")
        if 'file_location' in locals() and os.path.exists(file_location):
            os.remove(file_location)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/files")
async def get_user_files(
    request: Request,
    db: Session = Depends(get_db),
    limit: int = Query(10, ge=1, le=100, description="Number of files per page"),
    offset: int = Query(0, ge=0, description="Number of files to skip"),
):
    user = get_current_user(request, db)
    if not user:
        logger.warning("Unauthorized attempt to list files.")
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Removed the repeated performance logs and user logs for each refresh
    query = db.query(models.UploadedFile).filter(models.UploadedFile.user_id == user.id)
    total = query.count()
    files = query.order_by(models.UploadedFile.upload_time.desc()).limit(limit).offset(offset).all()

    return {
        "total": total,
        "files": [
            {
                "id": f.id,
                "user_id": f.user_id,
                "filename": f.filename,
                "filepath": f.filepath,
                "upload_time": f.upload_time.isoformat(),
                "status": f.status,
                "transcription": f.transcription,
                "transcription_job_id": f.transcription_job_id,
                "output_format": f.output_format,
                "language": f.language,
                "media_duration": f.media_duration,
            }
            for f in files
        ],
    }

@app.delete("/files/{file_id}")
async def delete_file(file_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        logger.warning("Unauthorized file deletion attempt.")
        raise HTTPException(status_code=401, detail="Not authenticated")

    file = db.query(models.UploadedFile).filter(
        models.UploadedFile.id == file_id, 
        models.UploadedFile.user_id == user.id
    ).first()
    if not file:
        logger.warning(f"User {user.email} tried to delete a non-existing file: {file_id}")
        raise HTTPException(status_code=404, detail="File not found")

    if os.path.exists(file.filepath):
        os.remove(file.filepath)

    db.delete(file)
    db.commit()
    logger.info(f"User {user.email} deleted file id {file_id}")

    return {"detail": "File deleted"}

@app.get("/sse")
async def sse_endpoint(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

    user_channel = f"user_{user.id}_updates"

    async def event_generator():
        redis_conn = await aioredis.from_url("redis://redis:6379")
        pubsub = redis_conn.pubsub()
        await pubsub.subscribe(user_channel)
        try:
            while True:
                if await request.is_disconnected():
                    logger.info(f"User {user.email} disconnected from SSE.")
                    break
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message['type'] == 'message':
                    data = message['data'].decode('utf-8')
                    yield f"data: {data}\n\n"

                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(user_channel)
            await pubsub.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/login/google")
async def google_login():
    """
    Redirect user to Google's OAuth2 server for the 'classic' flow.
    We keep the existing code and comments from your previous logic above.
    This does not remove or break your old /auth/google route, but effectively replaces it.
    """

    client_id = os.getenv('GOOGLE_CLIENT_ID')
    redirect_uri = "https://tutty.ir/auth/google/callback"  # or your domain
    scope = "openid email profile"
    response_type = "code"
    prompt = "consent"  # or 'select_account' if you want the account chooser each time

    # Build Google's OAuth 2.0 authorization URL
    google_oauth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type={response_type}"
        f"&scope={scope}"
        f"&prompt={prompt}"
    )

    return RedirectResponse(url=google_oauth_url)


@app.get("/auth/google/callback")
async def google_callback(
    request: Request,
    code: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Handles the 'code' returned from Google after user consents.
    Exchange code for tokens, verify user info, store in session.
    """

    if not code:
        # If there's no code param, user might have canceled or something else happened
        # Provide a fallback (redirect to home or show an error)
        return RedirectResponse(url="/")

    client_id = os.getenv('GOOGLE_CLIENT_ID')
    client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
    redirect_uri = "https://tutty.ir/auth/google/callback"

    # Exchange the authorization code for tokens
    token_request_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }

    token_res = requests.post(token_request_url, data=token_data)
    if token_res.status_code != 200:
        logger.error(f"Failed to exchange code for tokens: {token_res.text}")
        return RedirectResponse(url="/?error=token_exchange_failed")

    tokens = token_res.json()
    id_token = tokens.get("id_token")
    if not id_token:
        logger.error("No id_token in the token response.")
        return RedirectResponse(url="/?error=no_id_token")

    # Now verify the ID token the same way you previously did in /auth/google
    verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
    response = requests.get(verify_url)
    if response.status_code != 200:
        logger.error(f"Failed to verify ID token with tokeninfo endpoint: {response.text}")
        return RedirectResponse(url="/?error=invalid_id_token")

    claims = response.json()

    # Basic validation of claims
    # (same logic from your existing /auth/google method)
    client_id_env = os.getenv('GOOGLE_CLIENT_ID')
    if claims.get('aud') != client_id_env:
        logger.error("Token audience does not match our client_id.")
        return RedirectResponse(url="/?error=invalid_token_audience")
    if claims.get('iss') not in ['accounts.google.com', 'https://accounts.google.com']:
        logger.error("Invalid token issuer.")
        return RedirectResponse(url="/?error=invalid_token_issuer")

    email = claims.get('email')
    name = claims.get('name')
    picture = claims.get('picture')
    google_id = claims.get('sub')

    if not email:
        logger.error("Email not found in token.")
        return RedirectResponse(url="/?error=missing_email")

    # Retrieve or create user (identical to your old method)
    user = db.query(User).filter(User.email == email).first()
    if not user:
        logger.info(f"Creating new user: {email}")
        user = User(
            email=email,
            name=name,
            picture=picture,
            google_id=google_id,
            remaining_time=5  # default or your preference
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"New user created with ID: {user.id}")

    # Store user ID in session
    request.session['user_id'] = user.id
    logger.info(f"User ID {user.id} stored in session (login success).")

    # Log login activity
    activity = UserActivity(
        user_id=user.id,
        activity_type='login',
        details='User logged in via Google OAuth (Redirect Flow)'
    )
    db.add(activity)
    db.commit()

    # After successful login, redirect to wherever you want
    return RedirectResponse(url="/dashboard")
