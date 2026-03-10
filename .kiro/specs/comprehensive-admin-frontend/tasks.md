# Implementation Plan: Comprehensive Admin Frontend

## Overview

This implementation plan breaks down the comprehensive admin frontend into discrete, incremental coding tasks. The plan follows a bottom-up approach: starting with foundational infrastructure (authentication, API client, shared components), then building feature modules (conversations, bookings, CRM, finance), and finally integrating everything with real-time updates and mobile responsiveness.

Each task builds on previous work, ensuring no orphaned code. Testing tasks are marked as optional with `*` to allow for faster MVP delivery while maintaining quality standards.

## Tasks

- [ ] 1. Project setup and core infrastructure
  - [x] 1.1 Initialize Next.js 14+ project with TypeScript and Tailwind CSS
    - Create new Next.js project with App Router
    - Configure TypeScript with strict mode
    - Set up Tailwind CSS with custom theme colors
    - Configure environment variables for Firebase and API endpoints
    - _Requirements: 15.1, 15.2, 17.6_

  - [x] 1.2 Set up Firebase Authentication and Firestore client
    - Initialize Firebase app with configuration
    - Create auth utility functions (login, logout, onAuthChange)
    - Create useAuth hook for authentication state management
    - Set up Firestore client instance
    - _Requirements: 15.2, 15.3, 15.4_

  - [x] 1.3 Create API client with authentication integration
    - Implement ApiClient class with request method
    - Add authentication token injection to all requests
    - Implement error handling with ApiError class
    - Add retry logic for network failures
    - _Requirements: 15.6, 16.1, 16.2_

  - [ ] 1.4 Write unit tests for API client error handling
    - Test network error scenarios
    - Test authentication token injection
    - Test retry logic
    - _Requirements: 16.1, 16.2_

- [x] 2. Authentication and routing setup
  - [x] 2.1 Create login page with Firebase authentication
    - Build login form with email/password inputs
    - Implement form validation
    - Handle authentication errors with user-friendly messages
    - Add loading state during authentication
    - _Requirements: 15.3, 15.4, 16.3_

  - [x] 2.2 Implement authentication middleware and protected routes
    - Create auth layout that checks authentication state
    - Redirect unauthenticated users to login page
    - Handle session expiration with redirect and message
    - Implement logout functionality
    - _Requirements: 15.1, 15.7, 15.8_

  - [x] 2.3 Write integration tests for authentication flow
    - Test successful login flow
    - Test failed login with invalid credentials
    - Test session expiration handling
    - _Requirements: 15.3, 15.7_

- [ ] 3. Shared UI components and layout
  - [ ] 3.1 Create base UI components (Button, Input, Modal, LoadingSpinner)
    - Implement reusable Button component with variants
    - Create Input component with validation states
    - Build Modal component with overlay and animations
    - Create LoadingSpinner component
    - _Requirements: 16.4, 17.1_

  - [x] 3.2 Build main layout with sidebar and header
    - Create responsive Layout component with sidebar
    - Implement Sidebar with navigation links
    - Build Header with user info and logout button
    - Add mobile navigation with hamburger menu
    - _Requirements: 13.1, 13.2, 13.4_

  - [x] 3.3 Create notification system components
    - Build Notification card component
    - Implement notification panel with stacking
    - Add notification dismiss functionality
    - Create notification sound/browser notification integration
    - _Requirements: 14.1, 14.2, 14.5, 14.6_

  - [x] 3.4 Write unit tests for shared components
    - Test Button click handlers and variants
    - Test Modal open/close behavior
    - Test Input validation states
    - _Requirements: 16.4_

- [x] 4. Checkpoint - Verify authentication and layout
  - Ensure all tests pass, verify login flow works, check responsive layout on mobile. Ask the user if questions arise.

- [x] 5. Conversation management - API integration
  - [x] 5.1 Implement conversation API methods in ApiClient
    - Add getConversations() method
    - Add getConversationHistory(id) method
    - Add sendMessage() method
    - Add updateAiState() method
    - Add updateLabel() method
    - _Requirements: 1.1, 2.3, 3.3, 18.3_

  - [x] 5.2 Create Firestore real-time hooks for conversations
    - Implement useRealtimeConversations hook with onSnapshot
    - Create useConversationMessages hook for message history
    - Add error handling and loading states
    - Implement cleanup on unmount to prevent memory leaks
    - _Requirements: 1.1, 1.4, 5.1_

  - [x] 5.3 Write unit tests for conversation hooks
    - Test onSnapshot listener setup and cleanup
    - Test error handling in hooks
    - Test loading state transitions
    - _Requirements: 1.1, 16.1_

- [x] 6. Conversation management - UI components
  - [x] 6.1 Build ConversationList component with filtering
    - Create ConversationItem component with channel badges
    - Implement search input with debounced filtering
    - Add label filter dropdown
    - Display AI status and notification badges
    - _Requirements: 1.1, 1.3, 1.7, 1.8, 5.1, 5.2, 5.3_

  - [x] 6.2 Implement MessageList component with real-time updates
    - Display messages with sender labels (Customer, AI, Admin)
    - Format timestamps in human-readable format
    - Preserve WhatsApp formatting (bold, italic)
    - Auto-scroll to latest message
    - _Requirements: 1.5, 2.8, 5.1_

  - [x] 6.3 Create MessageComposer component
    - Build multi-line textarea with auto-expand
    - Add send button with loading state
    - Implement Enter key to send (Shift+Enter for new line)
    - Display channel indicator
    - _Requirements: 2.1, 2.2, 2.4, 2.7, 2.9_

  - [x] 6.4 Build ConversationHeader with AI controls
    - Display customer name and channel badge
    - Add AI pause/resume toggle button
    - Show AI pause information (expiration, reason)
    - Display warning badge when AI is paused
    - _Requirements: 3.1, 3.2, 3.3, 3.7, 3.8_

  - [x] 6.5 Write integration tests for conversation components
    - Test message sending flow
    - Test AI state toggle
    - Test conversation filtering
    - _Requirements: 2.3, 3.3, 5.4_

- [x] 7. Conversation management - Integration and labeling
  - [x] 7.1 Implement conversation labeling functionality
    - Add label dropdown to ConversationHeader
    - Implement label update with reason prompt
    - Display label history in conversation details
    - Support bulk label updates
    - _Requirements: 18.1, 18.2, 18.3, 18.5, 18.6, 18.8_

  - [x] 7.2 Create conversations page with full integration
    - Build /conversations route with ConversationList and MessageList
    - Implement conversation selection state management
    - Wire up all conversation components
    - Add error boundaries for graceful error handling
    - _Requirements: 1.1, 1.5, 2.1, 5.8_

  - [x] 7.3 Implement real-time notification system
    - Create useNotifications hook
    - Detect new messages and show notifications
    - Clear notifications when conversation is selected
    - Add browser notification permission request
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.7_

  - [x] 7.4 Write integration tests for notification system
    - Test notification creation on new message
    - Test notification dismissal
    - Test notification click navigation
    - _Requirements: 14.1, 14.3, 14.7_

- [x] 8. Checkpoint - Verify conversation management
  - Ensure all tests pass, verify real-time updates work, test message sending and AI controls. Ask the user if questions arise.

- [ ] 9. Booking management - API and data layer
  - [ ] 9.1 Implement booking API methods in ApiClient
    - Add getBookings() method
    - Add updateBookingStatus() method
    - Add booking status validation logic
    - _Requirements: 4.2, 4.8, 19.1_

  - [ ] 9.2 Create booking data models and utilities
    - Define Booking TypeScript interfaces
    - Create booking status workflow validation
    - Implement date grouping utilities for calendar
    - Add repaint slot calculation logic
    - _Requirements: 4.4, 4.5, 19.1, 19.3_

  - [ ] 9.3 Write unit tests for booking utilities
    - Test status transition validation
    - Test repaint slot calculation
    - Test date grouping logic
    - _Requirements: 19.1, 19.3_

- [ ] 10. Booking management - Calendar UI
  - [ ] 10.1 Build BookingCalendar component
    - Create calendar grid with month navigation
    - Display bookings by date with color-coded status
    - Show repaint slot occupancy indicators
    - Mark full dates with visual indicator
    - _Requirements: 4.1, 4.3, 4.4, 4.5_

  - [ ] 10.2 Create BookingModal for booking details
    - Display full booking information
    - Add status update dropdown with workflow validation
    - Implement admin notes textarea
    - Show status history timeline
    - _Requirements: 4.6, 4.7, 19.4, 19.5_

  - [ ] 10.3 Implement booking status workflow
    - Add status transition buttons with validation
    - Prompt for estimated completion date when marking in_progress
    - Prompt to create transaction when marking completed
    - Send automated notifications on status change
    - _Requirements: 19.1, 19.2, 19.5, 19.6, 19.7_

  - [ ] 10.4 Create bookings page with calendar integration
    - Build /bookings route with BookingCalendar
    - Implement booking selection and modal display
    - Add refresh functionality after updates
    - _Requirements: 4.1, 4.2, 4.10_

  - [ ] 10.5 Write integration tests for booking workflow
    - Test status transitions
    - Test booking modal interactions
    - Test calendar date selection
    - _Requirements: 19.1, 19.3_

- [ ] 11. Checkpoint - Verify booking management
  - Ensure all tests pass, verify calendar displays correctly, test booking status updates. Ask the user if questions arise.

- [ ] 12. CRM module - API and analytics
  - [ ] 12.1 Implement CRM API methods in ApiClient
    - Add getCRMSummary() method with date range support
    - Add getCustomerProfile() method
    - Add updateCustomerNotes() method
    - _Requirements: 6.2, 7.1, 7.7_

  - [ ] 12.2 Create CRM data models and formatting utilities
    - Define CRMSummary and CustomerProfile interfaces
    - Create revenue calculation utilities
    - Implement customer segmentation logic
    - Add date range formatting utilities
    - _Requirements: 6.3, 6.4, 6.5, 6.7_

  - [ ] 12.3 Write unit tests for CRM utilities
    - Test revenue calculations
    - Test customer segmentation
    - Test date range formatting
    - _Requirements: 6.4, 6.5_

- [ ] 13. CRM module - Dashboard UI
  - [ ] 13.1 Build CRMDashboard component with metrics
    - Display total customers and active conversations
    - Show conversion rate and revenue metrics
    - Add date range filter with preset options
    - Implement data refresh on date range change
    - _Requirements: 6.1, 6.3, 6.7, 6.8_

  - [ ] 13.2 Create Analytics component with charts
    - Build revenue trend chart using chart library
    - Create service distribution pie chart
    - Display customer segmentation breakdown
    - Show recent transactions list
    - _Requirements: 6.4, 6.5, 6.6, 6.9_

  - [ ] 13.3 Build CustomerProfile component
    - Display customer contact information and classification
    - Show conversation, booking, and transaction history
    - Display total lifetime value and completed bookings
    - Add admin notes editor with save functionality
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8_

  - [ ] 13.4 Create CRM pages and routing
    - Build /crm route with CRMDashboard
    - Create /crm/[customerId] route with CustomerProfile
    - Implement navigation between dashboard and profiles
    - _Requirements: 6.1, 7.1_

  - [ ] 13.5 Write integration tests for CRM module
    - Test dashboard data display
    - Test customer profile loading
    - Test admin notes update
    - _Requirements: 6.2, 7.6, 7.7_

- [ ] 14. Follow-up management
  - [ ] 14.1 Implement follow-up API methods in ApiClient
    - Add getFollowUpCandidates() method
    - Add executeFollowUps() method
    - _Requirements: 8.2, 8.7_

  - [ ] 14.2 Build FollowUpQueue component
    - Display follow-up candidates grouped by type
    - Show customer name, last interaction date, and suggested message
    - Add message editing capability
    - Implement bulk selection with checkboxes
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.6_

  - [ ] 14.3 Implement follow-up execution flow
    - Add execute button with confirmation dialog
    - Call API to execute selected follow-ups
    - Display success/failure status for each follow-up
    - Add regenerate suggestions functionality
    - _Requirements: 8.6, 8.7, 8.8, 8.9_

  - [ ] 14.4 Create follow-ups page
    - Build /follow-ups route with FollowUpQueue
    - Add refresh functionality
    - Display follow-up history in customer profiles
    - _Requirements: 8.1, 7.9_

  - [ ] 14.5 Write integration tests for follow-up execution
    - Test candidate selection
    - Test message editing
    - Test execution flow
    - _Requirements: 8.6, 8.7_

- [ ] 15. Checkpoint - Verify CRM and follow-ups
  - Ensure all tests pass, verify analytics display correctly, test follow-up execution. Ask the user if questions arise.

- [ ] 16. Finance module - Transaction management
  - [ ] 16.1 Implement finance API methods in ApiClient
    - Add addTransaction() method
    - Add getTransactions() method with filters
    - Add calculateRevenue() method
    - Add exportTransactions() method
    - _Requirements: 9.3, 9.4, 9.8_

  - [ ] 16.2 Create finance data models and utilities
    - Define Transaction interface
    - Create revenue calculation utilities
    - Implement payment method distribution logic
    - Add CSV export formatting
    - _Requirements: 9.2, 9.5, 9.6, 9.7_

  - [ ] 16.3 Build TransactionForm component
    - Create form with customer, service, amount, payment method fields
    - Add date picker for transaction date
    - Implement form validation
    - Link to associated booking if available
    - _Requirements: 9.1, 9.2, 9.9_

  - [ ] 16.4 Create TransactionList component with filtering
    - Display transaction history with customer, service, amount, date
    - Add date range filter
    - Add customer filter
    - Implement sorting by date
    - _Requirements: 9.4_

  - [ ] 16.5 Build RevenueBreakdown component
    - Display daily, weekly, monthly revenue totals
    - Show revenue breakdown by service category
    - Display payment method distribution
    - Add visual charts for revenue trends
    - _Requirements: 9.5, 9.6, 9.7_

  - [ ] 16.6 Create finance page with transaction management
    - Build /finance route with TransactionForm and TransactionList
    - Add RevenueBreakdown section
    - Implement CSV export functionality
    - _Requirements: 9.1, 9.4, 9.8_

  - [ ] 16.7 Write integration tests for finance module
    - Test transaction creation
    - Test filtering and sorting
    - Test revenue calculations
    - _Requirements: 9.3, 9.5_

- [ ] 17. Document generation
  - [ ] 17.1 Implement document generation API method in ApiClient
    - Add generateDocument() method
    - Support invoice, receipt, and payment confirmation types
    - _Requirements: 10.3_

  - [ ] 17.2 Build DocumentGenerator component
    - Create form for selecting customer and services
    - Add document type selector (invoice, receipt, confirmation)
    - Implement preview functionality
    - Add automatic WhatsApp sending option
    - _Requirements: 10.1, 10.2, 10.4, 10.5, 10.6_

  - [ ] 17.3 Integrate document generation with finance and bookings
    - Add "Generate Invoice" button in booking modal
    - Add "Generate Receipt" button in transaction form
    - Display document history in customer profile
    - Support document regeneration
    - _Requirements: 10.7, 10.8, 10.9_

  - [ ] 17.4 Write integration tests for document generation
    - Test document creation flow
    - Test preview display
    - Test WhatsApp sending
    - _Requirements: 10.3, 10.6_

- [ ] 18. Settings and configuration management
  - [ ] 18.1 Implement settings API methods in ApiClient
    - Add getSystemPrompt() method
    - Add updateSystemPrompt() method
    - Add getPromotion() method
    - Add updatePromotion() method
    - _Requirements: 11.2, 11.3, 11.5, 11.6_

  - [ ] 18.2 Build SystemPromptEditor component
    - Create textarea for editing system prompt
    - Add validation for prompt format
    - Implement save functionality with confirmation
    - Display current active prompt
    - _Requirements: 11.2, 11.3, 11.4, 11.8_

  - [ ] 18.3 Create PromoEditor component
    - Build form for editing monthly promotion
    - Add preview of promotion message
    - Implement save functionality
    - _Requirements: 11.5, 11.6_

  - [ ] 18.4 Build ServiceCatalog component
    - Display services organized by category
    - Show pricing by motorcycle type
    - Display bundling discounts
    - Add search functionality
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

  - [ ] 18.5 Create settings page
    - Build /settings route with SystemPromptEditor and PromoEditor
    - Add ServiceCatalog section
    - Display success messages after updates
    - _Requirements: 11.1, 11.9_

  - [ ] 18.6 Write integration tests for settings management
    - Test system prompt update
    - Test promotion update
    - Test validation
    - _Requirements: 11.3, 11.6, 11.8_

- [ ] 19. Checkpoint - Verify finance, documents, and settings
  - Ensure all tests pass, verify transaction tracking works, test document generation, check settings updates. Ask the user if questions arise.

- [ ] 20. Mobile responsiveness and optimization
  - [ ] 20.1 Implement mobile-specific layouts
    - Add mobile breakpoint styles to all components
    - Create MobileNav component with hamburger menu
    - Build MobileHeader component
    - Implement full-screen conversation view on mobile
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.8_

  - [ ] 20.2 Add touch-friendly interactions
    - Increase button and control sizes for mobile
    - Add swipe gestures for conversation list
    - Implement pull-to-refresh functionality
    - Optimize keyboard handling for message composer
    - _Requirements: 13.2, 13.5, 13.6_

  - [ ] 20.3 Implement performance optimizations
    - Add virtual scrolling to conversation list
    - Implement lazy loading for conversation history
    - Add debouncing to search inputs
    - Optimize images with Next.js Image component
    - _Requirements: 17.1, 17.2, 17.4, 17.5, 17.7_

  - [ ] 20.4 Add code splitting and bundle optimization
    - Implement dynamic imports for heavy components
    - Configure Next.js bundle analyzer
    - Optimize third-party library imports
    - Implement service worker caching
    - _Requirements: 17.6, 17.8, 17.9_

  - [ ] 20.5 Write mobile responsiveness tests
    - Test mobile layout rendering
    - Test touch interactions
    - Test viewport adaptations
    - _Requirements: 13.1, 13.7_

- [ ] 21. Internationalization setup
  - [ ] 21.1 Set up i18next with Indonesian translations
    - Install and configure i18next and react-i18next
    - Create translation files for all modules
    - Externalize all user-facing strings
    - Implement useTranslation hook usage
    - _Requirements: 20.1, 20.2, 20.3_

  - [ ] 21.2 Add locale-aware formatting
    - Implement date/time formatting with locale support
    - Add number and currency formatting
    - Support right-to-left text direction structure
    - _Requirements: 20.5, 20.6_

  - [ ] 21.3 Create language selector component
    - Build language selector (initially showing only Indonesian)
    - Prepare structure for adding English in future
    - Store language preference in local storage
    - _Requirements: 20.4, 20.7_

  - [ ] 21.4 Write tests for internationalization
    - Test translation key coverage
    - Test fallback behavior
    - Test locale formatting
    - _Requirements: 20.8_

- [ ] 22. Error handling and user feedback
  - [ ] 22.1 Implement comprehensive error handling
    - Create error boundary components
    - Add error logging to console
    - Implement retry logic for failed operations
    - Display user-friendly error messages
    - _Requirements: 16.1, 16.2, 16.6, 16.8_

  - [ ] 22.2 Add loading and success feedback
    - Implement loading indicators for all async operations
    - Add success notifications for completed actions
    - Create skeleton loaders for data fetching
    - Display connection error messages
    - _Requirements: 16.3, 16.4, 16.5_

  - [ ] 22.3 Implement form validation feedback
    - Add field-level validation with error messages
    - Highlight invalid fields with visual indicators
    - Display validation errors inline
    - _Requirements: 16.7_

  - [ ] 22.4 Add data staleness detection
    - Implement stale data detection with timestamps
    - Display refresh prompts when data is outdated
    - Add manual refresh buttons
    - _Requirements: 16.9_

  - [ ] 22.5 Write tests for error handling
    - Test error boundary behavior
    - Test retry logic
    - Test validation feedback
    - _Requirements: 16.1, 16.8_

- [ ] 23. Final integration and testing
  - [ ] 23.1 Wire all modules together in main layout
    - Integrate all feature modules into dashboard layout
    - Implement navigation between all pages
    - Add breadcrumb navigation
    - Ensure consistent styling across all modules
    - _Requirements: 1.1, 13.7_

  - [ ] 23.2 Implement cross-module integrations
    - Link transactions to bookings
    - Link follow-ups to customer profiles
    - Link documents to transactions and bookings
    - Ensure data consistency across modules
    - _Requirements: 9.9, 7.9, 10.7_

  - [ ] 23.3 Add global search functionality
    - Implement search across conversations, customers, and bookings
    - Display search results with type indicators
    - Add keyboard shortcuts for search
    - _Requirements: 5.6_

  - [ ] 23.4 Write end-to-end integration tests
    - Test complete user workflows
    - Test cross-module data flow
    - Test navigation between modules
    - _Requirements: 13.7_

- [ ] 24. Final checkpoint and deployment preparation
  - Ensure all tests pass, verify all features work end-to-end, test on multiple devices and browsers. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- The implementation uses TypeScript, Next.js 14+, React 18+, and Tailwind CSS
- Real-time updates are handled via Firestore onSnapshot listeners
- All API communication goes through the centralized ApiClient
- Mobile responsiveness is built-in from the start using Tailwind's responsive utilities
- Authentication is required before accessing any business data
- Error handling and user feedback are integrated throughout all components
