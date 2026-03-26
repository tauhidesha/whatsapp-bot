# Comprehensive Admin Frontend

A modern, feature-rich admin dashboard for Bosmat Repainting & Detailing Studio, built with Next.js 14+, TypeScript, and Tailwind CSS.

## Features

- Multi-channel conversation management (WhatsApp, Instagram DM, Facebook Messenger)
- Advanced booking management with calendar interface
- CRM dashboard with analytics and customer profiles
- Follow-up campaign management
- Financial transaction tracking and reporting
- Document generation (invoices, receipts)
- System configuration management
- Full mobile responsiveness
- Real-time notifications
- Firebase Authentication integration

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Authentication
- **Backend**: Express.js REST API
- **Database**: Firebase Firestore

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn
- Firebase project with Authentication enabled

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Firebase credentials and API endpoint.

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
admin-frontend/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Dashboard routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── conversations/     # Conversation management
│   ├── bookings/          # Booking management
│   ├── crm/              # CRM components
│   ├── follow-ups/       # Follow-up management
│   ├── finance/          # Financial components
│   ├── settings/         # Settings components
│   └── shared/           # Shared/reusable components
├── lib/                   # Utilities and helpers
│   ├── api/              # API client
│   ├── auth/             # Authentication
│   ├── hooks/            # Custom React hooks
│   └── utils/            # Utility functions
└── public/               # Static assets
```

## Requirements Addressed

- **15.1**: Authentication required before displaying business data
- **15.2**: Firebase Authentication integration
- **17.6**: Bundle size optimization through code splitting and tree shaking

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## License

Private - Bosmat Repainting & Detailing Studio
