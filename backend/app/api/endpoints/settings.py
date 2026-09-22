from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any
from backend.app.database.connection import get_db
from backend.app.models.schemas import User, UserSetting, UserSettingResponse, UserSettingBase
from backend.app.api.endpoints.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=UserSettingResponse)
def get_user_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    settings_obj = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
    if not settings_obj:
        # Create default
        settings_obj = UserSetting(
            user_id=current_user.id,
            model_provider="openai",
            model_name="gpt-4o-mini",
            temperature=0.2,
            max_tokens=2000,
            chunk_size=1000,
            chunk_overlap=200,
            api_keys_encrypted=""
        )
        db.add(settings_obj)
        db.commit()
        db.refresh(settings_obj)
    return settings_obj

@router.put("/", response_model=UserSettingResponse)
def update_user_settings(
    settings_in: UserSettingBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    settings_obj = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
    if not settings_obj:
        settings_obj = UserSetting(user_id=current_user.id)
        db.add(settings_obj)
        
    # Update fields
    for field, val in settings_in.dict(exclude_unset=True).items():
        setattr(settings_obj, field, val)
        
    db.commit()
    db.refresh(settings_obj)
    return settings_obj

@router.get("/local-models")
def get_local_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Discover available local Ollama models installed on the system."""
    import urllib.request
    import json
    
    ollama_url = "http://127.0.0.1:11434"
    settings_obj = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
    if settings_obj and settings_obj.api_keys_encrypted:
        try:
            parsed = json.loads(settings_obj.api_keys_encrypted)
            if isinstance(parsed, dict) and parsed.get("ollama"):
                candidate = parsed["ollama"].strip().rstrip("/")
                if candidate.endswith("/api"):
                    candidate = candidate[:-4]
                if candidate:
                    ollama_url = candidate
        except Exception:
            pass

    tags_url = f"{ollama_url}/api/tags"
    try:
        req = urllib.request.Request(
            tags_url,
            headers={"User-Agent": "ResearchMind-Doctor/1.0"}
        )
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            models = []
            for m in data.get("models", []):
                details = m.get("details", {}) or {}
                ctx_raw = details.get("context_length")
                ctx_str = "128k"
                if ctx_raw:
                    if ctx_raw >= 1048576:
                        ctx_str = f"{ctx_raw // 1048576}M"
                    elif ctx_raw >= 1024:
                        ctx_str = f"{ctx_raw // 1024}k"
                    else:
                        ctx_str = f"{ctx_raw}"
                
                name = m.get("name") or m.get("model")
                if not name:
                    continue
                    
                models.append({
                    "name": name,
                    "context": ctx_str,
                    "provider": "ollama",
                    "providerLabel": "Ollama",
                    "type": "Local",
                    "auth_source": "Local (Ollama)",
                    "size": m.get("size", 0),
                    "modified_at": m.get("modified_at", "")
                })
            return {"available": True, "url": ollama_url, "models": models}
    except Exception as e:
        return {"available": False, "url": ollama_url, "models": [], "error": str(e)}

