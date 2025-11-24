# 🎯 실전형 업무 시뮬레이터 for 신입

신입 직원과 아르바이트생을 위한 AI 기반 고객 응대 연습 도구입니다. 매뉴얼 기반 RAG(Retrieval-Augmented Generation) 파이프라인으로 실제 업무 상황을 모사하고, 즉시 피드백을 받아 역량을 강화할 수 있습니다.

## 🚀 신규 아키텍처 개요
기존 Streamlit 단일 앱을 **Frontend(React)**, **Backend(NestJS)** 로 분리하여 유지보수성과 확장성을 확보했습니다.

```
PWS_V2/
├── backend/        # NestJS API (문서 처리, 임베딩, LLM 라우팅, 시뮬레이션)
├── frontend/       # React + Vite UI (ChatGPT 스타일 인터랙션)
├── docs/           # 설계 문서 및 가이드
├── work_simulator_db/  # 기존 Chroma DB 자산 (참고용)
└── app.py          # 레거시 Streamlit 버전 (비교/백업용)
```

### Backend 하이라이트
- 파일 업로드 & 텍스트 추출 (PDF/TXT/Excel)
- SentenceTransformer 임베딩 (`@xenova/transformers`) + 로컬 JSON 벡터 스토어 (`storage/vector-store.json`)
- LLM 호출 라우팅: **Ollama / OpenAI / Google Gemini**
- 시뮬레이션 엔드포인트: 고객/직원 역할, 응답 평가, 시나리오 생성

### Frontend 하이라이트
- Streamlit + ChatGPT 감성을 살린 UI/UX (사이드바 + 챗 인터페이스)
- 매뉴얼 업로드, LLM 설정, 학습 통계 관리
- 고객/직원 모드 토글, 실시간 대화, 평가 패널 및 시나리오 리셋 버튼

## ⚙️ 요구 사항
- **Node.js 20.19.0 이상** (Vite 7이 요구. 현재 20.17 사용 시 빌드 시 경고가 출력됩니다)
- Python 환경은 레거시 `app.py` 실행 시에만 필요합니다.

## 🧭 실행 방법

### 1) Backend API (NestJS)
```bash
cd backend
cp .env.example .env   # 필요 시 API Key 입력
npm install
npm run start:dev      # http://localhost:3000
```
환경 변수
- `PORT` (기본 3000)
- `FRONTEND_ORIGIN` (기본 http://localhost:5173)
- `OPENAI_API_KEY`, `GEMINI_API_KEY` (선택 입력)

### 2) Frontend (React + Vite)
```bash
cd frontend
cp .env.example .env   # API Base URL 지정
npm install
npm run dev            # http://localhost:5173
```
- `.env`의 `VITE_API_BASE_URL`을 백엔드 주소로 설정
- `npm run build` 시 Node 20.19+ 권장 (20.17에서는 경고 출력 후 빌드 진행)

## 🌐 핵심 API
| Method | Path | 설명 |
| --- | --- | --- |
| `POST` | `/api/manuals` | 다중 파일 업로드 + 임베딩 학습 (`embedRatio` 필드 사용) |
| `POST` | `/api/simulations/scenario` | 직원 모드용 새 고객 시나리오 생성 |
| `POST` | `/api/simulations/customer/respond` | 고객 모드: AI 직원 응답 |
| `POST` | `/api/simulations/employee/respond` | 직원 모드: 평가 + 다음 고객 발화 |
| `GET` | `/api/system/ollama` | 로컬 Ollama 연결 상태/모델 목록 |

## 🖥️ UI 흐름
1. **매뉴얼 업로드**: PDF/TXT/Excel 업로드, 임베딩 비율 조정
2. **LLM 설정**: Ollama/OpenAI/Gemini + 모델 선택, 필요 시 API Key 입력
3. **역할 선택**: 고객/직원 카드 클릭 → 챗 인터페이스 활성화
4. **대화 진행**
   - 고객 모드: 사용자가 문의 → AI 직원 응답
   - 직원 모드: AI 고객 질문 → 사용자가 응답 → AI 평가 & 새 시나리오
5. **학습 통계**: 사이드바에서 누적 시뮬레이션, 평균 점수 확인

## 🧠 주요 기능 요약
- PDF, TXT, Excel 등 다양한 문서 실시간 학습
- 고객 ↔ 직원 양방향 시뮬레이션과 즉시 평가
- 학습 통계(누적 횟수/평균 점수) 및 시나리오 리셋 기능
- 로컬 Ollama, OpenAI, Gemini 등 다양한 모델 선택 지원

## 🛠️ 기술 스택
- **Frontend**: React 19, TypeScript, Vite 7
- **Backend**: NestJS 11, class-validator, multer
- **임베딩/LLM**: `@xenova/transformers`, Ollama SDK, OpenAI SDK, Google Generative AI
- **Vector Store**: 로컬 JSON (자동 `.gitignore` 처리)

## 🧾 문서 & 참고
- `docs/architecture-plan.md`: Streamlit → React/Nest 전환 로드맵
- `backend/.env.example`, `frontend/.env.example`: 환경 변수 템플릿
- `app.py`: 기존 Streamlit 구현 저장본

## 🐛 문제 해결 팁
- **Ollama 연결 실패**: `ollama list`로 서비스 확인 → 백엔드 재기동
- **임베딩 최초 로드 지연**: `@xenova/transformers` 모델(약 90MB) 다운로드 시간 필요
- **Vite Node 경고**: `nvm install 20.19.0 && nvm use 20.19.0` 권장
- **OpenAI/Gemini 오류**: `.env`에 API Key 입력 여부 확인

---
**지금 바로 매뉴얼을 업로드하고, 실제처럼 몰입감 있는 고객 응대 연습을 시작해보세요!**
