# Verity — Flow Diagrams

> These diagrams reflect the **actual implementation** in `backend/`. Where a
> component is a deliberate simplification or not yet built, it is marked inline.

Verity exposes **two answer paths**:

- **`/research/query`** — the full agentic LangGraph (planner → retriever → grader →
  contradiction → generator → citation verifier → hallucination checker), with
  HyDE + graph retrieval enabled.
- **`/research/query/stream`** — a latency-optimized streaming path used by the chat
  UI: dense + sparse retrieval only (HyDE/graph disabled), token-by-token SSE, and
  the grader/contradiction/citation/hallucination nodes skipped for speed.

---

## 1. Full Agentic Query Flow — `/research/query`

> Source of truth: `backend/agents/graph.py`

```mermaid
flowchart TD
    A([User Query]) --> P[Planner<br/>complexity analysis + sub-queries]
    P --> R[Hybrid Retriever<br/>dense + sparse + HyDE + graph → RRF]
    R --> G{Grader<br/>chunks relevant?}

    G -->|relevant & chunks exist| CD[Contradiction Detector]
    G -->|not relevant / no chunks| WS[Web Search Agent]

    WS -->|results found| GEN[Generator]
    WS -->|nothing found| Z([End])

    CD --> GEN[Generator<br/>context-grounded answer]
    GEN --> CV[Citation Verifier<br/>checks 1 2 refs vs chunks]
    CV --> HC[Hallucination Checker<br/>answer grounded in context?]
    HC --> Q([Response])
```

---

## 2. Streaming Query Flow — `/research/query/stream` (chat UI)

> Source of truth: `backend/api/routes/research.py`

```mermaid
flowchart TD
    A([User Query]) --> RL{Rate limit OK?<br/>2 req / 20 min per IP}
    RL -->|no| E429([429 Too Many Requests])
    RL -->|yes| H[Load conversation history]

    H --> DG{Domain guard<br/>query on selected domain?}
    DG -->|off-domain| REF([Polite refusal])
    DG -->|ok / all| RET[Fast Retriever<br/>dense + sparse + RRF<br/>HyDE and graph DISABLED]

    RET --> C{best dense cosine ≥ 0.45?}
    C -->|yes| GEN[Stream Generator tokens - SSE]
    C -->|no| WEB[Web Search - Tavily / DuckDuckGo]

    WEB --> RAW[Use raw web text as context]
    WEB -. fire-and-forget .-> BG[(Celery: ingest web results into KB)]
    RAW --> GEN

    GEN --> SRC[Emit sources + pipeline-info events]
    SRC --> MEM[Save exchange to memory]
    MEM --> DONE([done])

    note["Note: grader, contradiction, citation and hallucination<br/>checks are skipped here for latency."]
```

---

## 3. Hybrid Retrieval (internals)

> Source of truth: `backend/retrieval/hybrid_retriever.py`

```mermaid
flowchart TD
    A([Query]) --> HY[HyDE: generate hypothetical answer<br/>used as dense query - full path only]
    A --> SP[Tokenize for BM25]

    subgraph Stage1["Stage 1 — Candidate fetch (concurrent)"]
        HY --> D[Qdrant cosine search<br/>top 20]
        SP --> S[PostgreSQL FTS - tsvector/GIN<br/>top 20]
        A --> GR[Graph: entity-overlap match<br/>top 10 - full path only]
    end

    subgraph Stage2["Stage 2 — Fusion"]
        D --> RRF[Reciprocal Rank Fusion<br/>score = Σ 1/&#40;k+rank&#41;, k=60]
        S --> RRF
        GR --> RRF
        RRF --> TOP[Top-K fused - default 8]
    end

    D --> BD[best_dense_score = max cosine 0–1]
    TOP --> OUT([chunks])
    BD --> THR{best_dense ≥ 0.45?}
    THR -->|yes| USE([Use KB context])
    THR -->|no| FALL([Web search fallback])

    note["No cross-encoder reranker yet — ranking is RRF only.<br/>RRF scores are rank-based (~0.013–0.033), so the web-fallback<br/>decision uses the raw dense cosine, not the RRF score."]
```

---

## 4. Document Ingestion Pipeline

> Source of truth: `backend/ingestion/pipeline.py` (7 steps)

```mermaid
flowchart TD
    A([Document: file path or URL]) --> HASH{SHA-256 file hash<br/>exists in Postgres?}
    HASH -->|yes| SKIP([Skip — duplicate])
    HASH -->|no| T{Detect type}

    T -->|pdf| PP[PDFParser — PyMuPDF<br/>+ figure descriptions via vision LLM]
    T -->|docx| DP[DOCXParser — python-docx]
    T -->|web url| WP[WebParser — trafilatura]
    T -->|txt / md| TP[TXTParser]

    PP --> CL[Clean text<br/>emails, DOIs, refs, page numbers]
    DP --> CL
    WP --> CL
    TP --> CL

    CL --> CH{Chunker by type}
    CH -->|pdf, txt| RC[RecursiveChunker]
    CH -->|docx| HC[HeadingChunker]
    CH -->|md| MC[MarkdownChunker]
    CH -->|web| SC[SemanticChunker*]

    RC --> FLT[Filter low-quality chunks]
    HC --> FLT
    MC --> FLT
    SC --> FLT

    FLT --> EMB[Batch embed — bge-small-en-v1.5, 384-dim]
    EMB --> ENT[Per-chunk entity extraction - LLM]
    ENT --> QD[(Qdrant — vectors + payload:<br/>entities, domain, chunk_type=base)]
    FLT --> PG[(PostgreSQL — Document + Chunk<br/>+ tsvector for FTS)]

    note["* SemanticChunker currently delegates to RecursiveChunker.<br/>RAPTOR cluster summaries are built separately via scripts/build_raptor.py."]
```

---

## 5. Adaptive KB — Self-Improving RAG

> Web ka raw content seedha LLM ko milta hai current response ke liye;
> ingestion background mein hoti hai taaki current request block na ho.

```mermaid
flowchart TD
    A([User Query]) --> B[Search internal KB<br/>dense + sparse → RRF]
    B --> C[best dense cosine score]
    C --> H{score ≥ 0.45?}

    H -->|strong KB hit| I[Use KB context]
    H -->|weak / missing| J[Web Search Agent<br/>Tavily → DuckDuckGo]

    J --> K[Fetch raw documents]
    K -->|FAST PATH — current request| I
    K -. FIRE AND FORGET .-> L

    subgraph BG["Background — Celery worker"]
        L[ingest_text task queued] --> M[clean] --> N[chunk] --> O[embed] --> P[(store in Qdrant + Postgres)]
    end

    I --> Q[LLM generation] --> R([Streaming response])
    P -.->|next time — direct KB hit| S([No web call needed])
```

---

## 6. LangGraph Agent States

> Source of truth: `backend/agents/graph.py`

```mermaid
stateDiagram-v2
    [*] --> Planner
    Planner --> Retriever
    Retriever --> Grader

    Grader --> ContradictionDetector : relevant and chunks
    Grader --> WebSearch : not relevant / no chunks

    WebSearch --> Generator : results found
    WebSearch --> [*] : nothing found

    ContradictionDetector --> Generator
    Generator --> CitationVerifier
    CitationVerifier --> HallucinationChecker
    HallucinationChecker --> [*]
```

---

## 7. Async Task Queue (Celery)

> Source of truth: `backend/workers/celery_app.py`, `backend/workers/tasks.py`

```mermaid
flowchart LR
    A([API request]) --> B[FastAPI handler]
    B --> C([Immediate response])
    B -. apply_async .-> D[(Redis broker)]

    D --> W[Celery worker — solo pool]
    W --> T1[ingest_document]
    W --> T2[ingest_text — web results]

    T1 --> M[(Qdrant + Postgres)]
    T2 --> M

    note["Single default queue + one solo worker today.<br/>Priority queues / multi-worker scaling = future work."]
```
</content>
