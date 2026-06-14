from pydantic import BaseModel
from datetime import datetime

class LogResponse(BaseModel):
    created_at: str

try:
    resp = LogResponse(created_at=datetime.utcnow())
    print("SUCCESS:", resp.model_dump())
except Exception as e:
    print("ERROR:", e)
