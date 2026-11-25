# Food Donation Admin Website

A modern, responsive admin dashboard designed to manage and monitor food donation activities. The project aims to provide an organized platform for overseeing food donation operations and supporting efficient food distribution.

## Project Overview

The **Food Donation Admin Website** is an administrative web application developed to simplify the management of food donation activities.

It provides an interface for administrators to monitor donation-related information, organize records, and manage operations through a centralized dashboard.

The project focuses on creating a user-friendly, responsive, and scalable administrative interface using modern web technologies.

## Objectives

- Simplify the administration of food donation activities.
- Provide a centralized dashboard for managing donation-related information.
- Improve the organization and monitoring of food donation records.
- Build a responsive and user-friendly administrative interface.
- Support future expansion with database integration.

## Key Highlights

- Modern admin dashboard interface.
- Responsive web application architecture.
- Interactive data visualization using charts.
- PostgreSQL database integration support.
- Drizzle ORM for database operations.
- Demo mode for frontend preview.
- Modular and maintainable project structure.

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js 16 | React-based web framework |
| React 19 | User interface development |
| TypeScript | Type-safe development |
| Tailwind CSS 4 | Styling and responsive design |
| PostgreSQL | Relational database |
| Drizzle ORM | Database management |
| Recharts | Data visualization |
| Lucide React | Icons |
| ESLint | Code quality and linting |

## Project Structure

```text
food-donation-admin-website/
│
├── src/                  # Application source code
│
├── .env.example          # Example environment configuration
├── .gitignore            # Git ignored files
├── drizzle.config.json   # Drizzle configuration
├── next.config.ts        # Next.js configuration
├── package.json          # Project dependencies and scripts
├── package-lock.json     # Dependency lock file
├── postcss.config.mjs    # PostCSS configuration
└── tsconfig.json         # TypeScript configuration
```

## Installation and Setup

Follow these steps to run the project locally.

### 1. Clone the Repository

```bash
git clone https://github.com/titli-cloud/food-donation-admin-website.git
```

### 2. Navigate to the Project Directory

```bash
cd food-donation-admin-website
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory.

For frontend-only demo mode, add:

```env
ADMIN_DEMO_MODE=true
NEXT_PUBLIC_ADMIN_DEMO_MODE=true
```

You can also copy the provided example file:

```bash
copy .env.example .env.local
```

**Note:** Demo mode uses sample data for frontend preview. A properly configured database is required for saving changes.

### 5. Start the Development Server

```bash
npm run dev
```

### 6. Open the Application

Visit:

```text
http://localhost:3000
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the development server |
| `npm run build` | Builds the production application |
| `npm run start` | Starts the production server |
| `npm run lint` | Checks code quality |
| `npm run typecheck` | Checks TypeScript errors |

## Database

The project uses **PostgreSQL** as its relational database and **Drizzle ORM** for database interactions.

The database layer is intended to support structured storage and management of application data.

For persistent data operations, configure the PostgreSQL connection and the required environment variables before running database-dependent functionality.

## Future Enhancements

- Administrator authentication and role-based access control.
- Food donor registration and management.
- Donation request tracking.
- Food availability and inventory management.
- NGO and recipient management.
- Donation status tracking.
- Real-time notifications.
- Analytics and donation reports.
- Food distribution tracking.

## Project Impact

Food donation management systems can help improve the coordination between food donors and organizations involved in food distribution.

This project explores how web technologies can support better organization, transparency, and efficiency in food donation operations.

## Developer

**Titli Das**

B.Tech – Computer Science and Engineering

GitHub: [@titli-cloud](https://github.com/titli-cloud)

## License

This project is currently maintained as a development project. Licensing terms can be added when a license is selected.

---

If you find this project interesting, consider giving the repository a star.

**Repository:** [Food Donation Admin Website](https://github.com/titli-cloud/food-donation-admin-website)
