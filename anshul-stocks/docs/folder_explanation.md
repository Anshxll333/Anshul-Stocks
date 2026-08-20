# Folder Explanation

Detailed overview of the folder structure of **Anshul Stocks**.

## Structure

```
anshul-stocks/
├── frontend/        # React + Vite client application
│   ├── public/         # Static files (icons, logo images, assets)
│   └── src/            # Application source code
│       ├── api/        # Axios custom client wrappers for API requests
│       ├── components/ # Reusable React UI components and layouts
│       ├── hooks/      # Shared custom React hooks
│       ├── images/     # Embedded images & assets
│       ├── pages/      # Router pages (Home, AI Mentor, Stocks, IPO, Login, Register, Profile, NotFound)
│       ├── styles/     # Global stylesheets and CSS directives
│       ├── types/      # Typescript contracts & interfaces
│       └── utils/      # Standard string formatting and dates utilities
├── backend/         # NestJS application server
│   ├── src/            # Backend typescript modules
│   │   ├── auth/       # Passport, JWT authentication logic & controllers
│   │   ├── stocks/     # Stock price listing queries and symbol lookup
│   │   ├── ipo/        # IPO track lists and grading details
│   │   ├── users/      # Postgres SQL mapping for users
│   │   ├── ai/         # AI investment mentor engine services
│   │   ├── news/       # RSS news crawlers and processors
│   │   ├── database/   # Drizzle database configurations, connection, schemas
│   │   ├── config/     # Nest configuration settings
│   │   ├── middleware/ # Exception handlers & custom middlewares
│   │   ├── jobs/       # Nest schedule cron jobs
│   │   └── utils/      # Custom Logger services
│   └── test/           # End-to-end (e2e) tests
├── database/        # Storage folder for SQL schemas, local scripts, and seeds
├── docs/            # Platform architectural markdown guides
└── scripts/         # Shell automation and provisioning scripts
```
