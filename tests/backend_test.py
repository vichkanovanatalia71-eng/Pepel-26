import requests
import sys
from datetime import datetime
import json

class MedTrackAPITester:
    def __init__(self, base_url="https://medtrack-271.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.doctor_ids = []
        self.service_ids = []
        self.income_ids = []
        self.expense_ids = []
        self.document_ids = []

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                self.test_results.append({
                    "test": name,
                    "status": "PASSED",
                    "endpoint": endpoint,
                    "status_code": response.status_code
                })
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.test_results.append({
                    "test": name,
                    "status": "FAILED",
                    "endpoint": endpoint,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "error": response.text[:200]
                })

            try:
                return success, response.json() if response.text else {}
            except:
                return success, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({
                "test": name,
                "status": "ERROR",
                "endpoint": endpoint,
                "error": str(e)
            })
            return False, {}

    def test_root(self):
        """Test root endpoint"""
        success, response = self.run_test(
            "Root API",
            "GET",
            "api/",
            200
        )
        return success

    def test_create_doctor(self, name, short_name):
        """Create a doctor"""
        success, response = self.run_test(
            f"Create Doctor ({short_name})",
            "POST",
            "api/doctors",
            200,
            data={"name": name, "short_name": short_name}
        )
        if success and 'id' in response:
            self.doctor_ids.append(response['id'])
            return response['id']
        return None

    def test_get_doctors(self):
        """Get all doctors"""
        success, response = self.run_test(
            "Get Doctors",
            "GET",
            "api/doctors",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} doctors")
        return success

    def test_create_service(self, code, name, price, expense_items):
        """Create a paid service"""
        success, response = self.run_test(
            f"Create Service ({name})",
            "POST",
            "api/services",
            200,
            data={
                "code": code,
                "name": name,
                "price": price,
                "expense_items": expense_items
            }
        )
        if success and 'id' in response:
            self.service_ids.append(response['id'])
            print(f"   Doctor Share: {response.get('doctor_share', 0)} UAH")
            print(f"   FOP Income: {response.get('fop_income', 0)} UAH")
            return response['id']
        return None

    def test_get_services(self):
        """Get all services"""
        success, response = self.run_test(
            "Get Services",
            "GET",
            "api/services",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} services")
        return success

    def test_create_income(self, month, year, doctor_id, declarations, cap_rate, nhs_income, paid_income):
        """Create income record"""
        success, response = self.run_test(
            f"Create Income (Month {month}/{year})",
            "POST",
            "api/incomes",
            200,
            data={
                "month": month,
                "year": year,
                "doctor_id": doctor_id,
                "declarations": declarations,
                "capitalization_rate": cap_rate,
                "total_nhs_income": nhs_income,
                "paid_services_income": paid_income
            }
        )
        if success and 'id' in response:
            self.income_ids.append(response['id'])
            total_decl = sum(declarations.values())
            print(f"   Total declarations: {total_decl}, Total income: {nhs_income + paid_income} UAH")
            return response['id']
        return None

    def test_get_incomes(self):
        """Get all incomes"""
        success, response = self.run_test(
            "Get Incomes",
            "GET",
            "api/incomes",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} income records")
        return success

    def test_create_expense(self, date, category, amount, description):
        """Create expense record"""
        success, response = self.run_test(
            f"Create Expense ({category})",
            "POST",
            "api/expenses",
            200,
            data={
                "date": date,
                "category": category,
                "amount": amount,
                "description": description
            }
        )
        if success and 'id' in response:
            self.expense_ids.append(response['id'])
            print(f"   Amount: {amount} UAH")
            return response['id']
        return None

    def test_get_expenses(self):
        """Get all expenses"""
        success, response = self.run_test(
            "Get Expenses",
            "GET",
            "api/expenses",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} expense records")
        return success

    def test_dashboard_stats(self, month, year):
        """Get dashboard statistics"""
        success, response = self.run_test(
            f"Dashboard Stats ({month}/{year})",
            "GET",
            f"api/dashboard/stats?month={month}&year={year}",
            200
        )
        if success:
            print(f"   Income: {response.get('total_income', 0)} UAH")
            print(f"   Expenses: {response.get('total_expenses', 0)} UAH")
            print(f"   Net Profit: {response.get('net_profit', 0)} UAH")
            print(f"   Declarations: {response.get('total_declarations', 0)}")
        return success

    def test_get_documents(self):
        """Get all documents"""
        success, response = self.run_test(
            "Get Documents",
            "GET",
            "api/documents",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} documents")
        return success

    def test_create_monthly_service(self, month, year, service_id, doctor_id, quantity):
        """Create monthly service entry"""
        success, response = self.run_test(
            f"Create Monthly Service Entry",
            "POST",
            "api/monthly-services",
            200,
            data={
                "month": month,
                "year": year,
                "service_id": service_id,
                "doctor_id": doctor_id,
                "quantity": quantity
            }
        )
        if success and 'id' in response:
            print(f"   Total Revenue: {response.get('total_revenue', 0)} UAH")
            print(f"   Doctor Income: {response.get('doctor_income', 0)} UAH")
            return response['id']
        return None

    def test_get_monthly_services(self):
        """Get all monthly services"""
        success, response = self.run_test(
            "Get Monthly Services",
            "GET",
            "api/monthly-services",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} monthly service entries")
        return success

    def test_delete_monthly_service(self, entry_id):
        """Delete monthly service entry"""
        success, response = self.run_test(
            "Delete Monthly Service Entry",
            "DELETE",
            f"api/monthly-services/{entry_id}",
            200
        )
        return success

    def test_create_cash_balance(self, month, year, amount):
        """Create or update cash balance"""
        success, response = self.run_test(
            f"Create Cash Balance ({month}/{year})",
            "POST",
            "api/cash-balance",
            200,
            data={
                "month": month,
                "year": year,
                "amount": amount
            }
        )
        if success:
            print(f"   Amount: {response.get('amount', 0)} UAH")
        return success

    def test_get_cash_balance(self, month, year):
        """Get cash balance for specific period"""
        success, response = self.run_test(
            f"Get Cash Balance ({month}/{year})",
            "GET",
            f"api/cash-balance/{month}/{year}",
            200
        )
        if success:
            exists = response.get('exists', False)
            if exists:
                print(f"   Amount: {response.get('data', {}).get('amount', 0)} UAH")
            else:
                print(f"   No cash balance found")
        return success

    def test_get_all_cash_balances(self):
        """Get all cash balances"""
        success, response = self.run_test(
            "Get All Cash Balances",
            "GET",
            "api/cash-balance",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} cash balance records")
        return success

    def test_create_shared_report(self, data):
        """Create shared report"""
        success, response = self.run_test(
            "Create Shared Report",
            "POST",
            "api/reports/share",
            200,
            data={"data": data}
        )
        if success and 'share_token' in response:
            print(f"   Share Token: {response['share_token']}")
            print(f"   Expires At: {response.get('expires_at', 'N/A')}")
            return response['share_token']
        return None

    def test_get_shared_report(self, share_token):
        """Get shared report by token"""
        success, response = self.run_test(
            f"Get Shared Report",
            "GET",
            f"api/reports/share/{share_token}",
            200
        )
        if success:
            print(f"   Days Left: {response.get('days_left', 0)}")
        return success


def main():
    print("=" * 60)
    print("🏥 ME of Ukraine MedTrack API Testing")
    print("=" * 60)
    
    tester = MedTrackAPITester()
    current_month = datetime.now().month
    current_year = datetime.now().year

    # Test 1: Root endpoint
    print("\n📍 PHASE 1: Basic Connectivity")
    if not tester.test_root():
        print("\n❌ Root API failed - stopping tests")
        return 1

    # Test 2: Doctors
    print("\n📍 PHASE 2: Doctor Management")
    doctor1_id = tester.test_create_doctor("Пепеляшко Лілія Миколаївна", "ПЛМ")
    doctor2_id = tester.test_create_doctor("Овсієнко Світлана Леонідівна", "ОСЛ")
    tester.test_get_doctors()

    if not doctor1_id or not doctor2_id:
        print("\n⚠️ Warning: Doctor creation failed")

    # Test 3: Services
    print("\n📍 PHASE 3: Paid Services")
    tester.test_create_service("Консультація лікаря", 500, 300, 50)
    tester.test_create_service("УЗД обстеження", 800, 500, 100)
    tester.test_create_service("ЕКГ", 300, 180, 30)
    tester.test_get_services()

    # Test 4: Incomes
    print("\n📍 PHASE 4: Income Records")
    if doctor1_id:
        tester.test_create_income(
            current_month,
            current_year,
            doctor1_id,
            {"0-5": 50, "6-17": 30, "18-39": 100, "40-64": 80, "65+": 40},
            450.0,
            135000.0,
            15000.0
        )
    if doctor2_id:
        tester.test_create_income(
            current_month,
            current_year,
            doctor2_id,
            {"0-5": 40, "6-17": 25, "18-39": 90, "40-64": 70, "65+": 35},
            450.0,
            117000.0,
            12000.0
        )
    tester.test_get_incomes()

    # Test 5: Expenses
    print("\n📍 PHASE 5: Expense Records")
    tester.test_create_expense(
        datetime.now().isoformat(),
        "Комунальні послуги",
        5000,
        "Оплата за електроенергію"
    )
    tester.test_create_expense(
        datetime.now().isoformat(),
        "Медикаменти та медтовари",
        12000,
        "Закупівля медикаментів"
    )
    tester.test_create_expense(
        datetime.now().isoformat(),
        "Інтернет",
        500,
        "Місячна оплата інтернету"
    )
    tester.test_get_expenses()

    # Test 6: Dashboard Stats
    print("\n📍 PHASE 6: Dashboard Statistics")
    tester.test_dashboard_stats(current_month, current_year)

    # Test 7: Documents
    print("\n📍 PHASE 7: Document Management")
    tester.test_get_documents()

    # Print summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed} ✅")
    print(f"Failed: {tester.tests_run - tester.tests_passed} ❌")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    # Save results to JSON
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed": tester.tests_passed,
        "failed": tester.tests_run - tester.tests_passed,
        "success_rate": round(tester.tests_passed / tester.tests_run * 100, 1),
        "test_details": tester.test_results
    }
    
    with open('/app/tests/backend_test_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print("\n💾 Results saved to: /app/tests/backend_test_results.json")
    print("=" * 60)
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
