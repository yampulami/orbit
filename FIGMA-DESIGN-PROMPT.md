# Orbit Figma Design Prompt

Create a custom visual identity, icon system, and illustration library for **Orbit**, a university social and campus-life mobile application.

Orbit allows students to:

- Browse a university-specific social feed
- Create posts, events, polls, and marketplace listings
- Find roommates
- Send direct messages and participate in group chats
- Discover campus events, clubs, dining, and services
- Manage their campus identity, interests, posts, and replies

## Core visual direction

Use the supplied dark teal mobile-finance reference as the main visual inspiration.

Preserve its:

- Deep blue-black backgrounds
- Layered petrol and muted teal surfaces
- Warm cream contrast
- Thin hand-drawn illustrations
- Rounded compact panels
- Minimal monochrome iconography
- Quiet, polished typography
- Dark cinematic atmosphere
- Small moments of playful personality

Translate this style into an original campus social application. Do not copy the financial content, characters, layouts, or branding from the reference.

## Color system

Use these exact foundation colors:

| Role | Color |
| --- | --- |
| Main background | `#071619` |
| Primary surface | `#10252A` |
| Elevated surface | `#1C3339` |
| Deep teal | `#396D78` |
| Mid teal | `#53909A` |
| Active aqua | `#8BBBC4` |
| Warm cream | `#CEC5BE` |
| Primary text | `#EEEAE3` |
| Secondary text | `#A3B3B4` |
| Dividers | `#24383C` |
| Text on cream | `#101D20` |

The application must remain dark throughout every screen. Avoid isolated light-mode pages.

## Personality

Orbit should feel:

- Intimate
- Social
- Calm
- Sophisticated
- Slightly mysterious
- Welcoming to university students
- Editorial rather than corporate
- Playful through illustrations, not excessive decoration

Avoid:

- Bright lime green
- Purple gradients
- Glassmorphism
- Generic dashboard cards
- Large marketing slogans
- Excessive shadows
- Neon cyberpunk styling
- Oversized headings
- Generic stock illustrations
- Colorful emoji-style icons
- Cards around every individual element

## Typography

Use a clean contemporary sans-serif such as Inter, Geist, or SF Pro.

- Screen titles: 24–28 px, medium or semibold
- Section titles: 16–18 px, semibold
- Body text: 14–16 px
- Supporting metadata: 11–13 px
- Uppercase labels: 9–11 px with increased letter spacing

Keep copy concise. Interfaces should fit comfortably on a phone without unnecessary scrolling.

## Custom icon system

Create an original set of rounded monoline icons.

Icon construction:

- 24 × 24 pixel grid
- 1.75–2 pixel stroke
- Rounded caps and joins
- Slightly organic geometry
- Simple enough to remain legible at 20 pixels
- Monochrome by default
- Inactive icons use `#A3B3B4`
- Active icons use `#8BBBC4`
- Selected icons may include one small filled teal detail
- Avoid standard-looking Material or Font Awesome copies

Create icons for:

1. Feed
2. Roommates
3. Messages
4. Hangouts
5. Campus
6. Search
7. Notifications
8. Create post
9. Photo
10. Video
11. GIF
12. Feeling or emoji
13. Location
14. Poll
15. Event
16. Marketplace
17. Like
18. Comment
19. Share
20. Bookmark
21. Group chat
22. Direct message
23. Calendar
24. Profile
25. Settings
26. Edit
27. Delete
28. Back
29. Close
30. More options

Create three variants for navigation icons:

- Inactive outline
- Active aqua outline
- Active outline with a subtle illuminated accent

The bottom navigation should include:

- Feed
- Roommates
- Messages
- Hangouts
- Campus

Add a thin aqua indicator above the active tab. Design it so the indicator can slide smoothly between tabs.

## Custom illustration system

Create original hand-drawn editorial illustrations inspired by the reference image.

Illustration style:

- Thin cream and aqua line work
- Imperfect, human-looking strokes
- Flat shapes behind selected areas
- Limited palette
- No realistic shading
- No detailed facial features
- Slightly strange, memorable characters
- Warm cream used sparingly
- Transparent backgrounds
- Legible between 120 and 280 pixels wide

Create illustrations for:

1. Orbit welcome and authentication
2. Campus feed empty state
3. Students gathering at an event
4. A commuter arriving on campus
5. Roommates organizing a shared apartment
6. Students participating in a group chat
7. Campus marketplace exchange
8. Club discovery
9. No notifications
10. No messages
11. Email confirmation sent
12. Account successfully confirmed
13. Search with no results
14. Failed connection or offline state
15. Profile with no posts yet

Include small decorative assets:

- Orbiting planets
- Stars and sparkles
- Hand-drawn arrows
- Speech bubbles
- Abstract campus buildings
- Tiny books, coffee cups, bags, laptops, and transit symbols
- Organic scribbles that can sit inside cards without distracting from content

## Component system

Create reusable Figma components with variants for:

- Bottom navigation
- Floating create-post button
- Feed filter tabs
- Post header
- Standard post
- Event post
- Marketplace post
- Poll
- Comment row
- Composer toolbar
- Direct message row
- Group chat row
- Chat bubble
- Roommate listing
- Campus event row
- Club row
- Dining row
- Notification row
- Profile header
- Authentication field
- Primary cream button
- Secondary teal button
- Compact filter chip
- Modal header
- Empty state
- Loading skeleton
- Error state

## Component styling

Use:

- 16–24 px corner radii
- Thin `#24383C` dividers
- Cream primary buttons for important actions
- Teal surfaces for featured content
- Aqua only for active states and small highlights
- Very subtle or no shadows
- Generous internal spacing
- Clear touch targets of at least 44 × 44 pixels

Feed posts should feel like sections of a continuous social timeline. Do not put every post inside a floating generic card. Use subtle dividers, grouped content, and occasional teal feature panels.

## Screens to design

Create polished high-fidelity screens for:

1. Sign in
2. Create account
3. Email confirmation sent
4. Four-step onboarding
5. Campus feed
6. Expanded post composer
7. Event creation form
8. Marketplace listing form
9. Post comments
10. Notifications
11. Direct messages
12. Group chats
13. Active conversation
14. Roommate discovery
15. Hangouts
16. Campus events
17. Campus clubs
18. Campus dining
19. Student profile
20. Profile post and reply history

## Feed requirements

The feed header should contain:

- Orbit logo
- Search
- Notifications

Under the header, include horizontally scrollable filters:

- All
- Commuters
- Residents
- Roommates
- Marketplace

Use a floating compose button near the lower-right corner.

Post types:

- Standard social post
- Event
- Marketplace listing
- Poll

Post actions:

- Like
- Comment
- Share

Events should include:

- Date and time
- Location
- Organizer
- Target audience
- Attendee count
- Large register or interested button

Marketplace posts should include:

- Image
- Price
- Item details
- Location
- Pickup or drop-off
- Message seller button

## Post composer

Design a full-screen composer with:

- A safely positioned close button below the phone status bar
- Author identity
- Audience or community selector
- Large writing area
- Compact photo, video, GIF, feeling, location, and poll controls
- Post-type selector for Post, Event, and Marketplace
- Primary publish button
- Controls appearing progressively once the user begins writing

## Onboarding

Keep onboarding concise and interactive.

Collect:

- First name
- University
- Commuter, resident, or off-campus status
- Academic year
- Major
- Hobbies
- Club interests

Use:

- One clear decision per step
- Compact progress indicator
- Interactive choice tiles
- A live preview showing how selections personalize Orbit
- Dark teal backgrounds throughout
- Cream primary buttons
- Subtle page-transition animation notes

## Deliverable structure

Organize the Figma file into:

1. Foundations
2. Colors and typography
3. Icons
4. Illustrations
5. Components
6. Authentication
7. Onboarding
8. Feed and composer
9. Messages
10. Roommates and hangouts
11. Campus
12. Profile
13. Motion specifications

Use:

- Auto Layout
- Components and variants
- Named color variables
- Named text styles
- Consistent spacing tokens
- Clear layer names

## Export requirements

Icons:

- SVG
- Transparent background
- Individual named exports

Illustrations:

- SVG
- Transparent PNG at 1x, 2x, and 3x
- No embedded external images
- Editable vector layers

Create all work in an iPhone-sized frame around 390 × 844 pixels and respect iOS safe areas.
