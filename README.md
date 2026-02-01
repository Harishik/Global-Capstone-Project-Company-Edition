[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# 🌐 Global Capstone Project (Company Edition)

## Intellecta - Enterprise RAG System with Multi-Level Security

An advanced Retrieval-Augmented Generation (RAG) system designed for enterprise document intelligence with 5-tier security classification, multi-language support, and real-time analytics.

![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi)
![Qdrant](https://img.shields.io/badge/Qdrant-Vector%20DB-red)
![LLaMA](https://img.shields.io/badge/LLaMA-3.2%208B-purple)

---

## 🎯 Key Features

| Feature | Description |
|---------|-------------|
| **🚀 Dual Query Modes** | Fast Mode (speed-optimized) & Quality Mode (accuracy-optimized) |
| **🔐 5-Level Security** | PUBLIC → INTERNAL → CONFIDENTIAL → SECRET → TOP_SECRET |
| **🌍 Multi-Language** | English, Korean, Vietnamese support with auto-detection |
| **🔍 Smart Retrieval** | Two-stage retrieval: Dense vector search + Neural reranking |
| **📊 Real-time Analytics** | Performance metrics, accuracy tracking, interactive dashboards |
| **📄 Document Processing** | PDF, DOCX, TXT, CSV, JSON with intelligent semantic chunking |
| **⚡ High Performance** | Qwen3-VL embeddings (2048 dim) + LLaMA 3.2 generation |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + TypeScript + Vite)               │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────────┐    │
│  │   Dashboard    │  │ Document Ingest  │  │   Query Interface    │    │
│  │  • Statistics  │  │  • File Upload   │  │  • RAG Q&A           │    │
│  │  • Analytics   │  │  • Batch Ingest  │  │  • Source Citations  │    │
│  │  • Charts      │  │  • Security Tag  │  │  • Metrics Display   │    │
│  └────────────────┘  └──────────────────┘  └──────────────────────┘    │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ REST API (Port 8000)
┌─────────────────────────────────▼───────────────────────────────────────┐
│                      BACKEND (FastAPI + Python 3.11)                    │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────────┐    │
│  │   RAG Engine   │  │ Security Module  │  │  Document Processor  │    │
│  │  • Fast Mode   │  │  • 5-Level ACL   │  │  • PDF/DOCX/CSV      │    │
│  │  • Quality Mode│  │  • Content Scan  │  │  • Semantic Chunking │    │
│  │  • LLaMA 3.2   │  │  • Regex Detect  │  │  • Metadata Extract  │    │
│  └────────────────┘  └──────────────────┘  └──────────────────────┘    │
│  ┌────────────────┐  ┌──────────────────┐                              │
│  │   Embedding    │  │    Retriever     │                              │
│  │  • Qwen3-VL-2B │  │  • Qdrant Search │                              │
│  │  • 2048 dims   │  │  • Reranking     │                              │
│  │  • Reranker    │  │  • Filtering     │                              │
│  └────────────────┘  └──────────────────┘                              │
└───────────────┬─────────────────────────────────────┬───────────────────┘
                │                                     │
┌───────────────▼───────────────┐    ┌───────────────▼───────────────────┐
│         Qdrant                │    │          PostgreSQL               │
│    (Vector Database)          │    │     (Relational Database)         │
│  • Port: 6333/6334            │    │  • Port: 5433                     │
│  • Collection: intellecta_*   │    │  • DB: intellecta                 │
│  • Cosine Similarity          │    │  • Documents, Chunks, History     │
└───────────────────────────────┘    └───────────────────────────────────┘
                │
┌───────────────▼───────────────┐
│          Ollama               │
│    (LLM Inference Server)     │
│  • Port: 11434                │
│  • Model: llama3.2:latest     │
│  • keep_alive: -1 (persistent)│
└───────────────────────────────┘
```

---

## 🛠️ Technology Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **FastAPI** | 0.109.0 | High-performance REST API framework |
| **Qdrant** | 1.7.0 | Vector database for semantic search |
| **PostgreSQL** | 16 | Relational database for metadata |
| **Qwen3-VL-Embedding-2B** | Latest | Text embeddings (2048 dimensions) |
| **Qwen3-Reranker-0.6B** | Latest | Neural reranking for precision |
| **LLaMA 3.2 (8B)** | Latest | Response generation via Ollama |
| **PyTorch** | ≥2.1.0 | Deep learning framework |
| **Transformers** | ≥4.37.0 | Hugging Face model loading |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.1 | Modern UI framework |
| **TypeScript** | 5.8.3 | Type-safe JavaScript |
| **Vite** | 7.3.1 | Next-gen build tool |
| **TailwindCSS** | 3.4.17 | Utility-first CSS |
| **shadcn/ui** | Latest | Beautiful component library |
| **TanStack Query** | 5.83.0 | Powerful data fetching |
| **React Router** | 6.30.1 | Client-side routing |
| **Recharts** | 2.15.4 | Analytics visualizations |

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| Docker | Latest | `docker --version` |
| Ollama | Latest | `ollama --version` |

### Step 1: Clone the Repository

```bash
git clone https://github.com/Harishik/Global-Capstone-Project-Company-Edition.git
cd Global-Capstone-Project-Company-Edition
```

### Step 2: Start Docker Services

```bash
# Start PostgreSQL (Port 5433)
docker run -d --name intellecta-postgres \
  -e POSTGRES_USER=intellecta \
  -e POSTGRES_PASSWORD=intellecta123 \
  -e POSTGRES_DB=intellecta \
  -p 5433:5432 \
  postgres:16-alpine

# Start Qdrant Vector Database (Port 6333)
docker run -d --name intellecta-qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  qdrant/qdrant
```

### Step 3: Setup Ollama LLM

```bash
# Pull LLaMA 3.2 model
ollama pull llama3.2:latest

# Verify model is available
ollama list
```

### Step 4: Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (Linux/Mac)
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

> ⚠️ **Note**: First startup takes 2-3 minutes to load Qwen3-VL models on CPU.

### Step 5: Setup Frontend

```bash
cd Global_Capstone_Frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Step 6: Access the Application

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:8080 |
| **Backend API** | http://localhost:8000 |
| **API Documentation** | http://localhost:8000/docs |
| **Qdrant Dashboard** | http://localhost:6333/dashboard |

---

## 📡 API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/query` | Submit a RAG query with security level |
| `POST` | `/ingest` | Upload and ingest a single document |
| `POST` | `/batch-ingest` | Batch upload multiple documents |
| `GET` | `/documents` | List all ingested documents |
| `DELETE` | `/documents/{id}` | Delete a specific document |
| `GET` | `/history` | Get query history |
| `GET` | `/stats` | Get system statistics |
| `GET` | `/health` | Health check endpoint |

### Query Request Example

```json
{
  "query": "What is the total energy capacity?",
  "document_ids": ["doc-123", "doc-456"],
  "security_level": "CONFIDENTIAL",
  "mode": "quality",
  "top_k": 5
}
```

### Query Response Example

```json
{
  "answer": "Based on the documents, the total energy capacity is 500 MW...",
  "sources": [
    {
      "filename": "energy_report.pdf",
      "chunk_index": 3,
      "score": 0.92,
      "text": "The facility has a capacity of..."
    }
  ],
  "metrics": {
    "accuracy": 0.865,
    "precision": 0.91,
    "retrieval_time_ms": 245,
    "generation_time_ms": 1520
  }
}
```

---

## 🔒 Security Framework

### 5-Level Classification System

| Level | Value | Description | Use Case |
|-------|-------|-------------|----------|
| `PUBLIC` | 0 | Open access | General documentation |
| `INTERNAL` | 1 | Internal staff only | Company policies |
| `CONFIDENTIAL` | 2 | Need-to-know basis | Financial reports |
| `SECRET` | 3 | Restricted access | Strategic plans |
| `TOP_SECRET` | 4 | Maximum clearance | Critical infrastructure |

### Security Features

- **Content Scanning**: Automatic detection of sensitive patterns (SSN, emails, salaries)
- **Access Control**: Query results filtered by user's clearance level
- **Audit Logging**: All queries and access attempts are logged
- **Multi-language Detection**: Security keywords in EN, KO, VI

---

## 📁 Project Structure

```
Global_Capstone_Project_(Company_Edition)/
├── 📂 backend/
│   ├── main.py                 # FastAPI application & endpoints
│   ├── rag_engine.py           # RAG orchestration (Fast/Quality modes)
│   ├── embedding.py            # Qwen3-VL embedding & reranking
│   ├── retriever.py            # Qdrant vector search & filtering
│   ├── document_processor.py   # Document parsing & chunking
│   ├── security.py             # 5-level security framework
│   ├── database.py             # PostgreSQL database manager
│   ├── models.py               # Pydantic request/response schemas
│   ├── load_datasets.py        # Dataset pretraining utilities
│   └── requirements.txt        # Python dependencies
│
├── 📂 Global_Capstone_Frontend/
│   ├── 📂 src/
│   │   ├── 📂 pages/
│   │   │   ├── Dashboard.tsx       # System dashboard & analytics
│   │   │   ├── DocumentIngestion.tsx # Document upload interface
│   │   │   ├── QueryResponse.tsx   # RAG query interface
│   │   │   └── NotFound.tsx        # 404 page
│   │   ├── 📂 components/
│   │   │   ├── 📂 ui/              # shadcn/ui components
│   │   │   └── 📂 layout/          # Layout components
│   │   ├── 📂 services/
│   │   │   └── api.ts              # API client
│   │   └── 📂 hooks/               # Custom React hooks
│   ├── package.json
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
├── .gitignore
└── README.md
```

---

## 📊 Pretrained Datasets

The system comes pretrained with 4 energy sector datasets (62 chunks):

| Dataset | Files | Domain | Description |
|---------|-------|--------|-------------|
| **OPSD** | 8 | Power Plants | Open Power System Data |
| **NAB** | 8 | Time Series | Numenta Anomaly Benchmark |
| **NREL** | 8 | Solar Energy | National Renewable Energy Lab |
| **ORNL** | 7 | Buildings | Oak Ridge National Lab |

To pretrain additional datasets:

```bash
cd backend
python pretrain_datasets.py
```

---

## 🧪 Testing

### Backend Health Check

```bash
curl http://localhost:8000/health
```

### Sample Query

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the energy capacity?", "security_level": "PUBLIC"}'
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Port 5432 in use** | We use port 5433 for PostgreSQL |
| **Model loading slow** | First load takes 2-3 min on CPU, subsequent loads are cached |
| **Qdrant connection failed** | Ensure Docker container is running: `docker ps` |
| **Ollama not responding** | Start Ollama: `ollama serve` |
| **CUDA out of memory** | Models run on CPU by default |

---

## 👥 Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/Harishik">
        <b>Harishik</b>
      </a>
      <br />
      <sub>Project Lead</sub>
    </td>
    <td align="center">
      <a href="https://github.com/chinimini532">
        <b>chinimini532</b>
      </a>
      <br />
      <sub>Co-Lead</sub>
    </td>
  </tr>
</table>

---

## 📄 License

This project is developed as part of the **Global Capstone Program (Company Edition)** for educational and demonstration purposes.

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

---

## 📞 Support

For questions or issues:
- Open a [GitHub Issue](https://github.com/Harishik/Global-Capstone-Project-Company-Edition/issues)
- Check existing documentation in `/docs`

---

<p align="center">
  <b>Built with ❤️ for the Global Capstone Program</b>
</p>
