"""
Test Gmail Integration Endpoints (PROMPT 5)
Tests for Gmail OAuth2 flow, sync, and transaction management.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from environment
from tests.conftest_credentials import ADMIN_EMAIL, ADMIN_PASSWORD


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get auth headers for API requests."""
    return {"Authorization": f"Bearer {auth_token}"}


class TestGmailStatus:
    """Test GET /api/gmail/status endpoint."""
    
    def test_gmail_status_returns_connected_field(self, auth_headers):
        """Gmail status should return {connected: bool} structure."""
        response = requests.get(f"{BASE_URL}/api/gmail/status", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "connected" in data, "Response should have 'connected' field"
        assert isinstance(data["connected"], bool), "'connected' should be boolean"
        
        # If connected, should have additional fields
        if data["connected"]:
            assert "connected_at" in data, "Connected user should have 'connected_at'"
        
        print(f"Gmail status: connected={data['connected']}")


class TestGmailAuthUrl:
    """Test GET /api/gmail/auth-url endpoint."""
    
    def test_auth_url_returns_google_url(self, auth_headers):
        """Auth URL should return a valid Google OAuth2 URL."""
        response = requests.get(f"{BASE_URL}/api/gmail/auth-url", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "auth_url" in data, "Response should have 'auth_url' field"
        
        auth_url = data["auth_url"]
        assert isinstance(auth_url, str), "'auth_url' should be a string"
        assert auth_url.startswith("https://accounts.google.com"), \
            f"Auth URL should start with 'https://accounts.google.com', got: {auth_url[:50]}..."
        
        # Verify URL contains required OAuth2 parameters
        assert "client_id=" in auth_url, "Auth URL should contain client_id"
        assert "redirect_uri=" in auth_url, "Auth URL should contain redirect_uri"
        assert "scope=" in auth_url, "Auth URL should contain scope"
        
        print(f"Auth URL generated successfully (starts with: {auth_url[:80]}...)")


class TestGmailTransactions:
    """Test GET /api/gmail/transactions endpoint."""
    
    def test_transactions_returns_correct_structure(self, auth_headers):
        """Gmail transactions should return {transactions: [], summary: {...}}."""
        response = requests.get(f"{BASE_URL}/api/gmail/transactions", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check transactions array
        assert "transactions" in data, "Response should have 'transactions' field"
        assert isinstance(data["transactions"], list), "'transactions' should be a list"
        
        # Check summary object
        assert "summary" in data, "Response should have 'summary' field"
        summary = data["summary"]
        assert isinstance(summary, dict), "'summary' should be a dict"
        
        # Verify summary fields
        expected_summary_fields = ["total", "pendiente", "aprobado", "descartado"]
        for field in expected_summary_fields:
            assert field in summary, f"Summary should have '{field}' field"
            assert isinstance(summary[field], int), f"summary.{field} should be an integer"
        
        print(f"Gmail transactions: {len(data['transactions'])} items, summary: {summary}")


class TestGmailSync:
    """Test POST /api/gmail/sync endpoint."""
    
    def test_sync_returns_error_when_not_connected(self, auth_headers):
        """Sync should return 400 error when Gmail is not connected."""
        # First check if Gmail is connected
        status_response = requests.get(f"{BASE_URL}/api/gmail/status", headers=auth_headers)
        status_data = status_response.json()
        
        if status_data.get("connected"):
            pytest.skip("Gmail is already connected - cannot test 'not connected' error")
        
        # Try to sync without Gmail connected
        response = requests.post(f"{BASE_URL}/api/gmail/sync", headers=auth_headers)
        
        assert response.status_code == 400, f"Expected 400 when not connected, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Error response should have 'detail' field"
        assert "Gmail no conectado" in data["detail"] or "no conectado" in data["detail"].lower(), \
            f"Error message should mention Gmail not connected, got: {data['detail']}"
        
        print(f"Sync correctly returns error when not connected: {data['detail']}")


class TestBulkApproveReconciliation:
    """Test PUT /api/reconciliation/bulk-approve endpoint."""
    
    def test_bulk_approve_with_valid_ids(self, auth_headers):
        """Bulk approve should accept {transaction_ids: [...]} and return {approved, failed, total}."""
        # First get some pending transactions
        pending_response = requests.get(f"{BASE_URL}/api/reconciliation/pending", headers=auth_headers)
        
        if pending_response.status_code != 200:
            pytest.skip(f"Could not get pending transactions: {pending_response.status_code}")
        
        pending_data = pending_response.json()
        pending_list = pending_data.get("pending_review", [])
        
        if not pending_list:
            # Test with empty array - should return 400
            response = requests.put(
                f"{BASE_URL}/api/reconciliation/bulk-approve",
                json={"transaction_ids": []},
                headers=auth_headers
            )
            assert response.status_code == 400, "Empty array should return 400"
            print("Bulk approve correctly rejects empty array")
            return
        
        # Get first transaction ID
        test_id = pending_list[0].get("id") or pending_list[0].get("_id")
        
        response = requests.put(
            f"{BASE_URL}/api/reconciliation/bulk-approve",
            json={"transaction_ids": [test_id]},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "approved" in data, "Response should have 'approved' field"
        assert "failed" in data, "Response should have 'failed' field"
        assert "total" in data, "Response should have 'total' field"
        
        print(f"Bulk approve result: approved={data['approved']}, failed={data['failed']}, total={data['total']}")
    
    def test_bulk_approve_with_invalid_ids(self, auth_headers):
        """Bulk approve with invalid IDs should return failed count, not 500 error."""
        response = requests.put(
            f"{BASE_URL}/api/reconciliation/bulk-approve",
            json={"transaction_ids": ["invalid-id-12345", "another-invalid-id"]},
            headers=auth_headers
        )
        
        # Should not return 500 - should handle gracefully
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("approved", 0) == 0, "Invalid IDs should not be approved"
            assert data.get("failed", 0) >= 1, "Invalid IDs should be counted as failed"
            print(f"Bulk approve handles invalid IDs gracefully: {data}")
    
    def test_bulk_approve_empty_array_returns_400(self, auth_headers):
        """Bulk approve with empty array should return 400."""
        response = requests.put(
            f"{BASE_URL}/api/reconciliation/bulk-approve",
            json={"transaction_ids": []},
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for empty array, got {response.status_code}"
        print("Bulk approve correctly rejects empty array with 400")


class TestGmailApproveDiscard:
    """Test Gmail transaction approve/discard endpoints."""
    
    def test_approve_nonexistent_gmail_transaction(self, auth_headers):
        """Approving non-existent Gmail transaction should return 404."""
        response = requests.put(
            f"{BASE_URL}/api/gmail/transactions/nonexistent-gmail-id-12345/approve",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Approve correctly returns 404 for non-existent Gmail transaction")
    
    def test_discard_nonexistent_gmail_transaction(self, auth_headers):
        """Discarding non-existent Gmail transaction should return 404."""
        response = requests.put(
            f"{BASE_URL}/api/gmail/transactions/nonexistent-gmail-id-12345/discard",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Discard correctly returns 404 for non-existent Gmail transaction")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
