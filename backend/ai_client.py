"""Cliente de IA compartido — reemplaza emergentintegrations.llm.chat (LlmChat/UserMessage).

Vesta ya no depende de Emergent para nada: este modulo llama directo a la API de
Anthropic con la misma ANTHROPIC_API_KEY usada en el resto del ecosistema (rushr-ea,
casa-tipty, fitness-bot). Los call sites que antes hacian:

    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=..., system_message=X).with_model("openai", "gpt-4o")
    response = await chat.send_message(UserMessage(text=Y))

ahora hacen:

    response = await ai_client.ask(system_message=X, user_text=Y)

Y los que usaban FileContentWithMimeType para OCR de imagenes/PDFs ahora usan
ai_client.ask_with_file(...), pasando el path del archivo tal cual.
"""
import os
import base64
from anthropic import AsyncAnthropic

ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
DEFAULT_MODEL = "claude-sonnet-4-6"

_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


def is_configured() -> bool:
    return _client is not None


async def ask(system_message: str, user_text: str, model: str = DEFAULT_MODEL, max_tokens: int = 2000) -> str:
    """Clasificacion/chat de solo texto, sin memoria. Devuelve el texto de la respuesta."""
    if not _client:
        raise RuntimeError("ANTHROPIC_API_KEY no configurada")
    resp = await _client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_message,
        messages=[{"role": "user", "content": user_text}],
    )
    return resp.content[0].text


async def ask_conversation(system_message: str, messages: list, model: str = DEFAULT_MODEL, max_tokens: int = 2000) -> str:
    """Chat multi-turno: messages = [{"role": "user"|"assistant", "content": "..."}, ...].
    LlmChat de Emergent mantenia memoria via session_id server-side; aca el caller arma
    el historial explicitamente (ver routes/chat.py) y lo pasa completo cada vez."""
    if not _client:
        raise RuntimeError("ANTHROPIC_API_KEY no configurada")
    resp = await _client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_message,
        messages=messages,
    )
    return resp.content[0].text


async def ask_with_file(system_message: str, user_text: str, file_path: str, mime_type: str,
                         model: str = DEFAULT_MODEL, max_tokens: int = 4000) -> str:
    """OCR/vision sobre una imagen o PDF en disco. Devuelve el texto de la respuesta."""
    if not _client:
        raise RuntimeError("ANTHROPIC_API_KEY no configurada")
    with open(file_path, "rb") as f:
        file_b64 = base64.standard_b64encode(f.read()).decode("utf-8")
    if mime_type == "application/pdf":
        content_block = {"type": "document", "source": {"type": "base64", "media_type": mime_type, "data": file_b64}}
    else:
        content_block = {"type": "image", "source": {"type": "base64", "media_type": mime_type, "data": file_b64}}
    resp = await _client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_message,
        messages=[{"role": "user", "content": [content_block, {"type": "text", "text": user_text}]}],
    )
    return resp.content[0].text
