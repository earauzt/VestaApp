"""
Test Travel Fund (Fondo de Viajes) endpoints
- GET /api/travel-fund - Get fund status
- POST /api/travel-fund/deposit - Add money to fund
- PUT /api/travel-fund/settings - Update annual budget
- Also tests 401 response for invalid JWT tokens
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from environment
from tests.conftest_credentials import ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_EMAIL, DEMO_PASSWORD


class TestAuthentication:
    """Test authentication and 401 responses"""
    
    def test_login_admin_success(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login successful: {data['user']['name']}")
    
    @pytest.mark.skip(reason="Demo user may not exist in database")
    def test_login_demo_success(self):
        """Test demo user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == DEMO_EMAIL
        print(f"✓ Demo login successful: {data['user']['name']}")
    
    def test_invalid_token_returns_401(self):
        """Test that invalid JWT token returns 401 (not 403)"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        # Should return 401 Unauthorized, not 403 Forbidden
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        # Check WWW-Authenticate header is present
        assert "WWW-Authenticate" in response.headers, "Missing WWW-Authenticate header"
        print(f"✓ Invalid token returns 401 with WWW-Authenticate header")
    
    def test_expired_token_returns_401(self):
        """Test that expired/malformed JWT returns 401"""
        # Malformed JWT
        headers = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxfQ.invalid"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Malformed token returns 401")


class TestTravelFundEndpoints:
    """Test Travel Fund CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_travel_fund_status(self):
        """GET /api/travel-fund - Get fund status"""
        response = requests.get(f"{BASE_URL}/api/travel-fund", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "year" in data
        assert "annual_budget" in data
        assert "total_deposited" in data
        assert "total_available_fund" in data
        assert "total_spent" in data
        assert "available" in data
        assert "deposits" in data
        
        print(f"✓ GET /api/travel-fund - Year: {data['year']}")
        print(f"  Annual Budget: ${data['annual_budget']}")
        print(f"  Total Deposited: ${data['total_deposited']}")
        print(f"  Total Spent: ${data['total_spent']}")
        print(f"  Available: ${data['available']}")
    
    def test_get_travel_fund_with_year_param(self):
        """GET /api/travel-fund?year=2026 - Get fund for specific year"""
        response = requests.get(f"{BASE_URL}/api/travel-fund?year=2026", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["year"] == 2026
        print(f"✓ GET /api/travel-fund?year=2026 - Fund for year 2026 retrieved")
    
    def test_deposit_to_travel_fund(self):
        """POST /api/travel-fund/deposit - Add money to fund"""
        # Get initial state
        initial_response = requests.get(f"{BASE_URL}/api/travel-fund", headers=self.headers)
        initial_deposited = initial_response.json().get("total_deposited", 0)
        
        # Make deposit
        deposit_amount = 100.50
        deposit_data = {
            "amount": deposit_amount,
            "note": "TEST_Ahorro extra de prueba"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/travel-fund/deposit",
            headers=self.headers,
            json=deposit_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ POST /api/travel-fund/deposit - Deposited ${deposit_amount}")
        
        # Verify deposit was recorded
        verify_response = requests.get(f"{BASE_URL}/api/travel-fund", headers=self.headers)
        verify_data = verify_response.json()
        
        # Check total_deposited increased
        assert verify_data["total_deposited"] >= initial_deposited + deposit_amount
        print(f"  New total deposited: ${verify_data['total_deposited']}")
        
        # Check deposit appears in deposits list
        deposits = verify_data.get("deposits", [])
        test_deposit = next((d for d in deposits if "TEST_" in d.get("note", "")), None)
        assert test_deposit is not None, "Test deposit not found in deposits list"
        print(f"  Deposit recorded with note: {test_deposit['note']}")
    
    def test_deposit_invalid_amount(self):
        """POST /api/travel-fund/deposit - Invalid amount returns 400"""
        deposit_data = {
            "amount": 0,
            "note": "Invalid deposit"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/travel-fund/deposit",
            headers=self.headers,
            json=deposit_data
        )
        
        assert response.status_code == 400
        print(f"✓ POST /api/travel-fund/deposit with amount=0 returns 400")
    
    def test_deposit_negative_amount(self):
        """POST /api/travel-fund/deposit - Negative amount returns 400"""
        deposit_data = {
            "amount": -50,
            "note": "Negative deposit"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/travel-fund/deposit",
            headers=self.headers,
            json=deposit_data
        )
        
        assert response.status_code == 400
        print(f"✓ POST /api/travel-fund/deposit with negative amount returns 400")
    
    def test_update_travel_fund_settings(self):
        """PUT /api/travel-fund/settings - Update annual budget"""
        # Get initial budget
        initial_response = requests.get(f"{BASE_URL}/api/travel-fund", headers=self.headers)
        initial_budget = initial_response.json().get("annual_budget", 0)
        
        # Update budget
        new_budget = 20000.00
        settings_data = {
            "annual_budget": new_budget
        }
        
        response = requests.put(
            f"{BASE_URL}/api/travel-fund/settings",
            headers=self.headers,
            json=settings_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["annual_budget"] == new_budget
        print(f"✓ PUT /api/travel-fund/settings - Budget updated to ${new_budget}")
        
        # Verify change persisted
        verify_response = requests.get(f"{BASE_URL}/api/travel-fund", headers=self.headers)
        verify_data = verify_response.json()
        assert verify_data["annual_budget"] == new_budget
        print(f"  Verified: Annual budget is now ${verify_data['annual_budget']}")
        
        # Restore original budget
        requests.put(
            f"{BASE_URL}/api/travel-fund/settings",
            headers=self.headers,
            json={"annual_budget": initial_budget}
        )
        print(f"  Restored original budget: ${initial_budget}")


@pytest.mark.skip(reason="Demo user may not exist in database")
class TestTravelFundDemoUser:
    """Test Travel Fund with demo user (different budget)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get demo user auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_demo_user_travel_fund(self):
        """Demo user should have different default budget"""
        response = requests.get(f"{BASE_URL}/api/travel-fund", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Demo user should have $2000 default budget (not $16500)
        print(f"✓ Demo user travel fund - Budget: ${data['annual_budget']}")
        print(f"  Available: ${data['available']}")


class TestTravelFundUnauthorized:
    """Test Travel Fund endpoints without authentication"""
    
    def test_get_fund_unauthorized(self):
        """GET /api/travel-fund without token returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/travel-fund")
        assert response.status_code in [401, 403]
        print(f"✓ GET /api/travel-fund without auth returns {response.status_code}")
    
    def test_deposit_unauthorized(self):
        """POST /api/travel-fund/deposit without token returns 401/403"""
        response = requests.post(
            f"{BASE_URL}/api/travel-fund/deposit",
            json={"amount": 100, "note": "test"}
        )
        assert response.status_code in [401, 403]
        print(f"✓ POST /api/travel-fund/deposit without auth returns {response.status_code}")
    
    def test_settings_unauthorized(self):
        """PUT /api/travel-fund/settings without token returns 401/403"""
        response = requests.put(
            f"{BASE_URL}/api/travel-fund/settings",
            json={"annual_budget": 10000}
        )
        assert response.status_code in [401, 403]
        print(f"✓ PUT /api/travel-fund/settings without auth returns {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
