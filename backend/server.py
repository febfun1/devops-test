from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
from enum import Enum
import json
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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
app = FastAPI(title="LEXA HR System", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class UserRole(str, Enum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    HR = "hr"
    ADMIN = "admin"

class AttendanceStatus(str, Enum):
    CLOCKED_IN = "clocked_in"
    CLOCKED_OUT = "clocked_out"
    BREAK = "break"

class IndustryType(str, Enum):
    TRADITIONAL = "traditional"
    MUSIC = "music"
    EDUCATION = "education"
    GIGS = "gigs"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    first_name: str
    last_name: str
    role: UserRole
    company_id: str
    department: Optional[str] = None
    position: Optional[str] = None
    hourly_rate: Optional[float] = None
    salary: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class UserCreate(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role: UserRole = UserRole.EMPLOYEE
    department: Optional[str] = None
    position: Optional[str] = None
    hourly_rate: Optional[float] = None
    salary: Optional[float] = None

class UserLogin(BaseModel):
    email: str
    password: str

class Company(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    industry: IndustryType
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    timezone: str = "UTC"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CompanyCreate(BaseModel):
    name: str
    industry: IndustryType
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    timezone: str = "UTC"

class AttendanceRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    company_id: str
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    break_start: Optional[datetime] = None
    break_end: Optional[datetime] = None
    status: AttendanceStatus
    date: str  # YYYY-MM-DD format
    total_hours: Optional[float] = None
    overtime_hours: Optional[float] = None
    project_name: Optional[str] = None  # For gigs/projects
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AttendanceAction(BaseModel):
    user_id: str
    action: str  # "clock_in", "clock_out", "break_start", "break_end"
    project_name: Optional[str] = None
    notes: Optional[str] = None

class PayrollRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    company_id: str
    pay_period_start: datetime
    pay_period_end: datetime
    total_hours: float
    overtime_hours: float
    regular_pay: float
    overtime_pay: float
    gross_pay: float
    deductions: float
    net_pay: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def calculate_hours(clock_in: datetime, clock_out: datetime) -> float:
    delta = clock_out - clock_in
    return delta.total_seconds() / 3600

# Authentication endpoints
@api_router.post("/auth/register")
async def register_user(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create default company if first user
    company_count = await db.companies.count_documents({})
    if company_count == 0:
        default_company = Company(
            name="Default Company",
            industry=IndustryType.TRADITIONAL
        )
        await db.companies.insert_one(default_company.dict())
        company_id = default_company.id
    else:
        # Get first company for demo
        company = await db.companies.find_one({})
        company_id = company["id"]
    
    # Create user
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=user_data.role,
        company_id=company_id,
        department=user_data.department,
        position=user_data.position,
        hourly_rate=user_data.hourly_rate,
        salary=user_data.salary
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
    
    # Remove password hash and fix ObjectId from response
    user_dict = user.copy()
    del user_dict["password_hash"]
    user_dict = fix_object_id(user_dict)
    
    return {"user": user_dict, "message": "Login successful"}

# Company endpoints
@api_router.post("/companies", response_model=Company)
async def create_company(company_data: CompanyCreate):
    company = Company(**company_data.dict())
    await db.companies.insert_one(company.dict())
    return company

@api_router.get("/companies", response_model=List[Company])
async def get_companies():
    companies = await db.companies.find().to_list(100)
    companies = [fix_object_id(company) for company in companies]
    return [Company(**company) for company in companies]

# Attendance endpoints
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
            company_id=user["company_id"],
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
        attendance_dict["notes"] = action_data.notes
        
    elif action_data.action == "clock_out":
        if attendance_dict["status"] != AttendanceStatus.CLOCKED_IN:
            raise HTTPException(status_code=400, detail="Not clocked in")
        
        attendance_dict["clock_out"] = now
        attendance_dict["status"] = AttendanceStatus.CLOCKED_OUT
        
        # Calculate total hours
        if attendance_dict["clock_in"]:
            total_hours = calculate_hours(attendance_dict["clock_in"], now)
            attendance_dict["total_hours"] = total_hours
            
            # Calculate overtime (over 8 hours)
            if total_hours > 8:
                attendance_dict["overtime_hours"] = total_hours - 8
            else:
                attendance_dict["overtime_hours"] = 0
    
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
    
    return attendance

@api_router.get("/attendance/history/{user_id}")
async def get_attendance_history(user_id: str, days: int = 30):
    start_date = datetime.now() - timedelta(days=days)
    
    attendance_records = await db.attendance.find({
        "user_id": user_id,
        "created_at": {"$gte": start_date}
    }).sort("date", -1).to_list(100)
    
    return attendance_records

@api_router.get("/attendance/company/{company_id}")
async def get_company_attendance(company_id: str):
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Get all attendance records for today
    attendance_records = await db.attendance.find({
        "company_id": company_id,
        "date": today
    }).to_list(100)
    
    # Get user details for each record
    enriched_records = []
    for record in attendance_records:
        user = await db.users.find_one({"id": record["user_id"]})
        if user:
            record["user_name"] = f"{user['first_name']} {user['last_name']}"
            record["department"] = user.get("department", "")
            record["position"] = user.get("position", "")
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
    
    total_hours = sum(record.get("total_hours", 0) for record in month_records)
    total_overtime = sum(record.get("overtime_hours", 0) for record in month_records)
    days_worked = len([r for r in month_records if r.get("total_hours", 0) > 0])
    
    # Current status
    today = datetime.now().strftime("%Y-%m-%d")
    current_attendance = await db.attendance.find_one({
        "user_id": user_id,
        "date": today
    })
    
    current_status = current_attendance.get("status", "clocked_out") if current_attendance else "clocked_out"
    
    return {
        "total_hours_month": total_hours,
        "overtime_hours_month": total_overtime,
        "days_worked_month": days_worked,
        "current_status": current_status,
        "current_attendance": current_attendance
    }

# Users endpoints
@api_router.get("/users/company/{company_id}")
async def get_company_users(company_id: str):
    users = await db.users.find({"company_id": company_id}).to_list(100)
    
    # Remove password hashes
    for user in users:
        if "password_hash" in user:
            del user["password_hash"]
    
    return users

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