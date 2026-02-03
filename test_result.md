#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Ukrainian medical practice management system for tracking income, expenses, taxes, and declarations (PMG) for multiple doctors"

backend:
  - task: "Update PMG calculation logic for unverified declarations"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Updated logic: total_patients = ALL declarations (patients_count), total_amount = ONLY verified (patients_count - not_verified) × coefficient × rate / 12. Changed not_verified from int to float to support decimal values (e.g., 4.5)."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: Backend correctly handles decimal unverified values (4.5, 6.5). API accepts float values and calculation logic works properly. Total declarations count includes ALL declarations while payment amount correctly subtracts unverified declarations. Save/update operations successful."

frontend:
  - task: "Update PMG form UI for unverified declarations"
    implemented: true
    working: true
    file: "/app/frontend/src/pages/PMGIncome.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Simplified form UI to 2 fields per age group: Декларацій (all) and Неверифіковані (decimal supported with step=0.1). Removed 3-column calculation display. Added hint explaining unverified count logic. Updated formTotalPatients to show all declarations, not subtract unverified. Changed updateNotVerifiedCount to use parseFloat for decimal support."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: UI correctly supports decimal input (4.5, 6.5, 0.5) with step=0.1. Total calculation shows 150 (100+50) including all declarations. 2-field layout implemented correctly. Form saves successfully and KPI cards update properly showing 'Активних декларацій: 150' and payment amount reflects verified calculations. Edge cases (0.5, 0) work correctly."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 4
  run_ui: true

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Updated unverified declarations logic per user requirements: 1) Allow decimal values (4.5, 6.5, etc) using step=0.1 in input. 2) Changed calculation: total_patients includes ALL declarations (not subtracting unverified), but total_amount only counts verified declarations (patients_count - not_verified) for payment. Backend model changed not_verified from int to float. Frontend simplified to 2-field layout per age group. Need to test: decimal input works, total patients shows full count, payment amount subtracts unverified correctly."
  - agent: "testing"
    message: "✅ COMPREHENSIVE TESTING COMPLETED: All unverified declarations logic working correctly. Key findings: 1) Decimal input (4.5, 6.5, 0.5) fully supported with step=0.1 attribute. 2) Total declarations correctly shows 150 (100+50) including ALL declarations. 3) KPI cards display properly: 'Активних декларацій: 150' and payment calculations reflect verified amounts only. 4) 2-field UI layout implemented correctly. 5) Save/edit functionality works with decimal values. 6) Edge cases (0.5, 0) handled properly. 7) No JavaScript errors or validation issues. The implementation matches all user requirements perfectly."