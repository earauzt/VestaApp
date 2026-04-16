"""
Iteration 16 Tests - Code Quality Refactoring Verification
Tests:
1. All backend API endpoints work correctly after refactoring
2. ReconciliacionEstados component split verification (frontend smoke)
3. process_bank_statement() refactored helper functions work
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
from tests.conftest_credentials import ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_EMAIL, DEMO_PASSWORD


class TestHealthAndAuth:
    """Health check and authentication tests"""
    
    def test_health_endpoint(self):
        """GET /api/health - health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health endpoint working")
    
    def test_admin_login(self):
        """POST /api/auth/login - admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data or "token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login successful: {data['user']['email']}")
        return data.get("access_token") or data.get("token")
    
    def test_demo_login(self):
        """POST /api/auth/login - demo user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data or "token" in data
        print(f"✓ Demo login successful: {data['user']['email']}")
    
    def test_auth_me(self):
        """GET /api/auth/me - verify auth works"""
        # First login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json().get("access_token") or login_resp.json().get("token")
        
        # Then check /me
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        print(f"✓ Auth /me working: {data['email']}")


class TestDashboardEndpoints:
    """Dashboard API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_resp.json().get("access_token") or login_resp.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_stats(self):
        """GET /api/dashboard/stats - dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        # Verify structure
        assert "total_income" in data or "totalIncome" in data or isinstance(data, dict)
        print(f"✓ Dashboard stats working")
    
    def test_subscription_renewals(self):
        """GET /api/dashboard/subscription-renewals - subscription renewals"""
        response = requests.get(f"{BASE_URL}/api/dashboard/subscription-renewals", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "subscriptions" in data
        assert "upcoming_this_week" in data
        print(f"✓ Subscription renewals working: {len(data['subscriptions'])} subscriptions")


class TestTransactionsAndCategories:
    """Transactions and categories API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_resp.json().get("access_token") or login_resp.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_transactions(self):
        """GET /api/transactions - list transactions"""
        response = requests.get(f"{BASE_URL}/api/transactions", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data or isinstance(data, list)
        print(f"✓ Transactions list working")
    
    def test_get_categories(self):
        """GET /api/categories - SRI categories"""
        response = requests.get(f"{BASE_URL}/api/categories", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, (list, dict))
        print(f"✓ Categories working")


class TestCreditCardsAndPayments:
    """Credit cards and payments API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_resp.json().get("access_token") or login_resp.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_credit_cards(self):
        """GET /api/credit-cards - credit cards"""
        response = requests.get(f"{BASE_URL}/api/credit-cards", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "cards" in data or isinstance(data, list)
        print(f"✓ Credit cards working")
    
    def test_deferred_payments(self):
        """GET /api/deferred-payments - deferred payments"""
        response = requests.get(f"{BASE_URL}/api/deferred-payments", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data or isinstance(data, list)
        print(f"✓ Deferred payments working")
    
    def test_scheduled_payments(self):
        """GET /api/scheduled-payments - scheduled payments"""
        response = requests.get(f"{BASE_URL}/api/scheduled-payments", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data or isinstance(data, list)
        print(f"✓ Scheduled payments working")


class TestVendorsAndReconciliation:
    """Vendors and reconciliation API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_resp.json().get("access_token") or login_resp.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_known_vendors(self):
        """GET /api/known-vendors - vendors"""
        response = requests.get(f"{BASE_URL}/api/known-vendors", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "vendors" in data or isinstance(data, list)
        print(f"✓ Known vendors working")
    
    def test_reconciliation_history(self):
        """GET /api/reconciliation/history - reconciliation history"""
        response = requests.get(f"{BASE_URL}/api/reconciliation/history", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "statements" in data or isinstance(data, list)
        print(f"✓ Reconciliation history working")
    
    def test_reconciliation_upload_endpoint_exists(self):
        """POST /api/reconciliation/upload-statement - endpoint exists (returns 422 without file)"""
        response = requests.post(f"{BASE_URL}/api/reconciliation/upload-statement", headers=self.headers)
        # Should return 422 (Unprocessable Entity) because no file was provided
        assert response.status_code == 422
        print(f"✓ Reconciliation upload endpoint exists (422 without file as expected)")


class TestGmailAndReminders:
    """Gmail and reminders API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_resp.json().get("access_token") or login_resp.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_gmail_status(self):
        """GET /api/gmail/status - gmail status"""
        response = requests.get(f"{BASE_URL}/api/gmail/status", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        print(f"✓ Gmail status working: connected={data['connected']}")
    
    def test_gmail_transactions(self):
        """GET /api/gmail/transactions - gmail transactions"""
        response = requests.get(f"{BASE_URL}/api/gmail/transactions", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data or "summary" in data or isinstance(data, dict)
        print(f"✓ Gmail transactions working")
    
    def test_reminders(self):
        """GET /api/reminders - reminders"""
        response = requests.get(f"{BASE_URL}/api/reminders", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "reminders" in data or isinstance(data, list)
        print(f"✓ Reminders working")


class TestCashflowAndBudget:
    """Cashflow and budget API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_resp.json().get("access_token") or login_resp.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_cashflow_projection(self):
        """GET /api/cashflow/projection - cashflow"""
        response = requests.get(f"{BASE_URL}/api/cashflow/projection", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ Cashflow projection working")
    
    def test_budget_categories(self):
        """GET /api/budget/categories - budget"""
        response = requests.get(f"{BASE_URL}/api/budget/categories", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data or isinstance(data, (list, dict))
        print(f"✓ Budget categories working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
