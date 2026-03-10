# Requirements Document

## Introduction

This document defines the requirements for a comprehensive admin frontend that will replace the existing basic admin-ui. The new frontend will provide a modern, feature-rich interface for managing the WhatsApp AI bot system, including customer conversations, bookings, CRM operations, financial tracking, and system configuration. The system serves Bosmat Repainting & Detailing Studio's business operations.

## Glossary

- **Admin_Frontend**: The new comprehensive web application for administrative operations
- **Backend_API**: The existing Node.js Express server that provides REST endpoints
- **Conversation_Manager**: Component responsible for displaying and managing customer chat conversations
- **Booking_System**: Component for managing service bookings and calendar scheduling
- **CRM_Module**: Customer Relationship Management functionality for tracking customer data and interactions
- **Finance_Module**: Component for tracking transactions, revenue, and financial analytics
- **AI_Agent**: The Zoya AI assistant that handles customer conversations
- **Firestore**: Firebase Firestore database used for data persistence
- **WhatsApp_Channel**: Communication channel via WhatsApp
- **Meta_Channels**: Communication channels via Instagram DM and Facebook Messenger
- **Customer**: End user who interacts with the business through messaging channels
- **Admin_User**: Business owner or staff member using the admin frontend
- **Snooze_Mode**: State where AI responses are temporarily paused for a conversation
- **Label_System**: Categorization system for conversations (hot_lead, cold_lead, booking_process, etc.)
- **Follow_Up_Engine**: Automated system for scheduling and executing customer follow-ups
- **System_Prompt**: Configurable AI behavior instructions
- **Service_Catalog**: List of available services (Repaint, Detailing, Coating) with pricing

## Requirements

### Requirement 1: Multi-Channel Conversation Management

**User Story:** As an Admin_User, I want to view and manage customer conversations from multiple channels, so that I can handle all customer communications in one place.

#### Acceptance Criteria

1. WHEN the Admin_Frontend loads, THE Conversation_Manager SHALL fetch and display all conversations from Firestore
2. THE Conversation_Manager SHALL display conversations from WhatsApp_Channel, Instagram DM, and Facebook Messenger
3. FOR EACH conversation, THE Conversation_Manager SHALL display customer name, platform identifier, last message preview, timestamp, and channel badge
4. THE Conversation_Manager SHALL refresh conversation data every 15 seconds
5. WHEN a conversation is selected, THE Conversation_Manager SHALL display the complete message history with sender labels (Customer, AI, Admin)
6. THE Conversation_Manager SHALL support real-time search filtering by customer name, phone number, or message content
7. THE Conversation_Manager SHALL display channel-specific badges (WA, Instagram, Messenger) for each conversation
8. WHEN a new message arrives, THE Conversation_Manager SHALL show a notification badge for unread conversations
9. THE Conversation_Manager SHALL display conversation labels (hot_lead, cold_lead, booking_process, etc.) with visual indicators

### Requirement 2: Admin Message Sending

**User Story:** As an Admin_User, I want to send messages to customers through their original channel, so that I can provide manual support when needed.

#### Acceptance Criteria

1. WHEN a conversation is selected, THE Admin_Frontend SHALL display a message composer interface
2. THE Admin_Frontend SHALL send messages through the Backend_API to the customer's original channel
3. WHEN the send button is clicked, THE Admin_Frontend SHALL POST the message to `/api/send-message` with number, message, channel, and platformId
4. THE Admin_Frontend SHALL disable the send button while a message is being sent
5. AFTER a message is sent successfully, THE Admin_Frontend SHALL clear the composer and refresh the conversation history
6. IF message sending fails, THE Admin_Frontend SHALL display an error notification to the Admin_User
7. THE Admin_Frontend SHALL support multi-line text input with auto-expanding textarea
8. THE Admin_Frontend SHALL preserve WhatsApp formatting (bold, italic, strikethrough) in message display
9. WHEN sending to non-WhatsApp channels, THE Admin_Frontend SHALL display a channel indicator in the composer

### Requirement 3: AI State Control

**User Story:** As an Admin_User, I want to pause or resume AI responses for specific conversations, so that I can take over conversations manually when needed.

#### Acceptance Criteria

1. FOR EACH conversation, THE Admin_Frontend SHALL display the current AI state (active or paused)
2. THE Admin_Frontend SHALL provide a toggle button to enable or disable AI responses
3. WHEN the toggle button is clicked, THE Admin_Frontend SHALL POST to `/api/conversation/{number}/ai-state` with enabled status and reason
4. THE Admin_Frontend SHALL display AI pause information including manual/automatic status, expiration time, and reason
5. AFTER toggling AI state, THE Admin_Frontend SHALL refresh both conversation list and history
6. THE Admin_Frontend SHALL disable the toggle button while the state change is processing
7. WHEN AI is paused, THE Admin_Frontend SHALL display a warning badge in the conversation list
8. THE Admin_Frontend SHALL show a human-readable AI status description (e.g., "AI dijeda hingga [time]")

### Requirement 4: Booking Calendar Management

**User Story:** As an Admin_User, I want to view and manage service bookings in a calendar interface, so that I can track scheduled appointments and capacity.

#### Acceptance Criteria

1. THE Admin_Frontend SHALL provide a calendar view displaying bookings by date
2. WHEN calendar view is selected, THE Admin_Frontend SHALL fetch bookings from `/api/bookings`
3. THE Admin_Frontend SHALL display bookings with color-coded status indicators (pending, confirmed, in_progress, completed, cancelled)
4. FOR EACH date, THE Admin_Frontend SHALL show repaint slot occupancy (current/2 slots)
5. WHEN a date has 2 active repaint bookings, THE Admin_Frontend SHALL mark it as full with a visual indicator
6. WHEN a booking is clicked, THE Admin_Frontend SHALL display a modal with full booking details
7. THE Admin_Frontend SHALL allow updating booking status and admin notes through the modal
8. WHEN booking status is updated, THE Admin_Frontend SHALL PATCH to `/api/bookings/{id}/status`
9. THE Admin_Frontend SHALL display estimated completion dates for multi-day repaint services
10. THE Admin_Frontend SHALL refresh booking data after any update operation

### Requirement 5: Conversation Filtering and Search

**User Story:** As an Admin_User, I want to filter conversations by label and search by keywords, so that I can quickly find specific customer interactions.

#### Acceptance Criteria

1. THE Admin_Frontend SHALL provide a dropdown filter for conversation labels
2. THE Label_System SHALL support filtering by: hot_lead, cold_lead, booking_process, scheduling, completed, follow_up, general, archive
3. WHEN a label filter is selected, THE Conversation_Manager SHALL display only conversations matching that label
4. THE Admin_Frontend SHALL provide a search input field for keyword filtering
5. WHEN search text is entered, THE Conversation_Manager SHALL filter conversations by name, number, or message content
6. THE Admin_Frontend SHALL apply both label filter and search filter simultaneously
7. WHEN filters result in no matches, THE Admin_Frontend SHALL display an empty state message
8. THE Admin_Frontend SHALL preserve filter state when switching between conversations

### Requirement 6: CRM Dashboard and Analytics

**User Story:** As an Admin_User, I want to view customer analytics and business metrics, so that I can track performance and identify opportunities.

#### Acceptance Criteria

1. THE Admin_Frontend SHALL provide a CRM dashboard view
2. WHEN CRM dashboard is accessed, THE Admin_Frontend SHALL call Backend_API CRM endpoints
3. THE CRM_Module SHALL display total customer count, active conversations, and conversion metrics
4. THE CRM_Module SHALL display revenue analytics including total revenue, average transaction value, and revenue by service type
5. THE CRM_Module SHALL show customer segmentation by label (hot leads, cold leads, etc.)
6. THE CRM_Module SHALL display recent transactions with customer name, service, amount, and date
7. THE CRM_Module SHALL provide date range filtering for analytics data
8. THE CRM_Module SHALL refresh analytics data when date range is changed
9. THE CRM_Module SHALL display visual charts for revenue trends and service distribution

### Requirement 7: Customer Profile Deep Dive

**User Story:** As an Admin_User, I want to view detailed customer profiles with complete interaction history, so that I can understand customer relationships and provide personalized service.

#### Acceptance Criteria

1. WHEN a customer is selected, THE CRM_Module SHALL display a comprehensive customer profile
2. THE CRM_Module SHALL show customer contact information, conversation history, booking history, and transaction history
3. THE CRM_Module SHALL display customer classification (hot_lead, cold_lead, etc.) with reason
4. THE CRM_Module SHALL show total lifetime value and number of completed bookings
5. THE CRM_Module SHALL display admin notes associated with the customer
6. THE CRM_Module SHALL allow adding or updating admin notes
7. WHEN notes are updated, THE CRM_Module SHALL call the Backend_API crmManagement tool
8. THE CRM_Module SHALL display customer location if available
9. THE CRM_Module SHALL show follow-up history and scheduled follow-ups

### Requirement 8: Follow-Up Management

**User Story:** As an Admin_User, I want to view and execute automated follow-up campaigns, so that I can re-engage customers and increase conversions.

#### Acceptance Criteria

1. THE Admin_Frontend SHALL provide a follow-up queue view
2. WHEN follow-up view is accessed, THE Admin_Frontend SHALL fetch follow-up candidates from Backend_API
3. THE Follow_Up_Engine SHALL display customers categorized by follow-up type (abandoned_booking, post_service, cold_lead_reactivation)
4. FOR EACH follow-up candidate, THE Admin_Frontend SHALL display customer name, last interaction date, and suggested message
5. THE Admin_Frontend SHALL allow reviewing and editing suggested follow-up messages
6. THE Admin_Frontend SHALL provide bulk approval for executing follow-ups
7. WHEN follow-ups are approved, THE Admin_Frontend SHALL call the Backend_API to execute the follow-up queue
8. AFTER execution, THE Admin_Frontend SHALL display success/failure status for each follow-up
9. THE Admin_Frontend SHALL allow regenerating follow-up suggestions with new message variations

### Requirement 9: Financial Transaction Management

**User Story:** As an Admin_User, I want to record and track financial transactions, so that I can maintain accurate business records.

#### Acceptance Criteria

1. THE Finance_Module SHALL provide a transaction entry form
2. THE Finance_Module SHALL allow recording transactions with customer, service, amount, payment method, and date
3. WHEN a transaction is submitted, THE Finance_Module SHALL call the Backend_API addTransaction tool
4. THE Finance_Module SHALL display a transaction history list with filtering by date range and customer
5. THE Finance_Module SHALL calculate and display daily, weekly, and monthly revenue totals
6. THE Finance_Module SHALL show revenue breakdown by service category (Repaint, Detailing, Coating)
7. THE Finance_Module SHALL display payment method distribution (cash, transfer, etc.)
8. THE Finance_Module SHALL allow exporting transaction data to CSV format
9. THE Finance_Module SHALL link transactions to their associated bookings when available

### Requirement 10: Document Generation

**User Story:** As an Admin_User, I want to generate invoices and receipts for customers, so that I can provide professional documentation.

#### Acceptance Criteria

1. THE Admin_Frontend SHALL provide document generation functionality
2. THE Admin_Frontend SHALL support generating invoices, receipts, and payment confirmations
3. WHEN document generation is requested, THE Admin_Frontend SHALL call the Backend_API generateDocument tool
4. THE Admin_Frontend SHALL allow selecting customer, services, amounts, and payment details
5. WHEN a document is generated, THE Admin_Frontend SHALL display a preview or download link
6. THE Admin_Frontend SHALL automatically send generated documents to the customer's WhatsApp
7. THE Admin_Frontend SHALL store generated documents in Firestore for future reference
8. THE Admin_Frontend SHALL display a history of generated documents per customer
9. THE Admin_Frontend SHALL support regenerating documents with updated information

### Requirement 11: System Configuration Management

**User Story:** As an Admin_User, I want to configure AI behavior and system settings, so that I can customize the bot's responses and operations.

#### Acceptance Criteria

1. THE Admin_Frontend SHALL provide a settings interface for system configuration
2. THE Admin_Frontend SHALL allow viewing and editing the System_Prompt
3. WHEN System_Prompt is updated, THE Admin_Frontend SHALL call the Backend_API updateSystemPrompt tool
4. THE Admin_Frontend SHALL display the currently active System_Prompt
5. THE Admin_Frontend SHALL allow updating the monthly promotion message
6. WHEN promotion is updated, THE Admin_Frontend SHALL call the Backend_API updatePromoOfTheMonth tool
7. THE Admin_Frontend SHALL provide a preview of how the System_Prompt affects AI responses
8. THE Admin_Frontend SHALL validate System_Prompt format before saving
9. THE Admin_Frontend SHALL display a confirmation message after successful configuration updates

### Requirement 12: Service Catalog Management

**User Story:** As an Admin_User, I want to view and reference the service catalog with pricing, so that I can provide accurate information to customers.

#### Acceptance Criteria

1. THE Admin_Frontend SHALL display the complete Service_Catalog
2. THE Service_Catalog SHALL show all services organized by category (Repaint, Detailing, Coating)
3. FOR EACH service, THE Admin_Frontend SHALL display name, description, pricing by motorcycle type, and duration
4. THE Admin_Frontend SHALL display pricing variations for different motorcycle sizes (Matic, Bebek, Sport)
5. THE Admin_Frontend SHALL show bundling discounts and package deals
6. THE Admin_Frontend SHALL display the current monthly promotion
7. THE Admin_Frontend SHALL provide a quick reference view for common service combinations
8. THE Admin_Frontend SHALL allow searching services by name or category

### Requirement 13: Responsive Mobile Interface

**User Story:** As an Admin_User, I want to use the admin interface on mobile devices, so that I can manage operations while away from my desk.

#### Acceptance Criteria

1. WHEN the Admin_Frontend is accessed on a mobile device, THE interface SHALL adapt to mobile viewport dimensions
2. THE Admin_Frontend SHALL provide a mobile-optimized conversation list with swipe gestures
3. WHEN a conversation is selected on mobile, THE Admin_Frontend SHALL show full-screen conversation view with back navigation
4. THE Admin_Frontend SHALL display a mobile-optimized header with avatar, name, and AI status
5. THE Admin_Frontend SHALL provide touch-friendly buttons and controls sized for mobile interaction
6. THE Admin_Frontend SHALL support mobile keyboard for message composition
7. THE Admin_Frontend SHALL maintain functionality parity between desktop and mobile views
8. WHEN viewport width is below 768px, THE Admin_Frontend SHALL apply mobile-specific layouts

### Requirement 14: Real-Time Notifications

**User Story:** As an Admin_User, I want to receive notifications for new customer messages, so that I can respond promptly.

#### Acceptance Criteria

1. WHEN a new message arrives from a customer, THE Admin_Frontend SHALL display a notification card
2. THE notification SHALL show customer name, message preview, and timestamp
3. WHEN a notification is clicked, THE Admin_Frontend SHALL navigate to that conversation
4. THE Admin_Frontend SHALL automatically dismiss notifications for the currently selected conversation
5. THE Admin_Frontend SHALL stack multiple notifications in a notification panel
6. THE Admin_Frontend SHALL play a sound or show a browser notification for new messages (if permitted)
7. WHEN a conversation is selected, THE Admin_Frontend SHALL clear notifications for that customer
8. THE Admin_Frontend SHALL display a notification count badge on the conversation list

### Requirement 15: Authentication and Authorization

**User Story:** As an Admin_User, I want to securely log in to the admin interface, so that only authorized personnel can access business data.

#### Acceptance Criteria

1. THE Admin_Frontend SHALL require authentication before displaying any business data
2. THE Admin_Frontend SHALL integrate with Firebase Authentication
3. WHEN an unauthenticated user accesses the Admin_Frontend, THE system SHALL redirect to a login page
4. THE Admin_Frontend SHALL support email/password authentication
5. WHEN authentication succeeds, THE Admin_Frontend SHALL store the session token securely
6. THE Admin_Frontend SHALL include the authentication token in all Backend_API requests
7. WHEN a session expires, THE Admin_Frontend SHALL redirect to login and display a session timeout message
8. THE Admin_Frontend SHALL provide a logout function that clears the session
9. THE Admin_Frontend SHALL validate user permissions before displaying admin-only features

### Requirement 16: Error Handling and User Feedback

**User Story:** As an Admin_User, I want clear feedback when operations succeed or fail, so that I understand the system state and can take appropriate action.

#### Acceptance Criteria

1. WHEN a Backend_API request fails, THE Admin_Frontend SHALL display a user-friendly error message
2. THE Admin_Frontend SHALL distinguish between network errors, server errors, and validation errors
3. WHEN an operation succeeds, THE Admin_Frontend SHALL display a success notification
4. THE Admin_Frontend SHALL provide loading indicators during asynchronous operations
5. WHEN the Backend_API is unreachable, THE Admin_Frontend SHALL display a connection error message
6. THE Admin_Frontend SHALL log errors to the browser console for debugging
7. WHEN a form validation fails, THE Admin_Frontend SHALL highlight invalid fields with error messages
8. THE Admin_Frontend SHALL provide retry options for failed operations
9. WHEN data is stale or outdated, THE Admin_Frontend SHALL display a refresh prompt

### Requirement 17: Performance and Optimization

**User Story:** As an Admin_User, I want the admin interface to load quickly and respond smoothly, so that I can work efficiently.

#### Acceptance Criteria

1. THE Admin_Frontend SHALL load the initial page within 3 seconds on a standard broadband connection
2. THE Admin_Frontend SHALL implement lazy loading for conversation history and booking data
3. THE Admin_Frontend SHALL cache frequently accessed data in browser storage
4. WHEN scrolling through long conversation lists, THE Admin_Frontend SHALL use virtual scrolling to maintain performance
5. THE Admin_Frontend SHALL debounce search input to avoid excessive API calls
6. THE Admin_Frontend SHALL minimize bundle size through code splitting and tree shaking
7. THE Admin_Frontend SHALL use optimized images and assets
8. WHEN multiple API requests are needed, THE Admin_Frontend SHALL batch or parallelize requests where possible
9. THE Admin_Frontend SHALL implement service worker caching for offline resilience

### Requirement 18: Conversation Labeling and Categorization

**User Story:** As an Admin_User, I want to manually update conversation labels, so that I can organize customers by their current status.

#### Acceptance Criteria

1. THE Admin_Frontend SHALL allow changing a conversation's label through a dropdown or context menu
2. THE Label_System SHALL support labels: hot_lead, cold_lead, booking_process, scheduling, completed, follow_up, general, archive
3. WHEN a label is changed, THE Admin_Frontend SHALL call the Backend_API to update the label in Firestore
4. THE Admin_Frontend SHALL display the label change reason if available
5. AFTER a label is updated, THE Admin_Frontend SHALL refresh the conversation list to reflect the change
6. THE Admin_Frontend SHALL allow bulk label updates for multiple conversations
7. THE Admin_Frontend SHALL display label history showing when and why labels were changed
8. WHEN a label is changed, THE Admin_Frontend SHALL optionally prompt for a reason note

### Requirement 19: Booking Status Workflow

**User Story:** As an Admin_User, I want to update booking status through a defined workflow, so that I can track service progress accurately.

#### Acceptance Criteria

1. THE Booking_System SHALL support status transitions: pending → confirmed → in_progress → completed
2. THE Booking_System SHALL allow cancelling a booking from any status
3. WHEN a booking status is updated, THE Admin_Frontend SHALL validate the transition is allowed
4. THE Admin_Frontend SHALL display status history showing all status changes with timestamps
5. WHEN a booking is marked as in_progress, THE Admin_Frontend SHALL optionally prompt for estimated completion date
6. WHEN a booking is completed, THE Admin_Frontend SHALL prompt to create a transaction record
7. THE Admin_Frontend SHALL send automated notifications to customers when booking status changes
8. THE Admin_Frontend SHALL display visual workflow indicators showing current status and available transitions

### Requirement 20: Multi-Language Support Preparation

**User Story:** As an Admin_User, I want the interface to be built with internationalization support, so that future language additions are straightforward.

#### Acceptance Criteria

1. THE Admin_Frontend SHALL use a translation framework (e.g., i18next, react-intl)
2. THE Admin_Frontend SHALL externalize all user-facing text strings into translation files
3. THE Admin_Frontend SHALL default to Indonesian language
4. THE Admin_Frontend SHALL structure code to support adding English or other languages in the future
5. THE Admin_Frontend SHALL handle date and time formatting according to locale
6. THE Admin_Frontend SHALL support right-to-left text direction for future language additions
7. THE Admin_Frontend SHALL provide a language selector component (initially showing only Indonesian)
8. WHEN a translation key is missing, THE Admin_Frontend SHALL fall back to the default language
