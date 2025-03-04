to promote a user to admin run this in "docker compose exec backend bash"
python /app/scripts/promote_to_admin.py admin_user@example.com

to demote an admin:

python /app/scripts/demote_admin.py user@example.com


Tip: If you want to check your logs in real time:

docker compose exec backend tail -f logs/tutty.log
