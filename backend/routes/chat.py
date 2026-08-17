from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional
import uuid
import json
import logging

from database import db
from models import ChatMessage, ChatResponse, BUDGET_CATEGORIES
from utils import get_current_user
import ai_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(chat_message: ChatMessage, user: dict = Depends(get_current_user)):
    if not ai_client.is_configured():
        raise HTTPException(status_code=500, detail="API key no configurada")
    session_id = chat_message.session_id or f"chat_{user['id']}_{uuid.uuid4().hex[:8]}"
    try:
        now = datetime.now(timezone.utc)
        start_of_month = now.replace(day=1).strftime("%Y-%m-%d")
        start_of_year = f"{now.year}-01-01"
        recent_transactions = await db.transactions.find({"user_id": user["id"], "date": {"$gte": start_of_month}}, {"_id": 0, "description": 1, "amount": 1, "category": 1, "date": 1}).sort("date", -1).to_list(50)
        monthly_totals = {}
        for t in recent_transactions:
            cat = t.get("category", "otros")
            monthly_totals[cat] = monthly_totals.get(cat, 0) + t.get("amount", 0)
        incomes = await db.incomes.find({"user_id": user["id"], "date": {"$gte": start_of_year}}, {"_id": 0}).to_list(100)
        total_income = sum(i.get("amount", 0) for i in incomes)
        cards = await db.credit_cards.find({"user_id": user["id"]}, {"_id": 0}).to_list(10)
        total_debt = sum(c.get("current_balance", 0) for c in cards)
        financial_context = f"""
CONTEXTO FINANCIERO DEL USUARIO:

**Presupuesto Mensual (del Excel del usuario):**
- Ingresos esperados: $12,500/mes ($150,000/ano)
  - Personal: $7,250/mes
  - APX: $2,500/mes
  - USA: $2,750/mes

**Categorias de Presupuesto Personal:**
{json.dumps({k: {"nombre": v["name"], "presupuesto_mensual": v.get("monthly_budget", 0)} for k, v in BUDGET_CATEGORIES.items()}, indent=2, ensure_ascii=False)}

**Resumen del mes actual ({now.strftime('%B %Y')}):**
- Gastos por categoria: {json.dumps(monthly_totals, ensure_ascii=False)}
- Total gastado este mes: ${sum(monthly_totals.values()):,.2f}

**Ingresos registrados este ano:** ${total_income:,.2f}

**Tarjetas de credito:**
- Total deuda actual: ${total_debt:,.2f}
- Tarjetas: {', '.join([f"{c['name']} (${c['current_balance']:,.2f})" for c in cards]) if cards else 'Sin tarjetas registradas'}

**Ultimas 10 transacciones:**
{chr(10).join([f"- {t['date']}: {t['description']} - ${t['amount']:,.2f} ({t['category']})" for t in recent_transactions[:10]])}

**Metas financieras:**
- Gastos fijos: 55-65% del ingreso
- Ahorro: 10% ($1,250/mes)
- Inversion: 15% ($1,875/mes)
"""
        historial = await db.chat_history.find(
            {"session_id": session_id, "user_id": user["id"]}, {"_id": 0, "user_message": 1, "ai_response": 1}
        ).sort("timestamp", 1).to_list(20)
        conversation = []
        for h in historial:
            conversation.append({"role": "user", "content": h["user_message"]})
            conversation.append({"role": "assistant", "content": h["ai_response"]})
        conversation.append({"role": "user", "content": chat_message.message})

        response = await ai_client.ask_conversation(
            system_message=f"""Eres un asistente financiero personal experto en finanzas familiares y leyes tributarias de Ecuador.

Tu rol es ayudar al usuario a:
1. Analizar sus gastos y transacciones
2. Dar consejos para optimizar su presupuesto
3. Responder preguntas sobre su situacion financiera
4. Sugerir formas de aumentar ahorros y reducir deudas
5. Explicar temas tributarios del SRI Ecuador

IMPORTANTE:
- Responde SIEMPRE en espanol
- Se conciso y practico
- Usa los datos reales del usuario cuando sea relevante
- Si no sabes algo especifico, pide mas detalles
- No inventes datos que no tienes

{financial_context}
""",
            messages=conversation,
            max_tokens=1500,
        )
        await db.chat_history.insert_one({"session_id": session_id, "user_id": user["id"], "user_message": chat_message.message, "ai_response": response, "timestamp": datetime.now(timezone.utc).isoformat()})
        return ChatResponse(response=response, session_id=session_id)
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Error en el chat: {str(e)}")


@router.get("/chat/history")
async def get_chat_history(session_id: Optional[str] = None, limit: int = 20, user: dict = Depends(get_current_user)):
    query = {"user_id": user["id"]}
    if session_id:
        query["session_id"] = session_id
    history = await db.chat_history.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"history": list(reversed(history)), "count": len(history)}
