# backend/celery_config.py

from celery import Celery
from kombu import Queue, Exchange

celery_app = Celery(
    'tutty',
    broker='redis://redis:6379/0',
    backend='redis://redis:6379/0',
    include=['tasks']
)

# Define exchanges
default_exchange = Exchange('default', type='direct')
transcription_exchange = Exchange('transcription', type='direct')

# Define queues with their exchanges
celery_app.conf.task_queues = (
    Queue('default', default_exchange, routing_key='default'),
    Queue('transcription', transcription_exchange, routing_key='transcription.#'),
)

# Route tasks to specific queues
celery_app.conf.task_routes = {
    'tasks.transcribe_file': {'queue': 'transcription'},
}

# Celery configuration for handling long-running tasks
celery_app.conf.update(
    # Task settings
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    task_track_started=True,  # Track when tasks are started
    task_time_limit=7200,     # 2 hours max runtime
    task_soft_time_limit=6900,  # 1 hour 55 minutes soft limit
    
    # Worker settings
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks
    worker_concurrency=5,  # Number of worker processes
    
    # Result backend settings
    result_expires=24000,  # Results expire after about 6 hours
    
    # Broker settings
    broker_connection_retry_on_startup=True,
    broker_connection_max_retries=10,
    broker_connection_timeout=90,
    
    # Task acknowledgment
    task_acks_late=True,  # Tasks are acknowledged after completion
    task_reject_on_worker_lost=True,  # Reject tasks if worker is lost
    
    # Error handling
    task_send_sent_event=True,  # Enable sent events for monitoring
    
    # Timezone configuration
    enable_utc=True,
    timezone='UTC'
)

# Additional task routing patterns
celery_app.conf.task_routes.update({
    'tasks.cleanup_files': {'queue': 'default'},
    'tasks.health_check': {'queue': 'default'},
})