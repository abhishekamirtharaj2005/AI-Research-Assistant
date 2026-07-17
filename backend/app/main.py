from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database.connection import init_db
from backend.app.api.endpoints import auth, papers, chats, reports, settings as user_settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set CORS origins
# Allow frontend development port and standard deployment ports
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup DB initialization
@app.on_event("startup")
def on_startup():
    init_db()

# Include Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(papers.router, prefix=f"{settings.API_V1_STR}/papers", tags=["papers"])
app.include_router(chats.router, prefix=f"{settings.API_V1_STR}/chats", tags=["chats"])
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}/reports", tags=["reports"])
app.include_router(user_settings.router, prefix=f"{settings.API_V1_STR}/settings", tags=["settings"])

@app.get("/")
def read_root():
    return {"message": "Welcome to ResearchMind API! Check /docs for swagger specifications."}
