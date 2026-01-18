# Ashtech Pay - Design Guidelines

## Design Approach
Reference-Based: Binance-inspired fintech aesthetic - dark, professional, and trust-focused

## Color Palette
- **Primary Dark Backgrounds**: #0B0E11, #1E2329
- **Accent (CTAs)**: #F0B90B (golden yellow)
- **Text**: #EAECEF (light gray)
- **Dark mode is default**

## Typography
- **Hero Title**: Bold, large (48-64px desktop), impactful fintech messaging
- **Section Headers**: Medium weight (32-40px), clear hierarchy
- **Body Text**: Light gray (#EAECEF), 16-18px, excellent readability on dark backgrounds
- Use 2 font weights maximum for performance

## Layout System
- **Spacing**: Tailwind units of 4, 6, 8, 12, 16, 20 (p-4, py-8, gap-6, etc.)
- **Container**: max-w-7xl centered
- **Section Padding**: py-16 mobile, py-24 desktop
- **Rounded corners**: rounded-xl for cards, rounded-lg for buttons

## Landing Page Structure

### 1. Hero Section (80-90vh)
- **Headline**: "Transférez, recevez et gérez votre argent en toute simplicité"
- **Subheadline**: "Rechargez, retirez et créez des liens de paiement en quelques secondes avec Ashtech Pay"
- **CTAs**: Two prominent buttons side-by-side - "Créer un compte" (golden #F0B90B) + "Se connecter" (outlined)
- **Hero Image**: Modern fintech illustration showing digital wallet, secure transactions, cryptocurrency elements, floating UI elements. Place on right side (desktop) or above text (mobile)

### 2. Key Features Section
4-column grid (desktop) → 2-column (tablet) → 1-column (mobile)
- 💳 Recharge du compte (Mobile Money & Crypto)
- 💸 Retraits rapides et sécurisés
- 🔗 Création de liens de paiement
- 🔁 Transferts instantanés entre utilisateurs
- 📊 Historique et suivi en temps réel

Each card: Icon top, title, brief description, dark background (#1E2329), hover state with subtle glow

### 3. Why Ashtech Pay? Section
3-column layout with icons and benefits:
- Transactions rapides
- Sécurité renforcée
- Interface moderne
- Disponible dans plusieurs pays
- Support client réactif

### 4. How It Works Section
4-step horizontal timeline (desktop) → vertical (mobile):
1. Créez un compte
2. Rechargez votre solde
3. Envoyez, recevez ou retirez de l'argent
4. Créez et partagez des liens de paiement

Use numbered circles with connecting lines, each step has icon + description

### 5. Security & Trust Section
3-column grid with large icons:
- 🔐 Données protégées
- 🛡️ Transactions sécurisées
- 📜 Conformité & transparence

Dark cards with subtle borders, centered content

### 6. Final CTA Section
Centered content with gradient background overlay:
- **Title**: "Prêt à simplifier vos paiements?"
- **Button**: "Commencer avec Ashtech Pay" (golden, large, prominent)

### 7. Footer
4-column grid (desktop) → stacked (mobile):
- **Column 1**: Logo + brief description
- **Column 2**: À propos, Conditions d'utilisation, Politique de confidentialité
- **Column 3**: Support, Contact
- **Column 4**: Social media icons
- **Bottom**: Copyright © Ashtech Pay, centered

## Component Library

### Cards
- Background: #1E2329
- Border: subtle 1px #2B3139
- Padding: p-6 to p-8
- Rounded: rounded-xl
- Hover: subtle scale(1.02) + glow effect

### Buttons
- **Primary**: Golden (#F0B90B), black text, py-3 px-8, rounded-lg, font-semibold
- **Secondary**: Outlined with golden border, golden text, same padding
- **Hover**: Slight brightness increase, no blur backgrounds needed

### Icons
Use Heroicons or Font Awesome via CDN
- Size: 24-32px for feature icons, 16-20px for UI elements
- Color: Golden accent or light gray based on context

### Navigation (if needed)
- Fixed top, dark background (#0B0E11 with slight transparency)
- Logo left, nav items center, CTA button right
- Mobile: Hamburger menu

## Animations
Minimal and purposeful:
- Fade in on scroll for sections
- Subtle hover effects on cards (scale 1.02, 0.3s transition)
- Smooth scroll between sections
- NO complex animations that distract

## Images
1. **Hero Image**: Professional fintech illustration - digital wallet interface, transaction flows, security shields, cryptocurrency symbols, modern UI elements. Placement: Right side (60% width) desktop, full-width above text on mobile
2. **Feature Section**: Optional small icons or illustrations for each feature card
3. **Trust Section**: Security-focused imagery or abstract patterns

## Responsive Behavior
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- All multi-column layouts stack to single column on mobile
- Hero text scales down appropriately
- CTA buttons remain prominent on all screen sizes

## Accessibility
- High contrast maintained (light text on very dark backgrounds)
- Focus states visible with golden outline
- All interactive elements keyboard accessible
- ARIA labels for icon-only elements