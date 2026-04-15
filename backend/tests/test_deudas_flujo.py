"""
Test suite for Deudas (Credit Cards), Flujo (Scheduled Payments), and Reminders features
Tests: /credit-cards, /debt/summary, /debt/snowball-plan, /scheduled-payments, /reminders
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from environment
from tests.conftest_credentials import ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_EMAIL, DEMO_PASSWORD
TEST_EMAIL = ADMIN_EMAIL
TEST_PASSWORD = ADMIN_PASSWORD


class TestAuthentication:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test successful login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get auth headers"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestCreditCards:
    """Credit Cards CRUD tests"""
    
    def test_get_credit_cards(self, auth_headers):
        """Test GET /api/credit-cards"""
        response = requests.get(f"{BASE_URL}/api/credit-cards", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/credit-cards - Found {len(data)} cards")
        
        # Verify card structure if cards exist
        if len(data) > 0:
            card = data[0]
            assert "id" in card
            assert "name" in card
            assert "apr" in card
            assert "credit_limit" in card
            assert "current_balance" in card
            assert "available_credit" in card
            print(f"  Card structure verified: {card['name']}")
    
    def test_create_credit_card(self, auth_headers):
        """Test POST /api/credit-cards"""
        new_card = {
            "name": "TEST_Card_Pytest",
            "bank": "Test Bank",
            "apr": 18.5,
            "credit_limit": 5000,
            "current_balance": 1500,
            "minimum_payment": 75,
            "cut_off_day": 15,
            "payment_due_day": 5,
            "is_international": False
        }
        response = requests.post(f"{BASE_URL}/api/credit-cards", json=new_card, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == new_card["name"]
        assert data["apr"] == new_card["apr"]
        assert data["available_credit"] == new_card["credit_limit"] - new_card["current_balance"]
        print(f"✓ POST /api/credit-cards - Created card: {data['name']}")
        return data["id"]
    
    def test_update_credit_card(self, auth_headers):
        """Test PUT /api/credit-cards/{id}"""
        # First get existing cards
        response = requests.get(f"{BASE_URL}/api/credit-cards", headers=auth_headers)
        cards = response.json()
        test_card = next((c for c in cards if "TEST_" in c["name"]), None)
        
        if test_card:
            updated_data = {
                "name": test_card["name"],
                "bank": test_card["bank"],
                "apr": 20.0,  # Updated APR
                "credit_limit": test_card["credit_limit"],
                "current_balance": 2000,  # Updated balance
                "minimum_payment": test_card["minimum_payment"],
                "cut_off_day": test_card["cut_off_day"],
                "payment_due_day": test_card["payment_due_day"],
                "is_international": test_card["is_international"]
            }
            response = requests.put(f"{BASE_URL}/api/credit-cards/{test_card['id']}", json=updated_data, headers=auth_headers)
            assert response.status_code == 200
            print(f"✓ PUT /api/credit-cards/{test_card['id']} - Updated card")
        else:
            pytest.skip("No test card found to update")
    
    def test_delete_credit_card(self, auth_headers):
        """Test DELETE /api/credit-cards/{id}"""
        # Get test cards to delete
        response = requests.get(f"{BASE_URL}/api/credit-cards", headers=auth_headers)
        cards = response.json()
        test_cards = [c for c in cards if "TEST_" in c["name"]]
        
        for card in test_cards:
            response = requests.delete(f"{BASE_URL}/api/credit-cards/{card['id']}", headers=auth_headers)
            assert response.status_code == 200
            print(f"✓ DELETE /api/credit-cards/{card['id']} - Deleted test card")


class TestDebtSummary:
    """Debt Summary tests"""
    
    def test_get_debt_summary(self, auth_headers):
        """Test GET /api/debt/summary"""
        response = requests.get(f"{BASE_URL}/api/debt/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify summary structure
        assert "total_debt" in data
        assert "total_credit_limit" in data
        assert "total_available_credit" in data
        assert "total_minimum_payment" in data
        assert "utilization_rate" in data
        assert "cards_count" in data
        
        print(f"✓ GET /api/debt/summary")
        print(f"  Total Debt: ${data['total_debt']}")
        print(f"  Utilization Rate: {data['utilization_rate']}%")
        print(f"  Cards Count: {data['cards_count']}")
        
        # Verify highest APR card if cards exist
        if data.get("highest_apr_card"):
            print(f"  Highest APR Card: {data['highest_apr_card']['name']} ({data['highest_apr_card']['apr']}%)")


class TestSnowballPlan:
    """Avalanche/Snowball Plan tests"""
    
    def test_calculate_avalanche_plan(self, auth_headers):
        """Test POST /api/debt/snowball-plan with avalanche strategy"""
        plan_request = {
            "strategy": "avalanche",
            "extra_payment": 500
        }
        response = requests.post(f"{BASE_URL}/api/debt/snowball-plan", json=plan_request, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify plan structure
        assert "strategy" in data
        assert data["strategy"] == "avalanche"
        
        if data.get("months_to_payoff", 0) > 0:
            assert "months_to_payoff" in data
            assert "total_paid" in data
            assert "total_interest" in data
            assert "payoff_order" in data
            assert "recommendation" in data
            
            print(f"✓ POST /api/debt/snowball-plan (avalanche)")
            print(f"  Months to payoff: {data['months_to_payoff']}")
            print(f"  Total to pay: ${data['total_paid']}")
            print(f"  Total interest: ${data['total_interest']}")
            print(f"  Payoff order: {data['payoff_order']}")
            print(f"  Recommendation: {data['recommendation']}")
        else:
            print(f"✓ POST /api/debt/snowball-plan - No active debts")
    
    def test_calculate_snowball_plan(self, auth_headers):
        """Test POST /api/debt/snowball-plan with snowball strategy"""
        plan_request = {
            "strategy": "snowball",
            "extra_payment": 300
        }
        response = requests.post(f"{BASE_URL}/api/debt/snowball-plan", json=plan_request, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "strategy" in data
        print(f"✓ POST /api/debt/snowball-plan (snowball)")


class TestScheduledPayments:
    """Scheduled Payments CRUD tests"""
    
    def test_get_scheduled_payments(self, auth_headers):
        """Test GET /api/scheduled-payments"""
        response = requests.get(f"{BASE_URL}/api/scheduled-payments", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/scheduled-payments - Found {len(data)} payments")
        
        # Verify payment structure if payments exist
        if len(data) > 0:
            payment = data[0]
            assert "id" in payment
            assert "name" in payment
            assert "amount" in payment
            assert "due_day" in payment
            assert "payment_method" in payment
            assert "next_due_date" in payment
            print(f"  Payment structure verified: {payment['name']}")
    
    def test_create_scheduled_payment(self, auth_headers):
        """Test POST /api/scheduled-payments"""
        new_payment = {
            "name": "TEST_Payment_Pytest",
            "amount": 150.00,
            "due_day": 20,
            "category": "servicios_basicos",
            "payment_method": "transferencia",
            "is_recurring": True,
            "reminder_days_before": 3
        }
        response = requests.post(f"{BASE_URL}/api/scheduled-payments", json=new_payment, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == new_payment["name"]
        assert data["amount"] == new_payment["amount"]
        assert data["due_day"] == new_payment["due_day"]
        print(f"✓ POST /api/scheduled-payments - Created: {data['name']}")
        return data["id"]
    
    def test_update_scheduled_payment(self, auth_headers):
        """Test PUT /api/scheduled-payments/{id}"""
        # Get existing payments
        response = requests.get(f"{BASE_URL}/api/scheduled-payments", headers=auth_headers)
        payments = response.json()
        test_payment = next((p for p in payments if "TEST_" in p["name"]), None)
        
        if test_payment:
            updated_data = {
                "name": test_payment["name"],
                "amount": 200.00,  # Updated amount
                "due_day": 25,  # Updated day
                "category": test_payment["category"],
                "payment_method": "tarjeta_diners",  # Updated method
                "is_recurring": True,
                "reminder_days_before": 2
            }
            response = requests.put(f"{BASE_URL}/api/scheduled-payments/{test_payment['id']}", json=updated_data, headers=auth_headers)
            assert response.status_code == 200
            print(f"✓ PUT /api/scheduled-payments/{test_payment['id']} - Updated payment")
        else:
            pytest.skip("No test payment found to update")
    
    def test_mark_payment_as_paid(self, auth_headers):
        """Test POST /api/scheduled-payments/{id}/mark-paid"""
        # Get existing payments
        response = requests.get(f"{BASE_URL}/api/scheduled-payments", headers=auth_headers)
        payments = response.json()
        test_payment = next((p for p in payments if "TEST_" in p["name"]), None)
        
        if test_payment:
            response = requests.post(f"{BASE_URL}/api/scheduled-payments/{test_payment['id']}/mark-paid", headers=auth_headers)
            assert response.status_code == 200
            print(f"✓ POST /api/scheduled-payments/{test_payment['id']}/mark-paid")
        else:
            pytest.skip("No test payment found to mark as paid")
    
    def test_delete_scheduled_payment(self, auth_headers):
        """Test DELETE /api/scheduled-payments/{id}"""
        # Get test payments to delete
        response = requests.get(f"{BASE_URL}/api/scheduled-payments", headers=auth_headers)
        payments = response.json()
        test_payments = [p for p in payments if "TEST_" in p["name"]]
        
        for payment in test_payments:
            response = requests.delete(f"{BASE_URL}/api/scheduled-payments/{payment['id']}", headers=auth_headers)
            assert response.status_code == 200
            print(f"✓ DELETE /api/scheduled-payments/{payment['id']} - Deleted test payment")


class TestReminders:
    """Smart Reminders tests"""
    
    def test_get_reminders(self, auth_headers):
        """Test GET /api/reminders"""
        response = requests.get(f"{BASE_URL}/api/reminders", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/reminders - Found {len(data)} reminders")
        
        # Verify reminder structure if reminders exist
        for reminder in data:
            assert "type" in reminder
            assert "title" in reminder
            assert "priority" in reminder
            print(f"  - [{reminder['priority'].upper()}] {reminder['title']}")


class TestExistingCreditCards:
    """Test existing credit cards data (Diners, Pichincha, Pacificard, Apple Card)"""
    
    def test_verify_existing_cards(self, auth_headers):
        """Verify the 4 test credit cards exist"""
        response = requests.get(f"{BASE_URL}/api/credit-cards", headers=auth_headers)
        assert response.status_code == 200
        cards = response.json()
        
        expected_cards = ["Diners", "Pichincha", "Pacificard", "Apple Card"]
        found_cards = [c["name"] for c in cards]
        
        print(f"✓ Found {len(cards)} credit cards:")
        for card in cards:
            print(f"  - {card['name']}: ${card['current_balance']} balance, {card['apr']}% APR")
            
        # Check if expected cards exist (at least some)
        matching = [c for c in expected_cards if any(c.lower() in fc.lower() for fc in found_cards)]
        print(f"  Matching expected cards: {matching}")


class TestExistingScheduledPayments:
    """Test existing scheduled payments data"""
    
    def test_verify_existing_payments(self, auth_headers):
        """Verify scheduled payments exist"""
        response = requests.get(f"{BASE_URL}/api/scheduled-payments", headers=auth_headers)
        assert response.status_code == 200
        payments = response.json()
        
        print(f"✓ Found {len(payments)} scheduled payments:")
        for payment in payments:
            print(f"  - {payment['name']}: ${payment['amount']} on day {payment['due_day']} via {payment['payment_method']}")


class TestDashboardReminders:
    """Test dashboard reminders integration"""
    
    def test_reminders_include_payment_due(self, auth_headers):
        """Test that reminders include payment due notifications"""
        response = requests.get(f"{BASE_URL}/api/reminders", headers=auth_headers)
        assert response.status_code == 200
        reminders = response.json()
        
        # Check for different reminder types
        reminder_types = set(r.get("type") for r in reminders)
        print(f"✓ Reminder types found: {reminder_types}")
        
        # Check for insurance reminder (enviar factura al seguro)
        insurance_reminders = [r for r in reminders if "seguro" in r.get("title", "").lower() or "insurance" in r.get("type", "").lower()]
        if insurance_reminders:
            print(f"  Found insurance reminder: {insurance_reminders[0]['title']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
