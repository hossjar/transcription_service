# backend/payment_routes.py

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional
from logging_config import logger
import os
import requests
from fastapi.responses import RedirectResponse, JSONResponse
from database import get_db
from dependencies import get_current_user
from models import User, PaymentTransaction, PaymentStatus
from pydantic import BaseModel

payment_router = APIRouter(prefix="/payment", tags=["payment"])

# Environment variables - add these to your .env file
ZARINPAL_MERCHANT_ID = os.getenv('ZARINPAL_MERCHANT_ID')
IS_SANDBOX = os.getenv('ZARINPAL_SANDBOX', 'true').lower() == 'true'  # Default to sandbox mode

if IS_SANDBOX:
    ZARINPAL_REQUEST_URL = "https://sandbox.zarinpal.com/pg/v4/payment/request.json"
    ZARINPAL_VERIFY_URL = "https://sandbox.zarinpal.com/pg/v4/payment/verify.json"
    ZARINPAL_START_PAY_URL = "https://sandbox.zarinpal.com/pg/StartPay/{authority}"
else:
    ZARINPAL_REQUEST_URL = "https://api.zarinpal.com/pg/v4/payment/request.json"
    ZARINPAL_VERIFY_URL = "https://api.zarinpal.com/pg/v4/payment/verify.json"
    ZARINPAL_START_PAY_URL = "https://www.zarinpal.com/pg/StartPay/{authority}"

# IMPORTANT: Update your callback so it hits the backend via "/api"
CALLBACK_URL = "https://tootty.com/api/payment/verify"

class PurchaseTimeRequest(BaseModel):
    hours: float

def calculate_price(hours: float) -> float:
    """Calculate price based on hours purchased."""
    if hours <= 4:
        return hours * 160000
    elif hours <= 20:
        return hours * 140000
    else:
        return hours * 130000

@payment_router.post("/purchase")
async def initiate_purchase(
    request: PurchaseTimeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Initiate a purchase transaction with Zarinpal.
    Ensures logs contain both user_id and user_email.
    """
    if not current_user:
        logger.warning("Unauthorized purchase attempt.")
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = current_user.id
    user_email = current_user.email

    logger.info(f"[Payment] Purchase initiated. user_id={user_id}, email={user_email}, hours={request.hours}")

    try:
        # Add VAT (example: 10%) and convert to Rials if needed
        vat = 0.1
        amount = calculate_price(request.hours) * (1 + vat)
        amount = int(amount * 10)  # Example: *10 => convert Tomans to Rials if required

        # Create payment transaction record
        transaction = PaymentTransaction(
            user_id=user_id,
            amount=amount,
            hours_purchased=request.hours,
            status=PaymentStatus.PENDING
        )
        db.add(transaction)
        db.commit()
        db.refresh(transaction)

        metadata = {"email": user_email}  # Could include more data

        zarinpal_request = {
            "merchant_id": ZARINPAL_MERCHANT_ID,
            "amount": amount,  # in Rials
            "description": f"Purchase {request.hours} hours of transcription time",
            "callback_url": f"{CALLBACK_URL}?transaction_id={transaction.id}",
            "metadata": metadata
        }

        # Call Zarinpal API
        response = requests.post(ZARINPAL_REQUEST_URL, json=zarinpal_request)
        data = response.json()

        # If success
        if response.status_code == 200 and data.get("data", {}).get("code") == 100:
            authority = data["data"]["authority"]
            # Update transaction with authority
            transaction.authority = authority
            db.commit()

            logger.info(
                f"[Payment] Payment request success. user_id={user_id}, email={user_email}, "
                f"authority={authority}, transaction_id={transaction.id}"
            )
            return {
                "success": True,
                "payment_url": ZARINPAL_START_PAY_URL.format(authority=authority)
            }
        else:
            logger.error(
                f"[Payment] Payment request failed. user_id={user_id}, email={user_email}, "
                f"response={data}"
            )
            raise HTTPException(status_code=400, detail="Failed to initialize payment")

    except Exception as e:
        logger.error(
            f"[Payment] Payment initiation error. user_id={user_id}, email={user_email}, error={e}"
        )
        # Rollback the transaction if it was created
        if 'transaction' in locals():
            db.delete(transaction)
            db.commit()
        raise HTTPException(status_code=500, detail="Internal server error")


@payment_router.get("/verify")
async def verify_payment(
    request: Request,
    Authority: str,
    Status: str,
    transaction_id: int,
    db: Session = Depends(get_db)
):
    """
    Verify payment callback from Zarinpal.
    Now includes user info in logs by looking up the transaction -> user.
    """
    transaction = db.query(PaymentTransaction).filter(PaymentTransaction.id == transaction_id).first()
    if not transaction:
        logger.error(f"[Payment] Transaction not found. transaction_id={transaction_id}")
        raise HTTPException(status_code=404, detail="Transaction not found")

    user_id = transaction.user_id
    user = db.query(User).filter(User.id == user_id).first()
    user_email = user.email if user else "unknown"

    logger.info(f"[Payment] Verify callback. user_id={user_id}, email={user_email}, transaction_id={transaction_id}")

    # If user canceled or some error
    if Status != "OK":
        transaction.status = PaymentStatus.CANCELED
        db.commit()
        logger.warning(
            f"[Payment] Payment canceled. user_id={user_id}, email={user_email}, transaction_id={transaction_id}"
        )
        return RedirectResponse(url="/payment/failed")

    # Otherwise, attempt verification
    verify_data = {
        "merchant_id": ZARINPAL_MERCHANT_ID,
        "amount": int(transaction.amount),
        "authority": Authority
    }

    try:
        response = requests.post(ZARINPAL_VERIFY_URL, json=verify_data)
        data = response.json()

        if response.status_code == 200 and data.get("data", {}).get("code") in [100, 101]:
            # Payment successful
            transaction.status = PaymentStatus.SUCCESSFUL
            transaction.reference_id = str(data["data"]["ref_id"])
            db.commit()

            # Update user's remaining time
            if user:
                user.remaining_time += transaction.hours_purchased * 60  # hours -> minutes
                db.commit()

            logger.info(
                f"[Payment] Payment success. user_id={user_id}, email={user_email}, "
                f"transaction_id={transaction_id}, ref_id={transaction.reference_id}"
            )

            # If request is JSON
            if request.headers.get("Accept") == "application/json":
                return JSONResponse({
                    "success": True,
                    "message": "Payment successful",
                    "hours_purchased": transaction.hours_purchased
                })
            return RedirectResponse(url="/payment/success")

        else:
            transaction.status = PaymentStatus.FAILED
            db.commit()
            logger.error(
                f"[Payment] Payment verification failed. user_id={user_id}, email={user_email}, "
                f"transaction_id={transaction_id}, response={data}"
            )

            if request.headers.get("Accept") == "application/json":
                return JSONResponse({"success": False, "message": "Payment failed"})
            return RedirectResponse(url="/payment/failed")

    except Exception as e:
        logger.error(
            f"[Payment] Payment verification error. user_id={user_id}, email={user_email}, "
            f"transaction_id={transaction_id}, error={str(e)}"
        )
        if request.headers.get("Accept") == "application/json":
            return JSONResponse({"success": False, "message": "Payment verification error"})
        return RedirectResponse(url="/payment/failed")
