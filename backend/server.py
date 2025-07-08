from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, File, UploadFile, Header, BackgroundTasks
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
import csv
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as ReportLabImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from PIL import Image
import tempfile
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

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
app = FastAPI(title="Timevera HR System", version="3.0.0")

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

class LeaveType(str, Enum):
    VACATION = "vacation"
    SICK = "sick"
    PERSONAL = "personal"
    MATERNITY = "maternity"
    PATERNITY = "paternity"
    EMERGENCY = "emergency"

class LeaveStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"

class NotificationType(str, Enum):
    LEAVE_REQUEST = "leave_request"
    LEAVE_APPROVED = "leave_approved"
    LEAVE_REJECTED = "leave_rejected"
    PAYROLL_GENERATED = "payroll_generated"
    SYSTEM_UPDATE = "system_update"
    ATTENDANCE_REMINDER = "attendance_reminder"

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
    leave_policies: Dict[str, Any] = Field(default_factory=lambda: {
        "vacation_days": 20,
        "sick_days": 10,
        "personal_days": 5,
        "approval_required": True
    })
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
    leave_policies: Optional[Dict[str, Any]] = None

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
    manager_id: Optional[str] = None
    two_factor_enabled: bool = False
    leave_balances: Dict[str, int] = Field(default_factory=lambda: {
        "vacation": 20,
        "sick": 10,
        "personal": 5
    })
    performance_rating: Optional[float] = None
    last_login: Optional[datetime] = None
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
    manager_id: Optional[str] = None

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    employee_id: Optional[str] = None
    hourly_rate: Optional[float] = None
    salary: Optional[float] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    manager_id: Optional[str] = None
    avatar_base64: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class LeaveRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    organization_id: str
    leave_type: LeaveType
    start_date: datetime
    end_date: datetime
    total_days: int
    reason: str
    status: LeaveStatus = LeaveStatus.PENDING
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    comments: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class LeaveRequestCreate(BaseModel):
    leave_type: LeaveType
    start_date: datetime
    end_date: datetime
    reason: str

class LeaveRequestUpdate(BaseModel):
    status: LeaveStatus
    comments: Optional[str] = None

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    organization_id: str
    type: NotificationType
    title: str
    message: str
    data: Optional[Dict[str, Any]] = None
    read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

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

class PerformanceReview(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    organization_id: str
    reviewer_id: str
    review_period_start: datetime
    review_period_end: datetime
    overall_rating: float
    goals_achieved: List[str] = []
    areas_of_improvement: List[str] = []
    comments: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AnalyticsRequest(BaseModel):
    organization_id: str
    start_date: datetime
    end_date: datetime
    metric_type: str  # "attendance", "payroll", "performance", "leaves"

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

def calculate_leave_days(start_date: datetime, end_date: datetime) -> int:
    delta = end_date - start_date
    return delta.days + 1

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
            "custom_fields": False,
            "leave_management": True,
            "performance_tracking": False
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
            "custom_fields": True,
            "leave_management": True,
            "performance_tracking": True,
            "analytics_dashboard": True
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
            "white_label": True,
            "leave_management": True,
            "performance_tracking": True,
            "analytics_dashboard": True,
            "data_export": True,
            "audit_logs": True
        }
    }
    return features.get(tier, features["basic"])

async def send_notification(user_id: str, organization_id: str, notification_type: NotificationType, title: str, message: str, data: Dict[str, Any] = None):
    """Send notification to user"""
    notification = Notification(
        user_id=user_id,
        organization_id=organization_id,
        type=notification_type,
        title=title,
        message=message,
        data=data
    )
    await db.notifications.insert_one(notification.dict())

# Authentication endpoints
@api_router.post("/auth/register")
async def register_user(user_data: UserCreate, background_tasks: BackgroundTasks):
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
        manager_id=user_data.manager_id,
        hire_date=datetime.utcnow()
    )
    
    await db.users.insert_one(user.dict())
    
    # Send welcome notification
    background_tasks.add_task(
        send_notification,
        user.id,
        organization_id,
        NotificationType.SYSTEM_UPDATE,
        "Welcome to Timevera!",
        f"Welcome {user.first_name}! Your account has been created successfully."
    )
    
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
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.utcnow()}}
    )
    
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

# Employee Management
@api_router.get("/employees/organization/{org_id}")
async def get_organization_employees(org_id: str):
    users = await db.users.find({"organization_id": org_id}).to_list(1000)
    
    # Remove password hashes and fix ObjectId
    employees = []
    for user in users:
        user = fix_object_id(user)
        if "password_hash" in user:
            del user["password_hash"]
        
        # Get manager info if available
        if user.get("manager_id"):
            manager = await db.users.find_one({"id": user["manager_id"]})
            if manager:
                manager = fix_object_id(manager)
                user["manager_name"] = f"{manager['first_name']} {manager['last_name']}"
        
        employees.append(user)
    
    return employees

@api_router.put("/employees/{user_id}")
async def update_employee(user_id: str, user_update: UserUpdate):
    update_data = {k: v for k, v in user_update.dict().items() if v is not None}
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return {"message": "Employee updated successfully"}

@api_router.delete("/employees/{user_id}")
async def deactivate_employee(user_id: str):
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return {"message": "Employee deactivated successfully"}

# Leave Management
@api_router.post("/leaves/request")
async def create_leave_request(leave_data: LeaveRequestCreate, user_id: str, background_tasks: BackgroundTasks):
    # Get user info
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = fix_object_id(user)
    
    # Calculate total days
    total_days = calculate_leave_days(leave_data.start_date, leave_data.end_date)
    
    # Check leave balance
    leave_type = leave_data.leave_type.value
    current_balance = user.get("leave_balances", {}).get(leave_type, 0)
    
    if current_balance < total_days:
        raise HTTPException(status_code=400, detail=f"Insufficient {leave_type} leave balance")
    
    # Create leave request
    leave_request = LeaveRequest(
        user_id=user_id,
        organization_id=user["organization_id"],
        leave_type=leave_data.leave_type,
        start_date=leave_data.start_date,
        end_date=leave_data.end_date,
        total_days=total_days,
        reason=leave_data.reason
    )
    
    await db.leave_requests.insert_one(leave_request.dict())
    
    # Notify manager/HR
    if user.get("manager_id"):
        background_tasks.add_task(
            send_notification,
            user["manager_id"],
            user["organization_id"],
            NotificationType.LEAVE_REQUEST,
            "New Leave Request",
            f"{user['first_name']} {user['last_name']} has requested {total_days} days of {leave_type} leave."
        )
    
    return {"message": "Leave request submitted successfully", "leave_request": fix_object_id(leave_request.dict())}

@api_router.get("/leaves/user/{user_id}")
async def get_user_leaves(user_id: str):
    leaves = await db.leave_requests.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    return [fix_object_id(leave) for leave in leaves]

@api_router.get("/leaves/organization/{org_id}")
async def get_organization_leaves(org_id: str):
    leaves = await db.leave_requests.find({"organization_id": org_id}).sort("created_at", -1).to_list(100)
    
    # Enrich with user data
    enriched_leaves = []
    for leave in leaves:
        leave = fix_object_id(leave)
        user = await db.users.find_one({"id": leave["user_id"]})
        if user:
            leave["user_name"] = f"{user['first_name']} {user['last_name']}"
            leave["department"] = user.get("department", "")
        enriched_leaves.append(leave)
    
    return enriched_leaves

@api_router.put("/leaves/{leave_id}/approve")
async def approve_leave_request(leave_id: str, approver_id: str, comments: str = "", background_tasks: BackgroundTasks = None):
    # Get leave request
    leave = await db.leave_requests.find_one({"id": leave_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    leave = fix_object_id(leave)
    
    # Update leave request
    await db.leave_requests.update_one(
        {"id": leave_id},
        {"$set": {
            "status": LeaveStatus.APPROVED,
            "approved_by": approver_id,
            "approved_at": datetime.utcnow(),
            "comments": comments,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Update user leave balance
    leave_type = leave["leave_type"]
    await db.users.update_one(
        {"id": leave["user_id"]},
        {"$inc": {f"leave_balances.{leave_type}": -leave["total_days"]}}
    )
    
    # Notify user
    if background_tasks:
        background_tasks.add_task(
            send_notification,
            leave["user_id"],
            leave["organization_id"],
            NotificationType.LEAVE_APPROVED,
            "Leave Request Approved",
            f"Your {leave_type} leave request has been approved."
        )
    
    return {"message": "Leave request approved successfully"}

@api_router.put("/leaves/{leave_id}/reject")
async def reject_leave_request(leave_id: str, approver_id: str, comments: str, background_tasks: BackgroundTasks = None):
    # Update leave request
    result = await db.leave_requests.update_one(
        {"id": leave_id},
        {"$set": {
            "status": LeaveStatus.REJECTED,
            "approved_by": approver_id,
            "approved_at": datetime.utcnow(),
            "comments": comments,
            "updated_at": datetime.utcnow()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    # Get leave request for notification
    leave = await db.leave_requests.find_one({"id": leave_id})
    if leave:
        leave = fix_object_id(leave)
    
    # Notify user
    if background_tasks and leave:
        background_tasks.add_task(
            send_notification,
            leave["user_id"],
            leave["organization_id"],
            NotificationType.LEAVE_REJECTED,
            "Leave Request Rejected",
            f"Your {leave['leave_type']} leave request has been rejected. Reason: {comments}"
        )
    
    return {"message": "Leave request rejected successfully"}

# Notifications
@api_router.get("/notifications/user/{user_id}")
async def get_user_notifications(user_id: str, limit: int = 50):
    notifications = await db.notifications.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [fix_object_id(notification) for notification in notifications]

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    result = await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

# Analytics and Reporting
@api_router.post("/analytics/organization/{org_id}")
async def get_organization_analytics(org_id: str, analytics_request: AnalyticsRequest):
    start_date = analytics_request.start_date
    end_date = analytics_request.end_date
    metric_type = analytics_request.metric_type
    
    if metric_type == "attendance":
        # Attendance analytics
        attendance_records = await db.attendance.find({
            "organization_id": org_id,
            "created_at": {"$gte": start_date, "$lte": end_date}
        }).to_list(10000)
        
        total_hours = sum(record.get("total_hours", 0) for record in attendance_records)
        total_overtime = sum(record.get("overtime_hours", 0) for record in attendance_records)
        unique_employees = len(set(record["user_id"] for record in attendance_records))
        
        return {
            "metric_type": "attendance",
            "period": {"start": start_date, "end": end_date},
            "total_hours": total_hours,
            "total_overtime": total_overtime,
            "unique_employees": unique_employees,
            "average_hours_per_employee": total_hours / unique_employees if unique_employees > 0 else 0
        }
    
    elif metric_type == "payroll":
        # Payroll analytics
        payroll_records = await db.payroll.find({
            "organization_id": org_id,
            "generated_at": {"$gte": start_date, "$lte": end_date}
        }).to_list(10000)
        
        total_gross_pay = sum(record.get("gross_pay", 0) for record in payroll_records)
        total_net_pay = sum(record.get("net_pay", 0) for record in payroll_records)
        total_deductions = sum(record.get("tax_deductions", 0) + record.get("other_deductions", 0) for record in payroll_records)
        
        return {
            "metric_type": "payroll",
            "period": {"start": start_date, "end": end_date},
            "total_gross_pay": total_gross_pay,
            "total_net_pay": total_net_pay,
            "total_deductions": total_deductions,
            "number_of_payrolls": len(payroll_records)
        }
    
    elif metric_type == "leaves":
        # Leave analytics
        leave_requests = await db.leave_requests.find({
            "organization_id": org_id,
            "created_at": {"$gte": start_date, "$lte": end_date}
        }).to_list(10000)
        
        total_requests = len(leave_requests)
        approved_requests = len([r for r in leave_requests if r["status"] == "approved"])
        pending_requests = len([r for r in leave_requests if r["status"] == "pending"])
        rejected_requests = len([r for r in leave_requests if r["status"] == "rejected"])
        
        return {
            "metric_type": "leaves",
            "period": {"start": start_date, "end": end_date},
            "total_requests": total_requests,
            "approved_requests": approved_requests,
            "pending_requests": pending_requests,
            "rejected_requests": rejected_requests,
            "approval_rate": (approved_requests / total_requests * 100) if total_requests > 0 else 0
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid metric type")

# Data Export
@api_router.get("/export/attendance/{org_id}")
async def export_attendance_data(org_id: str, start_date: str, end_date: str):
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        
        # Get attendance records
        attendance_records = await db.attendance.find({
            "organization_id": org_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }).to_list(10000)
        
        # Enrich with user data
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Headers
        writer.writerow([
            "Employee Name", "Employee ID", "Date", "Clock In", "Clock Out",
            "Total Hours", "Overtime Hours", "Break Hours", "Project", "Location", "Notes"
        ])
        
        for record in attendance_records:
            user = await db.users.find_one({"id": record["user_id"]})
            if user:
                user = fix_object_id(user)
                writer.writerow([
                    f"{user['first_name']} {user['last_name']}",
                    user.get("employee_id", ""),
                    record["date"],
                    record.get("clock_in", ""),
                    record.get("clock_out", ""),
                    record.get("total_hours", 0),
                    record.get("overtime_hours", 0),
                    record.get("break_hours", 0),
                    record.get("project_name", ""),
                    record.get("location", ""),
                    record.get("notes", "")
                ])
        
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=attendance_export_{start_date}_{end_date}.csv"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Existing endpoints (attendance, payroll, etc.) continue here...
# [Previous attendance, payroll, subscription, and other endpoints remain the same]

# Attendance endpoints (existing code with organization context)
@api_router.post("/attendance/action")
async def attendance_action(action_data: AttendanceAction):
    today = datetime.now().strftime("%Y-%m-%d")
    now = datetime.utcnow()
    
    # Get user info
    user = await db.users.find_one({"id": action_data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = fix_object_id(user)
    
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
        attendance_dict = fix_object_id(attendance)
    
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
    
    # Get leave balances
    user = await db.users.find_one({"id": user_id})
    user = fix_object_id(user) if user else None
    leave_balances = user.get("leave_balances", {}) if user else {}
    
    # Get pending leave requests
    pending_leaves = await db.leave_requests.count_documents({
        "user_id": user_id,
        "status": "pending"
    })
    
    return {
        "total_hours_month": total_hours,
        "overtime_hours_month": total_overtime,
        "days_worked_month": days_worked,
        "current_status": current_status,
        "current_attendance": current_attendance,
        "leave_balances": leave_balances,
        "pending_leave_requests": pending_leaves
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
    
    # Pending leave requests
    pending_leaves = await db.leave_requests.count_documents({
        "organization_id": org_id,
        "status": "pending"
    })
    
    return {
        "organization": fix_object_id(org),
        "total_employees": total_employees,
        "clocked_in_today": clocked_in,
        "on_break_today": on_break,
        "total_payroll_month": total_payroll,
        "pending_leave_requests": pending_leaves,
        "subscription_tier": org.get("subscription_tier", "basic"),
        "subscription_status": org.get("subscription_status", "trial")
    }

# [Continue with existing payroll, subscription, and other endpoints...]
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