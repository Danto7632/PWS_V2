# System Redesign Plan

## Goals
- Split the existing Streamlit monolith into a React (Vite) frontend and a NestJS backend.
- Preserve all current RAG functionality: document ingestion (PDF/TXT/Excel), embedding & vector search, dual-role simulations, scoring, and support for Ollama/OpenAI/Gemini.
- Provide clear module boundaries and API contracts so each side can evolve independently.

## High-Level Architecture
```
frontend/ (React + TypeScript)
  - UI state, file uploads, conversation experience, settings sidebar, charts.
backend/ (NestJS + TypeScript)
  - File ingestion + text extraction services
  - Embedding + vector store (JSON persistence)
  - LLM orchestration (Ollama/OpenAI/Gemini)
  - Simulation flows (customer ↔ employee)
shared storage/
  - Vector store + manual cache persisted as JSON for local runs
work_simulator_db/
  - Existing Chroma artifacts retained for backward compatibility (optional)
```

## Backend Modules
| Module | Responsibility |
| --- | --- |
| `FilesModule` | Handle uploads, validate file types, extract raw text. Uses `pdf-parse`, `xlsx`, and UTF-8 decoding. |
| `EmbeddingsModule` | Wraps `@xenova/transformers` (all-MiniLM-L6-v2) to generate normalized vectors. |
| `VectorStoreModule` | Persists `{id, chunk, embedding}` pairs into `storage/vector-store.json` and performs cosine similarity search. |
| `LLMModule` | Unified entry-point for Ollama, OpenAI, Gemini calls. Expects provider+model+apiKey per request. |
| `SimulationModule` | Implements scenario generation, employee/customer replies, evaluation, and exposes REST endpoints. |
| `SystemModule` | Health checks (e.g., Ollama connection). |

### API Surface
`POST /api/manuals`  
- multipart/form-data (`files[]`, `embedRatio`)
- returns chunk counts, persisted manual summary

`POST /api/simulations/customer/respond`  
- `{ message, providerConfig }`
- retrieves relevant chunks, produces AI employee reply + raw context

`POST /api/simulations/employee/respond`  
- `{ message, providerConfig }`
- evaluates reply, generates next customer utterance, returns `{ evaluation, nextCustomerMessage, context }`

`POST /api/simulations/scenario`  
- `{ providerConfig }`
- generates a fresh scenario (`situation`, `customerType`, `firstMessage`)

`GET /api/system/ollama`  
- returns `{ connected: boolean, models?: string[] }`

All endpoints respond with 4xx errors if manuals were not uploaded yet.

## Frontend Structure
- `pages/App.tsx`: orchestrates layout (sidebar + main area) and routes API calls.
- `components/SidebarSettings.tsx`: handles uploads, embedding slider, provider selection, API key inputs, stats.
- `components/RoleCard.tsx`: CTA cards for "고객" vs "직원".
- `components/ChatWindow.tsx`: ChatGPT-style bubbles with scroll locking.
- `components/EvaluationPanel.tsx`: displays evaluation + feedback for 직원 모드.
- `hooks/useSimulation.ts`: manages conversation state machine and API interactions.
- `services/api.ts`: typed wrappers around backend endpoints.

### UI Flow
1. Upload files → call `POST /api/manuals` with slider ratio.
2. Choose role:
   - 직원 모드 triggers `/scenario` to preload AI 고객 첫 발화.
   - 고객 모드 just waits for user message.
3. Each message → call corresponding simulation endpoint.
4. 직원 모드 displays evaluation + auto-injects next 고객 발화.
5. Stats (counts/avg) tracked client-side, mirroring Streamlit behavior.

## Environment Config
- Frontend uses `VITE_API_BASE_URL` (default `http://localhost:3000`).
- Backend uses `.env` for optional default API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`) and Ollama host (`OLLAMA_HOST`). User-entered keys override.

## Outstanding Considerations
- Embedding downloads (~90MB) happen on first backend run; document this in README.
- Keep `work_simulator_db/` untouched for historical runs.
- Add integration tests later for manual ingestion + both roles once time allows.
