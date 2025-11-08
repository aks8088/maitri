# ---------- Offline Environment Configuration ----------
import os
os.environ["TRANSFORMERS_CACHE"] = r"C:\Users\lenovo\OneDrive\Desktop\maitri\models\huggingface\transformers"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

# ---------- Imports ----------
from fastapi import FastAPI, Depends, HTTPException, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from passlib.context import CryptContext
from transformers import pipeline, AutoModelForCausalLM, AutoTokenizer
import random, secrets, torch, subprocess

# ---------- Database setup ----------
DATABASE_URL = "sqlite:///./moods.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

# ---------- Database Models ----------
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)


class Mood(Base):
    __tablename__ = "moods"
    id = Column(Integer, primary_key=True, index=True)
    mood = Column(String, index=True)
    stress_level = Column(Integer)
    sleep_hours = Column(Float)
    date = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)


# ---------- NEW Chat History Model ----------
class ChatHistory(Base):
    __tablename__ = "chat_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    user_message = Column(String)
    ai_reply = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)


# ✅ Create tables on app load
Base.metadata.create_all(bind=engine)

# ---------- Password Utilities ----------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# ---------- FastAPI app ----------
app = FastAPI(title="Astronaut Mental Wellness API with AI Remedies")

# ---------- CORS Configuration ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("✅ CORS Middleware Initialized for localhost:3000 and related origins.")

# ---------- Dependency ----------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------- Schemas ----------
class MoodCreate(BaseModel):
    mood: str
    stress_level: int
    sleep_hours: float
    date: Optional[datetime] = None
    user_id: Optional[int] = None

class MoodResponse(BaseModel):
    id: int
    mood: str
    stress_level: int
    sleep_hours: float
    date: datetime
    class Config:
        orm_mode = True

class AnalyzeRequest(BaseModel):
    text: str

class AnalyzeResponse(BaseModel):
    message: str

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[int] = None  # ✅ Add user_id for personalization

class ChatResponse(BaseModel):
    reply: str


# ---------- AUTH ROUTES ----------
@app.post("/signup")
async def signup(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    username = form.get("username", "").strip()
    password = form.get("password", "").strip()
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    if len(password.encode("utf-8")) > 72:
        password = password.encode("utf-8")[:72].decode("utf-8", errors="ignore")

    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed = hash_password(password)
    user = User(username=username, password_hash=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"✅ Signup successful for {username}")
    return {"message": "Signup successful", "user_id": user.id}


@app.post("/login")
async def login(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    username = form.get("username", "").strip()
    password = form.get("password", "").strip()
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = secrets.token_hex(16)
    print(f"✅ Login successful for {username}")
    return {"message": "Login successful", "token": token, "user_id": user.id}


# ---------- Emotion Detection ----------
try:
    analyzer = pipeline("text-classification",
                        model="j-hartmann/emotion-english-distilroberta-base",
                        return_all_scores=True)
    print("✅ Emotion detection model loaded successfully.")
except Exception as e:
    print("⚠️ Could not load emotion model:", e)
    analyzer = None


@app.get("/")
def root():
    return {"message": "Astronaut Wellness API running with AI remedies"}


@app.get("/moods", response_model=List[MoodResponse])
def read_moods(user_id: int, db: Session = Depends(get_db)):
    return db.query(Mood).filter(Mood.user_id == user_id).order_by(Mood.date).all()


@app.post("/moods", response_model=MoodResponse)
def create_mood(entry: MoodCreate, db: Session = Depends(get_db)):
    if not (0 <= entry.stress_level <= 10):
        raise HTTPException(status_code=400, detail="Stress must be 0–10")
    if entry.sleep_hours < 0:
        raise HTTPException(status_code=400, detail="Sleep must be >= 0")

    db_mood = Mood(
        mood=entry.mood,
        stress_level=entry.stress_level,
        sleep_hours=entry.sleep_hours,
        date=entry.date or datetime.utcnow(),
        user_id=entry.user_id,
    )
    db.add(db_mood)
    db.commit()
    db.refresh(db_mood)
    return db_mood


@app.post("/analyze_mood", response_model=AnalyzeResponse)
def analyze_mood(request: AnalyzeRequest):
    if analyzer is None:
        raise HTTPException(status_code=500, detail="AI model not loaded")

    try:
        results = analyzer(request.text)
        emotions = sorted(results[0], key=lambda x: x["score"], reverse=True)
        top_emotion = emotions[0]["label"].lower()
        confidence = emotions[0]["score"]

        remedies = {
            "joy": "You seem upbeat and positive! Keep this energy going 🚀",
            "sadness": "You sound a bit low. Try journaling or talking with someone you trust 💙",
            "anger": "Take deep breaths and calm your mind 🌿",
            "fear": "Try meditation or mindfulness to center yourself 🧘",
            "neutral": "You’re calm and balanced — great mindset for the day ✨",
        }

        message = remedies.get(top_emotion, "Maintain balance and stay positive 🌈")
        return {"message": f"Detected emotion: {top_emotion.capitalize()} ({confidence:.1%}). {message}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


@app.get("/weekly_summary")
def get_weekly_summary(user_id: int, db: Session = Depends(get_db)):
    moods = db.query(Mood).filter(Mood.user_id == user_id).order_by(Mood.date.desc()).limit(7).all()
    if not moods:
        return {"summary": "No mood data logged this week yet."}

    stress_levels = [m.stress_level for m in moods if m.stress_level is not None]
    sleep_hours = [m.sleep_hours for m in moods if m.sleep_hours is not None]
    avg_stress = sum(stress_levels) / len(stress_levels) if stress_levels else 0
    avg_sleep = sum(sleep_hours) / len(sleep_hours) if sleep_hours else 0

    summary = f"Avg Stress: {avg_stress:.1f}/10 | Avg Sleep: {avg_sleep:.1f} hrs."
    return {"summary": summary}


# ---------- Chatbot (Gemma + DialoGPT + Memory) ----------
try:
    tokenizer = AutoTokenizer.from_pretrained("microsoft/DialoGPT-medium")
    chatbot_model = AutoModelForCausalLM.from_pretrained("microsoft/DialoGPT-medium")
    print("✅ Offline DialoGPT model loaded.")
except Exception as e:
    chatbot_model = None
    tokenizer = None
    print("⚠️ DialoGPT model unavailable:", e)


@app.post("/chatbot", response_model=ChatResponse)
def chatbot_reply(request: ChatRequest, db: Session = Depends(get_db)):
    """Offline AI chatbot with Gemma3:270m integration and memory context."""
    user_message = request.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Empty message.")

    user_id = request.user_id or None

    # --- Get mood context
    last_mood = db.query(Mood).filter(Mood.user_id == user_id).order_by(Mood.date.desc()).first()
    mood_context = (
        f"The user recently felt '{last_mood.mood}' (stress {last_mood.stress_level}, sleep {last_mood.sleep_hours} hrs)."
        if last_mood else "No recent mood data."
    )

    # --- Retrieve last 5 messages
    chat_memory = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user_id)
        .order_by(ChatHistory.timestamp.desc())
        .limit(5)
        .all()
    )
    memory_context = "\n".join([f"User: {c.user_message}\nAI: {c.ai_reply}" for c in reversed(chat_memory)])

    # --- Construct prompt
    prompt = f"""
You are MAITRI — an empathetic astronaut wellness assistant.
Use previous chat context to respond meaningfully.
Mood Context: {mood_context}
Conversation History:
{memory_context}

User: {user_message}
MAITRI:
"""

    # --- Try Gemma3
    try:
        result = subprocess.run(
            ["ollama", "run", "gemma3:270m"],
            input=prompt,
            text=True,
            capture_output=True,
            timeout=45,
        )
        reply = result.stdout.strip()
    except Exception as e:
        print(f"⚠️ Gemma unavailable: {e}")
        reply = None

    # --- Fallback: DialoGPT
    if not reply and chatbot_model and tokenizer:
        input_text = f"{mood_context}\n{memory_context}\nUser: {user_message}\nAI:"
        input_ids = tokenizer.encode(input_text + tokenizer.eos_token, return_tensors="pt")
        chat_history_ids = chatbot_model.generate(
            input_ids,
            max_length=200,
            pad_token_id=tokenizer.eos_token_id,
            temperature=0.7,
            top_k=50,
            top_p=0.9,
        )
        reply = tokenizer.decode(chat_history_ids[:, input_ids.shape[-1]:][0], skip_special_tokens=True).strip()

    if not reply:
        reply = random.choice([
            "I'm here for you. How are you feeling right now?",
            "Remember to breathe — you’ve got this 🌙",
            "Your thoughts matter. Tell me more 💬",
        ])

    # --- Save new chat
    chat_entry = ChatHistory(user_id=user_id, user_message=user_message, ai_reply=reply)
    db.add(chat_entry)
    db.commit()

    # --- Trim old memory (keep last 5)
    total = db.query(ChatHistory).filter(ChatHistory.user_id == user_id).count()
    if total > 5:
        oldest = (
            db.query(ChatHistory)
            .filter(ChatHistory.user_id == user_id)
            .order_by(ChatHistory.timestamp)
            .first()
        )
        db.delete(oldest)
        db.commit()

    return {"reply": reply}


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    print("✅ Database schema verified and ready (moods.db).")

@app.get("/daily_plan")
def generate_daily_plan(user_id: int, db: Session = Depends(get_db)):
    """
    Generate a personalized astronaut routine plan based on recent mood/stress/sleep logs.
    Uses Gemma3:270m for offline LLM inference.
    """
    moods = db.query(Mood).filter(Mood.user_id == user_id).order_by(Mood.date.desc()).limit(5).all()
    if not moods:
        return {"plan": "Log your first mood entry to get a personalized routine plan."}

    avg_stress = sum([m.stress_level for m in moods]) / len(moods)
    avg_sleep = sum([m.sleep_hours for m in moods]) / len(moods)
    recent_mood = moods[0].mood.lower()

    prompt = f"""
You are MAITRI, an astronaut mental wellness AI assistant.
The astronaut’s recent average stress is {avg_stress:.1f}/10, average sleep is {avg_sleep:.1f} hours,
and their most recent mood is '{recent_mood}'.

Generate a one-day mental wellness plan that includes:
- Morning meditation (specific duration & technique)
- Breathing routine
- Music or relaxation recommendation
- Movement or light exercise (fit for space)
- Sleep advice

Give short, practical, schedule-style points (no long text).
"""

    try:
        result = subprocess.run(
            ["ollama", "run", "gemma3:270m"],
            input=prompt,
            text=True,
            capture_output=True,
            timeout=45,
        )
        plan = result.stdout.strip()
        if not plan:
            plan = "🧘 Morning: Deep breathing (5 min)\n🎧 Afternoon: Soft ambient music\n🌙 Evening: Journaling & rest"
        return {"plan": plan}
    except Exception as e:
        print(f"⚠️ AI routine generation failed: {e}")
        return {"plan": "Default plan: Breathe deeply, stretch lightly, rest well."}
@app.get("/dos_donts")
def generate_dos_donts(user_id: int, db: Session = Depends(get_db)):
    """
    Generate 3 Do's and 3 Don'ts for the astronaut based on current emotional and stress profile.
    """
    last_mood = db.query(Mood).filter(Mood.user_id == user_id).order_by(Mood.date.desc()).first()
    if not last_mood:
        return {
            "dos": ["Drink water", "Take mindful breaks", "Write how you feel"],
            "donts": ["Skip rest", "Overthink", "Stay isolated"]
        }

    prompt = f"""
You are MAITRI, an astronaut mental wellness coach.
The astronaut currently feels '{last_mood.mood}', has stress level {last_mood.stress_level}/10,
and slept {last_mood.sleep_hours} hours.

Suggest 3 Do's and 3 Don'ts for them to maintain emotional balance.
Keep each suggestion short and clear.
"""

    try:
        result = subprocess.run(
            ["ollama", "run", "gemma3:270m"],
            input=prompt,
            text=True,
            capture_output=True,
            timeout=45,
        )
        response = result.stdout.strip()
        # Optional: Basic parsing fallback
        if "Do" not in response:
            response = "Do: Practice deep breathing, hydrate, stay connected\nDon't: Skip meals, ignore fatigue, isolate yourself"
        dos, donts = [], []
        for line in response.split("\n"):
            if "do" in line.lower():
                dos.append(line.strip("-• "))
            elif "don’t" in line.lower() or "don't" in line.lower():
                donts.append(line.strip("-• "))
        return {"dos": dos[:3], "donts": donts[:3]}
    except Exception as e:
        print(f"⚠️ AI Do's & Don'ts generation failed: {e}")
        return {
            "dos": ["Take 5 mins of mindfulness", "Stay hydrated", "Do gentle stretching"],
            "donts": ["Overstrain", "Work nonstop", "Suppress your emotions"]
        }
