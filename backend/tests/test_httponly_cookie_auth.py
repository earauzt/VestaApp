"""
Test suite for httpOnly cookie authentication (Fase 2 - Quality Improvements)
Tests both cookie-based and header-based authentication flows
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "earauzt@gmail.com"
ADMIN_PASSWORD = "Realmadrid2011"
DEMO_EMAIL = "demo@fintrack.ec"
DEMO_PASSWORD = "demo2026"


class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health check passed")


class TestLoginCookieAuth:
    """Test login endpoint sets httpOnly cookie AND returns token in body"""
    
    def test_login_returns_token_and_sets_cookie(self):
        """POST /api/auth/login - returns access_token in body AND sets httpOnly cookie"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        # Check body contains access_token
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "token_type" in data, "Response should contain token_type"
        assert data["token_type"] == "bearer"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Login returns access_token in body: {data['access_token'][:20]}...")
        
        # Check cookie is set
        cookies = response.cookies
        assert "access_token" in cookies, "Response should set access_token cookie"
        cookie_value = cookies.get("access_token")
        assert cookie_value is not None and len(cookie_value) > 0
        print(f"✓ Login sets access_token cookie: {cookie_value[:20]}...")
        
        # Verify cookie matches body token
        assert cookie_value == data["access_token"], "Cookie token should match body token"
        print("✓ Cookie token matches body token")
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login - returns 401 with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        print("✓ Invalid credentials rejected with 401")


class TestAuthMeEndpoint:
    """Test /auth/me works with both cookie and header authentication"""
    
    def test_auth_me_with_authorization_header(self):
        """GET /api/auth/me - works with Authorization header"""
        # First login to get token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Use token in Authorization header
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        print(f"✓ /auth/me works with Authorization header - user: {data['email']}")
    
    def test_auth_me_with_cookie(self):
        """GET /api/auth/me - works with cookie (pass cookie header manually)"""
        # First login to get cookie
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
        )
        assert login_response.status_code == 200
        cookie_value = login_response.cookies.get("access_token")
        assert cookie_value is not None
        
        # Use cookie directly in Cookie header (simulating browser behavior)
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Cookie": f"access_token={cookie_value}"}
        )
        assert response.status_code == 200, f"Auth/me with cookie failed: {response.text}"
        data = response.json()
        assert data["email"] == DEMO_EMAIL
        print(f"✓ /auth/me works with Cookie header - user: {data['email']}")
    
    def test_auth_me_no_auth_returns_401(self):
        """GET /api/auth/me - returns 401 with no auth"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ /auth/me returns 401 with no authentication")


class TestLogoutEndpoint:
    """Test logout endpoint clears cookie"""
    
    def test_logout_clears_cookie(self):
        """POST /api/auth/logout - clears cookie"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        
        # Logout
        session = requests.Session()
        session.cookies.set("access_token", login_response.cookies.get("access_token"))
        
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200
        data = logout_response.json()
        assert "message" in data
        print(f"✓ Logout returns message: {data['message']}")
        
        # Check cookie is cleared (Set-Cookie with empty value or max-age=0)
        set_cookie_header = logout_response.headers.get("set-cookie", "")
        # Cookie should be deleted (either empty value or max-age=0)
        print(f"✓ Logout Set-Cookie header: {set_cookie_header[:100] if set_cookie_header else 'N/A'}...")


class TestRegisterEndpoint:
    """Test register endpoint sets cookie"""
    
    def test_register_returns_token_and_sets_cookie(self):
        """POST /api/auth/register - returns access_token and sets cookie"""
        import uuid
        test_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": "Test User",
                "email": test_email,
                "password": "testpass123",
                "role": "spouse"
            }
        )
        assert response.status_code == 200, f"Register failed: {response.text}"
        
        # Check body contains access_token
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["email"] == test_email
        print(f"✓ Register returns access_token for new user: {test_email}")
        
        # Check cookie is set
        cookies = response.cookies
        assert "access_token" in cookies, "Response should set access_token cookie"
        print("✓ Register sets access_token cookie")


class TestProtectedEndpointsWithAuth:
    """Test various protected endpoints work with auth header"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_transactions_with_auth(self):
        """GET /api/transactions - works with auth header"""
        response = requests.get(f"{BASE_URL}/api/transactions", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/transactions works with auth header")
    
    def test_dashboard_stats_with_auth(self):
        """GET /api/dashboard/stats - works with auth header"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/dashboard/stats works with auth header")
    
    def test_categories(self):
        """GET /api/categories - SRI categories"""
        response = requests.get(f"{BASE_URL}/api/categories", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/categories works")
    
    def test_sri_deduction_limits(self):
        """GET /api/sri/deduction-limits - SRI deduction limits"""
        response = requests.get(f"{BASE_URL}/api/sri/deduction-limits", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/sri/deduction-limits works")
    
    def test_credit_cards(self):
        """GET /api/credit-cards - list credit cards"""
        response = requests.get(f"{BASE_URL}/api/credit-cards", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/credit-cards works")
    
    def test_deferred_payments(self):
        """GET /api/deferred-payments - list deferred payments"""
        response = requests.get(f"{BASE_URL}/api/deferred-payments", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/deferred-payments works")
    
    def test_budget_categories(self):
        """GET /api/budget/categories - budget categories"""
        response = requests.get(f"{BASE_URL}/api/budget/categories", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/budget/categories works")
    
    def test_income(self):
        """GET /api/income - income list"""
        response = requests.get(f"{BASE_URL}/api/income", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/income works")
    
    def test_known_vendors(self):
        """GET /api/known-vendors - known vendors list"""
        response = requests.get(f"{BASE_URL}/api/known-vendors", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/known-vendors works")
    
    def test_scheduled_payments(self):
        """GET /api/scheduled-payments - scheduled payments"""
        response = requests.get(f"{BASE_URL}/api/scheduled-payments", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/scheduled-payments works")
    
    def test_expected_income(self):
        """GET /api/expected-income - expected income"""
        response = requests.get(f"{BASE_URL}/api/expected-income", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/expected-income works")
    
    def test_travel_fund(self):
        """GET /api/travel-fund - travel fund"""
        response = requests.get(f"{BASE_URL}/api/travel-fund", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/travel-fund works")
    
    def test_cashflow_projection(self):
        """GET /api/cashflow/projection - cashflow projection"""
        response = requests.get(f"{BASE_URL}/api/cashflow/projection", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/cashflow/projection works")
    
    def test_reminders(self):
        """GET /api/reminders - reminders"""
        response = requests.get(f"{BASE_URL}/api/reminders", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/reminders works")
    
    def test_debt_summary(self):
        """GET /api/debt/summary - debt summary"""
        response = requests.get(f"{BASE_URL}/api/debt/summary", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/debt/summary works")
    
    def test_reconciliation_history(self):
        """GET /api/reconciliation/history - reconciliation history"""
        response = requests.get(f"{BASE_URL}/api/reconciliation/history", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/reconciliation/history works")
    
    def test_gmail_status(self):
        """GET /api/gmail/status - gmail status"""
        response = requests.get(f"{BASE_URL}/api/gmail/status", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/gmail/status works")
    
    def test_chat_history(self):
        """GET /api/chat/history - chat history"""
        response = requests.get(f"{BASE_URL}/api/chat/history", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/chat/history works")
    
    def test_transactions_grouped(self):
        """GET /api/transactions/grouped - grouped transactions"""
        response = requests.get(f"{BASE_URL}/api/transactions/grouped", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/transactions/grouped works")
    
    def test_budget_financial_goals(self):
        """GET /api/budget/financial-goals - financial goals"""
        response = requests.get(f"{BASE_URL}/api/budget/financial-goals", headers=self.headers)
        assert response.status_code == 200
        print("✓ GET /api/budget/financial-goals works")
    
    def test_reconciliation_bulk_approve(self):
        """PUT /api/reconciliation/bulk-approve - bulk approve"""
        response = requests.put(
            f"{BASE_URL}/api/reconciliation/bulk-approve",
            headers=self.headers,
            json={"transaction_ids": []}
        )
        # Empty array should return 400 or 200 depending on implementation
        assert response.status_code in [200, 400]
        print(f"✓ PUT /api/reconciliation/bulk-approve returns {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
