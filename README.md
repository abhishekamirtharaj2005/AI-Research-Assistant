# ResearchMind — AI Research Assistant

ResearchMind is a modular, production-ready AI Research Assistant designed for students, researchers, professors, and professionals. The platform allows users to upload research papers (PDFs), extract text, perform semantic searches, chat with AI, compare multiple papers side-by-side, and compile literature reviews or gap reports with clickable, page-specific citations.

---

## Key Features

1. **Precision RAG Engine**: Indexes documents page-by-page. Chat queries retrieve precise scientific contexts, creating clickable citation snippets mapping directly back to page numbers.
2. **Multi-Agent Coordination**: Routes queries automatically to 9 specialized agents:
   - **Research Agent**: Precision claim answering.
   - **Summary Agent**: Generates one-sentence, executive, and detailed summaries.
   - **Citation Agent**: Compiles BibTeX entries and audits reference listings.
   - **Literature Agent**: Synthesizes literature reviews combining multiple papers.
   - **Comparison Agent**: Formulates side-by-side matrices comparing methods, pros, and cons.
   - **Gap Agent (Idea Agent)**: Critiques methods and proposes novel research questions.
   - **Presentation / Reviewer / Planner Agents**: Outlines slide decks, reviews formatting drafts, and outlines research roadmaps.
3. **Split-Screen Workspace**: Displays a read-only document text browser next to the AI Chat, summaries panel, and citations analyzer.
4. **Rich Export Suite**: Downloads generated reports and literature reviews as **PDFs (dynamically styled via ReportLab)**, Markdown, HTML, or BibTeX references.
5. **Multi-Provider AI support**: Seamless support for OpenAI, Gemini, Claude, and local Ollama servers, including a zero-key simulated fallback mode.

---

## Tech Stack

* **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS v4, Lucide React icons, and Framer Motion.
* **Backend**: FastAPI (Python), SQLAlchemy, PyMuPDF (fitz), pdfplumber, and ReportLab.
* **Database & Vector Store**: PostgreSQL, SQLite (for zero-setup local runs), and ChromaDB.

---

## How to Run Locally (Recommended)

This method runs the project using SQLite and Chroma DB local persistent folders, which requires **zero external setup**.

### Prerequisites
* **Node.js** (v18 or higher)
* **Python** (v3.9 or higher)

### Step 1: Configure Environment Variables
Copy `.env.example` to a new `.env` file in the root workspace folder:
```bash
copy .env.example .env
```
*(Optional)*: Edit `.env` to input your `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `ANTHROPIC_API_KEY`. If left blank, the system runs in **Simulation Mode** or connects to a local **Ollama** server if running.

### Step 2: Start the FastAPI Backend
Ensure you are in the root directory, activate the pre-configured virtual environment, and launch the Uvicorn web server:
```bash
# 1. Activate the Python virtual environment
.\venv\Scripts\activate

# 2. Start the Uvicorn backend server
uvicorn backend.app.main:app --reload
```
* The backend API server will run at [http://localhost:8000](http://localhost:8000).
* You can view and test the interactive Swagger API documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

### Step 3: Start the Next.js Frontend
Open a **new** terminal window, navigate to the `frontend/` directory, and start the Next.js development server:
```bash
# 1. Navigate to frontend
cd frontend

# 2. Start the Next.js development server
npm run dev
```
* The Next.js user interface will start at [http://localhost:3000](http://localhost:3000).
* Open the browser and visit the page to register an account and start indexing papers.

---

## How to Run using Docker Compose

If you have Docker Desktop installed, you can spin up the entire production stack (including PostgreSQL and ChromaDB containers) using a single command.

1. **Create the environment file**:
   ```bash
   copy .env.example .env
   ```
2. **Start the containers**:
   ```bash
   docker-compose up --build
   ```
   * Next.js Frontend: [http://localhost:3000](http://localhost:3000)
   - FastAPI Backend: [http://localhost:8000](http://localhost:8000)
   - Chroma Vector Store: [http://localhost:8000](http://localhost:8000) (internal communication)
   - PostgreSQL Database: Port `5432`

---

## Verification & Testing

### Run Backend Unit Tests
To verify that PDF parsing and semantic chunking boundary handlers are functioning properly, run the test suite:
```bash
.\venv\Scripts\pytest backend/tests
```
