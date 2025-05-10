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
from models import User, PaymentTransaction, PaymentStatus, DiscountCode, DiscountUsage
from schemas import PurchaseTimeRequest, ValidateDiscountRequest, ValidateDiscountResponse
from datetime import datetime, timedelta, timezone

payment_router = APIRouter(prefix="/payment", tags=["payment"])

ZARINPAL_MERCHANT_ID = os.getenv('ZARINPAL_MERCHANT_ID')
IS_SANDBOX = os.getenv('ZARINPAL_SANDBOX', 'true').lower() == 'true'
if IS_SANDBOX:
    ZARINPAL_REQUEST_URL = "https://sandbox.zarinpal.com/pg/v4/payment/request.json"
    ZARINPAL_VERIFY_URL = "https://sandbox.zarinpal.com/pg/v4/payment/verify.json"
    ZARINPAL_START_PAY_URL = "https://sandbox.zarinpal.com/pg/StartPay/{authority}"
else:
    ZARINPAL_REQUEST_URL = "https://api.zarinpal.com/pg/v4/payment/request.json"
    ZARINPAL_VERIFY_URL = "https://api.zarinpal.com/pg/v4/payment/verify.json"
    ZARINPAL_START_PAY_URL = "https://www.zarinpal.com/pg/StartPay/{authority}"

CALLBACK_URL = os.getenv('CALLBACK_URL', 'https://tootty.com/api/payment/verify')

def calculate_price(hours: float) -> float:
    """Calculate price based on hours purchased."""
    if hours <= 4:
        return hours * 120000
    elif hours <= 9:
        return hours * 100000
    else:
        return hours * 90000

@payment_router.post("/validate_discount", response_model=ValidateDiscountResponse)
async def validate_discount(
    request: ValidateDiscountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    code = request.discount_code.upper()
    discount_code = db.query(DiscountCode).filter(DiscountCode.code == code).first()
    
    if not discount_code or not discount_code.is_active:
        return ValidateDiscountResponse(is_valid=False, message="Invalid discount code")
    if discount_code.expiration_date < datetime.utcnow():
        return ValidateDiscountResponse(is_valid=False, message="Discount code has expired")
    if discount_code.times_used >= discount_code.total_usage_limit:
        return ValidateDiscountResponse(is_valid=False, message="Discount code usage limit reached")
    
    usage = db.query(DiscountUsage).filter(
        DiscountUsage.discount_code_id == discount_code.id,
        DiscountUsage.user_id == current_user.id
    ).first()
    if usage:
        return ValidateDiscountResponse(is_valid=False, message="You have already used this discount code")
    
    base_price = calculate_price(request.hours)
    discount_amount = min(base_price * (discount_code.discount_percent / 100), discount_code.max_discount_amount)
    discounted_price = base_price - discount_amount
    vat = 0.1
    final_amount = discounted_price * (1 + vat)
    
    return ValidateDiscountResponse(
        is_valid=True,
        message="Discount applied successfully",
        original_price=base_price,
        discount_amount=discount_amount,
        discounted_price=discounted_price,
        final_amount=final_amount
    )

@payment_router.post("/purchase")
async def initiate_purchase(
    request: PurchaseTimeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user:
        logger.warning("Unauthorized purchase attempt.")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = current_user.id
    user_email = current_user.email
    logger.info(f"[Payment] Purchase initiated. user_id={user_id}, email={user_email}, hours={request.hours}")
    
    try:
        vat = 0.1
        base_price = calculate_price(request.hours)
        amount = base_price * (1 + vat)
        discount_code_id = None
        
        if request.discount_code:
            code = request.discount_code.upper()
            discount_code = db.query(DiscountCode).filter(DiscountCode.code == code).first()
            if (discount_code and discount_code.is_active and 
                discount_code.expiration_date >= datetime.utcnow() and 
                discount_code.times_used < discount_code.total_usage_limit):
                usage = db.query(DiscountUsage).filter(
                    DiscountUsage.discount_code_id == discount_code.id,
                    DiscountUsage.user_id == user_id
                ).first()
                if not usage:
                    discount_amount = min(base_price * (discount_code.discount_percent / 100), 
                                        discount_code.max_discount_amount)
                    discounted_price = base_price - discount_amount
                    amount = discounted_price * (1 + vat)
                    discount_code_id = discount_code.id
                else:
                    logger.warning(f"User {user_id} tried to reuse discount code {code}")
            else:
                logger.warning(f"Invalid discount code {code} for user {user_id}")
        
        amount = int(amount * 10)  # Convert to Rials
        transaction = PaymentTransaction(
            user_id=user_id,
            amount=amount,
            hours_purchased=request.hours,
            status=PaymentStatus.PENDING,
            discount_code_id=discount_code_id
        )
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        
        metadata = {"email": user_email}
        zarinpal_request = {
            "merchant_id": ZARINPAL_MERCHANT_ID,
            "amount": amount,
            "description": f"Purchase {request.hours} hours of transcription time",
            "callback_url": f"{CALLBACK_URL}?transaction_id={transaction.id}",
            "metadata": metadata
        }
        
        response = requests.post(ZARINPAL_REQUEST_URL, json=zarinpal_request)
        data = response.json()
        
        if response.status_code == 200 and data.get("data", {}).get("code") == 100:
            authority = data["data"]["authority"]
            transaction.authority = authority
            db.commit()
            logger.info(
                f"[Payment] Payment request success. user_id={user_id}, email={user_email}, "
                f"authority={authority}, transaction_id={transaction.id}"
            )
            return {"success": True, "payment_url": ZARINPAL_START_PAY_URL.format(authority=authority)}
        else:
            logger.error(
                f"[Payment] Payment request failed. user_id={user_id}, email={user_email}, response={data}"
            )
            raise HTTPException(status_code=400, detail="Failed to initialize payment")
    except Exception as e:
        logger.error(
            f"[Payment] Payment initiation error. user_id={user_id}, email={user_email}, error={e}"
        )
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
    transaction = db.query(PaymentTransaction).filter(PaymentTransaction.id == transaction_id).first()
    if not transaction:
        logger.error(f"[Payment] Transaction not found. transaction_id={transaction_id}")
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    user_id = transaction.user_id
    user = db.query(User).filter(User.id == user_id).first()
    user_email = user.email if user else "unknown"
    logger.info(f"[Payment] Verify callback. user_id={user_id}, email={user_email}, transaction_id={transaction_id}")
    
    if Status != "OK":
        transaction.status = PaymentStatus.CANCELED
        db.commit()
        logger.warning(
            f"[Payment] Payment canceled. user_id={user_id}, email={user_email}, transaction_id={transaction_id}"
        )
        return RedirectResponse(url="/payment/failed")
    
    verify_data = {
        "merchant_id": ZARINPAL_MERCHANT_ID,
        "amount": int(transaction.amount),
        "authority": Authority
    }
    
    try:
        response = requests.post(ZARINPAL_VERIFY_URL, json=verify_data)
        data = response.json()
        
        if response.status_code == 200 and data.get("data", {}).get("code") in [100, 101]:
            transaction.status = PaymentStatus.SUCCESSFUL
            transaction.reference_id = str(data["data"]["ref_id"])
            if transaction.discount_code_id:
                discount_code = db.query(DiscountCode).filter(DiscountCode.id == transaction.discount_code_id).first()
                if discount_code:
                    usage = DiscountUsage(
                        discount_code_id=discount_code.id,
                        user_id=user_id,
                        used_at=datetime.utcnow()
                    )
                    db.add(usage)
                    discount_code.times_used += 1
            db.commit()
            
            if user:
                user.remaining_time += transaction.hours_purchased * 60
                user.expiration_date = datetime.now(timezone.utc) + timedelta(days=31)
                db.commit()
            logger.info(
                f"[Payment] Payment success. user_id={user_id}, email={user_email}, "
                f"transaction_id={transaction_id}, ref_id={transaction.reference_id}"
            )
            
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