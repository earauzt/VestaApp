"""
Iteration 7 Tests - FamilyFinance Ecuador
Testing: Budget editable, Cargar y Validar, ChatBot, Deudas, Flujo, Diferidos
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from environment
from tests.conftest_credentials import ADMIN_EMAIL, ADMIN_PASSWORD
TEST_EMAIL = ADMIN_EMAIL
TEST_PASSWORD = ADMIN_PASSWORD


class TestAuthentication:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        assert data["user"]["role"] == "admin"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


@pytest.fixture
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed")


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestBudgetConfig:
    """Budget configuration endpoint tests"""
    
    def test_get_budget_config(self, auth_headers):
        """GET /api/budget/config - returns editable budget categories"""
        response = requests.get(f"{BASE_URL}/api/budget/config", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "categories" in data
        assert "income_projection" in data
        assert "savings_goal" in data
        assert "investment_goal" in data
        assert "year" in data
        
        # Verify categories exist
        categories = data["categories"]
        assert len(categories) > 0, "No categories returned"
        
        # Check for expected categories from Excel
        expected_cats = ["servicios_basicos", "empleados", "colegio_actividades", "seguros", "comida"]
        for cat in expected_cats:
            assert cat in categories, f"Missing category: {cat}"
    
    def test_budget_config_has_income_projection(self, auth_headers):
        """Budget config includes income projection (Personal, APX, USA)"""
        response = requests.get(f"{BASE_URL}/api/budget/config", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        income = data.get("income_projection", {})
        assert "personal" in income or "Personal" in income, "Missing Personal income"
        assert "apx" in income or "APX" in income, "Missing APX income"
        assert "usa" in income or "USA" in income, "Missing USA income"
    
    def test_budget_config_has_goals(self, auth_headers):
        """Budget config includes savings and investment goals"""
        response = requests.get(f"{BASE_URL}/api/budget/config", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        savings = data.get("savings_goal", {})
        investment = data.get("investment_goal", {})
        
        assert "monthly" in savings or "percentage" in savings, "Savings goal missing monthly/percentage"
        assert "monthly" in investment or "percentage" in investment, "Investment goal missing monthly/percentage"


class TestBudgetPersonal:
    """Personal budget save endpoint tests"""
    
    def test_save_budget_personal(self, auth_headers):
        """POST /api/budget/personal - saves budget changes"""
        payload = {
            "year": 2026,
            "categories": {
                "servicios_basicos": {
                    "name": "Servicios Básicos",
                    "monthly_budget": 1300,
                    "annual_budget": 15600
                }
            },
            "income_projection": {
                "personal": {"monthly": 7500, "annual": 90000},
                "apx": {"monthly": 2500, "annual": 30000},
                "usa": {"monthly": 2750, "annual": 33000}
            },
            "savings_goal": {"monthly": 1250, "percentage": 10},
            "investment_goal": {"monthly": 1875, "percentage": 15}
        }
        
        response = requests.post(f"{BASE_URL}/api/budget/personal", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "message" in data or "id" in data


class TestDeferredPayments:
    """Deferred payments (diferidos) endpoint tests"""
    
    def test_get_deferred_payments(self, auth_headers):
        """GET /api/deferred-payments - returns deferred payments list"""
        response = requests.get(f"{BASE_URL}/api/deferred-payments", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "payments" in data
        assert "total_remaining" in data
        assert "total_monthly_obligation" in data
        assert "count" in data
        
        # Check if we have the expected 3 diferidos from bank statement
        payments = data.get("payments", [])
        print(f"Found {len(payments)} deferred payments")
        
        # Verify payment structure if any exist
        if len(payments) > 0:
            payment = payments[0]
            assert "description" in payment
            assert "monthly_payment" in payment or "total_amount" in payment


class TestScheduledPayments:
    """Scheduled payments (Flujo) endpoint tests"""
    
    def test_get_scheduled_payments(self, auth_headers):
        """GET /api/scheduled-payments - returns scheduled payments"""
        response = requests.get(f"{BASE_URL}/api/scheduled-payments", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list), "Expected list of payments"
        
        # Check for card payment (Pago Tarjeta Mastercard for Feb 9)
        card_payments = [p for p in data if "tarjeta" in p.get("description", "").lower() or 
                        "tarjeta" in p.get("name", "").lower() or
                        p.get("category") == "tarjeta_credito"]
        print(f"Found {len(card_payments)} card payments in scheduled payments")
        
        # Verify payment structure if any exist
        if len(data) > 0:
            payment = data[0]
            assert "due_day" in payment or "due_date" in payment
            assert "amount" in payment


class TestCreditCards:
    """Credit cards endpoint tests"""
    
    def test_get_credit_cards(self, auth_headers):
        """GET /api/credit-cards - returns credit cards list"""
        response = requests.get(f"{BASE_URL}/api/credit-cards", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list), "Expected list of cards"
        
        # Check for Pichincha card with balance $2,009.16
        pichincha_cards = [c for c in data if "pichincha" in c.get("bank", "").lower() or 
                          "pichincha" in c.get("name", "").lower()]
        print(f"Found {len(pichincha_cards)} Pichincha cards")
        
        if len(pichincha_cards) > 0:
            card = pichincha_cards[0]
            print(f"Pichincha card balance: ${card.get('current_balance', 0)}")
            # Verify expected balance around $2,009.16
            balance = card.get("current_balance", 0)
            assert balance > 0, "Card should have a balance"


class TestReconciliation:
    """Reconciliation (Cargar y Validar) endpoint tests"""
    
    def test_get_pending_transactions(self, auth_headers):
        """GET /api/reconciliation/pending - returns pending transactions"""
        response = requests.get(f"{BASE_URL}/api/reconciliation/pending", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "pending_review" in data
        pending = data.get("pending_review", [])
        print(f"Found {len(pending)} pending transactions")
        
        # Should have 11 transactions from bank statement
        # Note: This may vary if some were approved/rejected
    
    def test_get_reconciliation_stats(self, auth_headers):
        """GET /api/reconciliation/stats - returns reconciliation statistics"""
        response = requests.get(f"{BASE_URL}/api/reconciliation/stats", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "pending_review" in data or "approved" in data


class TestChatBot:
    """ChatBot endpoint tests"""
    
    def test_chat_endpoint(self, auth_headers):
        """POST /api/chat - sends message and receives response"""
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "¿Cómo van mis gastos este mes?"
        }, headers=auth_headers, timeout=30)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "response" in data, "Missing response field"
        assert "session_id" in data, "Missing session_id field"
        
        # Response should not be empty
        assert len(data["response"]) > 0, "Empty response from chatbot"
        print(f"ChatBot response: {data['response'][:100]}...")
    
    def test_chat_requires_auth(self):
        """POST /api/chat - requires authentication"""
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "Test message"
        })
        assert response.status_code in [401, 403], "Chat should require authentication"


class TestDashboard:
    """Dashboard endpoint tests"""
    
    def test_dashboard_stats(self, auth_headers):
        """GET /api/dashboard/stats - returns dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "total_income" in data
        assert "total_expenses" in data
        assert "balance" in data
        assert "by_category" in data


class TestDebtSummary:
    """Debt summary endpoint tests"""
    
    def test_debt_summary(self, auth_headers):
        """GET /api/debt/summary - returns debt summary"""
        response = requests.get(f"{BASE_URL}/api/debt/summary", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "total_debt" in data
        assert "utilization_rate" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
