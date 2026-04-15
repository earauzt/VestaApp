"""
Test suite for backend modularization verification.
Tests all endpoints to ensure they work correctly after splitting server.py into multiple route files.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from environment
from tests.conftest_credentials import ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_EMAIL, DEMO_PASSWORD


class TestHealthAndRoot:
    """Health check and root endpoint tests"""
    
    def test_health_endpoint(self):
        """GET /api/health - should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health endpoint working")
    
    def test_root_endpoint(self):
        """GET /api/ - should return API info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ Root endpoint working")


class TestAuthEndpoints:
    """Authentication endpoint tests (routes/auth.py)"""
    
    def test_login_admin(self):
        """POST /api/auth/login - login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login successful - user: {data['user']['name']}")
        return data["access_token"]
    
    def test_login_demo(self):
        """POST /api/auth/login - login with demo credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print("✓ Demo login successful")
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login - should fail with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected")
    
    def test_get_me(self):
        """GET /api/auth/me - get current user profile"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        # Get user profile
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        print(f"✓ Get me endpoint working - role: {data['role']}")


@pytest.fixture(scope="class")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Authentication failed")


class TestTransactionsEndpoints:
    """Transaction endpoint tests (routes/transactions.py)"""
    
    @pytest.fixture(autouse=True)
    def setup(self, auth_token):
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_transactions(self):
        """GET /api/transactions - list transactions"""
        response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Transactions endpoint working - {len(data)} transactions")
    
    def test_get_transactions_grouped(self):
        """GET /api/transactions/grouped - grouped transactions"""
        response = requests.get(
            f"{BASE_URL}/api/transactions/grouped",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Grouped transactions endpoint working - {len(data)} groups")


class TestDashboardEndpoints:
    """Dashboard endpoint tests (routes/dashboard.py)"""
    
    @pytest.fixture(autouse=True)
    def setup(self, auth_token):
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_stats(self):
        """GET /api/dashboard/stats - dashboard statistics"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_income" in data
        assert "total_expenses" in data
        assert "balance" in data
        print(f"✓ Dashboard stats working - balance: ${data['balance']:,.2f}")
    
    def test_categories(self):
        """GET /api/categories - SRI categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert "income_sources" in data
        print(f"✓ Categories endpoint working - {len(data['categories'])} categories")
    
    def test_sri_deduction_limits(self):
        """GET /api/sri/deduction-limits - SRI deduction limits"""
        response = requests.get(
            f"{BASE_URL}/api/sri/deduction-limits",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "limite_global" in data
        assert "category_progress" in data
        print(f"✓ SRI deduction limits working - limit: ${data['limite_global']:,.2f}")


class TestCreditCardsEndpoints:
    """Credit cards endpoint tests (routes/credit_cards.py)"""
    
    @pytest.fixture(autouse=True)
    def setup(self, auth_token):
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_credit_cards(self):
        """GET /api/credit-cards - list credit cards"""
        response = requests.get(
            f"{BASE_URL}/api/credit-cards",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        # Response is a list directly (not wrapped in {cards: []})
        assert isinstance(data, list)
        print(f"✓ Credit cards endpoint working - {len(data)} cards")
    
    def test_debt_summary(self):
        """GET /api/debt/summary - debt summary"""
        response = requests.get(
            f"{BASE_URL}/api/debt/summary",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_debt" in data
        assert "total_credit_limit" in data
        print(f"✓ Debt summary working - total debt: ${data['total_debt']:,.2f}")


class TestDeferredPaymentsEndpoints:
    """Deferred payments endpoint tests (routes/deferred.py)"""
    
    @pytest.fixture(autouse=True)
    def setup(self, auth_token):
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_deferred_payments(self):
        """GET /api/deferred-payments - list deferred payments"""
        response = requests.get(
            f"{BASE_URL}/api/deferred-payments",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        assert "total_remaining" in data
        print(f"✓ Deferred payments working - {data['count']} payments")


class TestBudgetEndpoints:
    """Budget endpoint tests (routes/budget.py)"""
    
    @pytest.fixture(autouse=True)
    def setup(self, auth_token):
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_budget_categories(self):
        """GET /api/budget/categories - budget categories"""
        response = requests.get(
            f"{BASE_URL}/api/budget/categories",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert "payment_methods" in data
        print(f"✓ Budget categories working - {len(data['categories'])} categories")
    
    def test_budget_config(self):
        """GET /api/budget/config - budget config"""
        response = requests.get(
            f"{BASE_URL}/api/budget/config",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "year" in data
        assert "categories" in data
        print(f"✓ Budget config working - year: {data['year']}")
    
    def test_income_list(self):
        """GET /api/income - income list"""
        response = requests.get(
            f"{BASE_URL}/api/income",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Income list working - {len(data)} incomes")
    
    def test_income_summary(self):
        """GET /api/income/summary - income summary"""
        response = requests.get(
            f"{BASE_URL}/api/income/summary",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "year" in data
        print(f"✓ Income summary working - total: ${data['total']:,.2f}")
    
    def test_financial_goals(self):
        """GET /api/budget/financial-goals - financial goals"""
        response = requests.get(
            f"{BASE_URL}/api/budget/financial-goals",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "year" in data
        assert "savings_goal" in data
        print(f"✓ Financial goals working")


class TestVendorsEndpoints:
    """Vendors endpoint tests (routes/vendors.py)"""
    
    @pytest.fixture(autouse=True)
    def setup(self, auth_token):
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_known_vendors(self):
        """GET /api/known-vendors - known vendors list"""
        response = requests.get(
            f"{BASE_URL}/api/known-vendors",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Known vendors working - {len(data)} vendors")


class TestCashflowEndpoints:
    """Cashflow endpoint tests (routes/cashflow.py)"""
    
    @pytest.fixture(autouse=True)
    def setup(self, auth_token):
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_scheduled_payments(self):
        """GET /api/scheduled-payments - scheduled payments"""
        response = requests.get(
            f"{BASE_URL}/api/scheduled-payments",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Scheduled payments working - {len(data)} payments")
    
    def test_expected_income(self):
        """GET /api/expected-income - expected income"""
        response = requests.get(
            f"{BASE_URL}/api/expected-income",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total_pending" in data
        print(f"✓ Expected income working - {data['count']} items")
    
    def test_accounts_receivable(self):
        """GET /api/accounts-receivable - accounts receivable"""
        response = requests.get(
            f"{BASE_URL}/api/accounts-receivable",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total_pending" in data
        print(f"✓ Accounts receivable working - {data['count']} items")
    
    def test_travel_goals(self):
        """GET /api/travel-goals - travel goals"""
        response = requests.get(
            f"{BASE_URL}/api/travel-goals",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "goals" in data
        print(f"✓ Travel goals working - {data['count']} goals")
    
    def test_travel_fund(self):
        """GET /api/travel-fund - travel fund"""
        response = requests.get(
            f"{BASE_URL}/api/travel-fund",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "year" in data
        assert "annual_budget" in data
        assert "total_saved" in data
        print(f"✓ Travel fund working - budget: ${data['annual_budget']:,.2f}")
    
    def test_cashflow_projection(self):
        """GET /api/cashflow/projection - cashflow projection"""
        response = requests.get(
            f"{BASE_URL}/api/cashflow/projection",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "projection" in data
        assert "status" in data
        print(f"✓ Cashflow projection working - status: {data['status']}")
    
    def test_reminders(self):
        """GET /api/reminders - reminders"""
        response = requests.get(
            f"{BASE_URL}/api/reminders",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Reminders working - {len(data)} reminders")


class TestReconciliationEndpoints:
    """Reconciliation endpoint tests (routes/reconciliation.py)"""
    
    @pytest.fixture(autouse=True)
    def setup(self, auth_token):
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_reconciliation_history(self):
        """GET /api/reconciliation/history - reconciliation history"""
        response = requests.get(
            f"{BASE_URL}/api/reconciliation/history",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "statements" in data
        print(f"✓ Reconciliation history working - {len(data['statements'])} statements")
    
    def test_bulk_approve_empty(self):
        """PUT /api/reconciliation/bulk-approve - should fail with empty array"""
        response = requests.put(
            f"{BASE_URL}/api/reconciliation/bulk-approve",
            headers=self.headers,
            json={"transaction_ids": []}
        )
        assert response.status_code == 400
        print("✓ Bulk approve correctly rejects empty array")
    
    def test_bulk_approve_invalid_ids(self):
        """PUT /api/reconciliation/bulk-approve - should handle invalid IDs gracefully"""
        response = requests.put(
            f"{BASE_URL}/api/reconciliation/bulk-approve",
            headers=self.headers,
            json={"transaction_ids": ["invalid-id-1", "invalid-id-2"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert "approved" in data
        assert "failed" in data
        assert data["approved"] == 0
        assert data["failed"] == 2
        print("✓ Bulk approve handles invalid IDs correctly")


class TestGmailEndpoints:
    """Gmail endpoint tests (routes/gmail.py)"""
    
    @pytest.fixture(autouse=True)
    def setup(self, auth_token):
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_gmail_status(self):
        """GET /api/gmail/status - gmail status"""
        response = requests.get(
            f"{BASE_URL}/api/gmail/status",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        # Gmail is not connected in test environment
        print(f"✓ Gmail status working - connected: {data['connected']}")
    
    def test_gmail_documents(self):
        """GET /api/gmail/documents - gmail documents"""
        response = requests.get(
            f"{BASE_URL}/api/gmail/documents",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "documents" in data
        print(f"✓ Gmail documents working - {len(data['documents'])} documents")


class TestChatEndpoints:
    """Chat endpoint tests (routes/chat.py)"""
    
    @pytest.fixture(autouse=True)
    def setup(self, auth_token):
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_chat_history(self):
        """GET /api/chat/history - chat history"""
        response = requests.get(
            f"{BASE_URL}/api/chat/history",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "history" in data
        assert "count" in data
        print(f"✓ Chat history working - {data['count']} messages")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
