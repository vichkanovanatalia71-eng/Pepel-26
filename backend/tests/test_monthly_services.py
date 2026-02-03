"""
Backend API tests for Monthly Services CRUD operations
Tests: GET, POST, DELETE endpoints for monthly-services
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMonthlyServicesAPI:
    """Tests for Monthly Services API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get existing doctors and services for test data
        doctors_res = self.session.get(f"{BASE_URL}/api/doctors")
        services_res = self.session.get(f"{BASE_URL}/api/services")
        
        self.doctors = doctors_res.json() if doctors_res.status_code == 200 else []
        self.services = services_res.json() if services_res.status_code == 200 else []
        
        yield
        
        # Cleanup - delete test entries created during tests
        # (entries with TEST_ prefix in notes if we had notes field)
    
    def test_get_all_monthly_services(self):
        """Test GET /api/monthly-services returns list of entries"""
        response = self.session.get(f"{BASE_URL}/api/monthly-services")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify entry structure
        if len(data) > 0:
            entry = data[0]
            assert "id" in entry, "Entry should have id"
            assert "month" in entry, "Entry should have month"
            assert "year" in entry, "Entry should have year"
            assert "service_id" in entry, "Entry should have service_id"
            assert "doctor_id" in entry, "Entry should have doctor_id"
            assert "quantity" in entry, "Entry should have quantity"
            assert "total_revenue" in entry, "Entry should have total_revenue"
            assert "doctor_income" in entry, "Entry should have doctor_income"
            assert "fop_income" in entry, "Entry should have fop_income"
            print(f"SUCCESS: Found {len(data)} monthly service entries")
    
    def test_get_monthly_services_with_filters(self):
        """Test GET /api/monthly-services with query filters"""
        # Test with year filter
        response = self.session.get(f"{BASE_URL}/api/monthly-services?year=2026")
        assert response.status_code == 200
        data = response.json()
        for entry in data:
            assert entry["year"] == 2026, f"Entry year should be 2026, got {entry['year']}"
        print(f"SUCCESS: Year filter works - found {len(data)} entries for 2026")
        
        # Test with month filter
        response = self.session.get(f"{BASE_URL}/api/monthly-services?month=1&year=2026")
        assert response.status_code == 200
        data = response.json()
        for entry in data:
            assert entry["month"] == 1, f"Entry month should be 1, got {entry['month']}"
        print(f"SUCCESS: Month filter works - found {len(data)} entries for Jan 2026")
    
    def test_create_monthly_service_entry(self):
        """Test POST /api/monthly-services creates new entry"""
        if not self.doctors or not self.services:
            pytest.skip("No doctors or services available for testing")
        
        # Create test entry
        test_entry = {
            "month": 12,
            "year": 2025,
            "service_id": self.services[0]["id"],
            "doctor_id": self.doctors[0]["id"],
            "quantity": 99  # Unique quantity for test identification
        }
        
        response = self.session.post(f"{BASE_URL}/api/monthly-services", json=test_entry)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["month"] == 12
        assert data["year"] == 2025
        assert data["quantity"] == 99
        assert "id" in data
        assert data["total_revenue"] > 0, "Total revenue should be calculated"
        assert data["doctor_income"] > 0, "Doctor income should be calculated"
        
        # Store for cleanup
        self.test_entry_id = data["id"]
        print(f"SUCCESS: Created test entry with id {data['id']}")
        
        # Verify entry exists via GET
        get_response = self.session.get(f"{BASE_URL}/api/monthly-services?month=12&year=2025")
        assert get_response.status_code == 200
        entries = get_response.json()
        found = any(e["id"] == data["id"] for e in entries)
        assert found, "Created entry should be retrievable"
        print("SUCCESS: Entry verified via GET")
        
        # Cleanup - delete test entry
        delete_response = self.session.delete(f"{BASE_URL}/api/monthly-services/{data['id']}")
        assert delete_response.status_code == 200
        print("SUCCESS: Test entry cleaned up")
    
    def test_delete_monthly_service_entry(self):
        """Test DELETE /api/monthly-services/{entry_id}"""
        if not self.doctors or not self.services:
            pytest.skip("No doctors or services available for testing")
        
        # First create an entry to delete
        test_entry = {
            "month": 11,
            "year": 2025,
            "service_id": self.services[0]["id"],
            "doctor_id": self.doctors[0]["id"],
            "quantity": 88
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/monthly-services", json=test_entry)
        assert create_response.status_code == 200
        entry_id = create_response.json()["id"]
        print(f"Created entry {entry_id} for deletion test")
        
        # Delete the entry
        delete_response = self.session.delete(f"{BASE_URL}/api/monthly-services/{entry_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        data = delete_response.json()
        assert data.get("success") == True, "Delete should return success: true"
        print(f"SUCCESS: Entry {entry_id} deleted")
        
        # Verify entry no longer exists
        get_response = self.session.get(f"{BASE_URL}/api/monthly-services?month=11&year=2025")
        entries = get_response.json()
        found = any(e["id"] == entry_id for e in entries)
        assert not found, "Deleted entry should not be retrievable"
        print("SUCCESS: Entry verified as deleted")
    
    def test_delete_nonexistent_entry(self):
        """Test DELETE /api/monthly-services/{entry_id} with invalid ID"""
        fake_id = "nonexistent-id-12345"
        response = self.session.delete(f"{BASE_URL}/api/monthly-services/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: Delete nonexistent entry returns 404")
    
    def test_bulk_delete_simulation(self):
        """Test multiple DELETE operations (simulating bulk delete)"""
        if not self.doctors or not self.services:
            pytest.skip("No doctors or services available for testing")
        
        created_ids = []
        
        # Create 3 test entries
        for i in range(3):
            test_entry = {
                "month": 10,
                "year": 2025,
                "service_id": self.services[i % len(self.services)]["id"],
                "doctor_id": self.doctors[0]["id"],
                "quantity": 70 + i
            }
            response = self.session.post(f"{BASE_URL}/api/monthly-services", json=test_entry)
            assert response.status_code == 200
            created_ids.append(response.json()["id"])
        
        print(f"Created {len(created_ids)} test entries for bulk delete")
        
        # Delete all created entries
        for entry_id in created_ids:
            delete_response = self.session.delete(f"{BASE_URL}/api/monthly-services/{entry_id}")
            assert delete_response.status_code == 200, f"Failed to delete {entry_id}"
        
        print(f"SUCCESS: Bulk deleted {len(created_ids)} entries")
        
        # Verify all deleted
        get_response = self.session.get(f"{BASE_URL}/api/monthly-services?month=10&year=2025")
        entries = get_response.json()
        for entry_id in created_ids:
            found = any(e["id"] == entry_id for e in entries)
            assert not found, f"Entry {entry_id} should be deleted"
        
        print("SUCCESS: All bulk deleted entries verified as removed")


class TestDoctorsAPI:
    """Tests for Doctors API - needed for filter testing"""
    
    def test_get_all_doctors(self):
        """Test GET /api/doctors"""
        response = requests.get(f"{BASE_URL}/api/doctors")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2, "Should have at least 2 doctors (ПЛМ, ОСЛ)"
        
        # Verify doctor structure
        for doctor in data:
            assert "id" in doctor
            assert "name" in doctor
            assert "short_name" in doctor
        
        print(f"SUCCESS: Found {len(data)} doctors")


class TestServicesAPI:
    """Tests for Services API - needed for entry creation"""
    
    def test_get_all_services(self):
        """Test GET /api/services"""
        response = requests.get(f"{BASE_URL}/api/services")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should have services"
        
        # Verify service structure
        service = data[0]
        assert "id" in service
        assert "name" in service
        assert "price" in service
        assert "code" in service
        
        print(f"SUCCESS: Found {len(data)} services")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
