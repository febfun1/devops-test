import requests
import json
import time
from datetime import datetime, timedelta
import unittest
import random
import string

# Get the backend URL from the frontend .env file
BACKEND_URL = "https://981fa1ca-766c-4e29-8552-1f7971fb9d91.preview.emergentagent.com/api"

def random_string(length=8):
    """Generate a random string for test data"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

class LexaHRSystemTest(unittest.TestCase):
    """Test suite for LEXA HR/Payroll/Attendance System"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test data that will be used across tests"""
        cls.test_users = {}
        cls.company_id = None
    
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
        
        response = requests.post(f"{BACKEND_URL}/companies", json=company_data)
        self.assertEqual(response.status_code, 200, f"Failed to create company: {response.text}")
        
        company = response.json()
        self.assertIn("id", company, "Company ID not returned")
        self.__class__.company_id = company["id"]
        
        print(f"✅ Created company with ID: {self.__class__.company_id}")
    
    def test_02_get_companies(self):
        """Test retrieving companies endpoint"""
        response = requests.get(f"{BACKEND_URL}/companies")
        self.assertEqual(response.status_code, 200, f"Failed to get companies: {response.text}")
        
        companies = response.json()
        self.assertIsInstance(companies, list, "Companies should be returned as a list")
        self.assertGreaterEqual(len(companies), 1, "At least one company should exist")
        
        print(f"✅ Retrieved {len(companies)} companies")
    
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
            
            # Store user for later tests
            self.__class__.test_users[role] = result["user"]
            
            print(f"✅ Registered {role} user: {email}")
    
    def test_04_user_login(self):
        """Test user login functionality"""
        for role, user in self.__class__.test_users.items():
            login_data = {
                "email": user["email"],
                "password": "Password123!"
            }
            
            response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
            self.assertEqual(response.status_code, 200, f"Failed to login as {role}: {response.text}")
            
            result = response.json()
            self.assertIn("user", result, f"User data not returned for {role} login")
            self.assertEqual(result["user"]["email"], user["email"], f"Email mismatch for {role} login")
            
            print(f"✅ Successfully logged in as {role}")
            
        # Test invalid login
        invalid_login = {
            "email": "nonexistent@test.com",
            "password": "WrongPassword"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/login", json=invalid_login)
        self.assertEqual(response.status_code, 401, "Invalid login should return 401")
        
        print("✅ Invalid login correctly rejected")
    
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
        
        print("✅ Successfully clocked in employee")
        
        # Test duplicate clock in (should fail)
        response = requests.post(f"{BACKEND_URL}/attendance/action", json=action_data)
        self.assertEqual(response.status_code, 400, "Duplicate clock in should be rejected")
        
        print("✅ Duplicate clock in correctly rejected")
    
    def test_06_attendance_break(self):
        """Test break start/end functionality"""
        employee = self.__class__.test_users.get("employee")
        if not employee:
            self.skipTest("No employee user available")
        
        # Start break
        action_data = {
            "user_id": employee["id"],
            "action": "break_start",
            "notes": "Testing break functionality"
        }
        
        response = requests.post(f"{BACKEND_URL}/attendance/action", json=action_data)
        self.assertEqual(response.status_code, 200, f"Failed to start break: {response.text}")
        
        result = response.json()
        self.assertIn("attendance", result, "Attendance data not returned")
        self.assertEqual(result["attendance"]["status"], "break", "Status should be break")
        
        print("✅ Successfully started break")
        
        # End break
        action_data = {
            "user_id": employee["id"],
            "action": "break_end"
        }
        
        response = requests.post(f"{BACKEND_URL}/attendance/action", json=action_data)
        self.assertEqual(response.status_code, 200, f"Failed to end break: {response.text}")
        
        result = response.json()
        self.assertIn("attendance", result, "Attendance data not returned")
        self.assertEqual(result["attendance"]["status"], "clocked_in", "Status should be clocked_in after break")
        
        print("✅ Successfully ended break")
    
    def test_07_attendance_clock_out(self):
        """Test clock out functionality"""
        employee = self.__class__.test_users.get("employee")
        if not employee:
            self.skipTest("No employee user available")
        
        # Wait a bit to accumulate some hours
        time.sleep(2)
        
        action_data = {
            "user_id": employee["id"],
            "action": "clock_out"
        }
        
        response = requests.post(f"{BACKEND_URL}/attendance/action", json=action_data)
        self.assertEqual(response.status_code, 200, f"Failed to clock out: {response.text}")
        
        result = response.json()
        self.assertIn("attendance", result, "Attendance data not returned")
        self.assertEqual(result["attendance"]["status"], "clocked_out", "Status should be clocked_out")
        self.assertIsNotNone(result["attendance"]["total_hours"], "Total hours should be calculated")
        
        print(f"✅ Successfully clocked out employee with {result['attendance']['total_hours']} hours")
    
    def test_08_get_current_attendance(self):
        """Test getting current attendance status"""
        employee = self.__class__.test_users.get("employee")
        if not employee:
            self.skipTest("No employee user available")
        
        response = requests.get(f"{BACKEND_URL}/attendance/current/{employee['id']}")
        self.assertEqual(response.status_code, 200, f"Failed to get current attendance: {response.text}")
        
        attendance = response.json()
        self.assertIn("status", attendance, "Status not returned")
        
        print(f"✅ Retrieved current attendance status: {attendance['status']}")
    
    def test_09_get_attendance_history(self):
        """Test getting attendance history"""
        employee = self.__class__.test_users.get("employee")
        if not employee:
            self.skipTest("No employee user available")
        
        response = requests.get(f"{BACKEND_URL}/attendance/history/{employee['id']}")
        self.assertEqual(response.status_code, 200, f"Failed to get attendance history: {response.text}")
        
        history = response.json()
        self.assertIsInstance(history, list, "History should be a list")
        self.assertGreaterEqual(len(history), 1, "Should have at least one attendance record")
        
        print(f"✅ Retrieved {len(history)} attendance history records")
    
    def test_10_get_company_attendance(self):
        """Test getting company-wide attendance"""
        if not self.__class__.company_id:
            self.skipTest("No company ID available")
        
        response = requests.get(f"{BACKEND_URL}/attendance/company/{self.__class__.company_id}")
        self.assertEqual(response.status_code, 200, f"Failed to get company attendance: {response.text}")
        
        attendance_records = response.json()
        self.assertIsInstance(attendance_records, list, "Company attendance should be a list")
        
        print(f"✅ Retrieved {len(attendance_records)} company attendance records")
    
    def test_11_get_dashboard_stats(self):
        """Test getting dashboard statistics"""
        employee = self.__class__.test_users.get("employee")
        if not employee:
            self.skipTest("No employee user available")
        
        response = requests.get(f"{BACKEND_URL}/dashboard/stats/{employee['id']}")
        self.assertEqual(response.status_code, 200, f"Failed to get dashboard stats: {response.text}")
        
        stats = response.json()
        self.assertIn("total_hours_month", stats, "Total hours not returned")
        self.assertIn("current_status", stats, "Current status not returned")
        
        print(f"✅ Retrieved dashboard stats: {stats['current_status']} status, {stats['total_hours_month']} hours this month")
    
    def test_12_get_company_users(self):
        """Test getting company users"""
        if not self.__class__.company_id:
            self.skipTest("No company ID available")
        
        response = requests.get(f"{BACKEND_URL}/users/company/{self.__class__.company_id}")
        self.assertEqual(response.status_code, 200, f"Failed to get company users: {response.text}")
        
        users = response.json()
        self.assertIsInstance(users, list, "Users should be a list")
        
        print(f"✅ Retrieved {len(users)} company users")
    
    def test_13_edge_cases(self):
        """Test various edge cases"""
        # Test invalid action
        if not self.__class__.test_users.get("employee"):
            self.skipTest("No employee user available")
            
        employee = self.__class__.test_users["employee"]
        
        # Clock in again for edge case testing
        action_data = {
            "user_id": employee["id"],
            "action": "clock_in"
        }
        
        # First clock in
        requests.post(f"{BACKEND_URL}/attendance/action", json=action_data)
        
        # Test break end without break start
        invalid_action = {
            "user_id": employee["id"],
            "action": "break_end"
        }
        
        response = requests.post(f"{BACKEND_URL}/attendance/action", json=invalid_action)
        self.assertEqual(response.status_code, 400, "Invalid break end should be rejected")
        
        print("✅ Invalid break end correctly rejected")
        
        # Test clock out without clock in (after resetting)
        # First clock out to reset
        requests.post(f"{BACKEND_URL}/attendance/action", json={"user_id": employee["id"], "action": "clock_out"})
        
        # Then try to clock out again
        response = requests.post(f"{BACKEND_URL}/attendance/action", json={"user_id": employee["id"], "action": "clock_out"})
        self.assertEqual(response.status_code, 400, "Clock out without clock in should be rejected")
        
        print("✅ Clock out without clock in correctly rejected")
        
        # Test break start without clock in
        response = requests.post(f"{BACKEND_URL}/attendance/action", json={"user_id": employee["id"], "action": "break_start"})
        self.assertEqual(response.status_code, 400, "Break start without clock in should be rejected")
        
        print("✅ Break start without clock in correctly rejected")

if __name__ == "__main__":
    unittest.main(verbosity=2)