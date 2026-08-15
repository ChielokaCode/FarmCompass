# FarmCompass — Mobile-First PWA

**Design and Development of an AI-Assisted Personalised Agricultural Decision Support Web Application for Smallholder Farmers in Nigeria**

FarmCompass is a mobile-first Next.js Progressive Web Application that lets farmers maintain their own farm profile, receive ranked crop recommendations, open practical crop guidance and ask grounded AI-assisted questions. The seed dataset contains 34 crop profiles structured from the supplied Nigerian crop database.

## Role model

### Farmer

A farmer can:

- register and sign in
- complete the first-use app tour
- create their own farm profile
- edit their farm profile whenever conditions or plans change
- request personalised crop recommendations
- view their recommendation results/history
- browse the 34-crop knowledge base
- use the FarmCompass text/image assistant
- capture the farm GPS location from the phone/browser
- automatically calculate long-term rainfall and temperature for the saved farm location
- automatically request location-based soil pH and additional soil attributes from the Kaegro soil endpoint
- view a 7-day farm weather forecast and weather-aware field advisories

### Administrator

An administrator can:

- sign in to a separate administrator workspace
- see all registered farmer accounts
- see the farm profile each farmer has entered
- view profile details in read-only mode
- manage administrative crop controls exposed by the application

An administrator **cannot access farmer recommendation results/history through the admin API or interface** and cannot edit a farmer's farm profile.

## Mobile app structure

The farmer experience is intentionally structured like an installed mobile application rather than a traditional website:

- fixed five-tab bottom navigation
- Home, Crops, Recommend, Ask and My Farm screens
- touch-sized controls and single-column mobile layouts
- dedicated first-use onboarding tour
- searchable crop library with horizontal category filters
- chat-style AI assistant with camera/image attachment
- editable farmer-owned farm-profile screen
- PWA manifest, install support and offline page
- farm GPS, climate baseline, soil intelligence and short-term weather screen

## First-use onboarding

A newly registered farmer is sent to `/welcome` before the dashboard. The five-step tour explains:

1. how to add and update their own farm profile
2. farm GPS, automatic long-term climate, Kaegro soil intelligence and 7-day weather
3. personalised crop ranking and suitability scores
4. the 34-crop production-guidance library
5. FarmCompass Assistant and optional crop-image questions

After the first tour, the farmer is taken to `/profile` to set up their farm. Completion is stored on the MongoDB user record through `/api/onboarding/complete`, so the tour is not forced on every login. Farmers can replay it later.

## Core functionality

- Farmer registration and login
- Farmer-owned editable farm profiles
- Administrator read-only visibility of all farmer profiles
- Farmer recommendation privacy from the administrator interface/API
- 34-crop MongoDB knowledge base
- Weighted crop suitability scoring with missing-factor renormalisation
- Saved recommendation results scoped to the logged-in farmer
- Public/mobile crop library and detailed crop guidance
- OpenAI Responses API integration for grounded text answers and optional crop images
- `react-geolocated` React hook for farmer-controlled browser/device geolocation and farm coordinates
- Open-Meteo Historical Weather API using a 20-year ERA5 baseline for automatic average annual rainfall and average temperature
- Open-Meteo Forecast API for current conditions, 7-day forecast and deterministic farm-weather advisories
- Kaegro Soil API integration for GPS-derived soil pH, soil type/texture where returned, and additional soil attributes
- Basic PWA/offline support

## Prerequisites

- Node.js 22+
- npm
- MongoDB Atlas account/cluster
- OpenAI API key if AI chat/image explanations are required

**No Docker setup is required or included.**

## Configure MongoDB Atlas

Create `.env.local` in the project root:

```env
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=farmcompass
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5
SEED_ADMIN_EMAIL=admin@farmcompass.ng
SEED_ADMIN_PASSWORD=Admin123!
SEED_FARMER_EMAIL=farmer@farmcompass.ng
SEED_FARMER_PASSWORD=Farmer123!
```

The seed script loads `.env.local` directly when run with `tsx`.

## Install and seed

The farm-location screen uses `react-geolocated`. If you are applying this update to an existing FarmCompass checkout, install it with:

```bash
npm install react-geolocated --save
```

For a clean checkout, a normal dependency install is sufficient:

```bash
npm install
npm run seed
```

Demo accounts:

- Admin: `admin@farmcompass.ng` / `Admin123!`
- Farmer: `farmer@farmcompass.ng` / `Farmer123!`

The seeded farmer profile is treated as a farmer-managed profile. Running the corrected seed script also removes legacy profile fields from earlier administrator-managed builds.

## Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Farmer navigation

- `/dashboard` — mobile Home screen
- `/crops` — searchable crop library
- `/recommend` — personalised crop recommendation screen
- `/assistant` — chat-style grounded AI assistant
- `/weather` — current conditions, 7-day forecast, farm advisories and historical climate baseline
- `/profile` — create/edit personal farm profile, capture farm GPS and account controls
- `/welcome` — first-use onboarding tour


## Farm GPS, climate, soil and weather

FarmCompass does not ask farmers to guess average rainfall or temperature. On the **My Farm** screen the farmer can tap **Use my current location**. The client uses the `react-geolocated` hook as a controlled wrapper around the browser/device Geolocation API. Location capture is suppressed on page load and triggered only when the farmer presses the button. After the farmer grants permission, the hook returns latitude, longitude and an accuracy estimate, which FarmCompass saves with the farm profile.

When the profile is saved with coordinates, FarmCompass requests both a long-term climate baseline from the Open-Meteo Historical Weather API and location-based soil information from `https://www.kaegro.com/farms/api/soil?lat={latitude}&lon={longitude}`. The implementation uses the most recent 20 complete calendar years of ERA5 reanalysis and calculates:

- average annual precipitation/rainfall in mm/year
- average daily mean temperature in °C
- typical monthly rainfall and temperature values

The two headline climate values are stored on the farmer profile and are automatically used by the crop recommendation engine when it scores crop rainfall and temperature compatibility. Historical climate values are treated as area-level estimates, not as measurements from a physical sensor on the farm.

The Kaegro response is normalised into a `soilIntelligence` object. FarmCompass looks for soil pH and soil type/texture fields and keeps additional scalar soil attributes for explanation context. A farmer-provided measured pH takes precedence over the location-based estimate. If the farmer has not measured pH, the Kaegro pH estimate can be used by the recommendation engine instead of forcing the farmer to guess. Other returned soil attributes are passed to the AI assistant as additional context, but FarmCompass does not invent crop thresholds for properties that are not represented in the curated crop knowledge base. Location-derived soil information is an estimate and does not replace a laboratory soil test.

The `/weather` screen calls the Open-Meteo Forecast API for current conditions and a 7-day forecast. A deterministic advisory layer highlights conditions such as likely rain, heavy rain, hot/dry periods or elevated crop-water demand. The advisory language remains cautious and does not replace extension advice, product labels or field observation.

The farmer can remove the saved coordinates from the profile. Administrators can see coordinates, climate fields and the saved soil-intelligence summary because they can view the complete farmer profile, but the administrator still cannot see recommendation history or AI conversation history.

**Development note:** `react-geolocated` relies on the browser Geolocation API, which requires a secure context. It works on `localhost` during local development and should be deployed over HTTPS for phones and production use. The Kaegro request is made server-side, so the browser does not call the third-party soil endpoint directly. If the external soil service is unavailable, the farm profile and recommendation workflow continue using the other available factors.

## Farm-profile API

`/api/farm-profile` is scoped to the authenticated farmer:

- `GET` returns the current farmer's profile
- `PUT` creates or updates the current farmer's profile

Farmers cannot edit another user's profile because the API derives `userId` from the authenticated session rather than accepting it from the request body.

## Admin workflow

1. Sign in as the administrator.
2. Open `/admin`.
3. Search or select a farmer.
4. View the profile that farmer has entered.
5. The profile is read-only in the administrator workspace.

The administrator farmer endpoint returns account/profile information only. Recommendation records and AI conversation history are not returned.

## Validation

```bash
npm run validate:recommendations
npm run typecheck
```

Before public deployment, replace demo credentials, rotate development secrets, configure Atlas network/database access securely, add rate limiting, define crop-image retention rules, review agricultural safety content, verify current agrochemical registration/labels and complete real farmer usability evaluation.
