from fastapi import FastAPI

app = FastAPI()

# Home page
@app.get("/")
def home():
    return {"message": "Welcome to ALIVE AI server", "status": "Server is running"}

# Ask a general question
@app.get("/question")
def question(q: str = "Hello"):
    return {
        "question": q,
        "answer": "I am ALIVE AI. I can help you learn, create, find a job, take care of your health and handle administrative tasks."
    }

# 1. Learn
@app.get("/learn")
def learn(q: str = ""):
    return {
        "service": "Learn",
        "answer": f"You want to learn: {q}. I will explain simply, with examples and exercises."
    }

# 2. Job & Entrepreneurship
@app.get("/job")
def job(q: str = ""):
    return {
        "service": "Job & Entrepreneurship",
        "answer": f"For your project: {q}. I can help you write a CV, a motivation letter, or a business plan."
    }

# 3. Health
@app.get("/health")
def health(q: str = ""):
    return {
        "service": "Health",
        "answer": f"Health question: {q}. I provide general information. For a diagnosis, please see a doctor."
    }

# 4. Administration
@app.get("/admin")
def admin(q: str = ""):
    return {
        "service": "Administration",
        "answer": f"Administrative process: {q}. I will explain the steps, the documents needed and where to go."
    }

# 5. Create a video
@app.get("/video")
def video(q: str = ""):
    return {
        "service": "Create a video",
        "answer": f"Video idea: {q}. Tell me the topic and duration, and I will prepare the script and scenes."
    }
