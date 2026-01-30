"""
FamilyFinance Ecuador - Comprehensive Feature Tests
Testing: Login, Transactions, Split, Attachments, Categorization Rules, Export, AI Predictions, SRI Limits
"""
import pytest
import requests
import os
import json
from io import BytesIO

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fintrackec.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_USER = {
    "email": "emilio@test.com",
    "password": "test1234"
}

class TestAuthenticationJWT:
    """Test JWT authentication flow"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == TEST_USER["email"]
        assert data["user"]["role"] == "admin"
        print(f"✓ Login successful for {TEST_USER['email']}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")
    
    def test_protected_endpoint_without_token(self):
        """Test accessing protected endpoint without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Protected endpoint correctly requires authentication")


class TestTransactionsCRUD:
    """Test transaction CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_expense_transaction(self):
        """Test creating an expense transaction"""
        transaction_data = {
            "amount": 45.50,
            "description": "TEST_Compra en Supermaxi",
            "category": "alimentacion",
            "subcategory": "Supermercado",
            "date": "2025-01-15",
            "transaction_type": "expense",
            "establishment": "Supermaxi Norte",
            "payment_source": "local",
            "is_international": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/transactions",
            json=transaction_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert data["amount"] == 45.50
        assert data["category"] == "alimentacion"
        assert data["is_deductible"] == True  # alimentacion is deductible
        assert "id" in data
        print(f"✓ Created expense transaction: {data['id']}")
        return data["id"]
    
    def test_create_income_transaction(self):
        """Test creating an income transaction"""
        transaction_data = {
            "amount": 5000.00,
            "description": "TEST_Salario mensual",
            "category": "otros",
            "subcategory": "Varios",
            "date": "2025-01-01",
            "transaction_type": "income",
            "source": "Personal"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/transactions",
            json=transaction_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert data["amount"] == 5000.00
        assert data["transaction_type"] == "income"
        print(f"✓ Created income transaction: {data['id']}")
        return data["id"]
    
    def test_get_transactions(self):
        """Test getting all transactions"""
        response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} transactions")
        return data
    
    def test_delete_test_transactions(self):
        """Clean up test transactions"""
        response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers=self.headers
        )
        transactions = response.json()
        
        deleted = 0
        for t in transactions:
            if t["description"].startswith("TEST_"):
                del_response = requests.delete(
                    f"{BASE_URL}/api/transactions/{t['id']}",
                    headers=self.headers
                )
                if del_response.status_code == 200:
                    deleted += 1
        
        print(f"✓ Cleaned up {deleted} test transactions")


class TestSplitTransactions:
    """Test transaction split functionality (QuickBooks-style)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and create a test transaction"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_split_transaction(self):
        """Test splitting a transaction into multiple categories"""
        # First create a transaction to split
        transaction_data = {
            "amount": 100.00,
            "description": "TEST_Compra mixta para split",
            "category": "alimentacion",
            "subcategory": "Supermercado",
            "date": "2025-01-15",
            "transaction_type": "expense",
            "establishment": "Supermaxi"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/transactions",
            json=transaction_data,
            headers=self.headers
        )
        assert create_response.status_code == 200
        transaction_id = create_response.json()["id"]
        print(f"✓ Created transaction to split: {transaction_id}")
        
        # Now split it
        split_data = {
            "transaction_id": transaction_id,
            "splits": [
                {
                    "amount": 60.00,
                    "category": "alimentacion",
                    "subcategory": "Comida",
                    "description": "Alimentos"
                },
                {
                    "amount": 40.00,
                    "category": "vestimenta",
                    "subcategory": "Ropa",
                    "description": "Ropa"
                }
            ]
        }
        
        split_response = requests.post(
            f"{BASE_URL}/api/transactions/split",
            json=split_data,
            headers=self.headers
        )
        assert split_response.status_code == 200, f"Split failed: {split_response.text}"
        
        data = split_response.json()
        assert "splits" in data
        assert len(data["splits"]) == 2
        assert data["splits"][0]["is_split"] == True
        assert data["splits"][0]["parent_transaction_id"] == transaction_id
        print(f"✓ Transaction split into {len(data['splits'])} parts")
        
        # Verify split amounts
        total_split = sum(s["amount"] for s in data["splits"])
        assert abs(total_split - 100.00) < 0.01, f"Split amounts don't match: {total_split}"
        print("✓ Split amounts verified correctly")
        
        return data
    
    def test_split_unbalanced_fails(self):
        """Test that unbalanced split fails"""
        # Create transaction
        transaction_data = {
            "amount": 100.00,
            "description": "TEST_Compra para split fallido",
            "category": "alimentacion",
            "subcategory": "Supermercado",
            "date": "2025-01-15",
            "transaction_type": "expense"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/transactions",
            json=transaction_data,
            headers=self.headers
        )
        transaction_id = create_response.json()["id"]
        
        # Try unbalanced split
        split_data = {
            "transaction_id": transaction_id,
            "splits": [
                {"amount": 50.00, "category": "alimentacion", "subcategory": "Comida"},
                {"amount": 30.00, "category": "vestimenta", "subcategory": "Ropa"}  # Only 80, not 100
            ]
        }
        
        split_response = requests.post(
            f"{BASE_URL}/api/transactions/split",
            json=split_data,
            headers=self.headers
        )
        assert split_response.status_code == 400, f"Expected 400 for unbalanced split, got {split_response.status_code}"
        print("✓ Unbalanced split correctly rejected")


class TestAttachments:
    """Test document attachment functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_upload_attachment(self):
        """Test uploading an attachment to a transaction"""
        # First create a transaction
        transaction_data = {
            "amount": 25.00,
            "description": "TEST_Compra con recibo",
            "category": "alimentacion",
            "subcategory": "Restaurantes",
            "date": "2025-01-15",
            "transaction_type": "expense"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/transactions",
            json=transaction_data,
            headers=self.headers
        )
        transaction_id = create_response.json()["id"]
        print(f"✓ Created transaction for attachment: {transaction_id}")
        
        # Create a simple test file (PNG header)
        test_file_content = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100  # Minimal PNG-like content
        files = {
            'file': ('test_receipt.png', BytesIO(test_file_content), 'image/png')
        }
        data = {'attachment_type': 'receipt'}
        
        # Upload attachment
        upload_response = requests.post(
            f"{BASE_URL}/api/transactions/{transaction_id}/attachments",
            files=files,
            data=data,
            headers=self.headers
        )
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        
        result = upload_response.json()
        assert "filename" in result
        assert result["type"] == "receipt"
        print(f"✓ Attachment uploaded: {result['filename']}")
        
        return result


class TestCategorizationRules:
    """Test automatic categorization rules (QuickBooks-style)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_categorization_rules(self):
        """Test getting all categorization rules"""
        response = requests.get(
            f"{BASE_URL}/api/categorization-rules",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get rules failed: {response.text}"
        
        data = response.json()
        assert "default_rules" in data
        assert "custom_rules" in data
        assert len(data["default_rules"]) > 0, "No default rules found"
        print(f"✓ Retrieved {len(data['default_rules'])} default rules, {len(data['custom_rules'])} custom rules")
        return data
    
    def test_create_custom_rule(self):
        """Test creating a custom categorization rule"""
        rule_data = {
            "keywords": ["test_keyword", "test_store"],
            "category": "alimentacion",
            "subcategory": "Supermercado",
            "is_active": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/categorization-rules",
            json=rule_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Create rule failed: {response.text}"
        
        data = response.json()
        assert "rule" in data
        assert data["rule"]["keywords"] == ["test_keyword", "test_store"]
        print(f"✓ Created custom rule: {data['rule']['id']}")
        return data["rule"]["id"]
    
    def test_auto_categorize_with_default_rule(self):
        """Test auto-categorization with default rules"""
        response = requests.post(
            f"{BASE_URL}/api/transactions/auto-categorize",
            params={"description": "Compra en Supermaxi"},
            headers=self.headers
        )
        assert response.status_code == 200, f"Auto-categorize failed: {response.text}"
        
        data = response.json()
        assert data["auto_categorized"] == True
        assert data["category"] == "alimentacion"
        assert data["subcategory"] == "Supermercado"
        print(f"✓ Auto-categorized 'Supermaxi' as {data['category']}/{data['subcategory']}")
        return data
    
    def test_auto_categorize_pharmacy(self):
        """Test auto-categorization for pharmacy"""
        response = requests.post(
            f"{BASE_URL}/api/transactions/auto-categorize",
            params={"description": "Compra en Fybeca"},
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["auto_categorized"] == True
        assert data["category"] == "salud"
        print(f"✓ Auto-categorized 'Fybeca' as {data['category']}/{data['subcategory']}")
    
    def test_delete_custom_rule(self):
        """Test deleting a custom rule"""
        # First create a rule
        rule_data = {
            "keywords": ["delete_test"],
            "category": "otros",
            "subcategory": "Varios",
            "is_active": True
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/categorization-rules",
            json=rule_data,
            headers=self.headers
        )
        rule_id = create_response.json()["rule"]["id"]
        
        # Delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/categorization-rules/{rule_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"✓ Deleted custom rule: {rule_id}")


class TestExportFunctionality:
    """Test export to Excel and PDF"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_export_excel(self):
        """Test exporting transactions to Excel"""
        response = requests.get(
            f"{BASE_URL}/api/export/transactions/excel",
            headers=self.headers
        )
        assert response.status_code == 200, f"Excel export failed: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "spreadsheet" in content_type or "octet-stream" in content_type, f"Unexpected content type: {content_type}"
        
        # Check file size
        assert len(response.content) > 0, "Excel file is empty"
        print(f"✓ Excel exported successfully ({len(response.content)} bytes)")
    
    def test_export_sri_pdf(self):
        """Test exporting SRI report to PDF"""
        response = requests.get(
            f"{BASE_URL}/api/export/sri/pdf",
            params={"year": 2025, "cargas_familiares": 3},
            headers=self.headers
        )
        assert response.status_code == 200, f"PDF export failed: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "pdf" in content_type or "octet-stream" in content_type, f"Unexpected content type: {content_type}"
        
        # Check file size
        assert len(response.content) > 0, "PDF file is empty"
        print(f"✓ SRI PDF exported successfully ({len(response.content)} bytes)")


class TestAIPredictions:
    """Test AI predictions endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_predictions(self):
        """Test getting AI predictions"""
        response = requests.get(
            f"{BASE_URL}/api/predictions",
            headers=self.headers
        )
        assert response.status_code == 200, f"Predictions failed: {response.text}"
        
        data = response.json()
        # API should return predictions, advice, and sri_tips
        assert "predictions" in data or "advice" in data, f"Unexpected response: {data}"
        print(f"✓ AI predictions retrieved successfully")
        return data


class TestSRIDeductionLimits:
    """Test SRI Ecuador deduction limits"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_sri_limits(self):
        """Test getting SRI deduction limits"""
        response = requests.get(
            f"{BASE_URL}/api/sri/deduction-limits",
            params={"cargas_familiares": 3},
            headers=self.headers
        )
        assert response.status_code == 200, f"SRI limits failed: {response.text}"
        
        data = response.json()
        assert "year" in data
        assert "limite_global" in data
        assert "category_progress" in data
        assert "contribuyente" in data
        
        # Verify SRI 2025 values
        assert data["canasta_basica"] == 798.31
        assert data["fraccion_basica_exenta"] == 11902.00
        
        print(f"✓ SRI limits retrieved: Global limit ${data['limite_global']:.2f}")
        print(f"  - Deductible spent: ${data['total_deductible_spent']:.2f}")
        print(f"  - Remaining: ${data['remaining_global']:.2f}")
        return data
    
    def test_deductible_categories(self):
        """Test that categories are correctly marked as deductible"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        
        data = response.json()
        categories = data["categories"]
        
        # Verify deductible categories
        deductible = ["alimentacion", "salud", "educacion", "vivienda", "vestimenta", "turismo"]
        non_deductible = ["transporte", "viajes_internacionales", "otros"]
        
        for cat in deductible:
            assert categories[cat]["deductible"] == True, f"{cat} should be deductible"
        
        for cat in non_deductible:
            assert categories[cat]["deductible"] == False, f"{cat} should NOT be deductible"
        
        print("✓ Deductible vs non-deductible categories verified correctly")


class TestCleanup:
    """Clean up test data"""
    
    def test_cleanup_test_data(self):
        """Remove all TEST_ prefixed data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get and delete test transactions
        response = requests.get(f"{BASE_URL}/api/transactions", headers=headers)
        transactions = response.json()
        
        deleted = 0
        for t in transactions:
            if t["description"].startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/transactions/{t['id']}", headers=headers)
                deleted += 1
        
        # Get and delete test rules
        response = requests.get(f"{BASE_URL}/api/categorization-rules", headers=headers)
        rules = response.json().get("custom_rules", [])
        
        for rule in rules:
            if any("test" in kw.lower() for kw in rule.get("keywords", [])):
                requests.delete(f"{BASE_URL}/api/categorization-rules/{rule['id']}", headers=headers)
                deleted += 1
        
        print(f"✓ Cleaned up {deleted} test items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
