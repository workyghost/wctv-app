---
name: Passion & Glory
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#e8bcb7'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#af8782'
  outline-variant: '#5e3f3b'
  surface-tint: '#ffb4aa'
  primary: '#ffb4aa'
  on-primary: '#690004'
  primary-container: '#e30a17'
  on-primary-container: '#fff5f4'
  inverse-primary: '#c0000f'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#c8c6c5'
  on-tertiary: '#313030'
  tertiary-container: '#727171'
  on-tertiary-container: '#faf6f6'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad5'
  primary-fixed-dim: '#ffb4aa'
  on-primary-fixed: '#410002'
  on-primary-fixed-variant: '#930009'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-hero:
    fontFamily: Montserrat
    fontSize: 64px
    fontWeight: '900'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 40px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 28px
    fontWeight: '800'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  stats-number:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '900'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  container-max: 1440px
  gutter: 24px
---

## Brand & Style

The design system is engineered to capture the high-octane energy of the Turkish National Football Team's 2026 World Cup journey. The brand personality is **Passionate, Bold, and Patriotic**, aiming to evoke a sense of stadium atmosphere and national pride.

The visual style is **Premium Sports Broadcast Modernism**. It utilizes a dark-mode foundation to make the "Passionate Red" pop, combined with **Glassmorphism** to simulate high-end broadcast overlays. The aesthetic balance leans toward "High-Contrast/Bold" to mirror the intensity of live football, using sharp gradients and atmospheric depth to create a world-class IPTV experience.

## Colors

The palette is rooted in the Turkish national identity.
- **Passionate Red (#E30A17):** The primary driver for action, used for live indicators, primary buttons, and active states.
- **Brilliant White (#FFFFFF):** Used for maximum legibility of scores, player names, and core metadata against dark backgrounds.
- **Deep Night Grey (#0F0F0F):** The foundational canvas, providing a cinematic, immersive "blackout" stadium feel.
- **Secondary Surfaces (#1A1A1A):** Used for cards and navigation bars to create subtle depth.

Gradients should be used sparingly but impactfully on hero sections and large buttons to simulate movement and lighting.

## Typography

This design system uses a dual-font approach to balance impact with utility.
- **Montserrat** is the voice of the brand, used for all headlines and scores. Its geometric, bold nature evokes classic jersey numbering and stadium signage. Use **Heavy (900)** or **ExtraBold (800)** for headlines to command attention.
- **Inter** provides high-performance legibility for schedules, settings, and descriptions. Its neutral, systematic nature ensures that dense data (like group standings) remains easy to scan.

Uppercase styling is preferred for "Display" and "Label" roles to reinforce the authoritative sports aesthetic.

## Layout & Spacing

The layout utilizes a **12-column fluid grid** for desktop and a **4-column grid** for mobile. 
- **Desktop:** 24px gutters with 48px side margins.
- **Mobile:** 16px gutters with 16px side margins.

Content is organized into "Live Strips" (horizontal carousels) and "Bento Grids" for featured matches. Vertical spacing follows an 8px base unit, using larger gaps (48px+) between distinct sections like "Match Highlights" and "Group Standings" to prevent visual clutter. For the IPTV interface, focus on a "Lean-back" experience with larger click targets and clear visual paths.

## Elevation & Depth

Depth in the design system is achieved through **Tonal Layering** and **Glassmorphism** rather than traditional drop shadows.
1. **Base Layer:** Deep Night Grey (#0F0F0F).
2. **Surface Layer:** Dark Grey (#1A1A1A) with a 1px subtle stroke (white at 10% opacity) to define edges.
3. **Overlay Layer:** Semi-transparent glass (rgba(255, 255, 255, 0.05)) with a 20px backdrop-blur. This is used for navigation bars and score overlays atop live video feeds.

When a match is "Live," the card may emit a soft, low-opacity Red glow (#E30A17 at 20% blur) to signify its active status.

## Shapes

The shape language is **Rounded (0.5rem base)**. This softens the aggressive high-contrast color palette, making the premium broadcast feel more modern and accessible. 
- **Thumbnail/Video Containers:** Use 1rem (rounded-lg) to frame live action cleanly.
- **Buttons & Action Items:** Use 0.5rem (base) for a sturdy, athletic feel.
- **Status Chips:** Use Pill-shaped (3) for "Live" or "Replay" tags to distinguish them from structural elements.

## Components

### Buttons
- **Primary:** Solid Red (#E30A17) with white uppercase Montserrat text. 0.5rem corner radius.
- **Secondary:** Transparent with a 2px White border. Ghost effect.
- **Live Tag:** A pill-shaped red badge with a pulsing dot icon next to the word "LIVE".

### Cards (Match/VOD)
- **Design:** Aspect ratio 16:9 for video, 1:1 for player profiles.
- **Interaction:** On hover, the card scales slightly (1.05x) and the border brightness increases.
- **Overlay:** Bottom-aligned gradient (Black to Transparent) to ensure text legibility over video thumbnails.

### Input Fields
- Dark backgrounds (#1A1A1A) with a 1px border that turns Red on focus. 
- Monospaced or Inter font for technical data entry.

### Additional Components
- **Scoreboard:** High-contrast display using Montserrat ExtraBold. Team flags should be circular.
- **Progress Bar:** Red for the watched portion, dark grey for the remaining time. Use for both VOD and live-delay scrubbing.
- **Group Table:** Zebra-striping with subtle grey alternates to keep rows clear during fast scrolling.