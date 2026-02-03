from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
import tempfile
import io
from gridfs import GridFS
from bson import ObjectId
import pymongo
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_CENTER, TA_LEFT

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
sync_client = pymongo.MongoClient(mongo_url)
sync_db = sync_client[os.environ['DB_NAME']]
fs = GridFS(sync_db)

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==== MODELS ====

class Doctor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    short_name: str  # ОСЛ, ПЛМ
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DoctorCreate(BaseModel):
    name: str
    short_name: str

class ServiceExpenseItem(BaseModel):
    """Деталізація витрат для послуги"""
    material_name: str  # Назва матеріалу
    quantity: float  # Кількість
    unit: str  # Одиниця виміру (шт, пара, мл)
    price_per_unit: float  # Ціна за одиницю
    total_cost: float  # Загальна вартість

class PaidService(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: Optional[str] = None  # Код послуги
    name: str
    price: float  # Ціна для клієнта
    doctor_share: float = 0.0  # Кошти лікаря за послугу
    expense_items: List[ServiceExpenseItem] = Field(default_factory=list)  # Деталізація витрат
    total_expenses: float = 0.0  # Загальні витрати (автоматично)
    expenses_with_tax: float = 0.0  # Витрати+ЄП+ВЗ (автоматично)
    fop_income: float = 0.0  # Дохід ФОП (автоматично)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaidServiceCreate(BaseModel):
    code: Optional[str] = None
    name: str
    price: float
    expense_items: List[ServiceExpenseItem] = Field(default_factory=list)
    # doctor_share видалено - розраховується автоматично

class Income(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    month: int
    year: int
    doctor_id: str
    declarations: Dict[str, int] = Field(default_factory=dict)  # {"0-5": 10, "6-17": 20, ...}
    capitalization_rate: float = 0.0
    total_nhs_income: float = 0.0  # Дохід від НСЗУ
    paid_services_income: float = 0.0  # Дохід від платних послуг
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class IncomeCreate(BaseModel):
    month: int
    year: int
    doctor_id: str
    declarations: Dict[str, int] = Field(default_factory=dict)
    capitalization_rate: float = 0.0
    total_nhs_income: float = 0.0
    paid_services_income: float = 0.0

class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: datetime
    category: str
    amount: float
    description: str = ""
    document_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ExpenseCreate(BaseModel):
    date: datetime
    category: str
    amount: float
    description: str = ""
    document_id: Optional[str] = None

class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # "nhs_report", "expense", "declaration_chart"
    file_name: str
    file_id: str  # GridFS file ID
    month: Optional[int] = None
    year: Optional[int] = None
    ai_analysis: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DocumentResponse(BaseModel):
    id: str
    type: str
    file_name: str
    month: Optional[int] = None
    year: Optional[int] = None
    ai_analysis: Optional[Dict[str, Any]] = None
    created_at: datetime

class MonthlyServiceEntry(BaseModel):
    """Щомісячний облік кількості послуг по лікарях"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    month: int
    year: int
    service_id: str
    doctor_id: str
    quantity: int
    # Автоматично розраховувані поля
    total_revenue: float = 0.0  # Загальний дохід (що оплатив клієнт)
    doctor_income: float = 0.0  # Дохід лікаря
    total_expenses: float = 0.0  # Загальні витрати
    fop_income: float = 0.0  # Дохід ФОП
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MonthlyServiceEntryCreate(BaseModel):
    month: int
    year: int
    service_id: str
    doctor_id: str
    quantity: int

class CashBalance(BaseModel):
    """Готівка в касі на кінець місяця"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    month: int
    year: int
    amount: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CashBalanceCreate(BaseModel):
    month: int
    year: int
    amount: float

class BankBalance(BaseModel):
    """Залишок на банківському рахунку на кінець місяця"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    month: int
    year: int
    amount: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BankBalanceCreate(BaseModel):
    month: int
    year: int
    amount: float

# ====== ПМГ (Декларації) Models ======

class AgeGroupData(BaseModel):
    """Дані за віковою групою"""
    age_group: str  # "0-5", "6-17", "18-39", "40-64", "65+"
    patients_count: int = 0
    not_verified: int = 0
    coefficient: float = 1.0
    amount: float = 0.0

class DoctorDeclarationData(BaseModel):
    """Дані декларацій по лікарю"""
    doctor_id: str
    doctor_name: str
    age_groups: List[AgeGroupData] = []
    total_patients: int = 0
    total_amount: float = 0.0

class PMGDeclaration(BaseModel):
    """Місячний звіт ПМГ декларацій"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    month: int
    year: int
    capitation_rate: float = 1007.3  # Капітаційна ставка
    doctors_data: List[DoctorDeclarationData] = []
    total_patients: int = 0
    total_amount: float = 0.0
    ep_rate: float = 0.05  # ЄП 5%
    vz_rate: float = 0.01  # ВЗ 1%
    total_ep: float = 0.0
    total_vz: float = 0.0
    net_amount: float = 0.0  # Чиста сума після податків
    source: str = "manual"  # "manual" або "pdf"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PMGDeclarationCreate(BaseModel):
    month: int
    year: int
    capitation_rate: float = 1007.3
    doctors_data: List[Dict[str, Any]] = []

class SharedReport(BaseModel):
    """Поширений звіт з обмеженим доступом"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    share_token: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])
    data: Dict[str, Any]  # Всі дані звіту
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(day=datetime.now(timezone.utc).day) + timedelta(days=30))

class SharedReportCreate(BaseModel):
    data: Dict[str, Any]

# ==== HELPER FUNCTIONS ====

async def analyze_document_with_ai(file_path: str, file_type: str, doc_type: str) -> Dict[str, Any]:
    """
    Аналізує документ за допомогою AI
    """
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"doc-analysis-{uuid.uuid4()}",
            system_message="Ти експерт з аналізу медичних фінансових документів. Витягуй структуровані дані з документів українською мовою."
        ).with_model("gemini", "gemini-2.5-flash")
        
        file_content = FileContentWithMimeType(
            file_path=file_path,
            mime_type=file_type
        )
        
        prompt = ""
        if doc_type == "nhs_report":
            prompt = """Проаналізуй цей звіт НСЗУ та витягни:
1. Кількість декларацій по кожному лікарю
2. Розподіл по віковим групам (0-5, 6-17, 18-39, 40-64, 65+)
3. Загальні суми
4. Місяць та рік звіту

Поверни дані у форматі JSON."""
        elif doc_type == "declaration_chart":
            prompt = """Проаналізуй це зображення графіка декларацій та витягни:
1. Ім'я лікаря
2. Кількість декларацій
3. Розподіл по віковим групам (якщо видно)

Поверни дані у форматі JSON."""
        elif doc_type == "expense":
            prompt = """Проаналізуй цей документ витрат та витягни:
1. Дата
2. Категорія витрат
3. Сума (усі суми)
4. Опис кожної витрати

Поверни дані у форматі JSON зі списком витрат."""
        
        message = UserMessage(
            text=prompt,
            file_contents=[file_content]
        )
        
        response = await chat.send_message(message)
        
        return {
            "success": True,
            "analysis": response,
            "raw_text": response
        }
    except Exception as e:
        logging.error(f"AI analysis error: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

# ==== API ROUTES ====

@api_router.get("/")
async def root():
    return {"message": "ME of Ukraine MedTrack API"}

# Doctors
@api_router.post("/doctors", response_model=Doctor)
async def create_doctor(doctor: DoctorCreate):
    # Check if doctor with same short_name already exists
    existing = await db.doctors.find_one({"short_name": doctor.short_name})
    if existing:
        raise HTTPException(status_code=400, detail=f"Doctor with short_name '{doctor.short_name}' already exists")
    
    doc_obj = Doctor(**doctor.model_dump())
    doc_dict = doc_obj.model_dump()
    doc_dict['created_at'] = doc_dict['created_at'].isoformat()
    await db.doctors.insert_one(doc_dict)
    return doc_obj

@api_router.get("/doctors", response_model=List[Doctor])
async def get_doctors():
    doctors = await db.doctors.find({}, {"_id": 0}).to_list(1000)
    for doc in doctors:
        if isinstance(doc['created_at'], str):
            doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    return doctors

# Paid Services
@api_router.post("/services", response_model=PaidService)
async def create_service(service: PaidServiceCreate):
    # Розрахунок загальних витрат
    total_expenses = sum(item.total_cost for item in service.expense_items)
    
    # Розрахунок податків: ЄП (5%) + ВЗ (1%) = 6%
    ep = service.price * 0.05  # ЄП 5%
    vz = service.price * 0.01  # ВЗ 1%
    ep_vz = ep + vz
    
    # Розрахунок витрат з податками
    expenses_with_tax = total_expenses + ep_vz
    
    # Формула: Дохід після податків = Ціна - Витрати - ЄП - ВЗ
    income_after_tax = service.price - total_expenses - ep_vz
    
    # Кошти лікаря = (Дохід після податків) / 2
    doctor_share = income_after_tax / 2
    
    # Дохід організації = (Дохід після податків) / 2
    organization_income = income_after_tax / 2
    
    service_obj = PaidService(
        code=service.code,
        name=service.name,
        price=service.price,
        doctor_share=doctor_share,
        expense_items=service.expense_items,
        total_expenses=total_expenses,
        expenses_with_tax=expenses_with_tax,
        fop_income=organization_income
    )
    service_dict = service_obj.model_dump()
    service_dict['created_at'] = service_dict['created_at'].isoformat()
    await db.services.insert_one(service_dict)
    return service_obj

@api_router.get("/services", response_model=List[PaidService])
async def get_services():
    services = await db.services.find({}, {"_id": 0}).to_list(1000)
    for service in services:
        if isinstance(service['created_at'], str):
            service['created_at'] = datetime.fromisoformat(service['created_at'])
    return services

@api_router.get("/services/{service_id}", response_model=PaidService)
async def get_service(service_id: str):
    service = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    if isinstance(service['created_at'], str):
        service['created_at'] = datetime.fromisoformat(service['created_at'])
    return service

@api_router.put("/services/{service_id}", response_model=PaidService)
async def update_service(service_id: str, service: PaidServiceCreate):
    # Розрахунок
    total_expenses = sum(item.total_cost for item in service.expense_items)
    ep = service.price * 0.05
    vz = service.price * 0.01
    ep_vz = ep + vz
    expenses_with_tax = total_expenses + ep_vz
    income_after_tax = service.price - total_expenses - ep_vz
    doctor_share = income_after_tax / 2
    organization_income = income_after_tax / 2
    
    service_dict = {
        'code': service.code,
        'name': service.name,
        'price': service.price,
        'doctor_share': doctor_share,
        'expense_items': [item.model_dump() for item in service.expense_items],
        'total_expenses': total_expenses,
        'expenses_with_tax': expenses_with_tax,
        'fop_income': organization_income
    }
    
    await db.services.update_one({"id": service_id}, {"$set": service_dict})
    updated_service = await db.services.find_one({"id": service_id}, {"_id": 0})
    if isinstance(updated_service['created_at'], str):
        updated_service['created_at'] = datetime.fromisoformat(updated_service['created_at'])
    return updated_service

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str):
    result = await db.services.delete_one({"id": service_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"success": True, "message": "Service deleted"}

# Incomes
@api_router.post("/incomes", response_model=Income)
async def create_income(income: IncomeCreate):
    income_obj = Income(**income.model_dump())
    income_dict = income_obj.model_dump()
    income_dict['created_at'] = income_dict['created_at'].isoformat()
    await db.incomes.insert_one(income_dict)
    return income_obj

@api_router.get("/incomes", response_model=List[Income])
async def get_incomes(month: Optional[int] = None, year: Optional[int] = None, doctor_id: Optional[str] = None):
    query = {}
    if month:
        query['month'] = month
    if year:
        query['year'] = year
    if doctor_id:
        query['doctor_id'] = doctor_id
    
    incomes = await db.incomes.find(query, {"_id": 0}).to_list(1000)
    for income in incomes:
        if isinstance(income['created_at'], str):
            income['created_at'] = datetime.fromisoformat(income['created_at'])
    return incomes

# Expenses
@api_router.post("/expenses", response_model=Expense)
async def create_expense(expense: ExpenseCreate):
    expense_obj = Expense(**expense.model_dump())
    expense_dict = expense_obj.model_dump()
    expense_dict['date'] = expense_dict['date'].isoformat()
    expense_dict['created_at'] = expense_dict['created_at'].isoformat()
    await db.expenses.insert_one(expense_dict)
    return expense_obj

@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses(month: Optional[int] = None, year: Optional[int] = None):
    query = {}
    if month and year:
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        query['date'] = {"$gte": start_date.isoformat(), "$lt": end_date.isoformat()}
    
    expenses = await db.expenses.find(query, {"_id": 0}).to_list(1000)
    for expense in expenses:
        if isinstance(expense['date'], str):
            expense['date'] = datetime.fromisoformat(expense['date'])
        if isinstance(expense['created_at'], str):
            expense['created_at'] = datetime.fromisoformat(expense['created_at'])
    return expenses

# Monthly Service Entries
@api_router.post("/monthly-services", response_model=MonthlyServiceEntry)
async def create_monthly_service(entry: MonthlyServiceEntryCreate):
    # Отримати послугу для розрахунків
    service = await db.services.find_one({"id": entry.service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Розрахунки
    total_revenue = entry.quantity * service['price']
    doctor_income = entry.quantity * service['doctor_share']
    total_expenses = entry.quantity * service['total_expenses']
    fop_income = entry.quantity * service['fop_income']
    
    entry_obj = MonthlyServiceEntry(
        **entry.model_dump(),
        total_revenue=total_revenue,
        doctor_income=doctor_income,
        total_expenses=total_expenses,
        fop_income=fop_income
    )
    entry_dict = entry_obj.model_dump()
    entry_dict['created_at'] = entry_dict['created_at'].isoformat()
    await db.monthly_services.insert_one(entry_dict)
    return entry_obj

@api_router.get("/monthly-services", response_model=List[MonthlyServiceEntry])
async def get_monthly_services(month: Optional[int] = None, year: Optional[int] = None, doctor_id: Optional[str] = None):
    query = {}
    if month:
        query['month'] = month
    if year:
        query['year'] = year
    if doctor_id:
        query['doctor_id'] = doctor_id
    
    entries = await db.monthly_services.find(query, {"_id": 0}).to_list(1000)
    for entry in entries:
        if isinstance(entry['created_at'], str):
            entry['created_at'] = datetime.fromisoformat(entry['created_at'])
    return entries

@api_router.get("/monthly-services/summary")
async def get_monthly_services_summary(month: int, year: int, doctor_id: Optional[str] = None):
    """Підсумки по послугах за місяць"""
    query = {"month": month, "year": year}
    if doctor_id:
        query['doctor_id'] = doctor_id
    
    entries = await db.monthly_services.find(query, {"_id": 0}).to_list(1000)
    
    # Агрегація
    total_revenue = sum(e.get('total_revenue', 0) for e in entries)
    total_doctor_income = sum(e.get('doctor_income', 0) for e in entries)
    total_expenses = sum(e.get('total_expenses', 0) for e in entries)
    total_fop_income = sum(e.get('fop_income', 0) for e in entries)
    total_quantity = sum(e.get('quantity', 0) for e in entries)
    
    return {
        "month": month,
        "year": year,
        "doctor_id": doctor_id,
        "total_services": len(entries),
        "total_quantity": total_quantity,
        "total_revenue": total_revenue,
        "total_doctor_income": total_doctor_income,
        "total_expenses": total_expenses,
        "total_fop_income": total_fop_income
    }

@api_router.put("/monthly-services/{entry_id}", response_model=MonthlyServiceEntry)
async def update_monthly_service(entry_id: str, quantity: int):
    """Оновити кількість послуг"""
    entry = await db.monthly_services.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    service = await db.services.find_one({"id": entry['service_id']}, {"_id": 0})
    
    # Перерахунок
    total_revenue = quantity * service['price']
    doctor_income = quantity * service['doctor_share']
    total_expenses = quantity * service['total_expenses']
    fop_income = quantity * service['fop_income']
    
    await db.monthly_services.update_one(
        {"id": entry_id}, 
        {"$set": {
            "quantity": quantity,
            "total_revenue": total_revenue,
            "doctor_income": doctor_income,
            "total_expenses": total_expenses,
            "fop_income": fop_income
        }}
    )
    
    updated_entry = await db.monthly_services.find_one({"id": entry_id}, {"_id": 0})
    if isinstance(updated_entry['created_at'], str):
        updated_entry['created_at'] = datetime.fromisoformat(updated_entry['created_at'])
    return updated_entry

@api_router.delete("/monthly-services/{entry_id}")
async def delete_monthly_service(entry_id: str):
    result = await db.monthly_services.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"success": True, "message": "Entry deleted"}

# Document Upload with AI Analysis
@api_router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form(...),  # "nhs_report", "expense", "declaration_chart"
    month: Optional[int] = Form(None),
    year: Optional[int] = Form(None)
):
    try:
        # Read file
        contents = await file.read()
        
        # Save to GridFS
        file_id = fs.put(contents, filename=file.filename)
        
        # Save to temp file for AI analysis
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        
        # Determine MIME type
        mime_type = file.content_type or "application/octet-stream"
        
        # AI Analysis
        ai_result = await analyze_document_with_ai(tmp_path, mime_type, doc_type)
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        # Create document record
        doc = Document(
            type=doc_type,
            file_name=file.filename,
            file_id=str(file_id),
            month=month,
            year=year,
            ai_analysis=ai_result
        )
        
        doc_dict = doc.model_dump()
        doc_dict['created_at'] = doc_dict['created_at'].isoformat()
        await db.documents.insert_one(doc_dict)
        
        return {
            "success": True,
            "document_id": doc.id,
            "ai_analysis": ai_result
        }
    except Exception as e:
        logging.error(f"Document upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/documents", response_model=List[DocumentResponse])
async def get_documents(doc_type: Optional[str] = None, month: Optional[int] = None, year: Optional[int] = None):
    query = {}
    if doc_type:
        query['type'] = doc_type
    if month:
        query['month'] = month
    if year:
        query['year'] = year
    
    documents = await db.documents.find(query, {"_id": 0, "file_id": 0}).to_list(1000)
    for doc in documents:
        if isinstance(doc['created_at'], str):
            doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    return documents

@api_router.get("/documents/{document_id}/download")
async def download_document(document_id: str):
    doc = await db.documents.find_one({"id": document_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        file_data = fs.get(ObjectId(doc['file_id']))
        return StreamingResponse(
            io.BytesIO(file_data.read()),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={doc['file_name']}"}
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail="File not found")

# Dashboard Stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(month: int, year: int):
    # Get incomes
    incomes = await db.incomes.find({"month": month, "year": year}, {"_id": 0}).to_list(1000)
    total_income = sum(inc.get('total_nhs_income', 0) + inc.get('paid_services_income', 0) for inc in incomes)
    
    # Get expenses
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    expenses = await db.expenses.find({
        "date": {"$gte": start_date.isoformat(), "$lt": end_date.isoformat()}
    }, {"_id": 0}).to_list(1000)
    total_expenses = sum(exp.get('amount', 0) for exp in expenses)
    
    # Calculate net profit
    net_profit = total_income - total_expenses
    
    # Get total declarations
    total_declarations = 0
    for inc in incomes:
        declarations = inc.get('declarations', {})
        total_declarations += sum(declarations.values())
    
    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net_profit": net_profit,
        "total_declarations": total_declarations,
        "month": month,
        "year": year
    }

# AI Analytics for Revenue
@api_router.post("/analytics/revenue-insights")
async def get_revenue_insights(data: Dict[str, Any]):
    """AI аналіз обороту та прогнозування"""
    try:
        # Підготовка даних для AI
        services_summary = "\n".join([
            f"{s['code']} {s['name']}: {s['quantity']} шт, {s['revenue']}₴"
            for s in data.get('services', [])[:10]
        ])
        
        monthly_data = "\n".join([
            f"{m['month']}/{m['year']}: {m['revenue']}₴"
            for m in data.get('monthly', [])
        ])
        
        stats = data.get('stats', {})
        
        prompt = f"""Проаналізуй фінансові дані медичного ФОП та надай інсайти українською мовою:

ЗАГАЛЬНА СТАТИСТИКА:
- Оборот: {stats.get('total_revenue', 0)}₴
- Кількість послуг: {stats.get('total_quantity', 0)}
- Дохід лікарів: {stats.get('total_doctor_income', 0)}₴
- Витрати: {stats.get('total_expenses', 0)}₴
- Дохід організації: {stats.get('total_fop_income', 0)}₴

ТОП ПОСЛУГИ:
{services_summary}

ДИНАМІКА ПО МІСЯЦЯХ:
{monthly_data}

Надай:
1. ПРОГНОЗ на наступний місяць (діапазон мін-макс)
2. 3-5 КЛЮЧОВИХ ІНСАЙТІВ (що добре, що погано, тренди)
3. 3-5 РЕКОМЕНДАЦІЙ для збільшення обороту
4. АНОМАЛІЇ якщо є (різкі зміни, незвичайні показники)

Відповідай структуровано у форматі JSON:
{{
  "forecast": {{
    "next_month_min": 95000,
    "next_month_max": 115000,
    "expected": 105000,
    "confidence": "висока"
  }},
  "insights": [
    "Оборот стабільно зростає на 15% щомісяця",
    "Послуга 012 (Спеціаліст) приносить найбільше доходу",
    ...
  ],
  "recommendations": [
    "Збільшити кількість консультацій спеціаліста - висока маржинальність",
    "Промо акція на послуги з низьким попитом",
    ...
  ],
  "anomalies": [
    "Різке зростання у лютому на 58% - перевірити причину"
  ]
}}"""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"analytics-{uuid.uuid4()}",
            system_message="Ти експерт фінансовий аналітик для медичного бізнесу. Аналізуй дані та давай практичні рекомендації українською мовою."
        ).with_model("gemini", "gemini-2.5-flash")
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        # Парсинг JSON з відповіді
        import json
        import re
        
        # Витягти JSON з відповіді
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            analysis = json.loads(json_match.group())
        else:
            # Fallback якщо AI не повернув JSON
            analysis = {
                "forecast": {
                    "next_month_min": int(stats.get('total_revenue', 0) * 0.9),
                    "next_month_max": int(stats.get('total_revenue', 0) * 1.1),
                    "expected": stats.get('total_revenue', 0),
                    "confidence": "середня"
                },
                "insights": ["Аналіз виконується..."],
                "recommendations": ["Продовжуйте надавати якісні послуги"],
                "anomalies": []
            }
        
        return {
            "success": True,
            "insights": analysis.get('insights', []),
            "recommendations": analysis.get('recommendations', []),
            "forecast": analysis.get('forecast', {}),
            "anomalies": analysis.get('anomalies', [])
        }
        
    except Exception as e:
        logging.error(f"AI analytics error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "insights": [],
            "recommendations": [],
            "forecast": None,
            "anomalies": []
        }

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(month: int, year: int):
    # Get incomes
    incomes = await db.incomes.find({"month": month, "year": year}, {"_id": 0}).to_list(1000)
    total_income = sum(inc.get('total_nhs_income', 0) + inc.get('paid_services_income', 0) for inc in incomes)
    
    # Get expenses
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    expenses = await db.expenses.find({
        "date": {"$gte": start_date.isoformat(), "$lt": end_date.isoformat()}
    }, {"_id": 0}).to_list(1000)
    total_expenses = sum(exp.get('amount', 0) for exp in expenses)
    
    # Calculate net profit
    net_profit = total_income - total_expenses
    
    # Get total declarations
    total_declarations = 0
    for inc in incomes:
        declarations = inc.get('declarations', {})
        total_declarations += sum(declarations.values())
    
    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net_profit": net_profit,
        "total_declarations": total_declarations,
        "month": month,
        "year": year
    }

# PDF Export endpoint
@api_router.post("/export/revenue-pdf")
async def export_revenue_pdf(data: Dict[str, Any]):
    """Генерація PDF звіту з українським текстом"""
    try:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        elements = []
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#FF8C00'),
            alignment=TA_CENTER,
            spaceAfter=12
        )
        
        # Заголовок
        elements.append(Paragraph('Статистика обороту', title_style))
        elements.append(Spacer(1, 6*mm))
        
        stats = data.get('stats', {})
        services = data.get('services', [])
        doctors = data.get('doctors', [])
        
        # Загальна інформація
        summary_text = f"""
        <para alignment='left'>
        <b>Оборот:</b> {stats.get('total_revenue', 0):,.0f} ₴ | 
        <b>Послуг:</b> {stats.get('total_quantity', 0)} | 
        <b>Середній чек:</b> {stats.get('avg_check', 0):.0f} ₴
        </para>
        """
        elements.append(Paragraph(summary_text, styles['Normal']))
        elements.append(Spacer(1, 6*mm))
        
        # Топ-5 послуг
        if services:
            elements.append(Paragraph('<b>🏆 Топ-5 послуг:</b>', styles['Heading2']))
            elements.append(Spacer(1, 3*mm))
            
            table_data = [['#', 'Код', 'Назва', 'К-ть', 'Оборот', '%']]
            for i, service in enumerate(services[:5], 1):
                percent = (service['revenue'] / stats['total_revenue'] * 100) if stats.get('total_revenue', 0) > 0 else 0
                table_data.append([
                    str(i),
                    service['code'],
                    service['name'][:30],
                    str(service['quantity']),
                    f"{service['revenue']:,.0f} ₴",
                    f"{percent:.1f}%"
                ])
            
            t = Table(table_data, colWidths=[10*mm, 15*mm, 60*mm, 20*mm, 30*mm, 20*mm])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FF8C00')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
            ]))
            elements.append(t)
            elements.append(Spacer(1, 6*mm))
        
        # По лікарях
        if doctors:
            elements.append(Paragraph('<b>👥 По лікарях:</b>', styles['Heading2']))
            elements.append(Spacer(1, 3*mm))
            
            table_data = [['Лікар', 'Оборот', 'Послуг', '%']]
            for doctor in doctors:
                percent = (doctor['revenue'] / stats['total_revenue'] * 100) if stats.get('total_revenue', 0) > 0 else 0
                table_data.append([
                    doctor['short_name'],
                    f"{doctor['revenue']:,.0f} ₴",
                    str(doctor['quantity']),
                    f"{percent:.1f}%"
                ])
            
            t = Table(table_data, colWidths=[40*mm, 40*mm, 30*mm, 30*mm])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FF8C00')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
            ]))
            elements.append(t)
            elements.append(Spacer(1, 6*mm))
        
        # Footer
        footer_text = f"<para alignment='center'>Створено: {datetime.now().strftime('%d.%m.%Y %H:%M')}<br/>ME of Ukraine MedTrack</para>"
        elements.append(Spacer(1, 10*mm))
        elements.append(Paragraph(footer_text, styles['Normal']))
        
        doc.build(elements)
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=Statystyka_Oborot_{datetime.now().strftime('%Y-%m-%d')}.pdf"}
        )
        
    except Exception as e:
        logging.error(f"PDF generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Cash Balance
@api_router.get("/cash-balance", response_model=List[CashBalance])
async def get_all_cash_balances():
    balances = await db.cash_balance.find({}, {"_id": 0}).to_list(1000)
    for balance in balances:
        if isinstance(balance.get('created_at'), str):
            balance['created_at'] = datetime.fromisoformat(balance['created_at'])
        if isinstance(balance.get('updated_at'), str):
            balance['updated_at'] = datetime.fromisoformat(balance['updated_at'])
    return balances

@api_router.post("/cash-balance", response_model=CashBalance)
async def create_or_update_cash_balance(data: CashBalanceCreate):
    # Перевірити чи вже є запис
    existing = await db.cash_balance.find_one({"month": data.month, "year": data.year}, {"_id": 0})
    
    if existing:
        # Оновити
        await db.cash_balance.update_one(
            {"month": data.month, "year": data.year},
            {"$set": {"amount": data.amount, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        updated = await db.cash_balance.find_one({"month": data.month, "year": data.year}, {"_id": 0})
        if isinstance(updated['created_at'], str):
            updated['created_at'] = datetime.fromisoformat(updated['created_at'])
        if isinstance(updated['updated_at'], str):
            updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
        return updated
    else:
        # Створити новий
        balance = CashBalance(**data.model_dump())
        balance_dict = balance.model_dump()
        balance_dict['created_at'] = balance_dict['created_at'].isoformat()
        balance_dict['updated_at'] = balance_dict['updated_at'].isoformat()
        await db.cash_balance.insert_one(balance_dict)
        return balance

@api_router.get("/cash-balance/{month}/{year}")
async def get_cash_balance(month: int, year: int):
    balance = await db.cash_balance.find_one({"month": month, "year": year}, {"_id": 0})
    if not balance:
        return {"exists": False, "amount": None}
    
    if isinstance(balance.get('created_at'), str):
        balance['created_at'] = datetime.fromisoformat(balance['created_at'])
    if isinstance(balance.get('updated_at'), str):
        balance['updated_at'] = datetime.fromisoformat(balance['updated_at'])
    
    return {"exists": True, "data": balance}

# Bank Balance API
@api_router.get("/bank-balance", response_model=List[BankBalance])
async def get_all_bank_balances():
    balances = await db.bank_balance.find({}, {"_id": 0}).to_list(1000)
    for balance in balances:
        if isinstance(balance.get('created_at'), str):
            balance['created_at'] = datetime.fromisoformat(balance['created_at'])
        if isinstance(balance.get('updated_at'), str):
            balance['updated_at'] = datetime.fromisoformat(balance['updated_at'])
    return balances

@api_router.post("/bank-balance", response_model=BankBalance)
async def create_or_update_bank_balance(data: BankBalanceCreate):
    # Перевірити чи вже є запис
    existing = await db.bank_balance.find_one({"month": data.month, "year": data.year}, {"_id": 0})
    
    if existing:
        # Оновити
        await db.bank_balance.update_one(
            {"month": data.month, "year": data.year},
            {"$set": {"amount": data.amount, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        updated = await db.bank_balance.find_one({"month": data.month, "year": data.year}, {"_id": 0})
        if isinstance(updated['created_at'], str):
            updated['created_at'] = datetime.fromisoformat(updated['created_at'])
        if isinstance(updated['updated_at'], str):
            updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
        return updated
    else:
        # Створити новий
        balance = BankBalance(**data.model_dump())
        balance_dict = balance.model_dump()
        balance_dict['created_at'] = balance_dict['created_at'].isoformat()
        balance_dict['updated_at'] = balance_dict['updated_at'].isoformat()
        await db.bank_balance.insert_one(balance_dict)
        return balance

@api_router.get("/bank-balance/{month}/{year}")
async def get_bank_balance(month: int, year: int):
    balance = await db.bank_balance.find_one({"month": month, "year": year}, {"_id": 0})
    if not balance:
        return {"exists": False, "amount": None}
    
    if isinstance(balance.get('created_at'), str):
        balance['created_at'] = datetime.fromisoformat(balance['created_at'])
    if isinstance(balance.get('updated_at'), str):
        balance['updated_at'] = datetime.fromisoformat(balance['updated_at'])
    
    return {"exists": True, "data": balance}

# ====== PMG Declarations API ======

@api_router.get("/pmg-declarations")
async def get_all_pmg_declarations():
    """Отримати всі ПМГ декларації"""
    declarations = await db.pmg_declarations.find({}, {"_id": 0}).to_list(1000)
    for decl in declarations:
        if isinstance(decl.get('created_at'), str):
            decl['created_at'] = datetime.fromisoformat(decl['created_at'])
        if isinstance(decl.get('updated_at'), str):
            decl['updated_at'] = datetime.fromisoformat(decl['updated_at'])
    return declarations

@api_router.get("/pmg-declarations/{month}/{year}")
async def get_pmg_declaration(month: int, year: int):
    """Отримати ПМГ декларацію за місяць/рік"""
    decl = await db.pmg_declarations.find_one({"month": month, "year": year}, {"_id": 0})
    if not decl:
        return {"exists": False, "data": None}
    
    if isinstance(decl.get('created_at'), str):
        decl['created_at'] = datetime.fromisoformat(decl['created_at'])
    if isinstance(decl.get('updated_at'), str):
        decl['updated_at'] = datetime.fromisoformat(decl['updated_at'])
    
    return {"exists": True, "data": decl}

@api_router.post("/pmg-declarations")
async def create_or_update_pmg_declaration(data: PMGDeclarationCreate):
    """Створити або оновити ПМГ декларацію"""
    # Розрахувати totals
    total_patients = 0
    total_amount = 0.0
    
    for doctor_data in data.doctors_data:
        doctor_total = 0
        doctor_amount = 0.0
        
        for age_group in doctor_data.get('age_groups', []):
            patients = age_group.get('patients_count', 0)
            not_verified = age_group.get('not_verified', 0)
            # Враховуємо тільки верифіковані декларації для розрахунків
            verified_patients = patients - not_verified
            coeff = age_group.get('coefficient', 1.0)
            amount = verified_patients * data.capitation_rate * coeff / 12  # Місячна ставка
            age_group['amount'] = round(amount, 2)
            doctor_total += verified_patients
            doctor_amount += amount
        
        doctor_data['total_patients'] = doctor_total
        doctor_data['total_amount'] = round(doctor_amount, 2)
        total_patients += doctor_total
        total_amount += doctor_amount
    
    total_ep = total_amount * 0.05
    total_vz = total_amount * 0.01
    net_amount = total_amount - total_ep - total_vz
    
    # Перевірити чи існує
    existing = await db.pmg_declarations.find_one({"month": data.month, "year": data.year}, {"_id": 0})
    
    if existing:
        # Оновити
        await db.pmg_declarations.update_one(
            {"month": data.month, "year": data.year},
            {"$set": {
                "capitation_rate": data.capitation_rate,
                "doctors_data": data.doctors_data,
                "total_patients": total_patients,
                "total_amount": round(total_amount, 2),
                "total_ep": round(total_ep, 2),
                "total_vz": round(total_vz, 2),
                "net_amount": round(net_amount, 2),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        updated = await db.pmg_declarations.find_one({"month": data.month, "year": data.year}, {"_id": 0})
        return updated
    else:
        # Створити новий
        decl = PMGDeclaration(
            month=data.month,
            year=data.year,
            capitation_rate=data.capitation_rate,
            doctors_data=data.doctors_data,
            total_patients=total_patients,
            total_amount=round(total_amount, 2),
            total_ep=round(total_ep, 2),
            total_vz=round(total_vz, 2),
            net_amount=round(net_amount, 2),
            source="manual"
        )
        decl_dict = decl.model_dump()
        decl_dict['created_at'] = decl_dict['created_at'].isoformat()
        decl_dict['updated_at'] = decl_dict['updated_at'].isoformat()
        await db.pmg_declarations.insert_one(decl_dict)
        return decl_dict

@api_router.delete("/pmg-declarations/{month}/{year}")
async def delete_pmg_declaration(month: int, year: int):
    """Видалити ПМГ декларацію за період"""
    result = await db.pmg_declarations.delete_one({"month": month, "year": year})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Декларацію не знайдено")
    return {"success": True}

@api_router.delete("/pmg-declarations/{month}/{year}/{doctor_id}")
async def delete_doctor_from_declaration(month: int, year: int, doctor_id: str):
    """Видалити дані лікаря з ПМГ декларації"""
    existing = await db.pmg_declarations.find_one({"month": month, "year": year}, {"_id": 0})
    
    if not existing:
        raise HTTPException(status_code=404, detail="Декларацію не знайдено")
    
    # Видалити лікаря з doctors_data
    doctors_data = existing.get('doctors_data', [])
    updated_doctors_data = [d for d in doctors_data if d.get('doctor_id') != doctor_id]
    
    if len(updated_doctors_data) == len(doctors_data):
        raise HTTPException(status_code=404, detail="Лікаря не знайдено в цій декларації")
    
    # Якщо це був останній лікар, видалити всю декларацію
    if len(updated_doctors_data) == 0:
        await db.pmg_declarations.delete_one({"month": month, "year": year})
        return {"success": True, "declaration_deleted": True}
    
    # Перерахувати totals
    total_patients = sum(d.get('total_patients', 0) for d in updated_doctors_data)
    total_amount = sum(d.get('total_amount', 0) for d in updated_doctors_data)
    total_ep = total_amount * 0.05
    total_vz = total_amount * 0.01
    net_amount = total_amount - total_ep - total_vz
    
    # Оновити декларацію
    await db.pmg_declarations.update_one(
        {"month": month, "year": year},
        {"$set": {
            "doctors_data": updated_doctors_data,
            "total_patients": total_patients,
            "total_amount": round(total_amount, 2),
            "total_ep": round(total_ep, 2),
            "total_vz": round(total_vz, 2),
            "net_amount": round(net_amount, 2),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "declaration_deleted": False}

@api_router.post("/pmg-declarations/analyze-image")
async def analyze_pmg_image(file: UploadFile = File(...)):
    """Аналізувати зображення звіту від НСЗУ"""
    try:
        # Зберегти файл тимчасово
        content = await file.read()
        
        # Визначити розширення файлу
        ext = '.jpg'
        if file.content_type:
            if 'png' in file.content_type:
                ext = '.png'
            elif 'webp' in file.content_type:
                ext = '.webp'
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            # Створити file content для AI
            file_content = FileContentWithMimeType(
                file_path=tmp_path,
                mime_type=file.content_type or "image/jpeg"
            )
            
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"pmg-image-{uuid.uuid4()}",
                system_message="""Ти експерт з аналізу медичних фінансових звітів від НСЗУ (Національна служба здоров'я України).

Проаналізуй скріншот дашборду НСЗУ та витягни дані у форматі JSON:
{
    "doctor_name": "ПІБ лікаря (повне ім'я якщо видно)",
    "total_declarations": число (К-сть активних декларацій),
    "age_groups": [
        {"age_group": "0-5", "patients_count": число з графіка},
        {"age_group": "6-17", "patients_count": число з графіка},
        {"age_group": "18-39", "patients_count": число з графіка},
        {"age_group": "40-64", "patients_count": число з графіка},
        {"age_group": "65+", "patients_count": число з графіка}
    ],
    "gender": {
        "male_percent": число,
        "female_percent": число
    }
}

ВАЖЛИВО:
- Знайди числа на графіку "Розподіл декларацій за віковими групами" - це вертикальна гістограма
- Числа над стовпчиками показують кількість пацієнтів в кожній віковій групі
- "К-сть активних декларацій" - це загальна кількість
- Ім'я лікаря може бути в фільтрі "ПІБ лікаря" або в заголовку

Поверни ТІЛЬКИ валідний JSON без markdown форматування."""
            ).with_model("gemini", "gemini-2.5-flash")
            
            response = await chat.send_message(
                UserMessage(text="Проаналізуй цей скріншот дашборду НСЗУ та витягни дані про декларації.", 
                           file_contents=[file_content])
            )
            
            # Парсити JSON з відповіді
            import json
            response_text = response if isinstance(response, str) else response.text
            response_text = response_text.strip()
            if response_text.startswith('```'):
                response_text = response_text.split('```')[1]
                if response_text.startswith('json'):
                    response_text = response_text[4:]
            response_text = response_text.strip()
            
            parsed_data = json.loads(response_text)
            
            return {
                "success": True,
                "parsed_data": parsed_data
            }
        finally:
            # Видалити тимчасовий файл
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        
    except Exception as e:
        logging.error(f"PMG Image analysis error: {e}")
        return {
            "success": False,
            "error": str(e)
        }

# Shared Reports
@api_router.post("/reports/share")
async def create_shared_report(report: SharedReportCreate):
    """Створити поширений звіт"""
    shared_report = SharedReport(**report.model_dump())
    report_dict = shared_report.model_dump()
    report_dict['created_at'] = report_dict['created_at'].isoformat()
    report_dict['expires_at'] = report_dict['expires_at'].isoformat()
    
    await db.shared_reports.insert_one(report_dict)
    
    return {
        "share_token": shared_report.share_token,
        "expires_at": shared_report.expires_at.isoformat(),
        "share_url": f"/share/{shared_report.share_token}"
    }

@api_router.get("/reports/share/{share_token}")
async def get_shared_report(share_token: str):
    """Отримати поширений звіт"""
    report = await db.shared_reports.find_one({"share_token": share_token}, {"_id": 0})
    
    if not report:
        raise HTTPException(status_code=404, detail="Звіт не знайдено")
    
    # Перевірити expiry
    expires_at = datetime.fromisoformat(report['expires_at'])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail="Термін дії звіту закінчився")
    
    # Розрахувати дні що залишились
    days_left = (expires_at - datetime.now(timezone.utc)).days
    
    if isinstance(report.get('created_at'), str):
        report['created_at'] = datetime.fromisoformat(report['created_at'])
    if isinstance(report.get('expires_at'), str):
        report['expires_at'] = datetime.fromisoformat(report['expires_at'])
    
    return {
        "report": report,
        "days_left": days_left,
        "is_expired": False
    }

# AI Image Analysis for Services
@api_router.post("/analyze-services-image")
async def analyze_services_image(file: UploadFile = File(...), month: int = Form(...), year: int = Form(...)):
    """Аналіз зображення зі списком послуг через AI"""
    try:
        # Зберегти файл тимчасово
        contents = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        
        # AI аналіз через Gemini Vision
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"image-analysis-{uuid.uuid4()}",
            system_message="Ти експерт з розпізнавання медичних документів. Витягуй структуровані дані з зображень."
        ).with_model("gemini", "gemini-2.5-flash")
        
        file_content = FileContentWithMimeType(
            file_path=tmp_path,
            mime_type=file.content_type or "image/jpeg"
        )
        
        prompt = f"""Проаналізуй це зображення зі списком наданих медичних послуг.

СТРУКТУРА ЗОБРАЖЕННЯ:
- Розділи по лікарях (ПЛМ, ОСЛ або повні імена)
- Для кожного лікаря: список "Код[номер]-[кількість]"
- Наприклад: "Код1-13" означає послуга 001, кількість 13

ЗАВДАННЯ:
1. Знайди всіх лікарів (ПЛМ, ОСЛ, або імена Пепеляшко, Овсієнко)
2. Для кожного лікаря витягни список послуг
3. Конвертуй коди: Код1→001, Код14→014, тощо

ПОВЕРНИ JSON:
{{
  "services": [
    {{"doctor_short_name": "ПЛМ", "code": "001", "quantity": 13}},
    {{"doctor_short_name": "ПЛМ", "code": "002", "quantity": 1}},
    {{"doctor_short_name": "ОСЛ", "code": "001", "quantity": 2}}
  ]
}}

Місяць: {month}, Рік: {year}"""

        message = UserMessage(
            text=prompt,
            file_contents=[file_content]
        )
        
        response = await chat.send_message(message)
        
        # Очистити temp файл
        os.unlink(tmp_path)
        
        # Парсинг JSON з відповіді
        import json
        import re
        
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            
            # Мапінг на service IDs
            services_list = await db.services.find({}, {"_id": 0}).to_list(1000)
            doctors_list = await db.doctors.find({}, {"_id": 0}).to_list(1000)
            
            parsed_services = []
            for item in result.get('services', []):
                # Знайти service по коду
                service = next((s for s in services_list if s['code'] == item['code']), None)
                # Знайти лікаря
                doctor = next((d for d in doctors_list if d['short_name'] == item['doctor_short_name']), None)
                
                if service and doctor:
                    parsed_services.append({
                        'service_id': service['id'],
                        'doctor_id': doctor['id'],
                        'code': item['code'],
                        'quantity': item['quantity']
                    })
            
            return {
                "success": True,
                "services": parsed_services,
                "raw_response": response
            }
        else:
            return {
                "success": False,
                "error": "AI не повернув структурований результат",
                "raw_response": response
            }
            
    except Exception as e:
        logging.error(f"Image analysis error: {str(e)}")
        if 'tmp_path' in locals():
            try:
                os.unlink(tmp_path)
            except:
                pass
        return {
            "success": False,
            "error": str(e)
        }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    sync_client.close()