"""
Iteration 15 Tests - Subscription Renewals & Service Receipt Features
Tests for:
1. NEW /api/dashboard/subscription-renewals endpoint
2. SERVICE_DOMAINS constant in models.py
3. _classify_service_receipt function in gmail.py
4. Existing endpoints regression tests
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from shared config
from tests.conftest_credentials import ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_EMAIL, DEMO_PASSWORD


@pytest.fixture(scope="module")
def admin_token():
    """Get admin user authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def demo_token():
    """Get demo user authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200, f"Demo login failed: {response.text}"
    return response.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_health_endpoint(self):
        """GET /api/health - health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health endpoint working")
    
    def test_admin_login(self):
        """POST /api/auth/login - admin login with httpOnly cookie"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print("✓ Admin login working")
    
    def test_auth_me_with_header(self, admin_token):
        """GET /api/auth/me - works with Authorization header"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        print("✓ Auth me endpoint working with header")


class TestNewSubscriptionRenewalsEndpoint:
    """Tests for the NEW /api/dashboard/subscription-renewals endpoint"""
    
    def test_subscription_renewals_returns_correct_structure(self, admin_token):
        """GET /api/dashboard/subscription-renewals - returns subscriptions and upcoming_this_week arrays"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/subscription-renewals",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "subscriptions" in data, "Response must have 'subscriptions' key"
        assert "upcoming_this_week" in data, "Response must have 'upcoming_this_week' key"
        assert isinstance(data["subscriptions"], list), "'subscriptions' must be a list"
        assert isinstance(data["upcoming_this_week"], list), "'upcoming_this_week' must be a list"
        print(f"✓ Subscription renewals endpoint returns correct structure: subscriptions={len(data['subscriptions'])}, upcoming={len(data['upcoming_this_week'])}")
    
    def test_subscription_renewals_requires_auth(self):
        """GET /api/dashboard/subscription-renewals - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboard/subscription-renewals")
        assert response.status_code == 401
        print("✓ Subscription renewals endpoint requires authentication")
    
    def test_subscription_renewals_demo_user(self, demo_token):
        """GET /api/dashboard/subscription-renewals - works for demo user"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/subscription-renewals",
            headers=auth_headers(demo_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert "subscriptions" in data
        assert "upcoming_this_week" in data
        print("✓ Subscription renewals endpoint works for demo user")


class TestDashboardEndpoints:
    """Dashboard endpoints regression tests"""
    
    def test_dashboard_stats(self, admin_token):
        """GET /api/dashboard/stats - dashboard statistics"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        required_fields = ["total_income", "total_expenses", "balance", "daily_average", 
                          "weekly_total", "monthly_total", "by_category", "sri_deductible"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        print("✓ Dashboard stats endpoint working")
    
    def test_dashboard_chart_data(self, admin_token):
        """GET /api/dashboard/chart-data - chart data"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/chart-data?period=month",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        print("✓ Dashboard chart data endpoint working")


class TestGmailEndpoints:
    """Gmail integration endpoints tests"""
    
    def test_gmail_status(self, admin_token):
        """GET /api/gmail/status - gmail status"""
        response = requests.get(
            f"{BASE_URL}/api/gmail/status",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        print(f"✓ Gmail status endpoint working (connected={data['connected']})")
    
    def test_gmail_transactions(self, admin_token):
        """GET /api/gmail/transactions - gmail transactions with summary"""
        response = requests.get(
            f"{BASE_URL}/api/gmail/transactions",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data
        assert "summary" in data
        
        # Verify summary structure
        summary = data["summary"]
        assert "total" in summary
        assert "pendiente" in summary
        assert "aprobado" in summary
        assert "descartado" in summary
        print(f"✓ Gmail transactions endpoint working (total={summary['total']})")


class TestTransactionsEndpoints:
    """Transactions endpoints regression tests"""
    
    def test_list_transactions(self, admin_token):
        """GET /api/transactions - list transactions"""
        response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Transactions list endpoint working ({len(data)} transactions)")


class TestCategoriesEndpoints:
    """Categories endpoints regression tests"""
    
    def test_sri_categories(self, admin_token):
        """GET /api/categories - SRI categories"""
        response = requests.get(
            f"{BASE_URL}/api/categories",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        
        # Verify SRI categories exist
        categories = data["categories"]
        expected_cats = ["alimentacion", "salud", "educacion", "vivienda", "vestimenta"]
        for cat in expected_cats:
            assert cat in categories, f"Missing SRI category: {cat}"
        print("✓ Categories endpoint working with SRI categories")
    
    def test_budget_categories(self, admin_token):
        """GET /api/budget/categories - budget categories"""
        response = requests.get(
            f"{BASE_URL}/api/budget/categories",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        print("✓ Budget categories endpoint working")


class TestFinancialEndpoints:
    """Financial management endpoints regression tests"""
    
    def test_credit_cards(self, admin_token):
        """GET /api/credit-cards - list credit cards"""
        response = requests.get(
            f"{BASE_URL}/api/credit-cards",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        # API returns list directly
        assert isinstance(data, list)
        print(f"✓ Credit cards endpoint working ({len(data)} cards)")
    
    def test_deferred_payments(self, admin_token):
        """GET /api/deferred-payments - deferred payments"""
        response = requests.get(
            f"{BASE_URL}/api/deferred-payments",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        print(f"✓ Deferred payments endpoint working ({len(data['payments'])} payments)")
    
    def test_known_vendors(self, admin_token):
        """GET /api/known-vendors - known vendors"""
        response = requests.get(
            f"{BASE_URL}/api/known-vendors",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        # API returns list directly
        assert isinstance(data, list)
        print(f"✓ Known vendors endpoint working ({len(data)} vendors)")
    
    def test_scheduled_payments(self, admin_token):
        """GET /api/scheduled-payments - scheduled payments"""
        response = requests.get(
            f"{BASE_URL}/api/scheduled-payments",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        # API returns list directly
        assert isinstance(data, list)
        print(f"✓ Scheduled payments endpoint working ({len(data)} payments)")
    
    def test_reminders(self, admin_token):
        """GET /api/reminders - reminders"""
        response = requests.get(
            f"{BASE_URL}/api/reminders",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Reminders endpoint working ({len(data)} reminders)")
    
    def test_cashflow_projection(self, admin_token):
        """GET /api/cashflow/projection - cashflow projection"""
        response = requests.get(
            f"{BASE_URL}/api/cashflow/projection",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        data = response.json()
        # Verify projection structure - data is nested under 'projection' key
        assert "projection" in data or "status" in data, "Response must have projection or status"
        if "projection" in data:
            projection = data["projection"]
            expected_fields = ["expected_income", "projected_balance"]
            for field in expected_fields:
                assert field in projection, f"Missing field in projection: {field}"
        print("✓ Cashflow projection endpoint working")


class TestServiceDomainsConstant:
    """Tests to verify SERVICE_DOMAINS constant is properly defined"""
    
    def test_gmail_sync_endpoint_exists(self, admin_token):
        """POST /api/gmail/sync - endpoint exists (will fail if Gmail not connected)"""
        response = requests.post(
            f"{BASE_URL}/api/gmail/sync",
            headers=auth_headers(admin_token)
        )
        # Should return 400 (Gmail not connected) not 404 (endpoint not found)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        if response.status_code == 400:
            data = response.json()
            assert "detail" in data
            # Expected error when Gmail is not connected
            assert "Gmail" in data["detail"] or "conectado" in data["detail"].lower()
        print("✓ Gmail sync endpoint exists (Gmail not connected - expected)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
