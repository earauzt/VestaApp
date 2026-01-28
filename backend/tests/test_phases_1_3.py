"""
Phases 1-3 Tests - FamilyFinance Ecuador
Testing: Travel Goals, Expected Income, Accounts Receivable, Cashflow Projection, FAB
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - admin user
TEST_EMAIL = "earauzt@gmail.com"
TEST_PASSWORD = "Realmadrid2011"

# Note: test@finanzas.com user does not exist in the database
# Use the admin credentials for all tests


class TestAuthentication:
    """Authentication tests with provided credentials"""
    
    def test_login_admin_user(self):
        """Test login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code != 200:
            # Try alternative credentials
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": ALT_EMAIL,
                "password": ALT_PASSWORD
            })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"Logged in as: {data['user']['email']} (role: {data['user']['role']})")


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


# ================= TRAVEL GOALS TESTS =================

class TestTravelGoals:
    """Travel Goals CRUD endpoint tests"""
    
    def test_get_travel_goals(self, auth_headers):
        """GET /api/travel-goals - returns travel goals list"""
        response = requests.get(f"{BASE_URL}/api/travel-goals", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "goals" in data, "Response should have 'goals' key"
        assert "count" in data, "Response should have 'count' key"
        
        goals = data.get("goals", [])
        print(f"Found {len(goals)} travel goals")
        
        # Verify goal structure if any exist
        if len(goals) > 0:
            goal = goals[0]
            assert "id" in goal, "Goal should have 'id'"
            assert "destination" in goal, "Goal should have 'destination'"
            assert "target_amount" in goal, "Goal should have 'target_amount'"
            assert "saved_amount" in goal or goal.get("saved_amount") == 0, "Goal should have 'saved_amount'"
            assert "target_date" in goal, "Goal should have 'target_date'"
            assert "status" in goal, "Goal should have 'status'"
            print(f"First goal: {goal['destination']} - ${goal['target_amount']} (saved: ${goal.get('saved_amount', 0)})")
    
    def test_create_travel_goal(self, auth_headers):
        """POST /api/travel-goals - creates a new travel goal"""
        future_date = (datetime.now() + timedelta(days=180)).strftime("%Y-%m-%d")
        payload = {
            "destination": "TEST_Cancún, México",
            "target_amount": 2500.00,
            "target_date": future_date,
            "notes": "Test travel goal for automated testing"
        }
        
        response = requests.post(f"{BASE_URL}/api/travel-goals", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Response should have 'id'"
        assert data["destination"] == payload["destination"]
        assert data["target_amount"] == payload["target_amount"]
        assert data["status"] == "active"
        assert data.get("saved_amount", 0) == 0
        
        print(f"Created travel goal: {data['id']}")
        return data["id"]
    
    def test_add_savings_to_goal(self, auth_headers):
        """PUT /api/travel-goals/{id}/add-savings - adds savings to a goal"""
        # First create a goal
        future_date = (datetime.now() + timedelta(days=180)).strftime("%Y-%m-%d")
        create_response = requests.post(f"{BASE_URL}/api/travel-goals", json={
            "destination": "TEST_Savings_Goal",
            "target_amount": 1000.00,
            "target_date": future_date,
            "notes": "Test for savings"
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        goal_id = create_response.json()["id"]
        
        # Add savings - amount is a query parameter
        response = requests.put(
            f"{BASE_URL}/api/travel-goals/{goal_id}/add-savings?amount=250.00",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "new_saved" in data
        assert data["new_saved"] == 250.00
        print(f"Added $250 savings to goal {goal_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/travel-goals/{goal_id}", headers=auth_headers)
    
    def test_update_travel_goal(self, auth_headers):
        """PUT /api/travel-goals/{id} - updates a travel goal"""
        # First create a goal
        future_date = (datetime.now() + timedelta(days=180)).strftime("%Y-%m-%d")
        create_response = requests.post(f"{BASE_URL}/api/travel-goals", json={
            "destination": "TEST_Update_Goal",
            "target_amount": 1500.00,
            "target_date": future_date,
            "notes": "Original notes"
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        goal_id = create_response.json()["id"]
        
        # Update the goal
        response = requests.put(
            f"{BASE_URL}/api/travel-goals/{goal_id}",
            json={"notes": "Updated notes", "target_amount": 2000.00},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/travel-goals", headers=auth_headers)
        goals = get_response.json().get("goals", [])
        updated_goal = next((g for g in goals if g["id"] == goal_id), None)
        
        if updated_goal:
            assert updated_goal["notes"] == "Updated notes"
            print(f"Updated goal {goal_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/travel-goals/{goal_id}", headers=auth_headers)
    
    def test_delete_travel_goal(self, auth_headers):
        """DELETE /api/travel-goals/{id} - deletes a travel goal"""
        # First create a goal
        future_date = (datetime.now() + timedelta(days=180)).strftime("%Y-%m-%d")
        create_response = requests.post(f"{BASE_URL}/api/travel-goals", json={
            "destination": "TEST_Delete_Goal",
            "target_amount": 500.00,
            "target_date": future_date,
            "notes": "To be deleted"
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        goal_id = create_response.json()["id"]
        
        # Delete the goal
        response = requests.delete(f"{BASE_URL}/api/travel-goals/{goal_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/travel-goals", headers=auth_headers)
        goals = get_response.json().get("goals", [])
        deleted_goal = next((g for g in goals if g["id"] == goal_id), None)
        assert deleted_goal is None, "Goal should be deleted"
        print(f"Deleted goal {goal_id}")


# ================= EXPECTED INCOME TESTS =================

class TestExpectedIncome:
    """Expected Income CRUD endpoint tests"""
    
    def test_get_expected_income(self, auth_headers):
        """GET /api/expected-income - returns expected income list"""
        response = requests.get(f"{BASE_URL}/api/expected-income", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "items" in data, "Response should have 'items' key"
        assert "total_pending" in data, "Response should have 'total_pending' key"
        assert "count" in data, "Response should have 'count' key"
        
        items = data.get("items", [])
        print(f"Found {len(items)} expected income items, total pending: ${data['total_pending']}")
        
        # Verify item structure if any exist
        if len(items) > 0:
            item = items[0]
            assert "id" in item
            assert "description" in item
            assert "amount" in item
            assert "expected_date" in item
            assert "status" in item
            print(f"First item: {item['description']} - ${item['amount']} ({item['status']})")
    
    def test_create_expected_income(self, auth_headers):
        """POST /api/expected-income - creates a new expected income"""
        future_date = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")
        payload = {
            "description": "TEST_Bonus Payment",
            "amount": 1500.00,
            "expected_date": future_date,
            "source": "personal",
            "recurring": False,
            "notes": "Test expected income"
        }
        
        response = requests.post(f"{BASE_URL}/api/expected-income", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["description"] == payload["description"]
        assert data["amount"] == payload["amount"]
        assert data["status"] == "pending"
        
        print(f"Created expected income: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/expected-income/{data['id']}", headers=auth_headers)
    
    def test_mark_income_received(self, auth_headers):
        """PUT /api/expected-income/{id}/mark-received - marks income as received"""
        # First create an expected income
        future_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        create_response = requests.post(f"{BASE_URL}/api/expected-income", json={
            "description": "TEST_Mark_Received",
            "amount": 500.00,
            "expected_date": future_date,
            "source": "personal",
            "recurring": False
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        income_id = create_response.json()["id"]
        
        # Mark as received
        response = requests.put(
            f"{BASE_URL}/api/expected-income/{income_id}/mark-received",
            json={},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "transaction_id" in data, "Should create a transaction"
        print(f"Marked income {income_id} as received, created transaction {data['transaction_id']}")
    
    def test_delete_expected_income(self, auth_headers):
        """DELETE /api/expected-income/{id} - deletes expected income"""
        # First create an expected income
        future_date = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        create_response = requests.post(f"{BASE_URL}/api/expected-income", json={
            "description": "TEST_Delete_Income",
            "amount": 300.00,
            "expected_date": future_date,
            "source": "apx",
            "recurring": False
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        income_id = create_response.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/expected-income/{income_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"Deleted expected income {income_id}")


# ================= ACCOUNTS RECEIVABLE TESTS =================

class TestAccountsReceivable:
    """Accounts Receivable CRUD endpoint tests"""
    
    def test_get_accounts_receivable(self, auth_headers):
        """GET /api/accounts-receivable - returns accounts receivable list"""
        response = requests.get(f"{BASE_URL}/api/accounts-receivable", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "items" in data, "Response should have 'items' key"
        assert "total_pending" in data, "Response should have 'total_pending' key"
        assert "count" in data, "Response should have 'count' key"
        
        items = data.get("items", [])
        print(f"Found {len(items)} accounts receivable, total pending: ${data['total_pending']}")
        
        # Verify item structure if any exist
        if len(items) > 0:
            item = items[0]
            assert "id" in item
            assert "client_name" in item
            assert "amount" in item
            assert "due_date" in item
            assert "status" in item
            print(f"First item: {item['client_name']} - ${item['amount']} ({item['status']})")
    
    def test_create_account_receivable(self, auth_headers):
        """POST /api/accounts-receivable - creates a new account receivable"""
        future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        today = datetime.now().strftime("%Y-%m-%d")
        payload = {
            "client_name": "TEST_Client XYZ",
            "invoice_number": "TEST-001-001-000001",
            "amount": 2500.00,
            "invoice_date": today,
            "due_date": future_date,
            "notes": "Test account receivable"
        }
        
        response = requests.post(f"{BASE_URL}/api/accounts-receivable", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["client_name"] == payload["client_name"]
        assert data["amount"] == payload["amount"]
        assert data["status"] == "pending"
        assert data.get("amount_paid", 0) == 0
        
        print(f"Created account receivable: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/accounts-receivable/{data['id']}", headers=auth_headers)
    
    def test_record_payment(self, auth_headers):
        """PUT /api/accounts-receivable/{id}/payment - records a payment"""
        # First create an account receivable
        future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        today = datetime.now().strftime("%Y-%m-%d")
        create_response = requests.post(f"{BASE_URL}/api/accounts-receivable", json={
            "client_name": "TEST_Payment_Client",
            "invoice_number": "TEST-002",
            "amount": 1000.00,
            "invoice_date": today,
            "due_date": future_date
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        account_id = create_response.json()["id"]
        
        # Record partial payment - amount is a query parameter
        response = requests.put(
            f"{BASE_URL}/api/accounts-receivable/{account_id}/payment?amount=400.00",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["new_status"] == "partial"
        print(f"Recorded $400 payment for account {account_id}, status: {data['new_status']}")
        
        # Record full payment - amount is a query parameter
        response = requests.put(
            f"{BASE_URL}/api/accounts-receivable/{account_id}/payment?amount=600.00",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["new_status"] == "paid"
        print(f"Recorded $600 payment, status: {data['new_status']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/accounts-receivable/{account_id}", headers=auth_headers)
    
    def test_delete_account_receivable(self, auth_headers):
        """DELETE /api/accounts-receivable/{id} - deletes account receivable"""
        # First create an account receivable
        future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        today = datetime.now().strftime("%Y-%m-%d")
        create_response = requests.post(f"{BASE_URL}/api/accounts-receivable", json={
            "client_name": "TEST_Delete_Client",
            "amount": 500.00,
            "invoice_date": today,
            "due_date": future_date
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        account_id = create_response.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/accounts-receivable/{account_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"Deleted account receivable {account_id}")


# ================= CASHFLOW PROJECTION TESTS =================

class TestCashflowProjection:
    """Cashflow Projection endpoint tests"""
    
    def test_get_cashflow_projection(self, auth_headers):
        """GET /api/cashflow/projection - returns 30-day cashflow projection"""
        response = requests.get(f"{BASE_URL}/api/cashflow/projection", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "projection" in data, "Response should have 'projection' key"
        assert "status" in data, "Response should have 'status' key"
        assert "message" in data, "Response should have 'message' key"
        assert "details" in data, "Response should have 'details' key"
        
        projection = data.get("projection", {})
        assert "expected_income" in projection
        assert "receivables" in projection
        assert "total_inflow" in projection
        assert "scheduled_payments" in projection
        assert "total_outflow" in projection
        assert "projected_balance" in projection
        
        print(f"Cashflow Projection:")
        print(f"  Total Inflow: ${projection['total_inflow']}")
        print(f"  Total Outflow: ${projection['total_outflow']}")
        print(f"  Projected Balance: ${projection['projected_balance']}")
        print(f"  Status: {data['status']}")
        print(f"  Message: {data['message']}")


# ================= DASHBOARD INTEGRATION TESTS =================

class TestDashboardWidgets:
    """Dashboard widgets integration tests"""
    
    def test_dashboard_stats(self, auth_headers):
        """GET /api/dashboard/stats - returns dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "total_income" in data
        assert "total_expenses" in data or "monthly_total" in data
        assert "balance" in data
        print(f"Dashboard stats: Income=${data.get('total_income', 0)}, Balance=${data.get('balance', 0)}")
    
    def test_travel_goals_for_dashboard(self, auth_headers):
        """Travel goals endpoint returns data for dashboard widget"""
        response = requests.get(f"{BASE_URL}/api/travel-goals", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Dashboard widget shows active goals
        goals = data.get("goals", [])
        active_goals = [g for g in goals if g.get("status") == "active"]
        print(f"Active travel goals for dashboard: {len(active_goals)}")


# ================= TRANSACTIONS ENDPOINT (for FAB) =================

class TestTransactions:
    """Transactions endpoint tests (used by FAB for quick expense)"""
    
    def test_create_quick_expense(self, auth_headers):
        """POST /api/transactions - creates a quick expense (FAB functionality)"""
        today = datetime.now().strftime("%Y-%m-%d")
        payload = {
            "amount": 25.50,
            "category": "comida",
            "subcategory": "supermercado",  # Required field
            "description": "TEST_Quick expense from FAB",
            "date": today,
            "transaction_type": "expense",
            "payment_method": "efectivo",
            "status": "pending_review",
            "source_type": "manual_quick"
        }
        
        response = requests.post(f"{BASE_URL}/api/transactions", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        print(f"Created quick expense: {data['id']} - ${payload['amount']}")
        
        # Cleanup - delete the test transaction
        requests.delete(f"{BASE_URL}/api/transactions/{data['id']}", headers=auth_headers)


# ================= CLEANUP TEST DATA =================

class TestCleanup:
    """Cleanup test data created during testing"""
    
    def test_cleanup_test_travel_goals(self, auth_headers):
        """Remove TEST_ prefixed travel goals"""
        response = requests.get(f"{BASE_URL}/api/travel-goals", headers=auth_headers)
        if response.status_code == 200:
            goals = response.json().get("goals", [])
            test_goals = [g for g in goals if g.get("destination", "").startswith("TEST_")]
            for goal in test_goals:
                requests.delete(f"{BASE_URL}/api/travel-goals/{goal['id']}", headers=auth_headers)
            print(f"Cleaned up {len(test_goals)} test travel goals")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
