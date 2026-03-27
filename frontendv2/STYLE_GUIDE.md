# PetMatch Design System & Style Guide

This document outlines the standardized design system for the PetMatch application. All future development should adhere to these guidelines to ensure consistency across the platform.

## 1. Color Palette

We use a semantic color naming convention. Avoid using raw hex values or non-semantic Tailwind colors (e.g., `red-500`) directly in components.

### Primary Colors
Used for main actions, buttons, links, and focus states.
- **Primary**: `bg-primary`, `text-primary`, `border-primary` (#f43f5e)
- **Primary Hover**: `bg-primary-hover`, `text-primary-hover` (#e11d48)
- **Primary Light**: `bg-primary-light` (#fb7185)

### Secondary Colors
Used for accents, gradients, and secondary actions.
- **Secondary**: `bg-secondary`, `text-secondary` (#fb923c)
- **Secondary Hover**: `bg-secondary-hover` (#f97316)

### Background Colors
- **Default**: `bg-white` (#ffffff)
- **Light**: `bg-background-light` (#fff1f2) - Used for page backgrounds (gradients)
- **Peach Light**: `bg-peach-light` (#FFCDB2)
- **Peach Medium**: `bg-peach-medium` (#FFB4A2)

### Semantic Usage
- **Primary Buttons**: `bg-primary text-white hover:bg-primary-hover`
- **Secondary Buttons**: `bg-secondary text-white hover:bg-secondary-hover`
- **Inputs**: `border-gray-300 focus:ring-primary focus:border-primary`
- **Error States**: `border-red-500 text-red-500` (Standard Tailwind red is acceptable for errors)
- **Links**: `text-primary hover:text-primary-hover`

## 2. Typography

Font Family: **Inter**, system-ui, sans-serif.

### Headings
- **H1 (Hero)**: `text-4xl md:text-6xl lg:text-7xl font-bold`
- **H2 (Section)**: `text-3xl md:text-4xl font-bold`
- **H3 (Card)**: `text-xl md:text-2xl font-bold`

### Body Text
- **Standard**: `text-base text-gray-700`
- **Small**: `text-sm text-gray-500`

## 3. Responsive Breakpoints

We follow a **Mobile-First** approach. Base styles are for mobile.

- **Mobile**: Default (0px - 768px)
  - Stacked layouts
  - Full width inputs/buttons
  - 16px padding
- **Tablet**: `md:` (768px - 1024px)
  - 2-column grids
  - Larger typography
  - 24px-32px padding
- **Desktop**: `lg:` (1024px+)
  - 3+ column grids
  - Max-width containers (max-w-7xl)
  - 48px+ padding

## 4. Component Patterns

### Buttons
```jsx
// Primary Button
<button className="bg-primary text-white px-6 py-2 rounded-full hover:bg-primary-hover transition-colors shadow-lg">
  Action
</button>

// Gradient Button (Hero)
<button className="bg-gradient-to-r from-secondary to-primary text-white ...">
  Call to Action
</button>
```

### Form Inputs
```jsx
<input 
  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
/>
```

### Cards
```jsx
<div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6">
  {/* Content */}
</div>
```

## 5. CSS Variables & Tailwind Config

The design system is implemented via `tailwind.config.js`:

```javascript
extend: {
  colors: {
    primary: {
      DEFAULT: '#f43f5e',
      hover: '#e11d48',
      light: '#fb7185',
    },
    secondary: {
      DEFAULT: '#fb923c',
      hover: '#f97316',
    },
    // ...
  },
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
  },
}
```

## 6. Layout Structure

- **Page Container**: `min-h-screen bg-gradient-to-br from-peach-light via-peach-medium to-rose-light` (or similar theme gradient)
- **Content Wrapper**: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

---
*Last Updated: 2025-12-29*
