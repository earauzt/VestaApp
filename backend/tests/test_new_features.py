"""
Test suite for FamilyFinance Ecuador - New Features
Tests: Income CRUD, Budget Categories, Reconciliation, Personal Budget
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fintrackec.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "emilio@test.com"
TEST_PASSWORD = "test1234"


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
        assert data["user"]["role"] == "admin"
        
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@test.com",
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
        return response.json()["access_token"]
    pytest.skip("Authentication failed")


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestIncomeEndpoints:
    """Test Income CRUD endpoints"""
    
    def test_get_incomes(self, auth_headers):
        """Test GET /api/income"""
        response = requests.get(f"{BASE_URL}/api/income?year=2026", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
    def test_create_income(self, auth_headers):
        """Test POST /api/income - Create income with distribution"""
        payload = {
            "amount": 2500,
            "date": "2026-01-20",
            "distribution": "APX",
            "concept": "Bonus",
            "description": "Test bonus from APX",
            "is_recurring": False,
            "payment_method": "transferencia"
        }
        response = requests.post(f"{BASE_URL}/api/income", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 2500
        assert data["distribution"] == "APX"
        assert data["concept"] == "Bonus"
        assert "id" in data
        
        # Cleanup - delete the created income
        income_id = data["id"]
        requests.delete(f"{BASE_URL}/api/income/{income_id}", headers=auth_headers)
        
    def test_create_income_usa_distribution(self, auth_headers):
        """Test creating income with USA distribution"""
        payload = {
            "amount": 1500,
            "date": "2026-01-21",
            "distribution": "USA",
            "concept": "Dividendos",
            "description": "Test dividends from USA",
            "is_recurring": False,
            "payment_method": "venmo"
        }
        response = requests.post(f"{BASE_URL}/api/income", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["distribution"] == "USA"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/income/{data['id']}", headers=auth_headers)
        
    def test_get_income_summary(self, auth_headers):
        """Test GET /api/income/summary"""
        response = requests.get(f"{BASE_URL}/api/income/summary?year=2026", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "by_distribution" in data
        assert "by_concept" in data
        assert "year" in data
        

class TestBudgetCategoriesEndpoints:
    """Test Budget Categories endpoints"""
    
    def test_get_budget_categories(self, auth_headers):
        """Test GET /api/budget/categories - Personal budget categories"""
        response = requests.get(f"{BASE_URL}/api/budget/categories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check for personal budget categories
        assert "categories" in data
        categories = data["categories"]
        
        # Verify expected categories from user's Excel
        expected_categories = [
            "servicios_basicos", "empleados", "colegio_actividades", 
            "seguros", "comida", "restaurantes", "carros", 
            "usa", "viajes", "gastos_libres"
        ]
        for cat in expected_categories:
            assert cat in categories, f"Missing category: {cat}"
            
        # Check gastos_libres has monthly limits
        assert "monthly_limits" in categories["gastos_libres"]
        assert categories["gastos_libres"]["monthly_limits"]["KP (Esposa)"] == 800
        assert categories["gastos_libres"]["monthly_limits"]["EA (Emilio)"] == 500
        
        # Check payment methods
        assert "payment_methods" in data
        assert "venmo" in data["payment_methods"]
        assert "apple_card" in data["payment_methods"]
        
        # Check goals
        assert "goals" in data
        assert data["goals"]["gastos_libres_max_annual"] == 30000
        
    def test_get_personal_budget(self, auth_headers):
        """Test GET /api/budget/personal"""
        response = requests.get(f"{BASE_URL}/api/budget/personal", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "total_income" in data
        assert "total_expenses" in data
        assert "balance" in data
        assert "by_category" in data
        assert "goal_progress" in data
        
        # Check goal progress structure
        goal_progress = data["goal_progress"]
        assert "gastos_fijos" in goal_progress
        assert "gastos_libres" in goal_progress
        
        # Gastos fijos should have target percent
        assert "target_percent" in goal_progress["gastos_fijos"]
        assert goal_progress["gastos_fijos"]["target_percent"]["min"] == 0.55
        assert goal_progress["gastos_fijos"]["target_percent"]["max"] == 0.65


class TestReconciliationEndpoints:
    """Test Reconciliation endpoints"""
    
    def test_get_pending_reconciliation(self, auth_headers):
        """Test GET /api/reconciliation/pending"""
        response = requests.get(f"{BASE_URL}/api/reconciliation/pending", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "pending_review" in data
        assert "duplicate_suspects" in data
        assert "stats" in data
        
    def test_get_reconciliation_stats(self, auth_headers):
        """Test GET /api/reconciliation/stats"""
        response = requests.get(f"{BASE_URL}/api/reconciliation/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check expected fields
        expected_fields = ["pending_review", "approved", "rejected", "duplicate_suspect"]
        for field in expected_fields:
            assert field in data
            
    def test_get_duplicates(self, auth_headers):
        """Test GET /api/reconciliation/duplicates"""
        response = requests.get(f"{BASE_URL}/api/reconciliation/duplicates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "pairs" in data


class TestSRICategoriesEndpoints:
    """Test SRI Categories endpoints"""
    
    def test_get_categories(self):
        """Test GET /api/categories - SRI categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()
        
        # Check SRI categories
        assert "categories" in data
        categories = data["categories"]
        
        # Verify deductible categories
        deductible_cats = ["alimentacion", "salud", "educacion", "vivienda", "vestimenta", "turismo"]
        for cat in deductible_cats:
            assert cat in categories
            assert categories[cat]["deductible"] == True
            
        # Verify non-deductible categories
        non_deductible_cats = ["transporte", "viajes_internacionales", "otros"]
        for cat in non_deductible_cats:
            assert cat in categories
            assert categories[cat]["deductible"] == False
            
        # Check income sources
        assert "income_sources" in data
        assert "Personal" in data["income_sources"]
        assert "APX" in data["income_sources"]
        assert "USA" in data["income_sources"]
        
    def test_get_sri_deduction_limits(self, auth_headers):
        """Test GET /api/sri/deduction-limits"""
        response = requests.get(f"{BASE_URL}/api/sri/deduction-limits?cargas_familiares=3", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "year" in data
        assert "contribuyente" in data
        assert "canasta_basica" in data
        assert "fraccion_basica_exenta" in data
        assert "limite_global" in data
        assert "category_progress" in data
        
        # Verify canasta basica value
        assert data["canasta_basica"] == 798.31
        assert data["fraccion_basica_exenta"] == 11902.0


class TestTransactionEndpoints:
    """Test Transaction endpoints"""
    
    def test_get_transactions(self, auth_headers):
        """Test GET /api/transactions"""
        response = requests.get(f"{BASE_URL}/api/transactions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
    def test_create_transaction_with_establishment(self, auth_headers):
        """Test creating transaction with establishment first"""
        payload = {
            "amount": 45.50,
            "description": "Compra de víveres",
            "category": "alimentacion",
            "subcategory": "Supermercado",
            "date": "2026-01-26",
            "transaction_type": "expense",
            "establishment": "Supermaxi Samborondón",
            "payment_method": "tarjeta"
        }
        response = requests.post(f"{BASE_URL}/api/transactions", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["establishment"] == "Supermaxi Samborondón"
        assert data["amount"] == 45.50
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/transactions/{data['id']}", headers=auth_headers)


class TestDashboardEndpoints:
    """Test Dashboard endpoints"""
    
    def test_get_dashboard_stats(self, auth_headers):
        """Test GET /api/dashboard/stats"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check expected fields
        expected_fields = ["total_income", "total_expenses", "balance", "daily_average", "by_category"]
        for field in expected_fields:
            assert field in data
            
    def test_get_chart_data(self, auth_headers):
        """Test GET /api/dashboard/chart-data"""
        response = requests.get(f"{BASE_URL}/api/dashboard/chart-data?period=month", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
