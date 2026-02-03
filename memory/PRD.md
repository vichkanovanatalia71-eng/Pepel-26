# MedPractice Hub - Product Requirements Document

## Original Problem Statement
The user, a Ukrainian sole proprietor (ФОП) running a medical practice, needs a full-stack application to replace their Excel-based system for financial management.

## Core Requirements

### 1. Paid Services Management ("Платні послуги")
- Manage ~22 paid services with detailed cost breakdowns
- Enter monthly service quantities per doctor
- Calculate revenue, doctor's income, organization's income, taxes
- Sorting, searching, bulk delete for monthly entries
- **Status**: ✅ Complete

### 2. PMG Income Management ("Дохід за ПМГ")
- Track income from National Health Service of Ukraine (НСЗУ)
- Display via KPI cards, charts, tables
- Filter by period (year/month) and doctor
- Active declarations show latest period data, not cumulative
- Edit/delete functionality per doctor entry
- **Status**: ✅ Complete

### 3. AI-Powered Data Entry
- Analyze НСЗУ dashboard images to populate declaration counts
- **Status**: ✅ Complete for PMG

### 4. Dashboard & Analytics
- 6 key metric cards
- Bank Account = Total Revenue - Cash on Hand
- Clickable cards with detailed modals
- **Status**: ✅ Partial (main dashboard complete)

### 5. Settings ("Налаштування")
- Services management
- Doctors management
- Capitation rates and coefficients
- **Status**: ✅ Complete

### 6. UI/UX Requirements
- Dark-themed, futuristic design with neon orange accents
- Mobile-responsive design
- **Status**: ✅ Complete

## Technical Stack
- **Backend**: FastAPI, MongoDB (motor), Python
- **Frontend**: React, Axios, Recharts, Shadcn UI
- **AI**: Gemini Vision via emergentintegrations

## Database Schema
- `doctors`: `{id, name}`
- `services`: `{id, code, name, price, cost_breakdown}`
- `monthly_service_entries`: `{...}`
- `pmg_declarations`: `{..., declaration_counts: [{..., not_verified: float}]}`
- `pmg_settings`: `{ capitation_rate: float, age_groups: [{label, coefficient}] }`

## Key Routes
- `/` → Dashboard
- `/monthly-services` → Paid Services
- `/incomes` → PMG Income
- `/expenses` → Expenses
- `/services` → Services Settings
- `/doctors` → Doctors Settings
- `/pmg-settings` → PMG Settings

## What's Been Implemented

### Session: February 2026
- ✅ Fixed mobile responsiveness for ALL pages:
  - "Дохід за ПМГ" (Incomes)
  - "Платні послуги" (Monthly Services)
  - "Послуги" (Services)
  - "Налаштування ПМГ" (PMG Settings)
  - "Головна" (Dashboard)
- ✅ Fixed modal window for declaration entry on mobile:
  - Full-screen modal on mobile devices
  - Vertical layout for form elements
  - All buttons visible with proper scrolling
- ✅ Added `overflow-x: hidden` globally to prevent horizontal scroll
- ✅ All pages: bodyWidth = windowWidth (no overflow)

## Known Issues
- **PDF Export**: Blocked due to Cyrillic character rendering issues with jsPDF

## Upcoming Tasks (P1)
- AI-Powered Service Entry for Paid Services
- Implement "Дохід організації" Modal

## Future Tasks (P2)
- Implement full "Витрати" (Expenses) Page
- Implement "Документи" (Documents) Page  
- Implement "Лікарі" (Doctors) full CRUD

## Refactoring Backlog
- Split `server.py` into multiple router files (currently ~1500+ lines)
