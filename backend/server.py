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
from datetime import datetime, timezone
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
import tempfile
import io
from gridfs import GridFS
from bson import ObjectId
import pymongo

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
    doctor_share: float = 0.0
    expense_items: List[ServiceExpenseItem] = Field(default_factory=list)

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
    
    # Розрахунок податків: ЄП (5%) + ВЗ (1%)
    ep_vz = service.price * 0.06  # 5% + 1% = 6%
    
    # Розрахунок витрат з податками
    expenses_with_tax = total_expenses + ep_vz
    
    # Розрахунок доходу після податків = Ціна - Витрати - ЄП - ВЗ
    income_after_tax = service.price - total_expenses - ep_vz
    
    # Кошти лікаря = (Дохід після податків) / 2
    doctor_share = income_after_tax / 2
    
    # Дохід організації = (Дохід після податків) / 2
    organization_income = income_after_tax / 2
    
    service_obj = PaidService(
        **service.model_dump(),
        total_expenses=total_expenses,
        expenses_with_tax=expenses_with_tax,
        fop_income=organization_income
    )
    service_dict = service_obj.model_dump()
    service_dict['created_at'] = service_dict['created_at'].isoformat()
    service_dict['doctor_share'] = doctor_share  # Оновлюємо кошти лікаря
    await db.services.insert_one(service_dict)
    service_obj.doctor_share = doctor_share
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
    ep_vz = service.price * 0.06  # ЄП 5% + ВЗ 1%
    expenses_with_tax = total_expenses + ep_vz
    income_after_tax = service.price - total_expenses - ep_vz
    doctor_share = income_after_tax / 2
    organization_income = income_after_tax / 2
    
    service_dict = service.model_dump()
    service_dict['total_expenses'] = total_expenses
    service_dict['expenses_with_tax'] = expenses_with_tax
    service_dict['fop_income'] = organization_income
    service_dict['doctor_share'] = doctor_share
    
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