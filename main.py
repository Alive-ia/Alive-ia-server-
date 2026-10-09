from fastapi import FastAPI
from fastapi.responses import FileResponse
from pydantic import BaseModel
app = FastAPI()

class ChatRequest(BaseModel):
        message: str

# Page d'accueil
@app.get("/")
def home():
    return FileResponse("static/index.html")

# Poser une question générale
@app.get("/question")
def question(q: str = "Bonjour"):
    return {
        "question": q,
        "answer": "Je suis ALIVE AI. Je peux vous aider à apprendre, créer, trouver un emploi, prendre soin de votre santé et gérer vos démarches administratives."
    }

# 1. Apprendre
@app.get("/learn")
def learn(q: str = ""):
    return {
        "service": "Apprendre",
        "answer": f"Vous voulez apprendre : {q}. Je vais vous expliquer simplement, avec des exemples et des exercices."
    }

# 2. Emploi et Entrepreneuriat
@app.get("/job")
def job(q: str = ""):
    return {
        "service": "Emploi et Entrepreneuriat",
        "answer": f"Pour votre projet : {q}. Je peux vous aider à écrire un CV, une lettre de motivation ou un plan d'affaires."
    }

# 3. Santé
@app.get("/health")
def health(q: str = ""):
    return {
        "service": "Santé",
        "answer": f"Question santé : {q}. Voici des informations générales. Pour un diagnostic, veuillez consulter un médecin."
    }

# 4. Administration
@app.get("/admin")
def admin(q: str = ""):
    return {
        "service": "Administration",
        "answer": f"Démarche administrative : {q}. Je vous explique les étapes, les documents nécessaires et où aller."
    }

# 5. Créer une vidéo
@app.get("/video")
def video(q: str = ""):
    return {
        "service": "Créer une vidéo",
        "answer": f"Idée de vidéo : {q}. Dites-moi le sujet et la durée, et je prépare le script et les scènes."
    }


# Chat
@app.post("/chat")
def chat(req: ChatRequest):
    return {"reply": "Tu as dit : " + req.message}
