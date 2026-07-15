# Architecture: Release Watcher

Release Watcher is a **microservice-based** Node.js application. It consists of a **Main API** service and a **Notification** microservice, connected via three transport paths (BullMQ queue, gRPC, REST fallback).

---

## 1. High-Level Overview

```mermaid
flowchart TB
    subgraph Clients["Clients"]
        Browser["Browser SPA"]
        APIConsumer["API Consumer"]
        Postman["Postman"]
    end

    subgraph MainAPI["Main API Service (:3000)"]
        Routes["Routes / Controllers"]
        Services["Services (Business Logic)"]
        Repos["Repositories"]
        Saga["Saga Orchestrator"]
        Scheduler["Scheduler (node-cron)"]
        Broker["Message Broker (BullMQ)"]
    end

    subgraph NotifSvc["Notification Service (:3001 / :50051)"]
        Consumer["BullMQ Consumer"]
        GrpcH["gRPC Handlers"]
        RestR["REST Routes"]
        EmailSvc["Email Service"]
        Resend["Resend Provider"]
        SMTP["SMTP Provider"]
    end

    Redis[("Redis :6379")]
    Postgres[("PostgreSQL :5432")]
    ResendAPI["Resend API"]
    SMTPServer["SMTP Server"]

    Browser -->|HTTP| Routes
    APIConsumer -->|HTTP| Routes
    Postman -->|HTTP| Routes

    Routes --> Services --> Repos
    Services --> Saga
    Services --> Scheduler
    Services --> Broker
    Repos --> Postgres
    Broker --> Redis
    Redis --> Consumer
    Broker -.gRPC fallback.-> GrpcH
    Broker -.REST fallback.-> RestR

    Consumer --> EmailSvc
    GrpcH --> EmailSvc
    RestR --> EmailSvc
    EmailSvc --> Resend --> ResendAPI
    EmailSvc --> SMTP --> SMTPServer
```

---

## 2. Layered Architecture

The application is built based on the principle of **layered architecture**: each layer can depend only on the layers below it.

```mermaid
flowchart TB
    P["Presentation<br/>Routes / Controllers / Middleware / gRPC Handlers"]
    A["Application<br/>Services (Subscription, Scanner, GitHub, Notification)<br/>Saga Orchestrator / Validators"]
    I["Infrastructure<br/>Repositories / Message Broker / Cache / Scheduler<br/>External Clients (GitHub API, gRPC, Email Providers)"]
    S["Shared / Cross-cutting<br/>Config / Logger / Constants / Metrics / DB Connection"]

    P --> A --> I --> S
```

### Layer Dependency Rules

| Layer          | May Depend On                       | Must NOT Depend On        |
| -------------- | ----------------------------------- | ------------------------- |
| Presentation   | Application, Infrastructure, Shared | —                         |
| Application    | Infrastructure, Shared              | Presentation              |
| Infrastructure | Shared                              | Presentation, Application |
| Shared         | Nothing (self-contained)            | All other layers          |

---

## 3. Module Structure — Main App

```
src/
├── server.js                          # Entry point (bootstrap)
├── app.js                             # Express application factory
│
├── modules/                           # Feature modules
│   ├── subscription/
│   │   ├── subscriptionRoutes.js      # [Presentation]   HTTP endpoints
│   │   ├── subscriptionService.js     # [Application]    Business logic
│   │   ├── subscriptionRepository.js  # [Infrastructure] DB access
│   │   └── subscriptionValidator.js   # [Application]    Input validation
│   │
│   ├── github/
│   │   ├── githubService.js           # [Application]    Release checking
│   │   └── githubApiClient.js         # [Infrastructure] GitHub API calls
│   │
│   ├── scanner/
│   │   ├── scannerService.js          # [Application]    Scan orchestration
│   │   └── repoRepository.js          # [Infrastructure] Repo DB access
│   │
│   └── notification/
│       └── notificationClient.js      # [Infrastructure] Multi-transport
│
├── infrastructure/
│   ├── saga/
│   │   ├── sagaOrchestrator.js        # [Application]    Saga execution
│   │   ├── subscribeSaga.js           # [Application]    Subscription saga
│   │   └── sagaLog.js                 # [Infrastructure] Saga persistence
│   │
│   ├── messageBroker/
│   │   ├── eventPublisher.js          # [Infrastructure] BullMQ producer
│   │   └── eventTypes.js              # [Shared]         Event constants
│   │
│   └── scheduler.js                   # [Infrastructure] Cron jobs
│
├── grpc/
│   ├── clients/notificationClient.js  # [Infrastructure] gRPC client
│   └── proto.js                       # [Infrastructure] Proto loader
│
├── cache/
│   └── redisCache.js                  # [Infrastructure] Redis cache
│
├── middleware/
│   ├── apiKey.js                      # [Presentation]   Auth middleware
│   ├── metricsMiddleware.js           # [Presentation]   Prometheus
│   └── errorHandler.js                # [Presentation]   Error formatting
│
├── config/index.js                    # [Shared] Environment config
├── db/                                # [Shared] Database connection
├── metrics/index.js                   # [Shared] Metrics registry
├── utils/                             # [Shared] Logger, validation
└── constants/messages.js              # [Shared] Response messages
```

## 3.1 Module Structure — Notification Service

```
services/notification/src/
├── server.js                          # Entry point
├── app.js                             # Express setup
├── config.js                          # [Shared] Environment config
├── logger.js                          # [Shared] Winston logger
│
├── routes/
│   └── notificationRoutes.js          # [Presentation] REST endpoints
│
├── grpc/
│   ├── server.js                      # [Presentation]   gRPC server
│   ├── proto.js                       # [Infrastructure] Proto loader
│   └── handlers/
│       ├── confirmationHandler.js     # [Presentation] Confirmation RPC
│       └── releaseHandler.js          # [Presentation] Release RPC
│
├── consumers/
│   ├── notificationConsumer.js        # [Presentation] BullMQ consumer
│   └── eventTypes.js                  # [Shared] Event constants
│
├── services/
│   └── emailService.js                # [Application] Email logic
│
├── providers/
│   ├── resendProvider.js              # [Infrastructure] Resend API
│   └── smtpProvider.js                # [Infrastructure] SMTP/Nodemailer
│
├── templates/
│   └── emailTemplates.js              # [Shared] Email HTML templates
│
└── utils/
    └── errorDetails.js                # [Shared] Error helpers
```

---

## 4. Dependency Graph Between Modules

```mermaid
flowchart LR
    subRoutes["subscriptionRoutes"] --> subService["subscriptionService"]
    subService --> subRepo["subscriptionRepository"]
    subService --> ghService["githubService"]
    ghService --> ghClient["githubApiClient"]
    ghClient --> redisCache["redisCache"]
    subService --> sagaOrch["sagaOrchestrator"]
    sagaOrch --> subscribeSaga["subscribeSaga"]
    subscribeSaga --> subRepo
    subscribeSaga --> notifClient["notificationClient"]
    notifClient --> eventPub["eventPublisher (BullMQ)"]
    notifClient --> grpcClient["gRPC client"]
    notifClient --> httpClient["HTTP (axios)"]

    scannerService["scannerService"] --> ghService
    scannerService --> repoRepo["repoRepository"]
    scannerService --> subRepo
    scannerService --> notifClient
```

---

## 5. Data Flow Diagrams

### 5.1 Subscribe Flow (with Saga)

```mermaid
sequenceDiagram
    participant Client
    participant MainAPI as Main API (Saga)
    participant DB as PostgreSQL
    participant Notif as Notification Service

    Client->>MainAPI: POST /api/subscribe
    activate MainAPI
    MainAPI->>DB: Step 1 — INSERT subscription
    MainAPI->>Notif: Step 2 — Send Email (Queue → gRPC → REST)
    MainAPI-->>Client: 201 Created
    deactivate MainAPI
```

### 5.2 Release Scanner Flow

```mermaid
sequenceDiagram
    participant Cron as Scheduler (cron)
    participant Scanner as Scanner Service
    participant GitHub as GitHub API
    participant DB as PostgreSQL
    participant Notif as Notification Service

    Cron->>Scanner: trigger scan
    Scanner->>DB: get confirmed repos
    DB-->>Scanner: repo list
    loop for each repo
        Scanner->>GitHub: GET latest release
        GitHub-->>Scanner: release info
        alt new release found
            Scanner->>Notif: notify subscribers
            Scanner->>DB: update last_seen_tag
        end
    end
```

### 5.3 Notification Delivery — Multi-Transport Fallback

```mermaid
flowchart TD
    Client["notificationClient.js"] -->|"1. BullMQ Queue (Primary)"| Redis[(Redis)]
    Redis --> Consumer["BullMQ Consumer"] --> Email1["emailService"]
    Client -.->|"2. gRPC (Fallback, if 1 fails)"| GrpcH["gRPC Handler"] --> Email2["emailService"]
    Client -.->|"3. REST HTTP (Last resort, if 2 fails)"| RestR["REST Route"] --> Email3["emailService"]
```

---

## 6. Infrastructure & Observability

```mermaid
flowchart LR
    subgraph Stack["Docker Compose Stack"]
        App["App :3000"]
        NotifSvc["Notif Svc :3001 / :50051"]
        PG["PostgreSQL :5432"]
        Redis["Redis :6379"]
        Prom["Prometheus :9090"]
        Graf["Grafana :3002"]
        ES["Elasticsearch :9200"]
        Kib["Kibana :5601"]
    end

    App -->|/metrics| Prom --> Graf
    App --> ES --> Kib
```

---

## 7. Technology Stack

| Component        | Technology                    | Purpose                     |
| ---------------- | ----------------------------- | --------------------------- |
| Runtime          | Node.js + Express             | HTTP API server             |
| Database         | PostgreSQL 16                 | Persistent storage          |
| Cache / Queue    | Redis 7 + BullMQ              | Caching & async jobs        |
| RPC              | gRPC + Protocol Buffers       | Inter-service communication |
| Email (primary)  | Resend API                    | Transactional email         |
| Email (fallback) | Nodemailer / SMTP             | Email fallback              |
| Scheduler        | node-cron                     | Periodic release scanning   |
| Metrics          | Prometheus + prom-client      | Application metrics         |
| Dashboards       | Grafana                       | Metrics visualization       |
| Logging          | Winston + Elasticsearch       | Structured logging          |
| CI/CD            | GitHub Actions                | Automated testing           |
| Deployment       | Docker + Render               | Containerized deployment    |
| Testing          | Jest + Supertest + Playwright | Unit / Integration / E2E    |

---

## 8. Key Design Decisions

| Decision                        | Rationale                                  | ADR                                                        |
| ------------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| PostgreSQL as primary datastore | ACID guarantees for subscriptions          | [ADR-001](adrs/ADR-001-postgresql-as-primary-datastore.md) |
| Multi-provider email delivery   | Reliability via Resend + SMTP fallback     | [ADR-002](adrs/ADR-002-email-delivery-strategy.md)         |
| Saga pattern for subscribe      | Atomic multi-step with compensation        | —                                                          |
| Triple transport fallback       | Queue → gRPC → REST ensures delivery       | —                                                          |
| Separate notification service   | Isolation of concerns, independent scaling | —                                                          |
