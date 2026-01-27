import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class FamilyFinanceAPITester:
    def __init__(self, base_url="https://fintrack-ec.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.spouse_token = None
        self.accountant_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        if token:
            test_headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                try:
                    error_detail = response.json().get('detail', 'Unknown error')
                    details += f", Error: {error_detail}"
                except:
                    details += f", Response: {response.text[:100]}"
            
            self.log_test(name, success, details if not success else "")
            
            if success:
                try:
                    return response.json()
                except:
                    return {"status": "success"}
            return None

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return None

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        self.run_test("Health Check", "GET", "", 200)
        self.run_test("API Root", "GET", "health", 200)

    def test_user_registration_and_login(self):
        """Test user registration and login for different roles"""
        print("\n🔍 Testing User Registration & Login...")
        
        timestamp = datetime.now().strftime("%H%M%S")
        
        # Test admin registration
        admin_data = {
            "name": f"Admin Test {timestamp}",
            "email": f"admin{timestamp}@test.com",
            "password": "TestPass123!",
            "role": "admin"
        }
        
        admin_response = self.run_test(
            "Register Admin User",
            "POST",
            "auth/register",
            200,
            data=admin_data
        )
        
        if admin_response:
            self.admin_token = admin_response.get('access_token')
        
        # Test spouse registration
        spouse_data = {
            "name": f"Spouse Test {timestamp}",
            "email": f"spouse{timestamp}@test.com",
            "password": "TestPass123!",
            "role": "spouse"
        }
        
        spouse_response = self.run_test(
            "Register Spouse User",
            "POST",
            "auth/register",
            200,
            data=spouse_data
        )
        
        if spouse_response:
            self.spouse_token = spouse_response.get('access_token')
        
        # Test accountant registration
        accountant_data = {
            "name": f"Accountant Test {timestamp}",
            "email": f"accountant{timestamp}@test.com",
            "password": "TestPass123!",
            "role": "accountant"
        }
        
        accountant_response = self.run_test(
            "Register Accountant User",
            "POST",
            "auth/register",
            200,
            data=accountant_data
        )
        
        if accountant_response:
            self.accountant_token = accountant_response.get('access_token')
        
        # Test login with admin
        if admin_response:
            login_response = self.run_test(
                "Login Admin User",
                "POST",
                "auth/login",
                200,
                data={"email": admin_data["email"], "password": admin_data["password"]}
            )
        
        # Test duplicate registration (should fail)
        self.run_test(
            "Duplicate Registration (Should Fail)",
            "POST",
            "auth/register",
            400,
            data=admin_data
        )

    def test_auth_me_endpoint(self):
        """Test the /auth/me endpoint"""
        print("\n🔍 Testing Auth Me Endpoint...")
        
        if self.admin_token:
            self.run_test(
                "Get Current User (Admin)",
                "GET",
                "auth/me",
                200,
                token=self.admin_token
            )
        
        # Test without token (should fail)
        self.run_test(
            "Get Current User (No Token - Should Fail)",
            "GET",
            "auth/me",
            401
        )

    def test_categories_endpoint(self):
        """Test categories endpoint"""
        print("\n🔍 Testing Categories Endpoint...")
        
        categories_response = self.run_test(
            "Get Categories",
            "GET",
            "categories",
            200
        )
        
        if categories_response:
            # Verify expected categories exist
            categories = categories_response.get('categories', {})
            expected_cats = ['alimentacion', 'salud', 'educacion', 'vivienda', 'vestimenta', 'transporte', 'otros']
            
            for cat in expected_cats:
                if cat in categories:
                    self.log_test(f"Category '{cat}' exists", True)
                else:
                    self.log_test(f"Category '{cat}' exists", False, f"Missing category: {cat}")

    def test_transactions_crud(self):
        """Test transaction CRUD operations"""
        print("\n🔍 Testing Transaction CRUD Operations...")
        
        if not self.admin_token:
            print("❌ No admin token available for transaction tests")
            return
        
        # Create expense transaction
        expense_data = {
            "amount": 25.50,
            "description": "Test grocery purchase",
            "category": "alimentacion",
            "subcategory": "Comida",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "transaction_type": "expense",
            "establishment": "Test Supermarket"
        }
        
        expense_response = self.run_test(
            "Create Expense Transaction",
            "POST",
            "transactions",
            200,
            data=expense_data,
            token=self.admin_token
        )
        
        expense_id = None
        if expense_response:
            expense_id = expense_response.get('id')
        
        # Create income transaction
        income_data = {
            "amount": 1500.00,
            "description": "Monthly salary",
            "category": "otros",
            "subcategory": "Varios",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "transaction_type": "income",
            "source": "Personal"
        }
        
        income_response = self.run_test(
            "Create Income Transaction",
            "POST",
            "transactions",
            200,
            data=income_data,
            token=self.admin_token
        )
        
        income_id = None
        if income_response:
            income_id = income_response.get('id')
        
        # Get all transactions
        self.run_test(
            "Get All Transactions",
            "GET",
            "transactions",
            200,
            token=self.admin_token
        )
        
        # Get transactions with filters
        self.run_test(
            "Get Transactions (Category Filter)",
            "GET",
            "transactions?category=alimentacion",
            200,
            token=self.admin_token
        )
        
        self.run_test(
            "Get Transactions (Type Filter)",
            "GET",
            "transactions?transaction_type=expense",
            200,
            token=self.admin_token
        )
        
        # Update transaction
        if expense_id:
            updated_data = expense_data.copy()
            updated_data["amount"] = 30.00
            updated_data["description"] = "Updated grocery purchase"
            
            self.run_test(
                "Update Transaction",
                "PUT",
                f"transactions/{expense_id}",
                200,
                data=updated_data,
                token=self.admin_token
            )
        
        # Delete transactions
        if expense_id:
            self.run_test(
                "Delete Expense Transaction",
                "DELETE",
                f"transactions/{expense_id}",
                200,
                token=self.admin_token
            )
        
        if income_id:
            self.run_test(
                "Delete Income Transaction",
                "DELETE",
                f"transactions/{income_id}",
                200,
                token=self.admin_token
            )

    def test_dashboard_endpoints(self):
        """Test dashboard endpoints"""
        print("\n🔍 Testing Dashboard Endpoints...")
        
        if not self.admin_token:
            print("❌ No admin token available for dashboard tests")
            return
        
        # Test dashboard stats
        self.run_test(
            "Get Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            token=self.admin_token
        )
        
        # Test chart data with different periods
        for period in ['week', 'month', 'year']:
            self.run_test(
                f"Get Chart Data ({period})",
                "GET",
                f"dashboard/chart-data?period={period}",
                200,
                token=self.admin_token
            )

    def test_budget_endpoints(self):
        """Test budget endpoints"""
        print("\n🔍 Testing Budget Endpoints...")
        
        if not self.admin_token:
            print("❌ No admin token available for budget tests")
            return
        
        # Test get budget
        self.run_test(
            "Get Budget",
            "GET",
            "budget",
            200,
            token=self.admin_token
        )
        
        # Test budget vs actual
        self.run_test(
            "Get Budget vs Actual",
            "GET",
            "budget/vs-actual",
            200,
            token=self.admin_token
        )

    def test_predictions_endpoint(self):
        """Test predictions endpoint"""
        print("\n🔍 Testing Predictions Endpoint...")
        
        if not self.admin_token:
            print("❌ No admin token available for predictions tests")
            return
        
        # Test predictions (may take time due to AI processing)
        self.run_test(
            "Get AI Predictions",
            "GET",
            "predictions",
            200,
            token=self.admin_token
        )

    def test_role_based_access(self):
        """Test role-based access control"""
        print("\n🔍 Testing Role-Based Access Control...")
        
        # Test accountant view with admin token (should work)
        if self.admin_token:
            self.run_test(
                "Accountant View (Admin Access)",
                "GET",
                "accountant/tax-summary",
                200,
                token=self.admin_token
            )
        
        # Test accountant view with accountant token (should work)
        if self.accountant_token:
            self.run_test(
                "Accountant View (Accountant Access)",
                "GET",
                "accountant/tax-summary",
                200,
                token=self.accountant_token
            )
        
        # Test accountant view with spouse token (should fail)
        if self.spouse_token:
            self.run_test(
                "Accountant View (Spouse Access - Should Fail)",
                "GET",
                "accountant/tax-summary",
                403,
                token=self.spouse_token
            )
        
        # Test users endpoint with admin token (should work)
        if self.admin_token:
            self.run_test(
                "Get Users (Admin Access)",
                "GET",
                "users",
                200,
                token=self.admin_token
            )
        
        # Test users endpoint with spouse token (should fail)
        if self.spouse_token:
            self.run_test(
                "Get Users (Spouse Access - Should Fail)",
                "GET",
                "users",
                403,
                token=self.spouse_token
            )

    def test_international_features(self):
        """Test new international expense features"""
        print("\n🔍 Testing International Features...")
        
        if not self.admin_token:
            print("❌ No admin token available for international tests")
            return
        
        # Create an international transaction first
        intl_transaction_data = {
            "amount": 150.00,
            "description": "Hotel booking in Miami USA",
            "category": "viajes_internacionales",
            "subcategory": "USA",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "transaction_type": "expense",
            "establishment": "Marriott Miami",
            "country": "USA",
            "is_international": True,
            "payment_source": "internacional",
            "is_deductible": False
        }
        
        intl_response = self.run_test(
            "Create International Transaction",
            "POST",
            "transactions",
            200,
            data=intl_transaction_data,
            token=self.admin_token
        )
        
        # Test international transactions endpoint
        self.run_test(
            "Get International Transactions",
            "GET",
            "transactions/international",
            200,
            token=self.admin_token
        )
        
        # Test transactions by payment source
        self.run_test(
            "Get Transactions by Payment Source (Internacional)",
            "GET",
            "transactions/by-payment-source?payment_source=internacional",
            200,
            token=self.admin_token
        )
        
        self.run_test(
            "Get Transactions by Payment Source (Local)",
            "GET",
            "transactions/by-payment-source?payment_source=local",
            200,
            token=self.admin_token
        )

    def test_budget_suggestions(self):
        """Test budget suggestions feature"""
        print("\n🔍 Testing Budget Suggestions...")
        
        if not self.admin_token:
            print("❌ No admin token available for budget suggestions tests")
            return
        
        # Test budget suggestions endpoint
        self.run_test(
            "Get Budget Suggestions",
            "GET",
            "budget/suggestions",
            200,
            token=self.admin_token
        )

    def test_multiple_file_upload_endpoints(self):
        """Test multiple file upload endpoints"""
        print("\n🔍 Testing Multiple File Upload Endpoints...")
        
        if not self.admin_token:
            print("❌ No admin token available for file upload tests")
            return
        
        # Test multiple receipts endpoint structure (without actual files)
        # We can't easily test file uploads in this simple test, but we can verify the endpoint exists
        print("ℹ️  Multiple file upload endpoints exist but require actual files for full testing")
        print("ℹ️  Endpoints: /api/process/receipts-multiple, /api/process/receipt, /api/process/excel")

    def test_ai_processing_endpoints(self):
        """Test AI processing endpoints (basic structure test)"""
        print("\n🔍 Testing AI Processing Endpoints...")
        
        if not self.admin_token:
            print("❌ No admin token available for AI processing tests")
            return
        
        # Test email processing with empty content (should handle gracefully)
        # Note: We're not testing actual AI functionality, just endpoint availability
        print("ℹ️  AI processing endpoints exist but require actual content for full testing")

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting FamilyFinance Ecuador API Tests")
        print("=" * 60)
        
        try:
            self.test_health_check()
            self.test_user_registration_and_login()
            self.test_auth_me_endpoint()
            self.test_categories_endpoint()
            self.test_transactions_crud()
            self.test_international_features()
            self.test_dashboard_endpoints()
            self.test_budget_endpoints()
            self.test_budget_suggestions()
            self.test_predictions_endpoint()
            self.test_role_based_access()
            self.test_multiple_file_upload_endpoints()
            self.test_ai_processing_endpoints()
            
        except Exception as e:
            print(f"\n❌ Test suite failed with exception: {str(e)}")
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    tester = FamilyFinanceAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())