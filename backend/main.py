# backend/main.py
from datetime import datetime, timezone
import os
import uuid
from sqlalchemy import text
from fastapi import FastAPI, Request, Depends, HTTPException, status, UploadFile, File, Form, Query, APIRouter
import requests
from fastapi.responses import RedirectResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models
from starlette.middleware.sessions import SessionMiddleware
import time
from pydantic import BaseModel
from database import engine, get_db
from models import User, UploadedFile, UserActivity
import tasks
from tasks import get_media_duration
from admin_routes import admin_router
from dependencies import get_current_user
from payment_routes import payment_router
from logging_config import logger
import redis.asyncio as aioredis
import asyncio
import redis
from openai import OpenAI
from slowapi import Limiter
from slowapi.util import get_remote_address

SESSION_COOKIE_SAMESITE = os.getenv('SESSION_COOKIE_SAMESITE', 'lax')
SESSION_COOKIE_HTTPS_ONLY = os.getenv('SESSION_COOKIE_HTTPS_ONLY', 'false').lower() == 'true'


app = FastAPI()
app.include_router(admin_router)
app.include_router(payment_router)
# Create a router for development routes
dev_router = APIRouter()
app.include_router(dev_router)

# Session Middleware
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv('SECRET_KEY'),
    session_cookie='session',
    same_site=SESSION_COOKIE_SAMESITE,
    https_only=SESSION_COOKIE_HTTPS_ONLY,
    max_age=90000,
)

# CORS middleware updated for new domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1",
        "http://frontend",
        "https://tootty.com",
        "https://www.tootty.com",
        "http://test.tootty.com:81"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Type"],
)

UPLOAD_DIRECTORY = "/app/uploads"
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

models.Base.metadata.create_all(bind=engine)

redis_client = redis.Redis(host='redis', port=6379, db=0)

IMPORTANT_ENDPOINTS = {
    ("POST", "/auth/google"),
    ("POST", "/upload"),
    ("POST", "/payment/purchase"),
    ("GET",  "/payment/verify"),
}

limiter = Limiter(key_func=lambda request: request.session.get('user_id', get_remote_address(request)))
app.state.limiter = limiter

@app.middleware("http")
async def selective_perf_log(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    method = request.method
    path = request.url.path

    if (method, path) in IMPORTANT_ENDPOINTS:
        user_id = request.session.get('user_id')
        user_email = "unknown"
        if user_id:
            db = next(get_db())
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user_email = user.email
        logger.info(f"[PERF] {method} {path} took {process_time:.3f} sec (user_id={user_id}, user_email={user_email})")
    return response

class GoogleAuthToken(BaseModel):
    id_token: str
    next_url: str = '/dashboard'

if os.getenv('APP_ENV') == 'development':
    @app.post("/auth/dev-login")
    async def dev_login(request: Request, email: str = Form(...), db: Session = Depends(get_db)):
        """
        Development-only endpoint to log in a user by email without OAuth.
        """
        user = db.query(User).filter(User.email == email).first()
        if not user:
            logger.error(f"Dev login failed: User with email {email} not found")
            raise HTTPException(status_code=404, detail="User not found")
        
        # Set user session
        request.session['user_id'] = user.id
        
        # Log the activity
        activity = UserActivity(
            user_id=user.id,
            activity_type='login',
            details='User logged in via development mode',
            timestamp=datetime.utcnow()
        )
        db.add(activity)
        db.commit()
        
        logger.info(f"Dev login successful for user: {email} (ID: {user.id})")
        return {"detail": "Logged in successfully", "user_id": user.id}
        
@app.post("/auth/google")
async def auth_google(token: GoogleAuthToken, request: Request, db: Session = Depends(get_db)):
    """Authenticate user via Google ID token."""
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
        verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token_str}"
        response = requests.get(verify_url)
        if response.status_code != 200:
            logger.error(f"Failed to verify ID token: {response.text}")
            raise HTTPException(status_code=400, detail="Invalid ID token.")
        claims = response.json()
        if claims.get('aud') != client_id or claims.get('iss') not in ['accounts.google.com', 'https://accounts.google.com']:
            logger.error("Invalid token audience or issuer.")
            raise HTTPException(status_code=400, detail="Invalid token.")
        email = claims.get('email')
        name = claims.get('name')
        picture = claims.get('picture')
        google_id = claims.get('sub')
        if not email:
            logger.error("Email not found in token.")
            raise HTTPException(status_code=400, detail="Email not found in token.")
        user = db.query(User).filter(User.email == email).first()
        if not user:
            logger.info(f"Creating new user: {email}")
            user = User(email=email, name=name, picture=picture, google_id=google_id, remaining_time=5)
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info(f"New user created with ID: {user.id}")
        request.session['user_id'] = user.id
        logger.info(f"User ID {user.id} stored in session.")
        activity = UserActivity(user_id=user.id, activity_type='login', details='User logged in via Google OAuth')
        db.add(activity)
        db.commit()
        if not next_url.startswith('/'):
            logger.warning(f"Invalid next_url: {next_url}. Using /dashboard.")
            next_url = '/dashboard'
        return JSONResponse(content={"detail": "Authenticated successfully", "next_url": next_url})
    except Exception as e:
        logger.exception(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error.")

@app.post("/logout")
async def logout(request: Request, db: Session = Depends(get_db)):
    """Log out the user and clear session."""
    user_id = request.session.get('user_id')
    if user_id:
    #    user = db.query(User).filter(User.id == user_id).first()
    #    logger.info(f"User logging out: {user.email if user else 'unknown'}")
        activity = UserActivity(user_id=user_id, activity_type='logout', details='User logged out')
        db.add(activity)
        db.commit()
    request.session.pop('user_id', None)
    return JSONResponse(status_code=200, content={"detail": "Logged out successfully"})



@app.get("/health")
async def health_check():
    # Basic check: just confirm the app is responding
    return {"status": "ok"}


@app.get("/me")
async def read_me(request: Request, db: Session = Depends(get_db)):
    """Return current user info."""
    user = get_current_user(request, db)
    if not user:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Not authenticated"})
    current_time = datetime.utcnow()  # Use naive datetime in UTC
    if user.expiration_date and current_time > user.expiration_date:
        user.remaining_time = 0
        db.commit()
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "remaining_time": user.remaining_time,
        "expiration_date": user.expiration_date.isoformat() if user.expiration_date else None,
        "is_admin": user.is_admin
    }

@app.get("/")
async def read_root():
    return {"message": "Welcome to Tootty Backend!"}

async def save_upload_file(upload_file: UploadFile, content: bytes) -> str:
    """Save uploaded file and return path."""
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
@limiter.limit("3/minute")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    output_format: str = Form('txt'),
    language: str = Form('fa'),
    tag_audio_events: bool = Form(False),
    diarize: bool = Form(False),
    db: Session = Depends(get_db)
):
    """Handle file upload and initiate transcription."""
    try:
        user = get_current_user(request, db)
        if not user:
            logger.warning("Unauthorized file upload attempt.")
            raise HTTPException(status_code=401, detail="Not authenticated")
        file_extension = file.filename.split(".")[-1].lower()
        if file_extension not in ALLOWED_EXTENSIONS:
            logger.error(f"Unsupported file type by user {user.email}: {file.filename}")
            raise HTTPException(status_code=400, detail="Unsupported file type")
        is_video = file_extension in ALLOWED_VIDEO_EXTENSIONS
        MAX_FILE_SIZE = 250 * 1024 * 1024  # 250MB
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            logger.error(f"File too large by user {user.email}: {file.filename}")
            raise HTTPException(status_code=400, detail="File size exceeds limit")
        file_location = await save_upload_file(file, content)
        media_duration = get_media_duration(file_location)
        if media_duration <= 0:
            if os.path.exists(file_location):
                os.remove(file_location)
            logger.error(f"Invalid media duration for {file.filename}")
            raise HTTPException(status_code=400, detail="Could not determine media duration")
        media_duration_minutes = media_duration / 60
        if user.expiration_date_aware and datetime.now(timezone.utc) > user.expiration_date_aware:
            user.remaining_time = 0
            db.commit()
        if user.remaining_time <= 0 or user.remaining_time < media_duration_minutes:
            if os.path.exists(file_location):
                os.remove(file_location)
            logger.info(f"User {user.email} has insufficient time.")
            return JSONResponse(status_code=400, content={"detail": "Insufficient transcription time. Please buy more time."})
        uploaded_file = UploadedFile(
            user_id=user.id, filename=file.filename, filepath=file_location, upload_time=datetime.now(timezone.utc),
            status='pending', output_format=output_format, language=language, media_duration=media_duration, is_video=is_video
        )
        db.add(uploaded_file)
        db.commit()
        db.refresh(uploaded_file)
        logger.info(f"User {user.email} uploaded file {file.filename} (id={uploaded_file.id}) for transcription.")
        tasks.transcribe_file.delay(uploaded_file.id, output_format, language, tag_audio_events, diarize)
        return JSONResponse(status_code=200, content={"detail": "File uploaded successfully", "file_id": uploaded_file.id})
    except Exception as e:
        logger.exception(f"Upload error: {e}")
        if 'file_location' in locals() and os.path.exists(file_location):
            os.remove(file_location)
        raise HTTPException(status_code=500, detail=str(e))

client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def generate_summary(text):
    """Generate a summary using OpenAI GPT-4."""
    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {
                "role": "system",
                "content": "You are an expert summarizer and keyword extractor. Your tasks are:\n1. To provide a concise, coherent summary of the input text.\n2. To extract a list of the most important keywords or key phrases that capture the main ideas.\n\nImportant instructions:\n- The summary should not exceed 200 words.\n- The summary should be written in the same language as the input text.\n- The list of keywords must also be in the same language and, if possible, reflect phrases exactly as they appear in the text.\n- Focus on preserving the meaning and the key details without adding any extra information."
            },
            {
                "role": "user",
                "content": f"input Text:\n\"\"\"\n{text}\n\"\"\""
            }
        ],
        max_tokens=350,
        temperature=0.2,
    )
    return response.choices[0].message.content.strip()

@app.post("/files/{file_id}/summarize")
@limiter.limit("5/minute")
async def summarize_file(file_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Generate and store a summary for a transcribed file."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    file = db.query(UploadedFile).filter(UploadedFile.id == file_id, UploadedFile.user_id == current_user.id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.status != 'transcribed':
        raise HTTPException(status_code=400, detail="File is not transcribed yet")
    if file.summary:
        return {"summary": file.summary}
    try:
        summary = generate_summary(file.transcription)
        file.summary = summary
        db.commit()
        logger.info(f"Summary generated for file_id={file_id} by user_id={current_user.id}")
        return {"summary": summary}
    except Exception as e:
        logger.error(f"Error generating summary for file_id={file_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate summary")


    
@app.get("/files")  # Updated existing endpoint
async def get_user_files(request: Request, db: Session = Depends(get_db), limit: int = Query(10, ge=1, le=100), offset: int = Query(0, ge=0)):
    """List user's uploaded files including summaries."""
    user = get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    query = db.query(UploadedFile).filter(UploadedFile.user_id == user.id)
    total = query.count()
    files = query.order_by(UploadedFile.upload_time.desc()).limit(limit).offset(offset).all()
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
                "summary": f.summary  # Include summary in response
            } for f in files
        ]
    }

@app.delete("/files/{file_id}")
async def delete_file(file_id: int, request: Request, db: Session = Depends(get_db)):
    """Delete a user's file."""
    user = get_current_user(request, db)
    if not user:
        logger.warning("Unauthorized file deletion attempt.")
        raise HTTPException(status_code=401, detail="Not authenticated")
    file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id, models.UploadedFile.user_id == user.id).first()
    if not file:
        logger.warning(f"User {user.email} tried to delete non-existing file: {file_id}")
        raise HTTPException(status_code=404, detail="File not found")
    if os.path.exists(file.filepath):
        os.remove(file.filepath)
    db.delete(file)
    db.commit()
    logger.info(f"User {user.email} deleted file id {file_id}")
    return {"detail": "File deleted"}

@app.get("/api/sse")
async def sse_endpoint(request: Request, db: Session = Depends(get_db)):
    """Stream real-time updates via SSE."""
    user = get_current_user(request, db)
    if not user:
        return JSONResponse(status_code=401, content={"detail": "Not authenticated"})
    
    user_channel = f"user_{user.id}_updates"
    
    async def event_generator():
        redis_conn = await aioredis.from_url("redis://redis:6379")
        pubsub = redis_conn.pubsub()
        await pubsub.subscribe(user_channel)
        last_keepalive = time.time()
        
        try:
            while True:
                # check if the client is disconnected
                if await request.is_disconnected():
                    # Remove or downgrade this log to avoid duplication
                    break
                # listen for redis messages
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message['type'] == 'message':
                    data = message['data'].decode('utf-8')
                    yield f"data: {data}\n\n"
                
                # Send keep-alive every 3 second
                if time.time() - last_keepalive >= 15:
                    yield ": keepalive\n\n"
                    last_keepalive = time.time()
                await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"SSE error for user {user.email}: {str(e)}")
        finally:
            logger.debug(f"SSE connection closed for user {user.email}")  # Changed to DEBUG
            await pubsub.unsubscribe(user_channel)
            await redis_conn.close()
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )
        
@app.get("/login/google")
async def google_login():
    """Redirect to Google OAuth2 login."""
    client_id = os.getenv('GOOGLE_CLIENT_ID')
    redirect_uri = f"{os.getenv('BASE_URL')}/auth/google/callback"
    scope = "openid email profile"
    google_oauth_url = f"https://accounts.google.com/o/oauth2/v2/auth?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}&prompt=consent"
    return RedirectResponse(url=google_oauth_url)

@app.get("/auth/google/callback")
async def google_callback(request: Request, code: str = Query(None), db: Session = Depends(get_db)):
    """Handle Google OAuth callback."""
    if not code:
        return RedirectResponse(url="/")
    client_id = os.getenv('GOOGLE_CLIENT_ID')
    client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
    redirect_uri = f"{os.getenv('BASE_URL')}/auth/google/callback"
    token_res = requests.post("https://oauth2.googleapis.com/token", data={
        "code": code, "client_id": client_id, "client_secret": client_secret, "redirect_uri": redirect_uri, "grant_type": "authorization_code"
    })
    if token_res.status_code != 200:
        logger.error(f"Failed to exchange code: {token_res.text}")
        return RedirectResponse(url="/?error=token_exchange_failed")
    tokens = token_res.json()
    id_token = tokens.get("id_token")
    if not id_token:
        logger.error("No id_token in response.")
        return RedirectResponse(url="/?error=no_id_token")
    response = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}")
    if response.status_code != 200:
        logger.error(f"Failed to verify ID token: {response.text}")
        return RedirectResponse(url="/?error=invalid_id_token")
    claims = response.json()
    if claims.get('aud') != client_id or claims.get('iss') not in ['accounts.google.com', 'https://accounts.google.com']:
        logger.error("Invalid token audience or issuer.")
        return RedirectResponse(url="/?error=invalid_token")
    email = claims.get('email')
    name = claims.get('name')
    picture = claims.get('picture')
    google_id = claims.get('sub')
    if not email:
        logger.error("Email not found in token.")
        return RedirectResponse(url="/?error=missing_email")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        logger.info(f"Creating new user: {email}")
        user = User(email=email, name=name, picture=picture, google_id=google_id, remaining_time=5)
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"New user created with ID: {user.id}")
    request.session['user_id'] = user.id
    logger.info(f"User ID {user.id} stored in session.")
    activity = UserActivity(user_id=user.id, activity_type='login', details='User logged in via Google OAuth (Redirect Flow)')
    db.add(activity)
    db.commit()
    return RedirectResponse(url="/dashboard")