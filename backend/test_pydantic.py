from pydantic import BaseModel
from decimal import Decimal

class ProfileRequest(BaseModel):
    name: str = ""
    age: str = ""
    gender: str = "male"
    weight: str = ""
    height: str = ""
    activityLevel: str = "sedentary"
    goal: str = "maintain"

class ProfileResponse(ProfileRequest):
    pass

try:
    resp = ProfileResponse(
        name="Test",
        age=Decimal('25.5'),
        gender="male",
        weight=Decimal('65.2'),
        height=Decimal('170.0'),
        activityLevel="active",
        goal="lose"
    )
    print("SUCCESS:", resp.dict())
except Exception as e:
    print("ERROR:", e)
