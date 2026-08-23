# SAYPX Portfolio Website

## Overview
This is a professional portfolio website for SAYPX, showcasing creative services including photography, graphic design, video production, event technology, and web development by Sayan Arit Das.

## Project Type
Static HTML/CSS/JavaScript portfolio website

## Technical Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Server**: Python 3.11 with http.server module
- **Port**: 5000 (frontend server on 0.0.0.0)

## Project Structure
```
.
├── index.html              # Main HTML file with complete portfolio structure
├── style.css               # Complete styling for the portfolio
├── app.js                  # Interactive JavaScript features
├── server.py               # Python HTTP server configured for port 5000
├── SAYPX-Logo-White.jpg   # SAYPX logo (used in navbar and footer)
└── hero-background.mp4     # Background video for hero section (15MB, 16:9 ratio)
```

## Features
- Responsive navigation with mobile menu
- Hero section with animated statistics
- About section with brand philosophy
- Services showcase (Photography, Graphic Design, Video Production, etc.)
- Portfolio gallery with category filtering
- Skills section with progress bars
- Testimonials carousel
- Contact form
- Smooth scroll animations
- Counter animations
- Intersection observer effects

## Development Setup
The website runs on a Python HTTP server configured to:
- Listen on 0.0.0.0:5000
- Serve static files with cache-control headers disabled (for development)
- Provide simple HTTP file serving

## Running the Project
The project automatically starts via the workflow:
```bash
python3 server.py
```

## Deployment Configuration
Configured for Replit's autoscale deployment target, serving the static website in production.

## Contact Information
- **Email**: sayandas0629@gmail.com
- **Phone**: +91 6294011684
- **Location**: Ranghat, Nadia - 741201, West Bengal, India
- **Instagram**: https://www.instagram.com/sayan.saypx/
- **Facebook**: https://www.facebook.com/sayanarit.das
- **LinkedIn**: https://www.linkedin.com/in/sayan-das-1a6939384/
- **YouTube**: https://www.youtube.com/@sayanaritdas

## Recent Changes
- **Dec 15, 2025**: Extensive mobile layout optimizations
  - Compact dropdown mobile menu
  - Services horizontal scroll with auto-carousel
  - 2-column grids for Portfolio, Why Choose SAYPX, and Skills sections
  - Smaller cards and text throughout mobile view
  - Hero text changed to "From 'I do' to Forever"
  - Book Now button linked to WhatsApp
  - Instagram showcase section added

- **Oct 31, 2025**: Video background and final customization
  - Removed center logo from hero section
  - Added looping video background (hero-background.mp4) to hero section
  - Video maintains 16:9 aspect ratio and scales responsively
  - Added semi-transparent overlay (20% opacity) for text readability
  - JavaScript ensures video autoplays on page load
  
- **Oct 31, 2025**: Contact information update
  - Updated all contact information with real details
  - Integrated Font Awesome 6.5.1 for professional social media icons
  - Replaced emoji icons with Font Awesome icons throughout
  - Updated both contact section and footer with social media links
  
- **Oct 31, 2025**: Logo and layout improvements
  - Added SAYPX logo to the website
  - Removed redundant "SAYPX" text from navigation and hero sections
  - Increased center hero logo size by 30% (from 80px to 104px)
  - Fixed navbar/hero overlap by adding proper top padding
  
- **Oct 31, 2025**: Initial project import and setup
  - Installed Python 3.11
  - Created HTTP server script on port 5000
  - Configured workflow for webview output
  - Added .gitignore for Python files
  - Created project documentation

## Notes
- Website is fully responsive with mobile-first design
- Uses Google Fonts (Poppins and Inter) and Font Awesome 6.5.1
- All interactive features use vanilla JavaScript (no frameworks)
- Logo image has been added to the project
