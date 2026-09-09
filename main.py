from pathlib import Path
from typing import Annotated, Literal
import joblib
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="Stress Level Predictor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load trained pipeline/model
model_path = Path(__file__).resolve().parent / "Mental_heallth_Model.pkl"
model = joblib.load(model_path)


class StudentData(BaseModel):

    age: Annotated[
        int,
        Field(gt=0, description="Student age must be greater than 0")
    ]

    gender: Annotated[
        Literal["Male", "Female"],
        Field(examples=["Female"])
    ]

    country: Annotated[
        str,
        Field(min_length=1, examples=["India"])
    ]

    academic_level: Annotated[
        Literal["Undergraduate", "Graduate", "High School"],
        Field(examples=["Undergraduate"])
    ]

    most_used_platform: Annotated[
        Literal[
            "Facebook",
            "LinkedIn",
            "Instagram",
            "Snapchat",
            "Twitter",
            "YouTube",
            "TikTok",
            "LINE",
            "KakaoTalk",
            "VKontakte",
            "WhatsApp",
            "WeChat"
        ],
        Field(examples=["Instagram"])
    ]

    purpose_of_use: Annotated[
        Literal["Networking", "Education", "Entertainment", "News"],
        Field(examples=["Entertainment"])
    ]

    avg_daily_usage_hours: Annotated[
        float,
        Field(ge=0, le=24, examples=[4.5])
    ]

    daily_unlocks: Annotated[
        int,
        Field(ge=0, examples=[85])
    ]

    study_hours: Annotated[
        float,
        Field(ge=0, examples=[5.0])
    ]

    physical_activity_hours: Annotated[
        float,
        Field(ge=0, examples=[1.5])
    ]

    sleep_hours_per_night: Annotated[
        float,
        Field(ge=0, examples=[7.0])
    ]

    stress_level: Annotated[
        Literal["Low", "Medium", "High", "Very High"],
        Field(examples=["Medium"])
    ]




TOP_COUNTRIES = {
    "India",
    "USA",
    "Canada",
    "Australia",
    "UK",
    "Germany",
    "Mexico",
    "Turkey",
    "France"
}

class PredictionResponse(BaseModel):
    predicted_mental_health_score:float
    #6.777777 -> float
    


@app.post("/predict",response_model=PredictionResponse)
def predict(data: StudentData):

    # Group country
    country_group = (
        data.country
        if data.country in TOP_COUNTRIES
        else "Other"
    )

    input_dict = {
        "Age": data.age,
        "Gender": data.gender,
        "Country": data.country,
        "Academic_Level": data.academic_level,
        "Most_Used_Platform": data.most_used_platform,
        "Purpose_Of_Use": data.purpose_of_use,
        "Avg_Daily_Usage_Hours": data.avg_daily_usage_hours,
        "Daily_Unlocks": data.daily_unlocks,
        "Study_Hours": data.study_hours,
        "Physical_Activity_Hours": data.physical_activity_hours,
        "Sleep_Hours_Per_Night": data.sleep_hours_per_night,
        "Stress_Level": data.stress_level,
        "Grouped_country": country_group
    }

    input_row = pd.DataFrame([input_dict])


    prediction = model.predict(input_row)[0] #6.77

    return PredictionResponse(predicted_mental_health_score=round(float(prediction),2)) 