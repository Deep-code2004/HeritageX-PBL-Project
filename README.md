# Smart Tourism & Cultural Heritage Discovery Platform

> A digital platform for discovering heritage, culture, local experiences, and tourism destinations through a modern and intelligent web interface.

**Project Type:** B.Tech Computer Engineering — PBL Project  
**Project Status:** 🟢 Frontend Completed · 🚧 Backend Integration Pending  
**Live Frontend:** [https://heritage-x.netlify.app/](https://heritage-x.netlify.app/)

---

## 📌 Overview

The **Smart Tourism & Cultural Heritage Discovery Platform** is a web-based tourism platform designed to provide users with a centralized place to discover historical locations, cultural heritage, traditional arts, handicrafts, local food, festivals, heritage walks, nearby attractions, and other cultural experiences.

Tourists often depend on multiple platforms to find information about destinations, historical significance, routes, timings, local experiences, and nearby attractions. This project aims to bring these different aspects together into a single, user-friendly platform.

The system is designed to support **digital tourism, cultural heritage preservation, responsible tourism, and local community visibility**, while contributing to the vision of **Viksit Bharat @2047** and relevant Sustainable Development Goals (SDG 8, SDG 11, and SDG 12).

---

## 🎯 Objectives

The primary objectives of the project are:

- Provide easy access to heritage and historical destinations.
- Organize accurate and meaningful heritage information.
- Recommend destinations based on user interests, location, distance, and available time.
- Promote local communities, artisans, traditional food, and cultural experiences.
- Create awareness about cultural heritage preservation.
- Encourage responsible and sustainable tourism.
- Provide map-based discovery and route information.
- Support trip and itinerary planning.
- Provide an administration system for managing and verifying heritage information.

---

## ✨ Key Features

### 🏛️ Heritage Discovery
Users can explore heritage destinations with information such as:
- Heritage site name
- Category
- Description
- Historical background
- Cultural significance
- Architecture
- Images
- Location
- Distance
- Visiting information
- Ratings
- Responsible tourism guidelines

### 🔎 Search & Filtering
Users can find relevant destinations using:
- Keyword search
- Heritage category
- User interests
- Location
- Distance
- Ratings
- Available time

### 🤖 Smart Recommendations
The frontend provides the interface and user flow for personalized heritage recommendations based on factors such as:
- User interests
- Location
- Distance
- Available time
- Heritage categories
- Ratings

```text
User Interests
      ↓
Nearby Heritage Places
      ↓
Remove Incompatible Places
      ↓
Consider Available Time
      ↓
Prioritize Relevant Places
      ↓
Recommended Destinations
```

> **Explainable Insight Example:**  
> *"Suggested because you selected History and this heritage site is nearby."*

The recommendation logic can be connected to a backend recommendation engine during integration.

### 🗺️ Map Explorer
The platform provides map-based exploration for discovering heritage locations and nearby attractions. Frontend capabilities include:
- Heritage markers
- Location information
- Distance information
- Nearby places
- Route information
- Map-based discovery

### 🧭 Trip Planner
Users can create an ordered travel itinerary based on selected destinations. The frontend supports the interface and workflow for:
- Selecting places
- Organizing destinations
- Viewing location information
- Considering distance
- Considering available time
- Estimated visit duration
- Route order

### ❤️ Saved Places
Users can save interesting destinations for future reference. The current frontend uses browser-side storage for selected saved-place functionality. This can be connected to user accounts and a backend database during backend integration.

### ⭐ Ratings & Reviews
The platform provides frontend interfaces for:
- Ratings
- Reviews
- Feedback
- Review moderation through the admin interface

Backend integration will provide persistent storage, validation, authentication, and moderation workflows.

### 🎭 Culture & Heritage
The platform covers cultural elements beyond monuments, including:
- Traditional food
- Festivals
- Arts
- Handicrafts
- Local markets
- Cultural practices
- Heritage stories
- Local experiences

### 🚶 Heritage Walks
The platform includes a dedicated heritage-walk section for presenting curated walking experiences, routes, important heritage locations, and cultural information.

### 🛠️ Administration
A separate admin interface is included for managing platform content and administrative operations. The frontend admin interface includes areas for:
- Heritage-site management
- Add / Edit / Delete operations
- Heritage verification status
- Review moderation
- Analytics
- Category statistics
- Rating statistics

---

## 🛠️ Technology Stack

### Frontend

| Technology | Purpose |
| :--- | :--- |
| **HTML5** | Website structure |
| **CSS3** | Styling and responsive design |
| **JavaScript** | Dynamic functionality and interactions |
| **Bootstrap 5** | Responsive UI components |
| **Bootstrap Icons** | Interface icons |
| **Chart.js** | Dashboard analytics |
| **Leaflet** | Interactive maps |
| **OpenStreetMap** | Map data |

### Backend
Backend development and API integration are handled separately. The backend is expected to provide:
- REST APIs
- Authentication
- Authorization
- Business logic
- Data validation
- Recommendation logic
- Database integration

### Database
The database technology will be finalized as part of backend development.

---

## 📂 Project Structure

```text
Heritage-PBL/
│
├── index.html
│
├── pages/
│   ├── explore.html
│   ├── recommendations.html
│   ├── map.html
│   ├── itinerary.html
│   ├── culture.html
│   ├── heritage-walks.html
│   ├── saved.html
│   └── ...
│
├── admin/
│   ├── login.html
│   ├── dashboard.html
│   ├── ...
│   │
│   ├── css/
│   │   └── ...
│   │
│   └── js/
│       └── ...
│
├── css/
│   └── ...
│
├── styles/
│   ├── data.js
│   ├── main.js
│   └── ...
│
└── README.md
```

*The project structure may be updated as backend integration and future development progress.*

---

## 🔌 Backend Integration

This repository contains the completed frontend implementation and is intended to be handed over to the backend developer for API, database, authentication, and server-side integration.

The frontend currently provides the required pages, user flows, interfaces, forms, data structures, and frontend interactions for the current project scope.

### Expected Backend Flow

```text
Authentication
       ↓
User Profile & Preferences
       ↓
Heritage Catalogue
       ↓
Search & Filtering
       ↓
Recommendation Engine
       ↓
Locations & Maps
       ↓
Trip Planning
       ↓
Saved Places
       ↓
Ratings & Reviews
       ↓
Administration
```

### Expected Backend Modules
- User Authentication
- User Profiles
- User Preferences
- Heritage Sites
- Categories
- Cultural Information
- Recommendations
- Locations
- Itineraries
- Saved Places
- Reviews & Ratings
- Heritage Walks
- Admin Management
- Heritage Verification
- Analytics

---

## 🗄️ Planned Data Entities

The backend may require entities such as:
- `User`
- `HeritageSite`
- `Category`
- `Review`
- `Rating`
- `SavedPlace`
- `Itinerary`
- `Recommendation`
- `Culture`
- `HeritageWalk`
- `Admin`

*The final database schema should be designed after reviewing the frontend data structures, forms, fields, and user flows.*

---

## 🤝 Frontend → Backend Handoff

The frontend is now complete for the current project scope and can be used as the reference implementation for backend development.

Before implementing the backend APIs, the backend developer should review:
- Existing HTML pages
- JavaScript files (`data.js`, `main.js`)
- Form fields and element IDs
- Existing data structures
- Search and filtering requirements
- Recommendation inputs
- Map-related coordinates and attributes
- Itinerary builder requirements
- Review functionality
- Review moderation requirements
- Admin panel functionality
- Navigation and page-to-page user flows

### Backend Integration Requirements
The backend should provide APIs that can be integrated with the existing frontend without unnecessarily changing the current UI structure. Particular attention should be given to:
- API request and response formats
- Heritage-site data fields
- User preferences
- Search and filtering parameters
- Recommendation inputs and outputs
- Review and rating data
- Saved places
- Itinerary data
- Authentication state
- Admin authorization
- Heritage verification status

---

## 🔐 Admin Panel & Security Notes

The project contains a separate administrative interface for managing platform content.

### Admin Capabilities
- Add heritage sites
- Edit heritage sites
- Delete heritage sites
- Manage verification status
- Moderate reviews
- View analytics
- Manage category-related information

### ⚠️ Security Warning
The current frontend admin authentication is intended for development/prototype purposes. Frontend-only authentication and browser storage must not be considered production-grade security.

For production deployment, the backend should implement:
- Server-side authentication
- Secure password hashing using bcrypt, Argon2, or equivalent
- Secure session tokens or JWT
- Role-based access control (RBAC)
- Server-side authorization
- Strict input validation and sanitization
- API authentication
- Rate limiting
- Secure database connections
- Protection against common web vulnerabilities
- Secure credential and secret management

---

## 🚧 Development Status

The frontend development for the current project scope has been completed. The remaining work primarily involves backend development, database integration, API integration, production authentication, and full system testing.

| Module | Status |
| :--- | :---: |
| Project Research | ✅ Completed |
| Requirements | ✅ Completed |
| Project Scope | ✅ Completed |
| UML Design | ✅ Completed |
| UI/UX Design | ✅ Completed |
| Frontend Development | ✅ Completed |
| Heritage Catalogue | ✅ Completed |
| Search & Filtering | ✅ Completed |
| Smart Recommendations UI | ✅ Completed |
| Map Explorer | ✅ Completed |
| Trip Planner | ✅ Completed |
| Reviews & Ratings UI | ✅ Completed |
| Heritage Walks | ✅ Completed |
| Culture & Heritage | ✅ Completed |
| Saved Places | ✅ Completed |
| Admin Dashboard | ✅ Frontend Completed |
| Admin Authentication UI | ✅ Frontend Completed |
| Backend API | 🔴 Pending |
| Database | 🔴 Pending |
| Production Authentication | 🔴 Pending |
| Backend Integration | 🔴 Pending |
| Full System Testing | 🔴 Pending |
| Production Deployment | 🔴 Pending |

### Status Legend
- ✅ Completed
- 🟡 In Progress / Prototype
- 🔴 Pending

---

## 🏗️ Target System Architecture

```text
┌──────────────────────────────────────┐
│              FRONTEND                │
│        HTML / CSS / JavaScript       │
│             Bootstrap 5              │
└──────────────────┬───────────────────┘
                   │
                REST API
                   │
┌──────────────────▼───────────────────┐
│              BACKEND                 │
│ Authentication                       │
│ Authorization                        │
│ Business Logic                       │
│ Recommendation Engine                │
│ Validation                           │
└──────────────────┬───────────────────┘
                   │
┌──────────────────▼───────────────────┐
│              DATABASE                │
│ Users                                │
│ Heritage Sites                       │
│ Reviews                              │
│ Itineraries                          │
│ Recommendations                      │
│ Analytics                            │
└──────────────────────────────────────┘
```

---

## 📍 Initial Scope

### Included in Version 1.0
- Heritage discovery and details
- Search and multi-criteria filtering
- Smart recommendation interface
- Map explorer with markers
- Itinerary and trip planning
- Ratings and reviews
- Cultural articles
- Heritage walks
- Saved places
- Administration dashboard

### Not Included in Initial Version
- Online ticket booking
- Online payment processing
- Complete offline navigation
- Full Augmented Reality (AR) tours

*(These features may be considered for future versions.)*

---

## 🌱 Project Vision

The long-term vision is to create a scalable digital platform connecting:  
**Tourists + Heritage + Local Communities + Culture + Technology**

The platform aims to improve the visibility of cultural heritage, encourage responsible tourism, support local communities, and contribute to the preservation of cultural knowledge for future generations.

---

## 📌 Current Project Stage

The frontend implementation is complete for the current project scope. The current repository is now primarily prepared for:
- Backend API development
- Database implementation
- Frontend-backend integration
- Production authentication and authorization
- Server-side security implementation
- Full system testing
- Final deployment

*The frontend should be treated as the primary UI/UX and user-flow reference for the backend implementation.*

---

## ⚠️ Development Disclaimer

This repository represents the completed frontend implementation for the current academic project scope. Some frontend features may use static data, mock data, browser storage, or frontend-only logic for development and demonstration purposes. The application should not be considered production-ready until backend integration, database implementation, authentication, authorization, server-side validation, API security, testing, and deployment are completed.

---

## 👨‍💻 Project Details

- **Academic Program:** B.Tech Computer Engineering — PBL Project
- **Domain:** Smart Tourism & Cultural Heritage
- **Project:** HeritageX
- **Frontend URL:** [https://heritage-x.netlify.app/](https://heritage-x.netlify.app/)
- **Admin Login Frontend URL:** [https://heritage-x.netlify.app/admin/login.html](https://heritage-x.netlify.app/admin/login.html)
- **Admin Login Username or email :** heritagex_admin
- **Admin Password :** PBL-Demo-2026!
- **Theme:** Digital Tourism and Cultural Heritage Preservation
- **Vision:** Viksit Bharat @2047
- **Related SDGs:** SDG 8 (Decent Work and Economic Growth), SDG 11 (Sustainable Cities and Communities), SDG 12 (Responsible Consumption and Production)

---

## 👥 Contributors

**B.Tech Computer Engineering — PBL Project Team**
- Frontend Development
- Backend Development
- Database Development
- UI/UX Design
- Research & Documentation
- Testing & Integration

---

## 📄 License

This project is currently developed for academic and PBL purposes. License and usage terms can be added when the project is finalized.

---

*Smart Tourism & Cultural Heritage Discovery Platform — Discover Heritage. Experience Culture. Travel Smarter.*
