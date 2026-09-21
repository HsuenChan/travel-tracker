# ✈️ Travel Tracker

[English](#english) | [中文](#中文)

**Live:** https://travel-tracker-nine-delta.vercel.app/
**Design Guideline:** https://hsuenchan.github.io/travel-tracker/design_guideline.html

---

## English

A modern, interactive personal travel journal. Log your trips, visualize routes on a 3D globe and interactive map, manage expenses, plan your itinerary, and generate AI-powered travel notes with ease.

### Key Features

- **Interactive 3D Globe** — WebGL rendering with animated flight arcs (all tracks shown by default), region-level markers, and smooth transitions. Destinations stored as precise lat/lng coordinates via Nominatim / OpenStreetMap. Country flags auto-resolved from Nominatim ISO codes. The trip drawer opens with a storytelling footprint summary — year span, trips, unique countries (counted by ISO code), and total travel days.
- **Travel Passport** — One book that holds every trip, the ones you created and the ones you were invited to alike — someone else opening the trip does not mean you were not there. Past the cover is the data page: the holder's photo rendered as print halftone, the trip, country and day counts beneath it, and two lines of machine-readable code at the foot. Then the entry stamps — one per country per trip, so three visits to Japan leave three stamps, and each stamp's shape, angle and ink are derived from the country code, so the same country always looks the same. The record page carries the distance of logged flights, the single longest flight, the longest trip and the country visited most; a flight counts only when both airports have known coordinates, and the rest are stated as excluded, because treating an unknown airport as zero produces a number that looks precise and is wrong. Every record disappears when there is nothing to say — a country visited once is not the country you visit most. After that comes a page per year — that year's trips, countries, days and a photo from that year's Google Photos album — which can be saved as an image to share. The way in is a passport tucked into the bottom-left corner of the globe: tap it and it flies to the middle and opens up, close it and it spins back to the corner. The passport sits on top of the home page rather than replacing it, so the globe is still at the angle you left it when you close the passport, not spinning up from scratch. It is a book that actually turns: drag a page and the paper bows under your finger and swings round the spine, snapping back if you let go too early. Tap either half to turn, or use the arrow keys. On a device without WebGL, or for anyone who has asked their system to reduce motion, it falls back to flat pages that change without turning — the same content either way.
- **Where the App Opens** — A trip that is happening right now opens straight into that trip. When everything has ended and no trip has been opened recently, the app lands on the travel passport instead — the off season has no "now" to show, but the ground already covered is still there. Opening any trip within the last 14 days keeps you on the trip list, because that means the trip is still being looked back on and should not be interrupted. The decision is made once per launch, so returning from the passport to the list never bounces you away again.
- **Route Tab** — Boarding-pass style cards for transport segments (flights, trains, buses).
- **Rich Text Notes + AI** — Full Quill editor with six section chips that trigger AI-generated content (travel tips, packing list, transit guides, etc.) via Google Gemini. Shared across all trip members. Opens in read mode with an explicit edit toggle; unsaved edits are kept as a local draft (restored on return, with an unsaved-changes indicator) so switching tabs never loses work. The toolbar covers headings, colours, links, lists, quotes, dividers and tables — tables are inserted by picking a size from a grid, and a row/column toolbar appears whenever the cursor sits inside one. Shift+Enter starts a new line inside the current block, so a quote, list item or paragraph can span several lines, while Enter still starts a new one. Reading mode uses the same typography as the editor, so a note looks identical before and after saving. The same editor powers itinerary notes and trip descriptions.
- **Itinerary Planning** — Multi-day events with a unified date-time range picker (end time optional). Timeline shows day-of-week labels, real-time weather forecasts, and per-item category icon nodes on the rail. Per-item rich text notes with clickable links, plus multiple photos per item (downscaled client-side before upload to Supabase Storage; the first photo becomes a full-width cover on top of the card with a +N badge and lightbox gallery). A multi-day event shows up on every day it covers: the starting day keeps the full card, while each following day gets a slim bar with the item's name and how far into the stay it is ("住宿中 3/9 天"), plus the check-out time on the last day — tapping the bar jumps back to the full card. Days in the middle of a stay appear on the timeline even when nothing else is planned, and the weather forecast covers the whole span rather than just the starting day.
- **Pocket List & Backup Plans** — A place you have not picked a day for goes into 口袋名單 at the top of the itinerary, as a single row of chips: a name, and a location field that happily takes a pasted Google link (shown on hover, since a holding area should not take more room than the itinerary it feeds). Tap a chip to open it in full — category, location, notes and photos work exactly as they do for a scheduled item. An outdoor one also carries a route button straight to its elevation profile and waypoints, since whether to do that route is a decision made by looking at exactly that, not something that should wait until it has a date. Drag the chip onto a day to schedule it; a scheduled item can be dragged back to the wishlist too. What follows the cursor while dragging is a small pill with just the title, not a ghost of the whole card. A long itinerary does not mean scrolling to reach a day that is off screen: the sticky row of dates at the top is itself a drop target, and dragging near the top or bottom edge scrolls the page. Going the other way, a 放回想去 target sits fixed at the bottom of the screen, so nothing has to be dragged all the way back up. Planned, backup and wishlist are three values of one field, so the edit form has one control for it rather than a scatter of buttons on the card, and choosing 想去 folds the date away. An outdoor leg with no photos of its own falls back to the representative photo from its route dossier — those photos already belong to that leg, just tucked inside the route view, while the card sat there looking empty; a row of grey canyon cards tells you nothing about which canyon is which. A backup card carries a vertical label down its left edge, with a dashed outline and a step back in weight, to be decided on the day itself — the left edge is the one part of the card nothing else competes for, with edit and delete at the top right, the cover photo along the top, and category and location already filling the line below. A backup is left out of the outdoor totals, because those numbers are what you train and pack against, and counting something undecided makes the baseline wrong. The wishlist shows on the read-only share link, since where to go is an argument the group has together, and it exports as its own sheet, because it has no date and would only add a column of blanks to a one-row-per-day table. A shared link carries a line at its foot saying that opening it records the device and source IP — the trip owner can see that in the admin console, so the person being recorded should have a way to know.
- **Save from Instagram or Threads** — Tap share on a reel or post, pick Travel Tracker, and it lands in a trip: the pocket list, the souvenir list or the trip's notes, whichever the post is actually about. Instagram hands over nothing but the permalink — no caption, no location tag — and its post pages are rendered client-side with no metadata for anyone not logged in, so the text is fetched separately and read by AI: the venue named in the caption, not the city on the location tag, because a post tagged *Florence, Italy* is usually about one square in it. A post that names several places yields several, each with a line on what the post actually claimed about it, and you tick the ones worth keeping before anything is saved — a pocket list is a list you curated, and a wrong guess sitting in it costs more to clear out later than it saved. The trip is chosen by matching the place's country against your trips, so a square in Florence defaults to the Italy trip rather than whichever trip happens to be first. What the post actually tells you about the place is kept — where to buy tickets, when to go, what to watch out for — rather than boiled down to a slogan, since a how-to compressed into three words is worth nothing later. The reel's cover frame is offered as the card photo but left unticked: it is a frame the poster chose, and these days it is as often a title card as the place itself, so it is shown next to the tickbox to be judged rather than assumed. A Threads post is read the same way, minus the cover-photo question: the only picture Threads gives out is a screenshot of the post itself, which would make a poor card photo, so it is not offered. When the post gives nothing to work with, the name is typed by hand and the link is kept regardless — and that holds when the AI is the part that fails: a busy model is retried, and if it is still busy the post and its link are handed back rather than thrown away with an error, so the fifteen seconds of reading are not spent twice. The address goes into the place's own location field rather than being buried in the notes, and it comes from the most trustworthy thing on offer: a map link the post itself carries, failing that an address the post spells out, failing that a lookup by name and city — and a looked-up one counts only when the country agrees with what the post said, because the same street name in the wrong country is worse than a blank. Each address is labelled with where it came from, and the looked-up ones say so plainly, since those are the ones worth a glance before saving. Any of them can be corrected on the spot: fixing a wrong guess here is one tap, fixing it afterwards means finding that item again. Not everything worth keeping is a place — a post about what to bring home goes to the souvenir list instead, and a post that is pure advice, how to buy metro tickets or which pass to get, has its practical points gathered up and appended to the trip's notes. That last one used to be a dead end: a guide naming no venue produced nothing at all. One share goes to one of the three, starting on whichever the post looks most like. Requires the app to be installed from the home screen; Android only, as iOS has no equivalent.
- **Outdoor Legs & Elevation Profile** — An itinerary item set to the Outdoor category carries distance, ascent, and descent, and opens a route view whose elevation profile is drawn from that leg's own waypoints: name, altitude, cumulative distance, which day it falls on, and the outbound and return time for each stretch between two points — the shape of a paper topo map, inside the app. Outbound and return are recorded separately because they are rarely the same. The profile only appears when the data supports it: fewer than four waypoints with an altitude, or altitudes on under 60% of them, and it is replaced by a line saying why — a profile drawn across legs with no data connects them with a straight line, which reads as gentle ground where a canyon actually drops. That call can be overridden per leg either way, and the override is stored on the leg so every trip member sees the same thing. A rappel, downclimb, jump or slide carries its measured drop, and the list draws each one as a bar scaled against the longest — the shape a canyon topo actually communicates, since CanyonTopos give drops rather than altitudes. The header then states the number that decides what rope to bring: longest rappel, rappel count, and the sum of recorded drops (labelled as such, because a spot that can be either rappelled or jumped is one waypoint and counts once). The route view lists every waypoint in order with its type, altitude, distance, leg time and notes — the hazards and flood refuges a canyon topo records are the reason to open the view at all, so they are read straight off the list rather than hidden behind a chart hover that a phone cannot trigger; hazard and escape rows are outlined in red and green. A waypoint can carry coordinates — a lat/lng pair or a Google Maps link — and one button then fills in the terrain elevation for every waypoint that has them, without touching the ones already filled in. Elevation is looked up from coordinates only, never guessed from a place name, because a silently wrong altitude on a canyon topo is worse than a blank one. A GPX track can be imported instead of typed: the file is read in the browser, the points that define the profile's shape are picked out (Douglas-Peucker over distance and a smoothed elevation, so GPS noise near a ridge does not crowd out the long climb), and the result is previewed — track length, elevation range, node list, and an offset field for when the track's absolute altitudes disagree with the map — before anything is added. A leg's distance, ascent and descent are always derived from its waypoints, never typed into the itinerary form — two places writing the same number means the last save silently wins, and a figure somebody typed would disappear the next time anyone touched the waypoints. A single-day leg is one item with no end date and a multi-day leg is one item spanning several days, so a trip can hold as many independent legs as it needs; a pill on the trip hero adds them all up. None of these fields show up on ordinary travel items.
- **Route Dossier** — An outdoor leg can carry the route's own file alongside its waypoints, and the route view then splits into tabs: quick info (location, grade, rock, catchment, anchors, gear, GPS, first descent), time planning (approach, descent, return and total, plus per-section times), the elevation profile and waypoint list, the approach written as numbered steps, the original topo, representative photos, and the hazards. Only tabs with something to show appear, so a leg that has nothing but waypoints looks exactly as it did before. The grade is displayed as its parts — vertical technicality, water difficulty, commitment and stars — instead of a string typed into the title, where it was easy to mistype and impossible to read consistently. Where a route file came from stays on screen, and recent trip reports sit next to the hazards, because a loose bolt somebody reported last season matters more on the day than the official topo does.
- **Canyon Longitudinal Profile** — A tab draws the descent the way a canyon topo does: obstacle by obstacle, left to right, each drop to vertical scale, with the pool it lands in shown as shallow, deep, or a dangerous hydraulic. Rappels are called out in colour because they decide what rope to carry, the anchor notation sits under each label, and long routes are split into the sections the official topo marks so an eighty-obstacle canyon does not become one unreadable strip. The drawing comes from the leg's own waypoints rather than a stored picture, so editing a waypoint redraws it, and any route gets a profile as soon as its obstacles are entered. Where no obstacle sequence exists yet the tab says so and keeps the link to the official topo.
- **Share-Link Views & AI Spend in the Admin** — The admin console separates what happened into three kinds. Changes to a trip live under 異動; logins, logouts, failed attempts and share-link opens live under 來訪, because those all answer the same question — who touched this system and when. A share link being opened is recorded with the trip it showed, the device and the IP, deduplicated so one person refreshing a page is one entry rather than thirty. AI usage gets its own admin page, with a summary card on the overview that links into it: every Gemini call is recorded with its token counts, how long it took, and whether it failed — failures included, because a blocked call is a failure and counting only successes makes usage look low when it is actually hitting a wall. The token counts — including the thinking tokens a reasoning model bills as output but reports separately, which are easy to miss and were six times the visible output on the first call measured — are converted to an estimated cost, broken down by feature and by account, and a monthly budget stops the AI features before the bill runs away rather than after.
- **Server Error Log** — Uncaught exceptions from route handlers, Server Components and Server Actions are captured through Next's `onRequestError` hook rather than a try/catch in every endpoint, so nothing is missed and new endpoints are covered the moment they are written. Each entry keeps the request path, the route file, the method, the stack and Next's error digest, and the same error on the same route is recorded once every five minutes — a broken endpoint being polled would otherwise bury every other error under thousands of identical rows. Responses that merely return a 500 without throwing are deliberately not recorded: those are expected outcomes, and mixing them in would hide the crashes that actually need attention.
- **Image Storage & Cleanup** — One admin page shows how much space itinerary photos take, against the 1 GB the free plan allows, turning amber past 80% — hitting the ceiling makes uploads fail outright, and finding out then is too late. Removing a photo from an itinerary item, or deleting the item entirely, drops the reference in the database but leaves the file in the bucket; deleting the file along with the row is not safe, because the same URL can be shared by several trips (copying an itinerary from a share link copies the link, not the file), so one deletion would break someone else's trip. Instead the page lists files that no itinerary points at and that have sat there for more than 24 hours, and clears them in one go — that 24 hours covers a photo uploaded but not yet saved, which would otherwise be swept away and come back broken the moment the user hits save. The check is recomputed when the button is pressed rather than trusting a figure that may be minutes old, and the cleanup itself is recorded in the activity log.
- **Export to Google Sheets** — One button in the trip's action row (inside the top-right menu on a phone) asks which tabs to export — transport, itinerary, expenses, souvenirs, gear and notes — and each becomes a sheet in the spreadsheet, in the same order as the tabs in the app. A tab with nothing in it produces no empty sheet, and photos are not offered since they cannot live in a spreadsheet. The file lives in your own Google Drive. Google asks for permission the first time, and only ever grants access to the files this app creates — nothing else in the Drive is reachable. The sheet is one row per itinerary item in timeline order, with date, weekday, start and end time, category, item, location and notes; an end-date column appears only when the trip has a multi-day item, and distance / ascent / descent only when it has outdoor legs. A trip with outdoor waypoints gets a second sheet listing them by leg — date, order, name, type, altitude, cumulative distance, drop, leg time and notes. The spreadsheet opens in a new tab, and the notification carries the link in case the browser blocks it.
- **Multi-Currency Expenses** — Track costs across currencies (TWD, EUR, JPY, …) with live exchange rates, sortable list, and automatic settlement calculations (all amounts converted to the trip's base currency). Settlement rows can be marked as paid, persisted to the database for all members. The form remembers the last payer and offers save-and-add-another for fast consecutive entry. Stats tab includes a clickable pie chart (desktop), a stacked proportion bar with category grid (mobile), monospaced amounts, and a per-member perspective view. Ended trips open the stats sub-tab by default.
- **Settlement Reminder** — One tap after settling turns who-owes-whom into a message that goes straight into the group chat. Only unpaid rows are listed — repeating one that is already settled just makes someone think they owe it twice. Every amount is in the trip's base currency, so a single message never mixes currencies. On a phone it opens the share sheet, so picking LINE sends it to the group directly rather than through copy, switch app, find the group, paste; on a desktop it goes to the clipboard, and if neither is available the text is shown in a selectable box. The button disappears once everything is settled.
- **Expenses Linked to the Itinerary** — Every itinerary card carries a running total of what has been spent on it, sitting at the end of the time / category / location row (per currency, no conversion). Tapping that amount opens a compact expense form already filled in with the item's name, category, and date, so a cost can be logged without leaving the itinerary. Items with nothing spent yet show a zero amount that works as the same entry point. The expense list can be filtered down to a single itinerary item, and a link can be changed or removed from the expense form.
- **AI Receipt Scan** — Photograph or upload a receipt and let Gemini extract the amount, currency, category, and description automatically into the expense form.
- **LINE Bot Expense Input** — Link a LINE group or DM to any trip via a one-time trip token. Quickly log expenses from LINE chat with support for description, amount, currency, payer, and split — synced to the web app in real time.
- **Daily LINE Push & Receipt Logging** — At 8am local time on each day of a trip, the group gets that day's plan: times aligned into a column you can scan down, a multi-day stay showing which day it is on, and a backup marked and stepped back. Local time is derived from the destination's coordinates, daylight saving included, and corrected by the device's own time zone whenever the app is opened during the trip — booking tickets in advance happens at home, so a reading is only taken when today falls inside the trip. The day after a trip ends, one settlement summary says who still owes whom, computed by the same code the app uses. Drop a photo of a receipt into the group and it becomes an expense: Gemini reads the amount and currency, then the existing split-picker takes over. A picture it cannot read an amount from is passed over in silence — nine out of ten photos in a group chat are scenery. Anyone in the group can also ask for a day at any time with `/trip`, or `/trip 2026-09-25` for a particular date; with no date it answers for today where the trip is, not where the server is, so checking the plan over breakfast in Rome does not hand back yesterday.
- **AI Ticket Import** — Extract flight details from boarding pass images or PDFs using Google Gemini.
- **Photo Wall** — Google Photos album integration with justified gallery layout, lazy loading, lightbox viewer (swipe to navigate, double-tap to zoom on mobile), and inline video playback.
- **Photo Frame Export** — Export any photo with a styled camera info bar: EXIF data (focal length, aperture, shutter speed, ISO, date/time), camera brand logo (Sony, Canon, Fujifilm, Leica, Nikon, Apple, Samsung, Vivo), and choice of aspect ratio (Original / 1:1 / 3:4 / 4:3 / 9:16 / 16:9), frame, and background color. Modal on desktop, bottom sheet on mobile.
- **Trip Mode & Quick-Expense FAB** — While a trip is in progress, opening it lands directly on today's itinerary. Landing always respects the trip's visible-tab setting: with the itinerary tab hidden it opens the first visible tab instead, and hiding the tab you are currently on moves you to the first visible one. The trip hero uses the first itinerary photo as a cover with a "Day N / M" progress pill and bar, home-page trip cards show the same cover, and the timeline rail tints the days already travelled. On mobile a floating "記帳" button is always within thumb reach, opening the expense form from any tab.
- **Trip Recap & Celebrations** — When a trip ends, a recap card (days · itinerary items · unique places) appears under the hero with a one-time confetti burst. Marking the last outstanding settlement as paid also celebrates with confetti.
- **Sharing & Collaboration** — Generate shareable read-only links (with active tab preserved in URL). Sharing asks which tabs the link should expose before it hands over the URL: the tabs you leave unticked never appear on the shared page, and their data is never sent to the recipient's browser at all — so a link can show the itinerary while keeping the costs to yourself. A trip's own hidden tabs are not offered, the choice is remembered for next time, and because a trip has a single share link, changing the selection also changes what an already-sent link shows. Shared links preview as “Trip name - Travel Tracker” with the trip's own hero photo as the thumbnail — a link that does not share the itinerary falls back to the app icon there, since the hero photo comes from an itinerary item. Trip members with edit access are automatically redirected to the full editor when opening a share link. Member avatars sit at the end of the hero pill row (with loading skeletons); owners can remove members, members can leave trips, and split-name ↔ account binding opens as a modal — from the action row on desktop, from the trip menu on mobile.
- **Copy an Itinerary from a Share Link** — Someone looking at your trip can turn it into a trip of their own: pick a departure date and the whole itinerary shifts to start there, with each day's plan and its ordering unchanged. What travels across is the plan itself — times, places, notes, the itinerary photos, and for an outdoor leg its waypoints — while expenses, members, the Google Photos album and transport segments stay with the original trip, because those belong to that trip rather than to the plan. The photos come across as links to the originals rather than as new files, so they disappear if the original trip is deleted. A link that does not share the itinerary tab has nothing to copy, and copying can be turned off per link from the share settings. Someone without an account is sent to sign in and lands straight back on the date step, and the share page ends with a way in of its own, so a link can be the first thing a new user ever sees.
- **Claim Your Identity After Joining** — When joining a trip, pick which existing split-bill member name represents you. Owners can manage member-name ↔ account bindings from the trip page. (Groundwork for upcoming expense-to-account integration.)
- **Gear & Packing List** — Build the pack item by item with a per-unit weight and quantity. The number on top is your own load — personal gear plus the shared kit assigned to you — with the team total and any still-unassigned shared kit next to it, because a four-person total says nothing about what any one person has to carry; the three numbers that decide whether the bag is carryable — base weight, worn, and consumables — count only your own pack as well. Working out who "you" are needs the split-bill member bound to an account: without that binding, and on the read-only share link, the bar falls back to the team total. Every item carries one free-form category — single-select, because an item can only sit in one place on the weight ledger — and the chip row shows the count and weight in each. Tap a category to filter, or open the manage sheet to rename or delete one across the whole list; a deleted category is cleared off its items rather than deleting them, and they fall into 未分類. Packing splits into personal and shared team kit: personal gear is visible only to the person who added it, enforced in the database rather than filtered in the page, because a packing list can hold things nobody else needs to see. Shared kit is visible to everyone on the trip and can be assigned a carrier — a field that only appears once an item is marked as shared — and a read-only share link only ever exposes the group half. Tick items off as they go into the bag, and hand group gear to a specific travel companion. Weight takes grams or kilograms and can be left blank until something has actually been weighed. The tab is off by default and turned on per trip, and it works just as well as a suitcase list checked against an airline weight limit.
- **Personal Gear Closet & LighterPack Import** — Anything on a trip's list can be saved into a personal closet that lives outside any single trip, then ticked back into the next trip in a couple of taps; the closet skips gear it already holds instead of stacking duplicates. An existing LighterPack list can come in two ways: upload the file from its Share → Export to CSV, or paste the share link. Either way the list is parsed and shown first — how many items, what they weigh, how many rows were skipped — and only then written into the trip list or the closet. Ounces, pounds and kilograms are converted on the way in, and LighterPack's worn / consumable flags land on the matching weight role.
- **Souvenirs & Shopping List** — Switch between a card grid and a compact list, with the choice remembered for next time. Custom tags, image upload, and quick check-off throughout; items without a photo simply skip the image area instead of showing a placeholder. Shows a completion progress bar; checked items slide down to the bottom so it stays obvious which one was just ticked off.
- **Admin Console** — A private console only the account named as the administrator can open; to anyone else the address simply does not exist. It is built around one question: where did this go? A query bar leads the page — type a name, or narrow it with chips like delete / last 7 days / itinerary — and every result opens in place to show which fields changed, old value beside new. Anything edited or deleted can be put back from the row itself, and the restore is recorded as its own entry. Sign-ins get their own list: when, from which device and IP address, and any failed attempts. Activity arriving while you are reading waits behind a counter instead of pushing the page around. The foot of every page states which build is live — when it went out, how long ago, the commit it came from and which environment this is, so "what does the bottom of your screen say" answers the version question in one line instead of guessing when someone last loaded the app.
- **LINE Message Simulator** — An admin page that holds a conversation with the bot without going through LINE. Pick a trip, type into a phone-shaped chat, and the cards come back exactly as the group would see them — including the buttons, which work: choosing who splits a bill and confirming it writes the expense for real, because a preview that only draws the layout can look right while the thing behind it is broken. Anything it writes is listed with a delete beside it, so a test does not leave a stray expense on a real trip. The two pushed cards — the daily plan and the settlement summary — can be previewed for any date without waiting for eight in the morning and without sending a message to anyone.
- **PWA & Offline Caching** — Local storage caching across all tabs with skeleton screens for fast perceived load.
- **Responsive UI** — Sidebar layout on desktop; on mobile a gooey bottom nav with a sliding indicator ball. Shared design components (TripHero, SegmentCard, MobileNav, PillButton) keep the app and public share pages visually in sync. LINE Seed TC display font for headline moments. Built with Tailwind CSS 4 and Ant Design 6.

### Roadmap

Planned, in rough priority order:

- A trip plan sheet for the person staying behind — emergency contacts, agreed check-in times, retreat plan — built on the read-only share link, printable for permit applications
- Turnaround time per itinerary item, marked on the timeline
- Richer daily weather: sunrise and sunset, feels-like temperature, chance of rain, wind, corrected for altitude
- A pre-trip training plan counted back from the departure date, generated from the route's own distance, ascent, and pack weight
- A food and supplement trial log that carries across trips
- GPX import for distance and ascent statistics and globe tracks
- Trip templates that only preset which tabs and categories a new trip starts with
- A public route library — outdoor routes other people can copy into their own trips (under consideration)

Deliberately out of scope: offline maps, GPX navigation, and live track recording.

### Tech Stack

![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Ant Design](https://img.shields.io/badge/Ant_Design_6-0170FE?style=flat-square&logo=antdesign&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-8E75B2?style=flat-square&logo=googlegemini&logoColor=white)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | Ant Design 6 + Tailwind CSS 4 |
| 3D Rendering | react-globe.gl + Three.js |
| Rich Text | react-quill-new (Quill) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Google OAuth) |
| AI | Google Gemini 2.5 Flash |
| Image Processing | Sharp + exifr |
| Geocoding | Nominatim / OpenStreetMap |
| Weather | Open-Meteo |
| LINE Bot | LINE Messaging API |

### Local Development

**1. Clone & install**

```bash
git clone git@github.com:HsuenChan/travel-tracker.git
cd travel-tracker
npm install
```

**2. Environment variables**

Copy `.env.local.example` → `.env.local` and fill in your credentials:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

NEXT_PUBLIC_GOOGLE_CLIENT_ID=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

LINE_BOT_USER_ID=
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_LINE_BOT_URL=https://line.me/R/ti/p/@your-bot-id

# auth.users.id of the one account allowed into /admin. Leave it blank and the console does not exist.
ADMIN_USER_ID=
```

**3. Run**

```bash
npm run dev
```

### Database Setup

Run the SQL files in `supabase/` in order via the [Supabase SQL Editor](https://supabase.com/dashboard):

| File | Purpose |
|---|---|
| `01_schema.sql` | Core tables (trips, expenses, itinerary, etc.) |
| `02_line_bot.sql` | LINE Bot integration tables |
| `03_member_links.sql` | Maps trip member names to authenticated accounts |
| `04_itinerary_images.sql` | Itinerary item photos (`image_urls` array + storage bucket; safe to re-run) |
| `05_settlement_paid.sql` | Persistent settlement paid marks (incl. RLS policies; safe to re-run) |
| `06_expense_itinerary_link.sql` | Links expenses to itinerary items (`itinerary_item_id`; safe to re-run) |
| `07_gear.sql` | Gear / packing list per trip (weights, categories, carrier; incl. RLS policy; safe to re-run) |
| `08_gear_closet.sql` | Personal gear closet reused across trips (incl. RLS policy; safe to re-run) |
| `09_itinerary_outdoor.sql` | Outdoor leg distance / ascent / descent + route waypoints (incl. RLS policy; safe to re-run) |
| `10_waypoint_single_duration.sql` | One time per leg instead of an out-and-back pair (safe to re-run) |
| `11_itinerary_show_elevation.sql` | Per-leg override for showing the elevation profile (safe to re-run) |
| `12_gear_scope_category.sql` | Personal / group gear scope with RLS, and one category per item (safe to re-run) |
| `13_content_rls.sql` | RLS for souvenirs / itinerary items / expenses (safe to re-run) |
| `14_waypoint_drop.sql` | Measured drop per waypoint, backfilled from names (safe to re-run) |
| `15_share_tabs.sql` | Which tabs a share link exposes, plus the trip's `share_token` column (safe to re-run) |
| `16_activity_log.sql` | Admin console log: data changes (with restorable snapshots) and sign-in events (safe to re-run) |
| `17_route_profile.sql` | The route's own file on an outdoor leg: grade, character, times, approach, hazards, sources (safe to re-run) |
| `18_waypoint_topo.sql` | Pool depth, anchor notation and section per waypoint, for the longitudinal profile (safe to re-run) |
| `19_share_view_log.sql` | Share-link views in the activity log, with a dedupe index (safe to re-run) |
| `20_ai_usage.sql` | AI call log: feature, model, token counts, duration, success (safe to re-run) |
| `21_ai_thinking_tokens.sql` | Thinking tokens on AI calls, billed as output but reported separately (safe to re-run) |
| `22_api_errors.sql` | Server-side uncaught exceptions, with a dedupe index (safe to re-run) |
| `23_share_fork.sql` | Whether a share link lets the viewer copy the itinerary into a trip of their own (safe to re-run) |
| `24_itinerary_status.sql` | Three itinerary states — planned, wishlist, backup — and a nullable date so a wishlist entry can wait for one (safe to re-run) |
| `25_trip_time_zone.sql` | The trip's local time zone, reported by the device during the trip, used by the daily push (safe to re-run) |
| `26_line_daily_brief.sql` | LINE push log so the same thing is never sent twice (safe to re-run) |

### LINE Bot Setup

1. Create a channel at [LINE Developers](https://developers.line.biz/) → Messaging API
2. Set the webhook URL to `https://your-domain.com/api/line-webhook`
3. Copy `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` into `.env.local`
4. Copy the **Bot User ID** (Messaging API → Bot information) into `LINE_BOT_USER_ID`
5. In the app, open any trip → LINE Bot button → copy the trip token, then send it to the bot in LINE

**Linking a chat to a trip:**

Send the trip token (format `TRIP-XXXX-XXXX`) in a LINE 1-on-1 or group chat. The bot confirms the link and the chat is now bound to that trip.

**Expense format (after linking):**

```
午餐 500
午餐 500 JPY
午餐 500 Eliza
```

After sending, the bot asks who to split with. Reply with numbers (`0` = everyone, `12` = persons 1 & 2), then confirm.

**Group chat:** Add the bot to a group, send the trip token once to link. Subsequent expense messages and number replies do not require @mention.

---

## 中文

現代化的互動式個人旅遊日誌。記錄旅程、在 3D 地球儀與互動地圖上視覺化路線、管理旅遊費用、安排行程，並透過 AI 一鍵生成旅遊筆記。

**線上版本：** https://travel-tracker-nine-delta.vercel.app/

### 核心功能

- **互動式 3D 地球儀** — WebGL 渲染飛行弧線動畫（預設顯示全部航跡），目的地精確到地區層級座標（Nominatim / OpenStreetMap）。國旗 emoji 從 Nominatim ISO code 自動解析，無需維護硬編碼對照表。旅程清單開頭以說故事語氣呈現旅遊足跡——年份跨度、趟數、國家數（以 ISO 國碼去重）與旅遊總天數。
- **旅遊護照** — 一本把所有旅程收在一起的護照，自己建立的與被邀請加入的都算 —— 別人開的那趟你也真的去了。封面之後是資料頁：持證人照片做成印刷網點，底下是趟數、國家數與總天數，最下面兩行是機讀碼。接著是入境章——一趟一國一枚，去過三次日本就有三枚章，章的形狀、角度與墨色由國碼決定，所以同一個國家每次蓋出來都一樣。旅行紀錄頁記已記錄航段的總距離、最遠的一段航段、最長的一趟與去最多次的國家；航段只算兩端機場都查得到座標的，其餘會標明未計入——把查不到的當成零，數字會看起來很精確但是錯的。沒有東西可講的那一格就不會出現——每個國家都只去過一次的時候，「去最多次的國家」是沒有意義的。之後每一年一頁，那年的趟數、國家、天數與一張那年 Google 相簿裡的照片，可以存成圖分享出去。入口是地球左下角斜插的一本護照，點下去它飛到畫面中央放大，關起來再轉回角落；護照是疊在首頁上面的，首頁不會被卸載，所以關掉之後地球還停在你離開時的角度，不會重轉一次。它是一本真的會翻的書：拖著頁面走，紙會跟著手指拱起來、繞書脊轉過去，放手時翻得不夠就彈回原位。點左右半邊可以翻頁，方向鍵也可以。裝置沒有 WebGL、或系統設定了減少動態效果時，自動退回不會翻的平面版，兩邊看到的內容一樣。
- **開 App 時的落點** — 有正在進行的旅程就直接進那趟。全部結束、最近也沒有回頭看任何一趟時，落在旅遊護照——淡季沒有「現在」可以看，但走過的路還在。最近 14 天內開過某趟就留在旅程清單，因為那代表還在回顧，不該被打斷。這個判斷一次開啟只做一次，所以從護照回到清單不會又被帶走。
- **路線分頁** — 登機證風格的交通段落卡片（航班、火車、巴士）。
- **筆記分頁（富文字 + AI）** — 完整 Quill 富文字編輯器，六個區塊 Chip 可觸發 AI 生成旅遊內容（旅遊注意事項、該帶什麼、地鐵攻略等），由 Google Gemini 驅動，所有成員共享。預設為閱讀模式、點「編輯」才進入編輯器；未儲存的編輯會自動存成本機草稿（回來時還原並提示），切換分頁不再遺失內容。工具列涵蓋標題、顏色、連結、清單、引言、分隔線與表格；表格以格線選擇尺寸後插入，游標移入表格時會展開增減列／欄與刪除表格的操作列。Shift+Enter 會在同一個區塊內換行，引言、清單項目或段落都能寫成多行，Enter 則照常另起新的一段。閱讀模式與編輯模式使用同一套排版，存檔前後看到的版面完全一致。行程備註與旅程簡介也使用同一個編輯器。
- **進階行程規劃** — 支援跨日事件與日期時間範圍選擇器（結束時間可留空），時間軸顯示星期標籤、每日即時天氣預報與逐筆類別 icon 節點，備註支援富文字與可點擊連結；每筆行程可上傳多張圖片（上傳前先在瀏覽器端縮圖壓縮，存於 Supabase Storage），第一張以全寬封面呈現於卡片頂部、多張顯示 +N 標記，點擊開啟燈箱可瀏覽全部。跨日行程（連住飯店、租車、周遊券）會出現在它覆蓋的每一天：開始日保留完整卡片，後續每天顯示一條精簡狀態條，標示名稱與「住宿中 3/9 天」，最後一天再加上退房時間，點一下即跳回完整卡片並短暫高亮。住宿期間即使沒有其他安排，那幾天也會出現在時間軸上，天氣預報同時涵蓋整段日期，不再只查到開始日。
- **口袋名單與備案** — 還沒決定哪一天的地方先丟進行程最上面的「口袋名單」：一行 chip，一個名字，地點欄位貼 Google 連結也行（滑過去才顯示，因為那只是暫存，不該比行程本身還占版面）。點 chip 就打開那一筆的完整內容，類型、地點、備註、照片都跟一般行程一樣可以填；戶外的還會多一顆路線鈕，直接看高度圖與途經點——「要不要去這條」本來就是看那張圖決定的，不必先排進某一天才打得開。之後把 chip 拖到某一天，已經排好的行程也可以拖回口袋名單。拖曳時跟著游標的是一顆只有標題的小膠囊，不是整張卡片的殘影。行程長的時候不必為了搆到畫面外的那一天先捲半天：頂部那排日期本身就是放置目標，拖到畫面上下緣也會自動捲動；反向則有一顆固定在畫面下緣的「放回想去」，不必一路捲回最上面。正式行程／備案／想去是同一個欄位的三種值，所以在編輯表單裡就是一個選擇器，不是散在卡片上的幾顆按鈕；選「想去」時日期欄位會收起來。沒有自己上傳照片的戶外路段，卡片會退回用路線檔案裡的代表照片——那些照片本來就在這一筆底下，只是收在路線檢視的分頁裡，卡片卻長得像一張空卡，溪降那種一整排灰底根本認不出是哪一條。備案的卡片在左緣立一條直立標、配虛線框並壓低存在感，當天再決定——左緣是整張卡唯一沒有東西跟它搶的地方，右上角有編輯與刪除、上緣有封面照、內文那排已經有分類與地點；備案不算進戶外路段的總計，因為那個數字是拿來決定要練到什麼程度、背包揹不揹得動的，把還沒決定的事算進去，準備的基準就是錯的。口袋名單會出現在唯讀分享連結上，因為「去哪」本來就是一起吵出來的；匯出試算表時另起一張工作表，它沒有日期，塞進一列一天的表只會多出一排空欄。分享連結的頁尾寫著「開啟此連結會記錄裝置與來源 IP」——那筆紀錄旅程擁有者在後台看得到，被記錄的人應該有機會知道。
- **從 IG／Threads 分享存進旅程** — 在 reel 或貼文按分享、選 Travel Tracker，東西就進了某一趟：口袋名單、伴手禮清單，或那趟的旅遊筆記，看那則貼文講的是哪一種。IG 交出來的只有一個網址，沒有內文也沒有地點標籤，而它的貼文頁對未登入的請求只回一個沒有任何 metadata 的空殼，所以內文是另外取回來再交給 AI 讀的：要的是內文裡點名的那個地方，不是地點標籤上的城市——一則標著「Florence, Italy」的貼文，講的通常是裡面的某一座廣場。一則講了好幾個地方就抽出好幾個，每個附一句那則貼文究竟怎麼形容它，存之前由你勾選——口袋名單是自己挑出來的清單，猜錯的東西留在裡面，之後清掉要花的力氣比當初省下的還多。存到哪一趟是拿地點的國家去對的，所以佛羅倫斯的廣場預設落在義大利那趟，而不是清單上剛好排第一的那趟。貼文究竟怎麼講那個地方會留下來——去哪買票、什麼時段去、要注意什麼——而不是壓成一句話，因為一套攻略被縮成四個字，之後就沒有用了。Reels 的封面會拿出來問要不要當卡片照片，但預設不勾：那是發文者自己挑的一幀，現在很多是標題卡而不是現場，所以連圖一起顯示讓你自己看過再決定。Threads 的貼文一樣讀得進來，只少了問封面這一步：Threads 唯一給得出的圖是貼文自己的截圖卡，拿來當卡片照片並不合適，所以不會問。貼文裡真的看不出地點時就自己打名稱，連結無論如何都會留著；換成是 AI 那端出狀況也一樣——模型忙線會自己重試，重試完還是忙就把貼文和連結原封交回來，而不是丟一句錯誤把剛剛讀到的東西一起扔掉，那十幾秒不必再等第二次。地址會填進那一筆自己的地點欄位，不再只是寫在備註裡，而且來自當下最可信的那一個：貼文自己貼了地圖連結就用它，沒有就用貼文明寫出來的地址，再沒有才拿名稱與城市去查——查來的還要國家對得上貼文說的才算數，同名的街道落在另一個國家，比留白更糟。每個地址都標著是哪裡來的，查來的會明說，因為那種才是存之前該瞄一眼的。全部都可以當場改掉：在這裡改是一下的事，存進去之後再改得先把那一筆找回來。而且值得留下的不一定是地點——講要帶什麼回家的那種存進伴手禮清單，純攻略的貼文（地鐵票怎麼買、該買哪一張通行證）則把重點整理出來，接在那趟旅程的筆記後面。最後這種以前是死路：一則沒有點名任何店家的攻略，過去什麼都存不下來。一次分享落在三者其中一個，一開始停在那則貼文比較像的那一種。需要先把 App 加到主畫面；僅限 Android，iOS 沒有對應的機制。
- **戶外路段與高度圖** — 類型設為「戶外」的行程會帶里程、爬升與下降，並可打開路線檢視：高度圖由這段路線自己的途經點畫出來——點位名稱、海拔、累積距離、屬於第幾天，以及每兩點之間的去程與返程時間，就是紙本地形圖上那個樣子。去程與返程分開記，因為兩者很少一樣。高度圖只在資料撐得起來時才出現：有海拔的點少於四個、或占比不到六成就不畫，改顯示一行說明原因 —— 剖面會把沒有資料的路段連成直線，讀起來像平緩地形，而那裡其實是連續垂降。這個判斷可以逐條路線手動覆寫（兩個方向都行），設定存在該路段上，所以旅伴看到的是同一個結果。垂降、下攀、跳水、滑降各自帶落差，清單會把每一段畫成以最長段為基準的長條 —— 這才是溪降地形圖真正在傳達的形狀，因為 CanyonTopo 標的是落差而不是海拔。標題列直接給出決定帶什麼繩的數字：最長繩距、垂降段數，以及已記錄障礙的落差總和（會標明是這個意思，因為同一處可垂降也可跳水時只算一個點位）。路線檢視會依序列出每個途經點的類型、海拔、距離、分段時間與備註 —— 溪降地形圖記的危險點與避洪處本來就是打開檢視的理由，所以直接讀在清單上，而不是藏在手機按不出來的圖表 hover 裡；危險點與脫逃點分別用紅色與綠色邊框標出。途經點可以填座標——「緯度, 經度」或 Google Maps 連結——填好按一個按鈕就會把有座標的點位一次查出地形海拔，已經填過的不會被覆蓋。海拔只從座標查、不用地名去猜，因為溪降地形圖上一個無聲填錯的高度比留空更危險。途經點也可以直接匯入 GPX 軌跡而不用手打：檔案在瀏覽器端解析，自動挑出決定剖面形狀的節點（在距離與平滑後高度上做 Douglas-Peucker，所以稜線附近的 GPS 雜訊不會把整段長爬升的節點擠掉），並先顯示軌跡長度、海拔範圍、節點清單與一個校正欄位（軌跡的絕對高度與地圖不符時平移用），確認後才加入。里程、爬升與下降一律由途經點算出來，行程表單裡不再手填 —— 同一個數字有兩個地方能寫，就是後存的無聲蓋掉先存的，手打的值會在下次有人動途經點時消失。單日路段就是一筆沒有結束日期的行程，多日路段是一筆跨日行程，所以一趟旅程可以放好幾段互不相連的戶外路段，hero 上會有一個 pill 把它們加總起來。一般旅遊的行程不會出現這些欄位。
- **路線檔案** — 戶外路段除了途經點以外還能帶整條路線的檔案，路線檢視會依此分成幾個分頁：快速資訊（地點、分級、岩質、集水區、錨點、裝備、GPS、首降）、時間規劃（進場、下降、回程與總時，以及各分段時間）、高度圖與途經點、寫成分步的進場路線、原始路線圖、代表照片，以及風險注意。只有真的有內容的分頁才會出現，所以只有途經點的路段看起來跟以前一模一樣。分級拆成垂直技術、水流難度、投入度與星等分開顯示，而不是打在標題裡的一串字 —— 打在標題裡容易打錯，也沒辦法一致地讀。每條路線的資料來源一直留在畫面上；近期隊伍回報和危險注意放在一起，因為上一季有人回報掛片鬆脫，現場的重要性高過官方地形圖。
- **溪降縱剖面圖** — 一個分頁把下降過程畫成官方溪降地形圖的樣子：依障礙順序由左往右，每一段落差照比例往下掉，落點畫出是淺潭、深潭還是會把人壓住的危險迴流。垂降用強調色標出來，因為那是決定帶什麼繩的點；錨點註記就在標籤下方；長路線依官方圖標的分段切開，八十個障礙的溪才不會變成一條讀不了的長圖。這張圖是從該路段自己的途經點畫出來的，不是一張存起來的圖片，所以改了途經點圖就跟著改，任何路線只要把障礙填進去就會有圖。還沒有障礙序列的路線會直接說明，並保留官方地形圖連結。
- **分享連結瀏覽與 AI 花費監測** — 後台把發生過的事分成三類：資料被改了歸「異動」；登入、登出、失敗的嘗試與分享連結被打開歸「來訪」，因為這些回答的是同一個問題 —— 誰在什麼時候碰到了這個系統。分享連結被打開時會記下看到的是哪一趟旅程、用什麼裝置、從哪個 IP，並做去重，所以一個人重整十幾次是一筆而不是十幾筆。AI 用量有自己的後台分頁，總覽上是一張摘要卡片、點進去看明細：每一次 Gemini 呼叫都記下 token 數、耗時與成功與否 —— 失敗也記，因為被擋下來時同樣是失敗，只記成功的會讓用量看起來很低，實際上是一直在撞牆。token 數換算成估計花費，依功能與帳號分別列出；思考模型另外回報、但按輸出計費的 thinking token 也算進去 —— 實測第一筆呼叫它是可見輸出的六倍，漏掉就會把成本低估到失去意義。並設每月預算，在帳單跑掉之前就先停用 AI 功能，而不是之後。
- **伺服器異常紀錄** — route handler、Server Component 與 Server Action 拋出的未捕捉例外，透過 Next 的 `onRequestError` 掛鉤收集，而不是在每支 API 包 try/catch —— 這樣不會漏，而且之後新增的 API 一寫好就被涵蓋。每筆保留請求路徑、路由檔、方法、stack 與 Next 的錯誤指紋；同一支路由的同一個錯誤 5 分鐘內只記一筆，否則一支壞掉的 API 被輪詢就會用幾千筆一模一樣的紀錄把其他錯誤埋掉。只回 500 但沒有拋例外的那種刻意不記：那是預期中的結果，混進來會蓋掉真正需要有人去看的當機。
- **匯出 Google 試算表** — 旅程動作列（手機在右上角的選單裡）一顆按鈕，選要匯出哪些分頁——路線、行程、費用、伴手禮、裝備、筆記，每一個變成試算表裡的一張工作表，順序照旅程分頁的順序。沒有內容的分頁不會產生空白工作表；照片放不進試算表，所以不在選項裡。整份存在你自己的 Google 雲端硬碟裡。第一次會跳出 Google 授權，而且只授權這個 App 自己建立的檔案，碰不到雲端硬碟裡其他東西。表格一列一筆行程、順序與時間軸相同，欄位有日期、星期、開始與結束時間、分類、項目、地點與備註；只有這趟真的有跨日行程時才會出現結束日期欄，有戶外路段時才會多出距離／上升／下降。有途經點的旅程會多一張工作表，依路段列出日期、順序、名稱、類型、海拔、累積距離、落差、分段時間與備註。匯出後試算表會直接開新分頁，通知訊息裡也附連結，被瀏覽器擋掉時還點得到。
- **旅途中模式與快速記帳** — 旅程進行期間打開旅程頁直接落在今日行程；落點一律遵守該旅程的「顯示分頁」設定 —— 沒有啟用行程分頁時會落在啟用清單的第一個分頁，把目前所在的分頁關掉時也會自動跳到第一個分頁；hero 以行程第一張照片為封面並顯示「第 N / M 天」進度 pill 與進度條，首頁旅程卡片同步顯示封面照，時間軸已走過的路段會上色。手機版右下常駐「記帳」懸浮按鈕，任何分頁一鍵記帳。
- **旅程回顧與慶祝** — 旅程結束後 hero 下方顯示回顧卡（天數・行程數・地點數），首次打開撒一次彩帶；結算最後一筆繳清時也會有彩帶慶祝。
- **多幣別費用追蹤** — 支援多種貨幣（TWD、EUR、JPY…）含即時匯率換算、可排序列表與自動結算（結算前一律換算成旅程主幣別）。應付款項可勾選「已繳清」並存入資料庫，全體成員同步。表單會記住上次付款人，並提供「儲存並繼續」快速連續記帳。統計分頁支援圓餅圖（桌機）與堆疊比例條＋類別格（手機）、金額等寬字型、個人視角切換；旅程結束後預設進入統計。
- **催款訊息** — 結算完按一下，誰要付誰多少變成一則可以直接送進群組的訊息。只列還沒繳清的——已經付過的再列一次，只會讓人以為還要再付一次。金額都是旅程主幣別，同一則訊息裡不會混幣別。手機上會叫出分享面板，選 LINE 就直接送進群組，不必複製、切到 LINE、找群組、再貼上；桌機複製到剪貼簿，兩者都不行時把文字放在可全選的框裡。全部繳清之後按鈕就收起來。
- **行程與記帳打通** — 每張行程卡在「時間 / 類型 / 地點」那一列的尾端顯示掛在該行程的花費合計（跨幣別並列，不換匯）。點金額直接開記帳表單，行程名稱、類型與日期都已帶入，不用切到費用分頁；還沒有花費的行程顯示 0，點下去就是新增第一筆。費用列表可依關聯行程篩選，也能在費用表單裡改綁或解除關聯。
- **AI 收據掃描** — 拍攝或上傳收據，Gemini 自動解析金額、幣別、類別與摘要，直接填入費用表單。
- **LINE Bot 快速記帳** — 以旅程 Token 連結 LINE 群組或私訊，無需帳號綁定。支援金額、幣別、付款人與分攤設定，即時同步至網頁。
- **LINE 每日推播與收據記帳** — 旅途中每天當地早上八點，群組會收到當日行程：時間對齊成一欄可以直接掃，跨日的住宿顯示進行到第幾天，備案標出來並降一階。當地時間是從目的地座標推算的（含夏令時間），而旅途中打開 App 時會用裝置時區校正——提前訂票時人還在出發地，那時候的裝置時區不算數，所以只在今天落在旅程期間內才採用。旅程結束的隔天推一次結算摘要，誰還沒付誰多少，金額與 App 上看到的是同一套算法。吃完飯在群組拍一張收據直接丟進來就記帳，Gemini 認出金額與幣別之後接上原本的分帳選人流程；認不出金額的圖片安靜略過，群組裡十張有九張是風景照。群組裡任何人也可以隨時用 `/trip` 問當天的行程，或 `/trip 2026-09-25` 指定某一天；沒給日期時回的是「旅程當地的今天」而不是伺服器的今天——人在羅馬吃早餐時問行程，不該拿到昨天那份。
- **AI 機票自動匯入** — 透過 Google Gemini 解析登機證圖片或 PDF，一鍵填入航班資訊。
- **旅遊照片牆** — 整合 Google Photos 相簿，等比例磚牆佈局、懶加載、Lightbox 瀏覽（手機可滑動換圖、雙擊縮放）與影片內嵌播放。
- **照片框架匯出** — 為任一張照片加上相機資訊欄後匯出：顯示焦距、光圈、快門、ISO、拍攝時間，以及相機品牌 Logo（Sony、Canon、Fujifilm、Leica、Nikon、Apple、Samsung、Vivo）。可選擇畫面比例（Original / 1:1 / 3:4 / 4:3 / 9:16 / 16:9）、邊框與背景顏色。桌機顯示 Modal，手機顯示底部面板。
- **分享與共同編輯** — 可生成唯讀分享連結（URL 保留當前分頁狀態）。按分享會先問這條連結要露出哪些分頁：沒勾的分頁不會出現在分享頁，資料也完全不會送到對方的瀏覽器——所以可以只分享行程、把費用留給自己。旅程裡已經關掉的分頁不會出現在選項中，選過的範圍下次打開會記住；因為一趟旅程只有一條分享連結，改了範圍之後，之前貼出去的同一條連結看到的東西也跟著變。連結貼到通訊軟體會顯示「旅程名稱 - Travel Tracker」與該趟旅程的封面照縮圖——封面照來自行程照片，所以沒分享行程的連結會退回顯示 App 圖示。具編輯權限的成員開啟分享連結時自動跳轉至完整編輯介面。成員頭像顯示於 hero pill 列尾端（載入時有骨架佔位）；旅程擁有者可移除成員，成員可自行離開旅程，「分帳綁定」以彈窗設定，桌機版從動作列進入、手機版從旅程選單進入。
- **從分享連結複製行程** — 看到別人行程的人可以把它變成自己的一趟：選一個出發日，整份行程平移到那天開始，每天的安排與前後順序都不變。帶走的是行程本身 —— 時間、地點、備註、行程照片，戶外路段連途經點一起；費用、成員、Google 相簿與交通票券留在原本那一趟，因為那些屬於那趟旅程，不屬於這份安排。照片是連到原本那幾張、不是另外存一份，所以原旅程被刪掉時複製出來的圖會跟著不見。沒分享行程分頁的連結沒有東西可以複製，分享設定裡也能逐條連結關掉複製。還沒有帳號的人按下去會先去登入，回來直接落在選日期那一步；分享頁最後還有自己的入口，所以一條連結可以是新使用者看到的第一個畫面。
- **加入旅程後認領身份** — 加入旅程時可認領你對應的既有分帳成員名稱，旅程擁有者可在旅程頁查看與管理「成員名稱 ↔ 帳號」綁定。（為日後支出自動歸戶功能鋪路）
- **伴手禮與購物清單** — 可切換「卡片」與「列表」兩種檢視，選擇會記住下次沿用。支援自訂標籤篩選、圖片上傳與快速打勾；沒有照片的項目不會顯示佔位圖。顯示完成進度條，已購買項目會以滑動動畫沉到底部，看得出剛剛勾掉的是哪一項。
- **裝備清單與重量** — 逐件記下裝備、單件重量與數量。頂部第一個數字是「我的負重」——自己的個人裝備加上分配給自己的公裝——旁邊才是全隊總重與還沒分配攜帶者的公裝重量，因為四人隊的總重對任何一個人都不代表要揹多少；決定背包揹不揹得動的三個數字：基準重量、穿著、消耗，同樣只算自己那一袋。認得出「我」的前提是分帳成員綁了帳號，沒綁定時（以及唯讀分享頁）退回顯示全隊總重。每件裝備一個自由分類——單選，因為一件裝備在重量帳上只能屬於一個地方——chip 列顯示各分類的件數與重量。點分類可篩選，也可以從「管理」對整份清單改名或刪除某個分類；刪除是把裝備的分類清空而不是刪掉裝備，它們會落到「未分類」。打包分成個人與公裝：個人裝備只有加入的人看得到，而且是由資料庫擋住而不是在畫面上篩掉，因為打包清單裡可能有不需要給別人看的東西。公裝全隊共享、可以分配攜帶者（這個欄位只在選了公裝時才出現）——而唯讀分享連結只會露出公裝那一半。裝進背包就打勾。重量可用公克或公斤輸入，還沒秤的先留空。分頁預設關閉、每趟旅程自行開啟；一般旅遊當成行李清單、對照航空公司重量限制也一樣好用。
- **個人裝備櫃與 LighterPack 匯入** — 清單上的裝備可以存進不屬於任何一趟旅程的個人裝備櫃，下一趟勾幾下就套用回來；櫃子裡已經有的同一件不會再重複堆一份。已經記在 LighterPack 上的清單有兩條路可以進來：用它的 Share → Export to CSV 匯出檔案上傳，或直接貼分享連結。兩條路都會先解析並顯示結果——幾件、總共多重、略過了幾列——確認後才寫進旅程清單或裝備櫃。盎司、英磅、公斤在匯入時統一換算，LighterPack 的 worn / consumable 也會對應到相同的重量身份。
- **後台操作紀錄** — 只有被指定為管理員的帳號打得開，其他人連這個網址存在都看不到。它先回答一個問題：這筆東西怎麼不見了？頁面以查詢列為主體 —— 打一個名字，或用「刪除」「近 7 天」「行程」這些 chips 收斂範圍 —— 每筆結果都能原地展開，看到哪幾個欄位被改了、舊值與新值並排。被改掉或刪掉的資料可以直接從那一列還原，而還原本身也會留下一筆紀錄。登入另外一份清單：什麼時候、從哪台裝置與哪個 IP 登入，以及失敗的嘗試。正在讀的時候有新異動進來，它會排在一個計數器後面等你點開，不會把畫面推走。每一頁的最下方都標著現在線上跑的是哪一版：什麼時候部署的、距今多久、來自哪個 commit、以及這是正式站還是預覽站——有人回報畫面怪怪的時候，「你最下面寫什麼」比猜他何時載入的快得多。
- **圖片儲存用量與清理** — 後台一頁看行程照片佔了多少空間，免費方案共 1 GB，用超過八成會轉成警示色——撞到上限時上傳會直接失敗，那時候才知道就太晚了。從行程上移掉一張圖、或刪掉整筆行程時，資料庫的參照會消失，但檔案仍留在 bucket 裡；不在刪除時連帶刪檔，是因為同一個網址可能被多筆行程共用（分享連結複製行程時照片只複製連結、不複製檔案），刪一筆就刪檔會把別人那趟的圖一起弄破。所以改成列出「沒有任何行程指向、而且已經放超過 24 小時」的檔案，一次清掉——那 24 小時是留給剛上傳還沒按儲存的圖，否則清掉之後使用者一存檔就得到一張破圖。按下清理時判定會重算一次，不吃畫面上那份可能已經過期幾分鐘的快照；清理本身也會留下一筆操作紀錄。
- **LINE 訊息模擬器** — 後台的一頁，不用透過 LINE 就能和 bot 對話。選一趟行程，在一台手機大小的聊天框裡打字，回來的卡片就是群組裡會看到的那些——連按鈕都是能按的：選平分對象、按下確認，費用是真的寫進去的，因為只畫得出版面的預覽看起來都對，背後壞掉也看不出來。寫進去的每一筆旁邊都有一顆刪除，測試不會在真的旅程上留下髒資料。兩張推播卡——當日行程與結算摘要——可以指定任何一天預覽，不用等到早上八點，也不用真的推一則給任何人。
- **PWA 與快取** — LocalStorage 暫存機制搭配骨架圖，確保網路不佳時操作依然流暢。
- **響應式介面** — 桌機側欄佈局；手機底部為 gooey 果凍導覽列（小球滑動指示）。共用設計元件（TripHero、SegmentCard、MobileNav、PillButton）讓 App 與公開分享頁視覺一致，標題時刻使用 LINE Seed TC 字型。Tailwind CSS 4 + Ant Design 6。

### 未來規劃

依優先順序排列：

- 留守人頁面 —— 緊急聯絡人、約定的回報時間、撤退計畫 —— 建在唯讀分享連結上，可列印給入園申請使用
- 每筆行程的撤退／關門時間，並在時間軸上標記
- 更完整的每日天氣：日出日落、體感溫度、降雨機率、風速，並依海拔校正
- 依出發日回推的行前訓練計畫，以該條路線的里程、爬升與背包重量生成
- 跨旅程累積的補給與行動糧試用紀錄
- GPX 匯入，取里程與爬升統計並在 3D 地球上畫出軌跡
- 建立旅程時的範本，只決定新旅程預設開啟哪些分頁與分類
- 公開路線庫 —— 戶外路線可以被別人複製進自己的旅程（待評估）

明確不做：離線地圖、GPX 導航、即時軌跡記錄。

### 技術架構

| 層級 | 技術 |
|---|---|
| 框架 | Next.js 16 (App Router) |
| UI 元件庫 | Ant Design 6 + Tailwind CSS 4 |
| 3D 渲染 | react-globe.gl + Three.js |
| 富文字編輯器 | react-quill-new (Quill) |
| 資料庫 | Supabase (PostgreSQL) |
| 身份驗證 | Supabase Auth（Google OAuth）|
| 人工智慧 | Google Gemini 2.5 Flash |
| 影像處理 | Sharp + exifr |
| 地理編碼 | Nominatim / OpenStreetMap |
| 天氣預報 | Open-Meteo |
| LINE Bot | LINE Messaging API |

### 本機開發

**1. 下載並安裝**

```bash
git clone git@github.com:HsuenChan/travel-tracker.git
cd travel-tracker
npm install
```

**2. 環境變數**

將 `.env.local.example` 複製為 `.env.local` 並填入：

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

NEXT_PUBLIC_GOOGLE_CLIENT_ID=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

LINE_BOT_USER_ID=
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_LINE_BOT_URL=https://line.me/R/ti/p/@your-bot-id

# auth.users.id of the one account allowed into /admin. Leave it blank and the console does not exist.
ADMIN_USER_ID=
```

**3. 啟動開發伺服器**

```bash
npm run dev
```

### 資料庫設定

於 [Supabase SQL Editor](https://supabase.com/dashboard) 依序執行 `supabase/` 資料夾內的 SQL 檔案：

| 檔案 | 用途 |
|---|---|
| `01_schema.sql` | 核心資料表（旅程、費用、行程等） |
| `02_line_bot.sql` | LINE Bot 整合資料表 |
| `03_member_links.sql` | 將旅程成員名稱對應到已登入帳號 |
| `04_itinerary_images.sql` | 行程照片（`image_urls` 陣列＋Storage bucket，可重複執行） |
| `05_settlement_paid.sql` | 結算繳清標記（含 RLS policy，可重複執行） |
| `06_expense_itinerary_link.sql` | 費用與行程的關聯欄位（`itinerary_item_id`，可重複執行） |
| `07_gear.sql` | 每趟旅程的裝備清單（重量、分類、揹負者，含 RLS policy，可重複執行） |
| `08_gear_closet.sql` | 跨旅程共用的個人裝備櫃（含 RLS policy，可重複執行） |
| `09_itinerary_outdoor.sql` | 戶外路段的里程／爬升／下降欄位與途經點資料表（含 RLS policy，可重複執行） |
| `10_waypoint_single_duration.sql` | 途經點時間收成單一欄位，移除去程／返程配對（可重複執行） |
| `11_itinerary_show_elevation.sql` | 逐條路線覆寫要不要顯示高度圖（可重複執行） |
| `12_gear_scope_category.sql` | 個人／公裝範圍（含 RLS）與單一分類欄位（可重複執行） |
| `13_content_rls.sql` | 伴手禮／行程／費用三張表的 RLS（可重複執行） |
| `14_waypoint_drop.sql` | 途經點的落差欄位，並從名稱回填（可重複執行） |
| `15_share_tabs.sql` | 分享連結要露出哪些分頁，並補上旅程的 `share_token` 欄位（可重複執行） |
| `16_activity_log.sql` | 後台操作紀錄：資料異動（含可還原的快照）與登入事件（可重複執行） |
| `17_route_profile.sql` | 戶外路段的路線檔案：分級、性質、時間、進場、危險與出處（可重複執行） |
| `18_waypoint_topo.sql` | 途經點的落水潭、錨點註記與分段，縱剖面圖用（可重複執行） |
| `19_share_view_log.sql` | 分享連結瀏覽納入操作紀錄，附去重索引（可重複執行） |
| `20_ai_usage.sql` | AI 呼叫紀錄：功能、模型、token 數、耗時、成功與否（可重複執行） |
| `21_ai_thinking_tokens.sql` | AI 呼叫的思考 token，另外回報但按輸出計費（可重複執行） |
| `22_api_errors.sql` | 伺服器端未捕捉的例外，附去重索引（可重複執行） |
| `23_share_fork.sql` | 分享連結是否開放對方把行程複製成自己的旅程（可重複執行） |
| `24_itinerary_status.sql` | 行程的三種狀態：已排入／想去／備案，並讓想去清單可以沒有日期（可重複執行） |
| `25_trip_time_zone.sql` | 旅程的當地時區，旅途中由裝置回報，每日推播用（可重複執行） |
| `26_line_daily_brief.sql` | LINE 推播紀錄，同一件事只推一次（可重複執行） |

### LINE Bot 設定

1. 前往 [LINE Developers](https://developers.line.biz/) 建立 Messaging API Channel
2. Webhook URL 設為 `https://your-domain.com/api/line-webhook`
3. 將 `LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN` 填入 `.env.local`
4. 將 **Bot User ID**（Messaging API → Bot information）填入 `LINE_BOT_USER_ID`
5. 在 App 中開啟任一旅程 → LINE Bot 按鈕 → 複製旅程 Token，並將其傳送給 Bot

**連結聊天室與旅程：**

在 LINE 私訊或群組中傳送旅程 Token（格式：`TRIP-XXXX-XXXX`），Bot 確認後該聊天室即與旅程綁定。

**記帳格式（連結後即可使用）：**

```
午餐 500
午餐 500 JPY
午餐 500 Eliza
```

傳送後 Bot 會詢問平分對象，回覆號碼（`0` = 全部，`12` = 第 1、2 人）後確認即完成記帳。

**群組使用：** 將 Bot 加入群組後，傳送一次旅程 Token 完成連結。後續記帳及數字回覆均不需 @mention。
