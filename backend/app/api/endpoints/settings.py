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
