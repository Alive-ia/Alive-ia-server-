from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def accueil():
    return {
        "message": "Bienvenue sur le serveur ALIVE IA",
        "statut": "Serveur opérationnel"
    }
