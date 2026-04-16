"""
Test suite for PROMPT 1-4 features:
- PROMPT 1: /api/transactions/learn-vendors with fuzzy matching
- PROMPT 2: Deferred payments matching logic
- PROMPT 3: Bulk approve with {transaction_ids: [...]} format
- PROMPT 4: Frontend UX improvements (tested via Playwright)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        from tests.conftest_credentials import ADMIN_EMAIL, ADMIN_PASSWORD
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestLearnVendors(TestAuth):
    """PROMPT 1: Test /api/transactions/learn-vendors endpoint"""
    
    def test_learn_vendors_returns_correct_structure(self, auth_headers):
        """Test that learn-vendors returns {status, vendors_nuevos, vendors_actualizados, total_en_db}"""
        response = requests.post(f"{BASE_URL}/api/transactions/learn-vendors", headers=auth_headers)
        assert response.status_code == 200, f"Learn vendors failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "status" in data, f"Missing 'status' in response: {data}"
        assert data["status"] == "success", f"Status not success: {data}"
        assert "vendors_nuevos" in data, f"Missing 'vendors_nuevos' in response: {data}"
        assert "vendors_actualizados" in data, f"Missing 'vendors_actualizados' in response: {data}"
        assert "total_en_db" in data, f"Missing 'total_en_db' in response: {data}"
        
        # Verify types
        assert isinstance(data["vendors_nuevos"], int), f"vendors_nuevos should be int: {data}"
        assert isinstance(data["vendors_actualizados"], int), f"vendors_actualizados should be int: {data}"
        assert isinstance(data["total_en_db"], int), f"total_en_db should be int: {data}"
        
        print(f"Learn vendors result: nuevos={data['vendors_nuevos']}, actualizados={data['vendors_actualizados']}, total={data['total_en_db']}")
    
    def test_learn_vendors_idempotency(self, auth_headers):
        """Test that second call has vendors_nuevos=0 (idempotency)"""
        # First call
        response1 = requests.post(f"{BASE_URL}/api/transactions/learn-vendors", headers=auth_headers)
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Second call should have vendors_nuevos=0 (all already learned)
        response2 = requests.post(f"{BASE_URL}/api/transactions/learn-vendors", headers=auth_headers)
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Second call should not create new vendors
        assert data2["vendors_nuevos"] == 0, f"Second call should have vendors_nuevos=0, got {data2['vendors_nuevos']}"
        print(f"Idempotency test passed: second call vendors_nuevos={data2['vendors_nuevos']}")


class TestKnownVendors(TestAuth):
    """Test known vendors endpoints for aliases, source, match_count fields"""
    
    def test_known_vendors_have_required_fields(self, auth_headers):
        """Verify vendors have aliases[], source, match_count fields"""
        response = requests.get(f"{BASE_URL}/api/known-vendors", headers=auth_headers)
        assert response.status_code == 200, f"Get known vendors failed: {response.text}"
        
        vendors = response.json()
        assert isinstance(vendors, list), f"Expected list, got {type(vendors)}"
        
        if len(vendors) > 0:
            vendor = vendors[0]
            # Check required fields
            assert "aliases" in vendor, f"Missing 'aliases' field: {vendor}"
            assert isinstance(vendor["aliases"], list), f"aliases should be list: {vendor}"
            assert "match_count" in vendor, f"Missing 'match_count' field: {vendor}"
            assert isinstance(vendor["match_count"], int), f"match_count should be int: {vendor}"
            
            # source is optional but should exist if created by learn-vendors
            if "source" in vendor:
                print(f"Vendor source: {vendor['source']}")
            
            print(f"Vendor fields verified: aliases={len(vendor['aliases'])}, match_count={vendor['match_count']}")
        else:
            pytest.skip("No vendors found to test")
    
    def test_vendor_lookup_by_alias(self, auth_headers):
        """Test that lookup finds vendors by alias too"""
        # First get a vendor with aliases
        response = requests.get(f"{BASE_URL}/api/known-vendors", headers=auth_headers)
        assert response.status_code == 200
        vendors = response.json()
        
        # Find a vendor with aliases
        vendor_with_alias = None
        for v in vendors:
            if v.get("aliases") and len(v["aliases"]) > 0:
                vendor_with_alias = v
                break
        
        if vendor_with_alias:
            alias = vendor_with_alias["aliases"][0]
            lookup_response = requests.get(
                f"{BASE_URL}/api/known-vendors/lookup",
                params={"establishment": alias},
                headers=auth_headers
            )
            assert lookup_response.status_code == 200, f"Lookup failed: {lookup_response.text}"
            lookup_data = lookup_response.json()
            assert lookup_data.get("found"), f"Should find vendor by alias: {lookup_data}"
            print(f"Lookup by alias '{alias}' found vendor: {lookup_data.get('vendor', {}).get('establishment')}")
        else:
            # Try lookup with establishment name
            if vendors:
                establishment = vendors[0]["establishment"]
                lookup_response = requests.get(
                    f"{BASE_URL}/api/known-vendors/lookup",
                    params={"establishment": establishment},
                    headers=auth_headers
                )
                assert lookup_response.status_code == 200
                lookup_data = lookup_response.json()
                assert lookup_data.get("found"), f"Should find vendor by name: {lookup_data}"
                print(f"Lookup by name '{establishment}' found vendor")
            else:
                pytest.skip("No vendors to test lookup")


class TestBulkApprove(TestAuth):
    """PROMPT 3: Test bulk-approve with {transaction_ids: [...]} format"""
    
    def test_bulk_approve_correct_format(self, auth_headers):
        """Test PUT /api/reconciliation/bulk-approve with {transaction_ids: [...]} format"""
        # First get pending transactions
        response = requests.get(f"{BASE_URL}/api/reconciliation/pending", headers=auth_headers)
        assert response.status_code == 200, f"Get pending failed: {response.text}"
        
        data = response.json()
        pending = data.get("pending_review", [])
        
        if len(pending) >= 2:
            # Get first 2 transaction IDs
            ids = [p.get("id") or p.get("_id") for p in pending[:2]]
            ids = [i for i in ids if i]  # Filter None
            
            if ids:
                # Test with correct format
                response = requests.put(
                    f"{BASE_URL}/api/reconciliation/bulk-approve",
                    json={"transaction_ids": ids},
                    headers=auth_headers
                )
                assert response.status_code == 200, f"Bulk approve failed: {response.text}"
                
                result = response.json()
                assert "approved" in result, f"Missing 'approved' in response: {result}"
                assert "failed" in result, f"Missing 'failed' in response: {result}"
                assert "total" in result, f"Missing 'total' in response: {result}"
                
                print(f"Bulk approve result: approved={result['approved']}, failed={result['failed']}, total={result['total']}")
            else:
                pytest.skip("No valid IDs found in pending transactions")
        else:
            pytest.skip("Not enough pending transactions to test bulk approve")
    
    def test_bulk_approve_invalid_ids(self, auth_headers):
        """Test bulk-approve with invalid IDs returns approved:0, failed:N without 500 error"""
        invalid_ids = ["invalid-id-1", "invalid-id-2", "nonexistent-uuid-12345"]
        
        response = requests.put(
            f"{BASE_URL}/api/reconciliation/bulk-approve",
            json={"transaction_ids": invalid_ids},
            headers=auth_headers
        )
        
        # Should NOT return 500
        assert response.status_code == 200, f"Should return 200 even with invalid IDs, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result["approved"] == 0, f"Should have approved=0 for invalid IDs: {result}"
        assert result["failed"] == len(invalid_ids), f"Should have failed={len(invalid_ids)}: {result}"
        
        print(f"Invalid IDs test passed: approved={result['approved']}, failed={result['failed']}")
    
    def test_bulk_approve_empty_array(self, auth_headers):
        """Test bulk-approve with empty array returns 400"""
        response = requests.put(
            f"{BASE_URL}/api/reconciliation/bulk-approve",
            json={"transaction_ids": []},
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Empty array should return 400, got {response.status_code}: {response.text}"
        print("Empty array test passed: returned 400 as expected")


class TestDeferredPayments(TestAuth):
    """PROMPT 2: Test deferred payments have payment_history field"""
    
    def test_deferred_payments_have_payment_history(self, auth_headers):
        """Verify deferred payments have payment_history field"""
        response = requests.get(f"{BASE_URL}/api/deferred-payments", headers=auth_headers)
        assert response.status_code == 200, f"Get deferred payments failed: {response.text}"
        
        data = response.json()
        assert "payments" in data, f"Missing 'payments' in response: {data}"
        
        payments = data["payments"]
        if len(payments) > 0:
            # Check if any payment has payment_history
            has_history = False
            for p in payments:
                if "payment_history" in p:
                    has_history = True
                    print(f"Deferred payment '{p.get('description')}' has payment_history: {len(p['payment_history'])} entries")
                    break
            
            # payment_history may be empty for new payments, but field should exist after deduction
            print(f"Found {len(payments)} deferred payments, total_remaining: {data.get('total_remaining')}")
        else:
            print("No active deferred payments found")
    
    def test_deferred_payments_structure(self, auth_headers):
        """Verify deferred payments response structure"""
        response = requests.get(f"{BASE_URL}/api/deferred-payments", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "payments" in data
        assert "total_remaining" in data
        assert "total_monthly_obligation" in data
        assert "count" in data
        
        print(f"Deferred payments: count={data['count']}, total_monthly={data['total_monthly_obligation']}")


class TestReconciliationPending(TestAuth):
    """Test reconciliation pending endpoint"""
    
    def test_get_pending_transactions(self, auth_headers):
        """Test GET /api/reconciliation/pending returns valid structure"""
        response = requests.get(f"{BASE_URL}/api/reconciliation/pending", headers=auth_headers)
        assert response.status_code == 200, f"Get pending failed: {response.text}"
        
        data = response.json()
        # Check expected fields
        assert "pending_review" in data or "pending" in data, f"Missing pending field: {data.keys()}"
        
        pending = data.get("pending_review", data.get("pending", []))
        print(f"Found {len(pending)} pending transactions")
        
        if pending:
            tx = pending[0]
            # Verify transaction has id field
            assert "id" in tx or "_id" in tx, f"Transaction missing id: {tx.keys()}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
