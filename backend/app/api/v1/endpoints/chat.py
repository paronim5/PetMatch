from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.api import deps
from app.services.messaging_service import messaging_service
from app.domain.schemas import Message, MessageCreate, Match, MatchWithUsers
from app.services.user_service import user_service

router = APIRouter()

@router.get("/matches", response_model=List[MatchWithUsers])
def get_user_matches(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get all active matches (chats).
    """
    return messaging_service.get_user_matches(db, user_id=current_user.id)

@router.get("/matches/{match_id}/messages", response_model=List[Message])
def get_messages(
    match_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get messages for a specific match.
    """
    try:
        return messaging_service.get_messages(db, match_id=match_id, user_id=current_user.id, limit=limit, offset=skip)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

@router.post("/matches/{match_id}/messages", response_model=Message)
def send_message(
    match_id: int,
    message_in: MessageCreate,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Send a message to a match.
    """
    # Ensure match_id in path matches body or set it
    message_in.match_id = match_id
    try:
        return messaging_service.send_message(db, sender_id=current_user.id, message_in=message_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/messages/{message_id}/react", response_model=Message)
def react_to_message(
    message_id: int,
    emoji: str = Body(..., embed=True),
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    React to a message.
    """
    try:
        return messaging_service.add_reaction(db, user_id=current_user.id, message_id=message_id, emoji=emoji)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/matches/{match_id}/read")
def mark_match_read(
    match_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Mark all messages in a match as read.
    """
    try:
        updated = messaging_service.mark_messages_read(db, user_id=current_user.id, match_id=match_id)
        return {"success": True, "updated": updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/matches/{match_id}", status_code=200)
def unmatch(
    match_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """Unmatch (deactivate) a match."""
    try:
        messaging_service.unmatch(db, user_id=current_user.id, match_id=match_id)
        return {"detail": "Unmatched successfully."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/messages/{message_id}", response_model=Message)
def delete_message(
    message_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """Soft-delete own message."""
    try:
        return messaging_service.delete_message(db, user_id=current_user.id, message_id=message_id)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

@router.post("/join", response_model=Match)
def join_chat_by_code(
    code: str = Body(..., embed=True),
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Join a chat by code (USER-{id}).
    """
    try:
        return messaging_service.join_chat_by_code(db, user_id=current_user.id, code=code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/join-by-username", response_model=MatchWithUsers)
def join_chat_by_username(
    username: str = Body(..., embed=True),
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Join or create a chat by target user's username.
    """
    from sqlalchemy.orm import joinedload
    from app.domain.models import Match as MatchModel, User as UserModel, UserPhoto as UserPhotoModel
    try:
        match = messaging_service.join_chat_by_username(db, user_id=current_user.id, username=username)
        return db.query(MatchModel).options(
            joinedload(MatchModel.user1).joinedload(UserModel.photos),
            joinedload(MatchModel.user2).joinedload(UserModel.photos),
        ).filter(MatchModel.id == match.id).first()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

