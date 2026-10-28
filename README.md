# Business IT Service Desk

A full-stack IT service desk application built to support ticket management, troubleshooting documentation, and IT support workflows.

## Overview

The Business IT Service Desk is a portfolio project designed to demonstrate how software development can support day-to-day IT operations. It provides a centralized way to manage support tickets, track their status, assign priorities and technicians, and document troubleshooting activities.

**Project Status:** In Progress

## Features

- **Ticket Management:** Create and view IT support tickets.
- **Priority Tracking:** Categorize tickets as Low, Medium, High, or Critical.
- **Status Management:** Track tickets through Open, In Progress, and Resolved statuses.
- **Technician Assignment:** Assign tickets to relevant IT support roles.
- **Troubleshooting Notes:** Document investigation steps and resolutions.
- **Ticket Activity:** View activity associated with individual tickets.

## Technology Stack

**Backend**
- C#
- ASP.NET Core Web API
- Entity Framework Core

**Frontend**
- React
- TypeScript
- Vite

**Database**
- Microsoft SQL Server

## Architecture

The application uses a frontend and backend architecture:

- **Frontend:** React and TypeScript provide the user interface.
- **Backend:** ASP.NET Core Web API handles ticket-related requests and application logic.
- **Database:** SQL Server stores ticket information and related records.

## Getting Started

### Prerequisites

Install the following tools:

- [.NET SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/)
- [Microsoft SQL Server](https://www.microsoft.com/en-us/sql-server)
- [Git](https://git-scm.com/)

### Clone the Repository

```bash
git clone https://github.com/AshleyPless/BusinessITServiceDesk.git
cd BusinessITServiceDesk
```

### Run the Backend

Open a terminal in the backend API project directory and run:

```bash
dotnet restore
dotnet run
```

Configure the database connection string for your local SQL Server instance before running the application. Apply the project's Entity Framework Core migrations if required.

### Run the Frontend

Open a separate terminal in the frontend directory and run:

```bash
npm install
npm run dev
```

Use the local URL displayed by Vite to open the frontend in your browser.

**Note:** The exact project directories, database configuration, and API URL may need to be adjusted to match your local environment.

## Skills Demonstrated

- Full-stack application development
- REST API development
- Relational database design and SQL
- Frontend development with React and TypeScript
- Ticket lifecycle and workflow management
- Troubleshooting and technical documentation
- Version control with Git and GitHub

## Future Improvements

- Enhanced ticket filtering and search
- Additional reporting and dashboard functionality
- Improved validation and error handling
- Authentication and role-based access control
- Automated testing and deployment

## Author

**Ashley Pless**

[GitHub Profile](https://github.com/AshleyPless)

---

This project is being developed for learning and portfolio purposes.
