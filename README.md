# Anispy 🕵️‍♂️

Anispy is a modern, responsive anime watchlist application that helps you track your favorite anime series and movies. With a direct integration with the Jikan API (MyAnimeList), it provides a seamless experience for searching and managing your anime library.

## ✨ Features

- **Smart Search & Grouping**: Search for any anime and see all related seasons and movies grouped under a single, clean banner.
- **Comprehensive Watchlist**: Track your progress with statuses like *Plan to Watch*, *Watching*, *Completed*, *Dropped*, and *Rewatching*.
- **Episode & Rating Tracking**: Keep track of exactly which episode you're on and give your favorite series the rating they deserve.
- **Character Insights**: View detailed character information and roles for every anime.
- **User Profiles**: Personalize your profile with a custom name, email, and profile photo.
- **Responsive Design**: Optimized for a premium experience across Mobile, Tablet, and Desktop devices.
- **Secure Authentication**: Powerded by Supabase for safe and reliable user management.

## 🚀 Tech Stack

- **Frontend**: 
  - Vanilla HTML5 / CSS3 (Modern Flexbox & Grid)
  - JavaScript (ES6+ Vanilla JS)
  - FontAwesome for iconography
- **Backend**:
  - FastAPI (Python 3.10+)
  - Pydantic for data validation
- **Database & Auth**:
  - Supabase (PostgreSQL + GoTrue Auth)
  - Supabase Storage for profile photos
- **API**:
  - Jikan API (Unofficial MyAnimeList API v4)
- **Deployment**:
  - Vercel (Frontend & Serverless Functions)

## 🛠️ Getting Started

### Prerequisites

- Python 3.10+
- A Supabase account and project
- Node.js (optional, for local development tools)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/anispy.git
   cd anispy
   ```

2. **Set up the backend**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory with the following:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key (Required for admin actions)
   ```

4. **Run the application**:
   ```bash
   uvicorn backend.main:app --reload
   ```
   The application will be available at `http://localhost:8000`.

## 📁 Project Structure

```text
anispy/
├── anime-watchlist/    # Frontend HTML, CSS, and JS
│   ├── index.html      # Main watchlist page
│   ├── login.html      # Authentication page
│   ├── profile.html    # User profile management
│   ├── app.js          # Core application logic
│   └── style.css       # Global styles
├── backend/            # FastAPI Backend
│   └── main.py         # Main server and admin routes
├── requirements.txt    # Python dependencies
└── vercel.json         # Vercel deployment configuration
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
