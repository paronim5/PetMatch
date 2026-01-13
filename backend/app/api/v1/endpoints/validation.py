from fastapi import APIRouter, HTTPException, Request
from typing import Optional
import base64
import logging
from app.services.ai_service import ai_service
from app.core.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/validate-image")
@limiter.limit("100/minute")
async def validate_image(request: Request):
    content_type = request.headers.get("content-type", "")
    image_bytes = None
    
    try:
        if "multipart/form-data" in content_type:
            form = await request.form()
            # Try to get 'file' or just the first uploaded file
            file = form.get("file")
            if not file:
                # Iterate to find any file
                for key, value in form.items():
                    if hasattr(value, "read"):
                        file = value
                        break
            
            if file:
                image_bytes = await file.read()
                
        elif "application/json" in content_type:
            data = await request.json()
            # Support 'image', 'file', 'image_base64', 'base64' keys
            b64_str = data.get("image_base64") or data.get("image") or data.get("file") or data.get("base64")
            
            if b64_str:
                # Handle data URI scheme if present (e.g. "data:image/jpeg;base64,...")
                if "," in b64_str:
                    b64_str = b64_str.split(",")[1]
                image_bytes = base64.b64decode(b64_str)
        
        if not image_bytes:
            raise HTTPException(status_code=400, detail="No image provided. Please upload a file or base64 string.")

        # Size validation (10MB)
        if len(image_bytes) > 10 * 1024 * 1024:
             raise HTTPException(status_code=400, detail="File too large (max 10MB).")

        # Call AI Service
        result = ai_service.validate_image(image_bytes)
        
        # User Feedback Logic
        message = ""
        is_animal = result['is_animal']
        animal_type = result['animal_type']
        confidence = result['confidence_score']
        
        if is_animal:
            if confidence < 0.6: # Edge case: Low confidence
                message = "We're not sure this is a pet photo. Please try another image."
            else:
                message = f"Thank you for your {animal_type} picture! ({confidence*100:.1f}% confidence)"
        else:
            detected_info = f"Detected: {animal_type}" if animal_type else "No animal detected"
            message = f"Please upload a profile picture of a common pet (cat, dog, hamster, bird, etc.). {detected_info}"

        return {
            "is_animal": is_animal,
            "animal_type": animal_type,
            "confidence_score": confidence,
            "processing_time_ms": result['processing_time_ms'],
            "message": message
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in validate_image: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
