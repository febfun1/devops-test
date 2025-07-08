import requests
import json
import time
from datetime import datetime, timedelta
import unittest
import random
import string
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Get the backend URL from the frontend .env file
BACKEND_URL = "https://4c4f2531-fb39-45f2-9df8-884ece82869f.preview.emergentagent.com/api"

def random_string(length=8):
    """Generate a random string for test data"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

class TimeveraHRSystemTest(unittest.TestCase):
    """Test suite for Timevera HR/Payroll/Attendance System"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test data that will be used across tests"""
        cls.test_users = {}
        cls.company_id = None
        cls.current_attendance = None
    
    def test_01_company_creation(self):
        """Test company creation endpoint"""
        company_data = {
            "name": f"Test Company {random_string()}",
            "industry": "traditional",
            "address": "123 Test Street",
            "phone": "555-123-4567",
            "email": "test@company.com",
            "timezone": "UTC"
        }
        
        response = requests.post(f"{BACKEND_URL}/organizations", json=company_data)
        self.assertEqual(response.status_code, 200, f"Failed to create company: {response.text}")
        
        company = response.json()
        self.assertIn("id", company, "Company ID not returned")
        self.__class__.company_id = company["id"]
        
        logger.info(f"✅ Created company with ID: {self.__class__.company_id}")
    
    def test_02_get_companies(self):
        """Test retrieving companies endpoint"""
        response = requests.get(f"{BACKEND_URL}/organizations")
        self.assertEqual(response.status_code, 200, f"Failed to get companies: {response.text}")
        
        companies = response.json()
        self.assertIsInstance(companies, list, "Companies should be returned as a list")
        self.assertGreaterEqual(len(companies), 1, "At least one company should exist")
        
        logger.info(f"✅ Retrieved {len(companies)} companies")
    
    def test_03_user_registration(self):
        """Test user registration with different roles"""
        roles = ["employee", "manager", "hr", "admin"]
        
        for role in roles:
            email = f"{role}_{random_string()}@test.com"
            user_data = {
                "email": email,
                "password": "Password123!",
                "first_name": f"Test{role.capitalize()}",
                "last_name": "User",
                "role": role,
                "department": "Testing",
                "position": f"Test {role.capitalize()}",
                "hourly_rate": 25.0 if role != "admin" else None,
                "salary": 75000.0 if role == "admin" else None
            }
            
            response = requests.post(f"{BACKEND_URL}/auth/register", json=user_data)
            self.assertEqual(response.status_code, 200, f"Failed to register {role} user: {response.text}")
            
            result = response.json()
            self.assertIn("user", result, f"User data not returned for {role}")
            self.assertEqual(result["user"]["email"], email, f"Email mismatch for {role}")
            self.assertEqual(result["user"]["role"], role, f"Role mismatch for {role}")
            
            # Verify secret code is generated
            self.assertIn("secret_code", result["user"], f"Secret code not generated for {role}")
            self.assertIsNotNone(result["user"]["secret_code"], f"Secret code is None for {role}")
            
            # Store user for later tests
            self.__class__.test_users[role] = result["user"]
            
            logger.info(f"✅ Registered {role} user: {email} with secret code: {result['user']['secret_code']}")
    
    def test_04_user_login(self):
        """Test user login functionality"""
        # Test invalid login first
        invalid_login = {
            "email": "nonexistent@test.com",
            "password": "WrongPassword"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/login", json=invalid_login)
        self.assertEqual(response.status_code, 401, "Invalid login should return 401")
        
        logger.info("✅ Invalid login correctly rejected")
        
        # Test valid login with each role
        for role, user in self.__class__.test_users.items():
            login_data = {
                "email": user["email"],
                "password": "Password123!"
            }
            
            response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
            self.assertEqual(response.status_code, 200, f"Failed to login as {role}: {response.text}")
            
            result = response.json()
            self.assertIn("user", result, f"User data not returned for {role}")
            self.assertEqual(result["user"]["email"], user["email"], f"Email mismatch for {role}")
            self.assertEqual(result["user"]["role"], role, f"Role mismatch for {role}")
            
            # Verify ObjectId fields are properly serialized
            self.assertIsInstance(result["user"]["_id"], str, "ObjectId not properly serialized to string")
            
            logger.info(f"✅ Successfully logged in as {role}")
    
    def test_05_secret_code_login(self):
        """Test login using secret code instead of email"""
        # Test invalid secret code login first
        invalid_login = {
            "secret_code": "nonexistentcode123",
            "password": "WrongPassword"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/login-secret", json=invalid_login)
        self.assertEqual(response.status_code, 401, "Invalid secret code login should return 401")
        
        logger.info("✅ Invalid secret code login correctly rejected")
        
        # Test valid secret code login with each role
        for role, user in self.__class__.test_users.items():
            login_data = {
                "secret_code": user["secret_code"],
                "password": "Password123!"
            }
            
            response = requests.post(f"{BACKEND_URL}/auth/login-secret", json=login_data)
            self.assertEqual(response.status_code, 200, f"Failed to login as {role} with secret code: {response.text}")
            
            result = response.json()
            self.assertIn("user", result, f"User data not returned for {role}")
            self.assertEqual(result["user"]["email"], user["email"], f"Email mismatch for {role}")
            self.assertEqual(result["user"]["role"], role, f"Role mismatch for {role}")
            self.assertEqual(result["user"]["secret_code"], user["secret_code"], f"Secret code mismatch for {role}")
            
            # Verify ObjectId fields are properly serialized
            self.assertIsInstance(result["user"]["_id"], str, "ObjectId not properly serialized to string")
            
            logger.info(f"✅ Successfully logged in as {role} using secret code")
    
    def test_06_get_secret_code(self):
        """Test getting user's secret code"""
        employee = self.__class__.test_users.get("employee")
        if not employee:
            self.skipTest("No employee user available")
        
        response = requests.get(f"{BACKEND_URL}/auth/get-secret-code/{employee['id']}")
        self.assertEqual(response.status_code, 200, f"Failed to get secret code: {response.text}")
        
        result = response.json()
        self.assertIn("secret_code", result, "Secret code not returned")
        self.assertEqual(result["secret_code"], employee["secret_code"], "Secret code mismatch")
        
        logger.info(f"✅ Successfully retrieved secret code: {result['secret_code']}")
    
    def test_07_update_secret_code(self):
        """Test updating user's secret code"""
        employee = self.__class__.test_users.get("employee")
        if not employee:
            self.skipTest("No employee user available")
        
        # Update with auto-generated code
        update_data = {
            "current_secret_code": employee["secret_code"]
        }
        
        response = requests.put(f"{BACKEND_URL}/auth/update-secret-code/{employee['id']}", json=update_data)
        self.assertEqual(response.status_code, 200, f"Failed to update secret code: {response.text}")
        
        result = response.json()
        self.assertIn("new_secret_code", result, "New secret code not returned")
        self.assertNotEqual(result["new_secret_code"], employee["secret_code"], "Secret code should be different")
        
        # Update test user with new secret code
        self.__class__.test_users["employee"]["secret_code"] = result["new_secret_code"]
        
        logger.info(f"✅ Successfully updated secret code to: {result['new_secret_code']}")
        
        # Update with custom code
        new_code = f"custom_{random_string(12)}"
        update_data = {
            "current_secret_code": result["new_secret_code"],
            "new_secret_code": new_code
        }
        
        response = requests.put(f"{BACKEND_URL}/auth/update-secret-code/{employee['id']}", json=update_data)
        self.assertEqual(response.status_code, 200, f"Failed to update secret code with custom value: {response.text}")
        
        result = response.json()
        self.assertIn("new_secret_code", result, "New secret code not returned")
        self.assertEqual(result["new_secret_code"], new_code, "Custom secret code not set correctly")
        
        # Update test user with new secret code
        self.__class__.test_users["employee"]["secret_code"] = result["new_secret_code"]
        
        logger.info(f"✅ Successfully updated secret code to custom value: {result['new_secret_code']}")
    
    def test_05_attendance_clock_in(self):
        """Test clock in functionality"""
        employee = self.__class__.test_users.get("employee")
        if not employee:
            self.skipTest("No employee user available")
        
        action_data = {
            "user_id": employee["id"],
            "action": "clock_in",
            "project_name": "Test Project",
            "notes": "Testing clock in functionality"
        }
        
        response = requests.post(f"{BACKEND_URL}/attendance/action", json=action_data)
        self.assertEqual(response.status_code, 200, f"Failed to clock in: {response.text}")
        
        result = response.json()
        self.assertIn("attendance", result, "Attendance data not returned")
        self.assertEqual(result["attendance"]["status"], "clocked_in", "Status should be clocked_in")
        self.assertEqual(result["attendance"]["project_name"], "Test Project", "Project name mismatch")
        
        # Store attendance record for later tests
        self.__class__.current_attendance = result["attendance"]
        
        logger.info("✅ Successfully clocked in employee")
        
        # Test duplicate clock in (should fail)
        response = requests.post(f"{BACKEND_URL}/attendance/action", json=action_data)
        self.assertEqual(response.status_code, 400, "Duplicate clock in should be rejected")
        
        logger.info("✅ Duplicate clock in correctly rejected")
    
    def test_06_attendance_break(self):
        """Test break start/end functionality"""
        employee = self.__class__.test_users.get("employee")
        if not employee or not self.__class__.current_attendance:
            self.skipTest("No employee user or current attendance available")
        
        # Start break
        action_data = {
            "user_id": employee["id"],
            "action": "break_start"
        }
        
        response = requests.post(f"{BACKEND_URL}/attendance/action", json=action_data)
        self.assertEqual(response.status_code, 200, f"Failed to start break: {response.text}")
        
        result = response.json()
        self.assertIn("attendance", result, "Attendance data not returned")
        self.assertEqual(result["attendance"]["status"], "break", "Status should be break")
        self.assertIsNotNone(result["attendance"]["break_start"], "Break start time should be set")
        
        logger.info("✅ Successfully started break")
        
        # Wait a moment before ending break
        time.sleep(2)
        
        # End break
        action_data = {
            "user_id": employee["id"],
            "action": "break_end"
        }
        
        response = requests.post(f"{BACKEND_URL}/attendance/action", json=action_data)
        self.assertEqual(response.status_code, 200, f"Failed to end break: {response.text}")
        
        result = response.json()
        self.assertIn("attendance", result, "Attendance data not returned")
        self.assertEqual(result["attendance"]["status"], "clocked_in", "Status should be clocked_in")
        self.assertIsNotNone(result["attendance"]["break_end"], "Break end time should be set")
        
        logger.info("✅ Successfully ended break")
    
    def test_07_attendance_clock_out(self):
        """Test clock out functionality"""
        employee = self.__class__.test_users.get("employee")
        if not employee:
            self.skipTest("No employee user available")
        
        action_data = {
            "user_id": employee["id"],
            "action": "clock_out"
        }
        
        response = requests.post(f"{BACKEND_URL}/attendance/action", json=action_data)
        self.assertEqual(response.status_code, 200, f"Failed to clock out: {response.text}")
        
        result = response.json()
        self.assertIn("attendance", result, "Attendance data not returned")
        self.assertEqual(result["attendance"]["status"], "clocked_out", "Status should be clocked_out")
        self.assertIsNotNone(result["attendance"]["clock_out"], "Clock out time should be set")
        self.assertIsNotNone(result["attendance"]["total_hours"], "Total hours should be calculated")
        
        logger.info("✅ Successfully clocked out employee")
    
    def test_08_get_current_attendance(self):
        """Test getting current attendance status"""
        employee = self.__class__.test_users.get("employee")
        if not employee:
            self.skipTest("No employee user available")
        
        response = requests.get(f"{BACKEND_URL}/attendance/current/{employee['id']}")
        self.assertEqual(response.status_code, 200, f"Failed to get current attendance: {response.text}")
        
        result = response.json()
        self.assertIn("status", result, "Status not returned")
        
        logger.info(f"✅ Successfully retrieved current attendance status: {result['status']}")
    
    def test_09_get_attendance_history(self):
        """Test getting attendance history"""
        employee = self.__class__.test_users.get("employee")
        if not employee:
            self.skipTest("No employee user available")
        
        response = requests.get(f"{BACKEND_URL}/attendance/history/{employee['id']}")
        self.assertEqual(response.status_code, 200, f"Failed to get attendance history: {response.text}")
        
        history = response.json()
        self.assertIsInstance(history, list, "History should be returned as a list")
        
        logger.info(f"✅ Successfully retrieved attendance history with {len(history)} records")
    
    def test_10_get_company_attendance(self):
        """Test getting company-wide attendance"""
        if not self.__class__.company_id:
            self.skipTest("No company ID available")
        
        response = requests.get(f"{BACKEND_URL}/attendance/organization/{self.__class__.company_id}")
        self.assertEqual(response.status_code, 200, f"Failed to get company attendance: {response.text}")
        
        attendance = response.json()
        self.assertIsInstance(attendance, list, "Attendance should be returned as a list")
        
        logger.info(f"✅ Successfully retrieved company attendance with {len(attendance)} records")
    
    def test_11_get_dashboard_stats(self):
        """Test getting dashboard statistics"""
        employee = self.__class__.test_users.get("employee")
        if not employee:
            self.skipTest("No employee user available")
        
        response = requests.get(f"{BACKEND_URL}/dashboard/stats/{employee['id']}")
        self.assertEqual(response.status_code, 200, f"Failed to get dashboard stats: {response.text}")
        
        stats = response.json()
        self.assertIn("current_status", stats, "Current status not returned")
        self.assertIn("leave_balances", stats, "Leave balances not returned")
        
        logger.info(f"✅ Successfully retrieved dashboard statistics")
    
    def test_12_get_company_users(self):
        """Test getting company users"""
        if not self.__class__.company_id:
            self.skipTest("No company ID available")
        
        response = requests.get(f"{BACKEND_URL}/employees/organization/{self.__class__.company_id}")
        self.assertEqual(response.status_code, 200, f"Failed to get company users: {response.text}")
        
        users = response.json()
        self.assertIsInstance(users, list, "Users should be returned as a list")
        self.assertGreaterEqual(len(users), 1, "At least one user should exist")
        
        # Verify ObjectId fields are properly serialized
        for user in users:
            self.assertIsInstance(user["_id"], str, "ObjectId not properly serialized to string")
        
        logger.info(f"✅ Successfully retrieved {len(users)} company users")
    
    def test_13_edge_cases(self):
        """Test various edge cases"""
        employee = self.__class__.test_users.get("employee")
        if not employee:
            self.skipTest("No employee user available")
            
        # Clock in again for edge case testing
        action_data = {
            "user_id": employee["id"],
            "action": "clock_in"
        }
        
        # First clock in
        requests.post(f"{BACKEND_URL}/attendance/action", json=action_data)
        
        # Clock out to reset
        requests.post(f"{BACKEND_URL}/attendance/action", json={"user_id": employee["id"], "action": "clock_out"})
        
        # Test clock out without clock in
        response = requests.post(f"{BACKEND_URL}/attendance/action", json={"user_id": employee["id"], "action": "clock_out"})
        self.assertEqual(response.status_code, 400, "Clock out without clock in should be rejected")
        
        logger.info("✅ Clock out without clock in correctly rejected")
        
        # Test break start without clock in
        response = requests.post(f"{BACKEND_URL}/attendance/action", json={"user_id": employee["id"], "action": "break_start"})
        self.assertEqual(response.status_code, 400, "Break start without clock in should be rejected")
        
        logger.info("✅ Break start without clock in correctly rejected")

if __name__ == "__main__":
    unittest.main(verbosity=2)