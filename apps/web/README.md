# VMO Service Management System

A comprehensive medical service management system for healthcare facilities.

## Features

- Patient Records Management
- Medication Registration with OCR
- Doctor Visit Scheduling
- Template Management
- Reporting and Analytics

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ``` 

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update the Supabase configuration:
     ```
     VITE_SUPABASE_URL=https://mzeptzwuqvpjspxgnzkp.supabase.co
     VITE_SUPABASE_ANON_KEY=your_actual_anon_key
     ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Database Setup

The application uses Supabase as the database. The database schema is automatically created through migrations in the `supabase/migrations` folder.

## Deployment

The application is deployed on Netlify. Make sure to set the environment variables in your Netlify dashboard:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Security Note

Never commit your actual environment variables to version control. Always use the `.env.example` file as a template and keep your actual `.env` file in `.gitignore`.