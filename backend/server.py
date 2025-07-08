from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, File, UploadFile, Header
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.encoders import jsonable_encoder
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import bcrypt
from enum import Enum
import json
from bson import ObjectId
import stripe
import base64
import io
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as ReportLabImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from PIL import Image
import tempfile

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Stripe configuration
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

# Custom JSON encoder for MongoDB ObjectId
class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        return super(JSONEncoder, self).default(obj)

# Helper function to convert ObjectId to string in MongoDB documents
def fix_object_id(doc):
    if doc is None:
        return None
    if isinstance(doc, list):
        return [fix_object_id(item) for item in doc]
    if isinstance(doc, dict):
        if '_id' in doc:
            doc['_id'] = str(doc['_id'])
        return doc
    return doc

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="LEXA HR System", version="2.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class UserRole(str, Enum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    HR = "hr"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

class AttendanceStatus(str, Enum):
    CLOCKED_IN = "clocked_in"
    CLOCKED_OUT = "clocked_out"
    BREAK = "break"

class IndustryType(str, Enum):
    TRADITIONAL = "traditional"
    MUSIC = "music"
    EDUCATION = "education"
    GIGS = "gigs"
    HEALTHCARE = "healthcare"
    RETAIL = "retail"
    TECHNOLOGY = "technology"

class SubscriptionTier(str, Enum):
    BASIC = "basic"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"

class Currency(str, Enum):
    USD = "USD"
    GBP = "GBP"
    EUR = "EUR"
    NGN = "NGN"

# Subscription pricing
SUBSCRIPTION_PRICING = {
    "basic": {
        "USD": {"amount": 999, "symbol": "$"},
        "GBP": {"amount": 799, "symbol": "£"},
        "EUR": {"amount": 899, "symbol": "€"},
        "NGN": {"amount": 45000, "symbol": "₦"}
    },
    "premium": {
        "USD": {"amount": 1999, "symbol": "$"},
        "GBP": {"amount": 1599, "symbol": "£"},
        "EUR": {"amount": 1799, "symbol": "€"},
        "NGN": {"amount": 90000, "symbol": "₦"}
    },
    "enterprise": {
        "USD": {"amount": 4999, "symbol": "$"},
        "GBP": {"amount": 3999, "symbol": "£"},
        "EUR": {"amount": 4499, "symbol": "€"},
        "NGN": {"amount": 225000, "symbol": "₦"}
    }
}

# Models
class Organization(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    industry: IndustryType
    subscription_tier: SubscriptionTier = SubscriptionTier.BASIC
    subscription_status: str = "trial"  # trial, active, canceled, past_due
    logo_base64: Optional[str] = None
    primary_color: str = "#3b82f6"
    secondary_color: str = "#1e293b"
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    tax_id: Optional[str] = None
    currency: Currency = Currency.USD
    timezone: str = "UTC"
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    trial_ends_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class OrganizationCreate(BaseModel):
    name: str
    industry: IndustryType
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    currency: Currency = Currency.USD
    timezone: str = "UTC"

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    logo_base64: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    tax_id: Optional[str] = None

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    first_name: str
    last_name: str
    role: UserRole
    organization_id: str
    department: Optional[str] = None
    position: Optional[str] = None
    employee_id: Optional[str] = None
    hourly_rate: Optional[float] = None
    salary: Optional[float] = None
    avatar_base64: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    hire_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class UserCreate(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role: UserRole = UserRole.EMPLOYEE
    organization_id: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    employee_id: Optional[str] = None
    hourly_rate: Optional[float] = None
    salary: Optional[float] = None
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class AttendanceRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    organization_id: str
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    break_start: Optional[datetime] = None
    break_end: Optional[datetime] = None
    status: AttendanceStatus
    date: str  # YYYY-MM-DD format
    total_hours: Optional[float] = None
    overtime_hours: Optional[float] = None
    break_hours: Optional[float] = None
    project_name: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AttendanceAction(BaseModel):
    user_id: str
    action: str  # "clock_in", "clock_out", "break_start", "break_end"
    project_name: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None

class PayrollRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    organization_id: str
    pay_period_start: datetime
    pay_period_end: datetime
    total_hours: float
    overtime_hours: float
    break_hours: float
    regular_pay: float
    overtime_pay: float
    gross_pay: float
    tax_deductions: float
    other_deductions: float
    net_pay: float
    currency: Currency
    generated_at: datetime = Field(default_factory=datetime.utcnow)

class SubscriptionRequest(BaseModel):
    organization_id: str
    tier: SubscriptionTier
    currency: Currency
    payment_method_id: Optional[str] = None

class PayslipRequest(BaseModel):
    payroll_id: str
    organization_id: str

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def calculate_hours(start: datetime, end: datetime) -> float:
    delta = end - start
    return delta.total_seconds() / 3600

def get_organization_features(tier: SubscriptionTier) -> Dict[str, Any]:
    features = {
        "basic": {
            "max_employees": 25,
            "custom_branding": False,
            "payroll_generation": True,
            "attendance_tracking": True,
            "basic_reports": True,
            "email_support": True,
            "advanced_reports": False,
            "api_access": False,
            "custom_fields": False
        },
        "premium": {
            "max_employees": 100,
            "custom_branding": True,
            "payroll_generation": True,
            "attendance_tracking": True,
            "basic_reports": True,
            "advanced_reports": True,
            "email_support": True,
            "api_access": True,
            "custom_fields": True
        },
        "enterprise": {
            "max_employees": -1,  # Unlimited
            "custom_branding": True,
            "payroll_generation": True,
            "attendance_tracking": True,
            "basic_reports": True,
            "advanced_reports": True,
            "email_support": True,
            "priority_support": True,
            "api_access": True,
            "custom_fields": True,
            "white_label": True
        }
    }
    return features.get(tier, features["basic"])

# Organization Management
@api_router.post("/organizations", response_model=Organization)
async def create_organization(org_data: OrganizationCreate):
    # Set trial period
    trial_ends_at = datetime.utcnow() + timedelta(days=14)
    
    organization = Organization(
        **org_data.dict(),
        trial_ends_at=trial_ends_at
    )
    
    await db.organizations.insert_one(organization.dict())
    return organization

@api_router.get("/organizations/{org_id}", response_model=Organization)
async def get_organization(org_id: str):
    org = await db.organizations.find_one({"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    org = fix_object_id(org)
    return Organization(**org)

@api_router.put("/organizations/{org_id}")
async def update_organization(org_id: str, org_update: OrganizationUpdate):
    update_data = {k: v for k, v in org_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.organizations.update_one(
        {"id": org_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    return {"message": "Organization updated successfully"}

@api_router.get("/organizations/{org_id}/features")
async def get_organization_features(org_id: str):
    org = await db.organizations.find_one({"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    features = get_organization_features(org["subscription_tier"])
    return features

# Authentication endpoints
@api_router.post("/auth/register")
async def register_user(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create default organization if first user and no organization specified
    organization_id = user_data.organization_id
    if not organization_id:
        org_count = await db.organizations.count_documents({})
        if org_count == 0:
            default_org = Organization(
                name="Default Organization",
                industry=IndustryType.TRADITIONAL
            )
            await db.organizations.insert_one(default_org.dict())
            organization_id = default_org.id
        else:
            # Get first organization for demo
            org = await db.organizations.find_one({})
            organization_id = org["id"]
    
    # Create user
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=user_data.role,
        organization_id=organization_id,
        department=user_data.department,
        position=user_data.position,
        employee_id=user_data.employee_id,
        hourly_rate=user_data.hourly_rate,
        salary=user_data.salary,
        phone=user_data.phone,
        hire_date=datetime.utcnow()
    )
    
    await db.users.insert_one(user.dict())
    
    # Remove password hash from response
    user_dict = user.dict()
    del user_dict["password_hash"]
    
    return {"user": user_dict, "message": "User registered successfully"}

@api_router.post("/auth/login")
async def login_user(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user["is_active"]:
        raise HTTPException(status_code=401, detail="Account is deactivated")
    
    # Get organization details
    org = await db.organizations.find_one({"id": user["organization_id"]})
    
    # Remove password hash and fix ObjectId from response
    user_dict = user.copy()
    del user_dict["password_hash"]
    user_dict = fix_object_id(user_dict)
    
    return {
        "user": user_dict,
        "organization": fix_object_id(org) if org else None,
        "message": "Login successful"
    }

# Subscription Management
@api_router.post("/subscriptions/create-checkout-session")
async def create_checkout_session(subscription_request: SubscriptionRequest):
    try:
        # Get organization
        org = await db.organizations.find_one({"id": subscription_request.organization_id})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Get pricing info
        tier = subscription_request.tier
        currency = subscription_request.currency
        pricing = SUBSCRIPTION_PRICING[tier][currency]
        
        # Create or get Stripe customer
        stripe_customer_id = org.get("stripe_customer_id")
        if not stripe_customer_id:
            customer = stripe.Customer.create(
                email=org["email"],
                name=org["name"],
                metadata={"organization_id": subscription_request.organization_id}
            )
            stripe_customer_id = customer.id
            
            # Update organization with customer ID
            await db.organizations.update_one(
                {"id": subscription_request.organization_id},
                {"$set": {"stripe_customer_id": stripe_customer_id}}
            )
        
        # Create checkout session
        session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': currency.lower(),
                    'product_data': {
                        'name': f'LEXA {tier.title()} Plan',
                        'description': f'Monthly subscription to LEXA {tier.title()} features'
                    },
                    'unit_amount': pricing["amount"],
                    'recurring': {
                        'interval': 'month',
                    },
                },
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/subscription-success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/subscription-cancel",
            metadata={
                'organization_id': subscription_request.organization_id,
                'tier': tier,
                'currency': currency
            }
        )
        
        return {"checkout_url": session.url, "session_id": session.id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/subscriptions/status/{session_id}")
async def get_subscription_status(session_id: str):
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.payment_status == "paid":
            subscription = stripe.Subscription.retrieve(session.subscription)
            
            # Update organization subscription status
            await db.organizations.update_one(
                {"id": session.metadata["organization_id"]},
                {"$set": {
                    "subscription_tier": session.metadata["tier"],
                    "subscription_status": "active",
                    "stripe_subscription_id": subscription.id,
                    "updated_at": datetime.utcnow()
                }}
            )
            
            return {
                "status": subscription.status,
                "current_period_end": subscription.current_period_end,
                "tier": session.metadata["tier"]
            }
        
        return {"status": "pending"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/subscriptions/pricing")
async def get_subscription_pricing():
    return SUBSCRIPTION_PRICING

# Attendance endpoints (existing code with organization context)
@api_router.post("/attendance/action")
async def attendance_action(action_data: AttendanceAction):
    today = datetime.now().strftime("%Y-%m-%d")
    now = datetime.utcnow()
    
    # Get user info
    user = await db.users.find_one({"id": action_data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get today's attendance record
    attendance = await db.attendance.find_one({
        "user_id": action_data.user_id,
        "date": today
    })
    
    if not attendance:
        # Create new attendance record
        attendance = AttendanceRecord(
            user_id=action_data.user_id,
            organization_id=user["organization_id"],
            date=today,
            status=AttendanceStatus.CLOCKED_OUT
        )
        attendance_dict = attendance.dict()
    else:
        attendance_dict = attendance
    
    # Handle different actions
    if action_data.action == "clock_in":
        if attendance_dict["status"] == AttendanceStatus.CLOCKED_IN:
            raise HTTPException(status_code=400, detail="Already clocked in")
        
        attendance_dict["clock_in"] = now
        attendance_dict["status"] = AttendanceStatus.CLOCKED_IN
        attendance_dict["project_name"] = action_data.project_name
        attendance_dict["location"] = action_data.location
        attendance_dict["notes"] = action_data.notes
        
    elif action_data.action == "clock_out":
        if attendance_dict["status"] != AttendanceStatus.CLOCKED_IN:
            raise HTTPException(status_code=400, detail="Not clocked in")
        
        attendance_dict["clock_out"] = now
        attendance_dict["status"] = AttendanceStatus.CLOCKED_OUT
        
        # Calculate total hours
        if attendance_dict["clock_in"]:
            total_hours = calculate_hours(attendance_dict["clock_in"], now)
            
            # Subtract break time if any
            break_hours = 0
            if attendance_dict.get("break_start") and attendance_dict.get("break_end"):
                break_hours = calculate_hours(attendance_dict["break_start"], attendance_dict["break_end"])
            
            attendance_dict["total_hours"] = total_hours - break_hours
            attendance_dict["break_hours"] = break_hours
            
            # Calculate overtime (over 8 hours)
            regular_hours = min(attendance_dict["total_hours"], 8)
            overtime_hours = max(0, attendance_dict["total_hours"] - 8)
            attendance_dict["overtime_hours"] = overtime_hours
    
    elif action_data.action == "break_start":
        if attendance_dict["status"] != AttendanceStatus.CLOCKED_IN:
            raise HTTPException(status_code=400, detail="Must be clocked in to take break")
        
        attendance_dict["break_start"] = now
        attendance_dict["status"] = AttendanceStatus.BREAK
        
    elif action_data.action == "break_end":
        if attendance_dict["status"] != AttendanceStatus.BREAK:
            raise HTTPException(status_code=400, detail="Not on break")
        
        attendance_dict["break_end"] = now
        attendance_dict["status"] = AttendanceStatus.CLOCKED_IN
    
    # Update database
    await db.attendance.update_one(
        {"user_id": action_data.user_id, "date": today},
        {"$set": attendance_dict},
        upsert=True
    )
    
    # Fix ObjectId in response
    attendance_dict = fix_object_id(attendance_dict)
    
    return {"message": f"Successfully {action_data.action.replace('_', ' ')}", "attendance": attendance_dict}

@api_router.get("/attendance/current/{user_id}")
async def get_current_attendance(user_id: str):
    today = datetime.now().strftime("%Y-%m-%d")
    attendance = await db.attendance.find_one({
        "user_id": user_id,
        "date": today
    })
    
    if not attendance:
        return {"status": "clocked_out", "message": "No attendance record for today"}
    
    attendance = fix_object_id(attendance)
    return attendance

@api_router.get("/attendance/history/{user_id}")
async def get_attendance_history(user_id: str, days: int = 30):
    start_date = datetime.now() - timedelta(days=days)
    
    attendance_records = await db.attendance.find({
        "user_id": user_id,
        "created_at": {"$gte": start_date}
    }).sort("date", -1).to_list(100)
    
    attendance_records = [fix_object_id(record) for record in attendance_records]
    return attendance_records

@api_router.get("/attendance/organization/{org_id}")
async def get_organization_attendance(org_id: str):
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Get all attendance records for today
    attendance_records = await db.attendance.find({
        "organization_id": org_id,
        "date": today
    }).to_list(100)
    
    # Get user details for each record
    enriched_records = []
    for record in attendance_records:
        record = fix_object_id(record)
        user = await db.users.find_one({"id": record["user_id"]})
        if user:
            user = fix_object_id(user)
            record["user_name"] = f"{user['first_name']} {user['last_name']}"
            record["department"] = user.get("department", "")
            record["position"] = user.get("position", "")
            record["employee_id"] = user.get("employee_id", "")
        enriched_records.append(record)
    
    return enriched_records

# Payroll Management
@api_router.post("/payroll/generate/{org_id}")
async def generate_payroll(org_id: str, pay_period_start: str, pay_period_end: str):
    try:
        # Parse dates
        start_date = datetime.strptime(pay_period_start, "%Y-%m-%d")
        end_date = datetime.strptime(pay_period_end, "%Y-%m-%d")
        
        # Get organization
        org = await db.organizations.find_one({"id": org_id})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Get all users in organization
        users = await db.users.find({"organization_id": org_id, "is_active": True}).to_list(1000)
        
        payroll_records = []
        
        for user in users:
            # Get attendance records for pay period
            attendance_records = await db.attendance.find({
                "user_id": user["id"],
                "date": {
                    "$gte": start_date.strftime("%Y-%m-%d"),
                    "$lte": end_date.strftime("%Y-%m-%d")
                }
            }).to_list(1000)
            
            # Calculate totals
            total_hours = sum(record.get("total_hours", 0) for record in attendance_records)
            overtime_hours = sum(record.get("overtime_hours", 0) for record in attendance_records)
            break_hours = sum(record.get("break_hours", 0) for record in attendance_records)
            
            # Calculate pay
            hourly_rate = user.get("hourly_rate", 0)
            salary = user.get("salary", 0)
            
            if salary > 0:
                # Salaried employee
                regular_pay = salary / 12  # Monthly salary
                overtime_pay = (overtime_hours * hourly_rate * 1.5) if hourly_rate > 0 else 0
            else:
                # Hourly employee
                regular_hours = total_hours - overtime_hours
                regular_pay = regular_hours * hourly_rate
                overtime_pay = overtime_hours * hourly_rate * 1.5
            
            gross_pay = regular_pay + overtime_pay
            
            # Calculate deductions (simplified)
            tax_rate = 0.15  # 15% tax
            tax_deductions = gross_pay * tax_rate
            other_deductions = 0  # Could include insurance, etc.
            
            net_pay = gross_pay - tax_deductions - other_deductions
            
            payroll_record = PayrollRecord(
                user_id=user["id"],
                organization_id=org_id,
                pay_period_start=start_date,
                pay_period_end=end_date,
                total_hours=total_hours,
                overtime_hours=overtime_hours,
                break_hours=break_hours,
                regular_pay=regular_pay,
                overtime_pay=overtime_pay,
                gross_pay=gross_pay,
                tax_deductions=tax_deductions,
                other_deductions=other_deductions,
                net_pay=net_pay,
                currency=Currency(org.get("currency", "USD"))
            )
            
            await db.payroll.insert_one(payroll_record.dict())
            payroll_records.append(payroll_record)
        
        return {"message": f"Generated payroll for {len(payroll_records)} employees", "records": len(payroll_records)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/payroll/organization/{org_id}")
async def get_organization_payroll(org_id: str, limit: int = 100):
    payroll_records = await db.payroll.find({
        "organization_id": org_id
    }).sort("generated_at", -1).to_list(limit)
    
    # Enrich with user data
    enriched_records = []
    for record in payroll_records:
        record = fix_object_id(record)
        user = await db.users.find_one({"id": record["user_id"]})
        if user:
            user = fix_object_id(user)
            record["user_name"] = f"{user['first_name']} {user['last_name']}"
            record["employee_id"] = user.get("employee_id", "")
            record["department"] = user.get("department", "")
        enriched_records.append(record)
    
    return enriched_records

# Payslip Generation
@api_router.post("/payslip/generate")
async def generate_payslip(payslip_request: PayslipRequest):
    try:
        # Get payroll record
        payroll = await db.payroll.find_one({"id": payslip_request.payroll_id})
        if not payroll:
            raise HTTPException(status_code=404, detail="Payroll record not found")
        
        # Get user and organization
        user = await db.users.find_one({"id": payroll["user_id"]})
        org = await db.organizations.find_one({"id": payslip_request.organization_id})
        
        if not user or not org:
            raise HTTPException(status_code=404, detail="User or organization not found")
        
        # Generate PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story = []
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            textColor=colors.HexColor(org.get("primary_color", "#3b82f6"))
        )
        
        # Organization header
        if org.get("logo_base64") and org.get("subscription_tier") in ["premium", "enterprise"]:
            # Add logo if available and subscription allows
            try:
                logo_data = base64.b64decode(org["logo_base64"].split(",")[1])
                logo_img = Image.open(io.BytesIO(logo_data))
                
                # Save to temporary file
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                    logo_img.save(tmp.name)
                    logo = ReportLabImage(tmp.name, width=100, height=50)
                    story.append(logo)
                    story.append(Spacer(1, 20))
            except:
                pass
        
        # Organization name
        org_name = Paragraph(org["name"], title_style)
        story.append(org_name)
        story.append(Spacer(1, 20))
        
        # Payslip title
        payslip_title = Paragraph("PAYSLIP", styles['Heading2'])
        story.append(payslip_title)
        story.append(Spacer(1, 20))
        
        # Employee details
        employee_data = [
            ["Employee Name:", f"{user['first_name']} {user['last_name']}"],
            ["Employee ID:", user.get("employee_id", "N/A")],
            ["Department:", user.get("department", "N/A")],
            ["Position:", user.get("position", "N/A")],
            ["Pay Period:", f"{payroll['pay_period_start'].strftime('%Y-%m-%d')} to {payroll['pay_period_end'].strftime('%Y-%m-%d')}"],
        ]
        
        employee_table = Table(employee_data, colWidths=[2*inch, 3*inch])
        employee_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ]))
        
        story.append(employee_table)
        story.append(Spacer(1, 20))
        
        # Pay details
        currency_symbol = SUBSCRIPTION_PRICING["basic"][payroll["currency"]]["symbol"]
        pay_data = [
            ["Description", "Hours", "Rate", "Amount"],
            ["Regular Hours", f"{payroll['total_hours'] - payroll['overtime_hours']:.1f}", f"{currency_symbol}{user.get('hourly_rate', 0):.2f}", f"{currency_symbol}{payroll['regular_pay']:.2f}"],
            ["Overtime Hours", f"{payroll['overtime_hours']:.1f}", f"{currency_symbol}{user.get('hourly_rate', 0) * 1.5:.2f}", f"{currency_symbol}{payroll['overtime_pay']:.2f}"],
            ["", "", "Gross Pay:", f"{currency_symbol}{payroll['gross_pay']:.2f}"],
            ["", "", "Tax Deductions:", f"-{currency_symbol}{payroll['tax_deductions']:.2f}"],
            ["", "", "Other Deductions:", f"-{currency_symbol}{payroll['other_deductions']:.2f}"],
            ["", "", "NET PAY:", f"{currency_symbol}{payroll['net_pay']:.2f}"],
        ]
        
        pay_table = Table(pay_data, colWidths=[2*inch, 1*inch, 1*inch, 1.5*inch])
        pay_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightgreen),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ]))
        
        story.append(pay_table)
        story.append(Spacer(1, 30))
        
        # Footer
        footer_text = f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        if org.get("subscription_tier") != "enterprise":
            footer_text += " • Powered by LEXA"
        
        footer = Paragraph(footer_text, styles['Normal'])
        story.append(footer)
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        
        return StreamingResponse(
            io.BytesIO(buffer.getvalue()),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=payslip_{user['first_name']}_{user['last_name']}_{payroll['pay_period_start'].strftime('%Y%m%d')}.pdf"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Dashboard endpoints
@api_router.get("/dashboard/stats/{user_id}")
async def get_dashboard_stats(user_id: str):
    # Get current month stats
    current_month = datetime.now().strftime("%Y-%m")
    
    # Total hours this month
    month_records = await db.attendance.find({
        "user_id": user_id,
        "date": {"$regex": f"^{current_month}"}
    }).to_list(100)
    
    month_records = [fix_object_id(record) for record in month_records]
    
    total_hours = sum(record.get("total_hours", 0) for record in month_records)
    total_overtime = sum(record.get("overtime_hours", 0) for record in month_records)
    days_worked = len([r for r in month_records if r.get("total_hours", 0) > 0])
    
    # Current status
    today = datetime.now().strftime("%Y-%m-%d")
    current_attendance = await db.attendance.find_one({
        "user_id": user_id,
        "date": today
    })
    
    if current_attendance:
        current_attendance = fix_object_id(current_attendance)
    
    current_status = current_attendance.get("status", "clocked_out") if current_attendance else "clocked_out"
    
    return {
        "total_hours_month": total_hours,
        "overtime_hours_month": total_overtime,
        "days_worked_month": days_worked,
        "current_status": current_status,
        "current_attendance": current_attendance
    }

@api_router.get("/dashboard/organization/{org_id}")
async def get_organization_dashboard(org_id: str):
    # Get organization stats
    org = await db.organizations.find_one({"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Employee count
    total_employees = await db.users.count_documents({"organization_id": org_id, "is_active": True})
    
    # Today's attendance
    today = datetime.now().strftime("%Y-%m-%d")
    today_attendance = await db.attendance.find({"organization_id": org_id, "date": today}).to_list(1000)
    
    clocked_in = len([a for a in today_attendance if a.get("status") == "clocked_in"])
    on_break = len([a for a in today_attendance if a.get("status") == "break"])
    
    # This month's stats
    current_month = datetime.now().strftime("%Y-%m")
    month_payroll = await db.payroll.find({
        "organization_id": org_id,
        "pay_period_start": {"$regex": f"^{current_month}"}
    }).to_list(1000)
    
    total_payroll = sum(record.get("gross_pay", 0) for record in month_payroll)
    
    return {
        "organization": fix_object_id(org),
        "total_employees": total_employees,
        "clocked_in_today": clocked_in,
        "on_break_today": on_break,
        "total_payroll_month": total_payroll,
        "subscription_tier": org.get("subscription_tier", "basic"),
        "subscription_status": org.get("subscription_status", "trial")
    }

# Users endpoints
@api_router.get("/users/organization/{org_id}")
async def get_organization_users(org_id: str):
    users = await db.users.find({"organization_id": org_id}).to_list(100)
    
    # Remove password hashes and fix ObjectId
    for user in users:
        user = fix_object_id(user)
        if "password_hash" in user:
            del user["password_hash"]
    
    return users

# Webhooks
@api_router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    payload = await request.body()
    
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, os.environ.get("STRIPE_WEBHOOK_SECRET")
        )
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Handle subscription events
    if event['type'] == 'customer.subscription.created':
        await handle_subscription_created(event['data']['object'])
    elif event['type'] == 'customer.subscription.updated':
        await handle_subscription_updated(event['data']['object'])
    elif event['type'] == 'customer.subscription.deleted':
        await handle_subscription_deleted(event['data']['object'])
    
    return {"status": "success"}

async def handle_subscription_created(subscription):
    # Update organization subscription status
    await db.organizations.update_one(
        {"stripe_customer_id": subscription['customer']},
        {"$set": {
            "stripe_subscription_id": subscription['id'],
            "subscription_status": "active",
            "updated_at": datetime.utcnow()
        }}
    )

async def handle_subscription_updated(subscription):
    await db.organizations.update_one(
        {"stripe_subscription_id": subscription['id']},
        {"$set": {
            "subscription_status": subscription['status'],
            "updated_at": datetime.utcnow()
        }}
    )

async def handle_subscription_deleted(subscription):
    await db.organizations.update_one(
        {"stripe_subscription_id": subscription['id']},
        {"$set": {
            "subscription_status": "canceled",
            "updated_at": datetime.utcnow()
        }}
    )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()