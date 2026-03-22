# Design System Specification: The Kinetic Archive

## 1. Overview & Creative North Star
This design system is built to transcend the "database" feel of traditional anime trackers. Our Creative North Star is **"The Kinetic Archive"**—an editorial-first experience that treats every series like a feature story. 

Instead of a rigid, clinical grid, we utilize intentional asymmetry, overlapping elements, and high-chroma accents to mimic the energy of Japanese street fashion and modern animation title sequences. We move away from the "template" look by using aggressive typography scales and depth-based layering, ensuring the community feels active and the content feels premium.

## 2. Colors & Surface Architecture
The palette is rooted in a deep, "Inky Burgundy" (`surface: #220213`), punctuated by "Neon Coral" (`primary: #ff8c98`) and "Electric Violet" (`secondary: #a68cff`).

### The "No-Line" Rule
Standard 1px solid borders are strictly prohibited for sectioning. We define boundaries through **Background Shifts** only. For example, a "Trending Now" section should use `surface-container-low` to sit naturally against the `surface` background. 

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the following tiers to define importance:
*   **Base Level:** `surface` (#220213) for the main application background.
*   **Section Level:** `surface-container` (#34081f) for major content areas.
*   **Component Level:** `surface-container-high` (#3d0d26) or `highest` (#46122c) for interactive cards and modals.
*   **The "Glass & Gradient" Rule:** Floating navigation bars or "Quick-View" overlays must use Glassmorphism. Apply a `surface-variant` color at 60% opacity with a `backdrop-filter: blur(20px)`. 

### Signature Textures
Main CTAs (e.g., "Start Watching") must not be flat. Use a linear gradient transitioning from `primary_dim` (#e5124e) to `primary_container` (#ff7386) at a 135-degree angle to provide a sense of "glow" and kinetic energy.

## 3. Typography
We utilize a high-contrast pairing to balance "Playful Energy" with "Information Density."

*   **Display & Headlines (Plus Jakarta Sans):** Used for anime titles and section headers. These should feel loud and authoritative. Use `display-lg` (3.5rem) for hero titles with tight letter-spacing (-0.02em) to create a "poster" effect.
*   **Body & Utility (Inter):** Used for synopses, user reviews, and metadata. Inter provides the legibility required for long-form reading in dark mode.
*   **Information Hierarchy:** Use `label-md` in all-caps with 0.05em tracking for metadata tags (e.g., "STUDIO MAPPA" or "FALL 2023") to give the UI a technical, curated feel.

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are often messy in dark-themed anime platforms. We use **Tonal Layering** to achieve lift.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft "recessed" or "elevated" effect without a single pixel of stroke.
*   **Ambient Shadows:** For high-floating elements like Modals, use a shadow color tinted with the primary hue: `rgba(229, 18, 78, 0.08)` with a blur of `40px`. This mimics the way neon light dissipates in a dark room.
*   **The "Ghost Border" Fallback:** If a divider is absolutely necessary for accessibility, use the `outline-variant` (#673a4d) at **15% opacity**. It should be felt, not seen.

## 5. Components

### Buttons
*   **Primary:** Gradient of `primary_dim` to `primary_container`. Border radius: `full` (9999px). No border.
*   **Secondary:** Ghost style. No background, `outline` (#9b667b) at 30% opacity, with `on_surface` text.
*   **Interaction:** On hover, primary buttons should scale 1.05x with a subtle `primary` outer glow.

### Character & Series Cards
*   **Structure:** No borders. Use `surface-container-high`. 
*   **Visual Style:** Images should use the `lg` (2rem) corner radius. Implement a "Gradient Scrim" at the bottom of the image (from transparent to `surface_container_highest`) to house the title text, ensuring legibility.

### Selection Chips
*   **Filter Chips:** Use `surface-bright` (#4f1733) for unselected states. When active, transition to `secondary` (#a68cff) with `on_secondary` (#25006b) text. Use the `sm` (0.5rem) corner radius for a "tab" feel.

### Progress Bars (Watch Status)
*   **Track:** `surface-variant` (#46122c).
*   **Indicator:** A vibrant gradient of `tertiary` (#ffe483) to `primary`. This highlights completion as a "rewarding" visual.

### Navigation (The "Floating Rail")
Instead of a fixed top bar, use a floating bottom or side rail using `surface-container-lowest` (#000000) at 80% opacity with a heavy backdrop blur. Use `xl` (3rem) corner radius.

## 6. Do's and Don'ts

### Do:
*   **Do** use asymmetrical margins (e.g., 80px left, 40px right) for hero sections to create a dynamic, editorial rhythm.
*   **Do** allow character art to "break the container" (bleed over edges) to add depth.
*   **Do** use `tertiary` (#ffe483) sparingly as a "star" or "highlight" color for ratings and special announcements.

### Don't:
*   **Don't** use pure white (#FFFFFF) for body text; use `on_surface_variant` (#d59ab1) to reduce eye strain against the deep burgundy background.
*   **Don't** use sharp 90-degree corners. The minimum radius allowed is `sm` (0.5rem).
*   **Don't** use standard dividers. If you need to separate content, use a `20` (5rem) spacing gap or a tonal background shift.