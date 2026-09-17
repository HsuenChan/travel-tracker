# ✈️ Travel Tracker

[English](#english) | [中文](#中文)

**Live:** https://travel-tracker-nine-delta.vercel.app/
**Design Guideline:** https://hsuenchan.github.io/travel-tracker/design_guideline.html

---

## English

A modern, interactive personal travel journal. Log your trips, visualize routes on a 3D globe and interactive map, manage expenses, plan your itinerary, and generate AI-powered travel notes with ease.

### Key Features

#### Planning a trip

- **Interactive 3D Globe** — WebGL flight arcs over a globe, with destinations stored as real coordinates rather than country names so a trip lands where it happened. The trip drawer opens on a footprint summary — year span, trips, countries, total days away.
- **Where the App Opens** — A trip in progress opens straight into it. With nothing running and nothing opened in the last 14 days, the app lands on the travel passport instead — the off season has no "now" to show, but the ground already covered is still there. Decided once per launch, so coming back from the passport never bounces you away again.
- **Itinerary Planning** — Multi-day events on a timeline with weather, category icons, rich-text notes and photos. A stay shows up on every day it covers: the first day keeps the full card, the rest get a slim bar saying how far into it you are ("住宿中 3/9 天") and the check-out time at the end. Those middle days appear even when nothing else is planned, and the forecast covers the whole span — a nine-night stay is nine days of the trip, not one.
- **Pocket List & Backup Plans** — A place with no date yet sits in 口袋名單 at the top of the itinerary as a row of chips. Tap one to fill it in like any other item; drag it onto a day to schedule it, or drag a scheduled item back. The sticky date row is itself a drop target, so a long trip does not mean scrolling to reach a day that is off screen. Planned, backup and wishlist are three values of one field, so the edit form has one control for it instead of buttons scattered on the card. A backup carries a vertical label down its left edge — the one part of the card nothing else competes for — and is decided on the day itself. The wishlist shows on the read-only share link, since where to go is an argument the group has together.
- **Save a Place from Instagram or Threads** — Tap share on a reel or post, pick Travel Tracker, and the place lands in a trip's pocket list. Instagram hands over nothing but the permalink, and its pages carry no metadata for anyone not logged in, so the text is fetched separately and read by AI — the venue named in the caption, not the city on the location tag, because a post tagged *Florence, Italy* is usually about one square in it. Several places named means several offered, each with what the post actually claimed, and you tick the ones worth keeping before anything is saved: a wrong guess left in a curated list costs more to clear out later than it saved. Practical detail survives — where to buy tickets, when to go, what to watch out for — rather than being boiled down to a slogan. The trip is picked by matching the place's country against your trips. The reel's cover frame is offered as the card photo but left unticked, since these days it is as often a title card as the place itself. Android only; needs the app installed from the home screen.
- **Rich Text Notes + AI** — A full editor shared by everyone on the trip, with six section chips that generate travel tips, packing lists or transit guides. Opens in read mode; unsaved edits survive as a local draft, so switching tabs never loses work. Reading and editing use the same typography, so a note looks identical before and after saving. The same editor powers itinerary notes and trip descriptions.
- **Route Tab** — Boarding-pass style cards for transport segments — flights, trains, buses.
- **AI Ticket Import** — Point Gemini at a boarding pass image or PDF and the flight details fill themselves in.

#### Money & splitting

- **Multi-Currency Expenses** — Costs in any currency with live rates, all converted to the trip's base currency for settlement. Settled rows are marked paid for everyone, not just for you. The form remembers the last payer and offers save-and-add-another, because expenses arrive in batches. Ended trips open on the stats instead of the list.
- **Expenses Linked to the Itinerary** — Each itinerary card shows what has been spent on it, at the end of the meta row. Tapping that amount opens an expense form already filled in with the item's name, category and date, so a cost gets logged without leaving the itinerary. The expense list can be narrowed to a single item.
- **AI Receipt Scan** — Photograph a receipt and Gemini fills the amount, currency, category and description into the expense form.
- **Settlement Reminder** — One tap turns who-owes-whom into a message for the group chat. Only unpaid rows are listed — repeating a settled one just makes someone think they owe it twice — and every amount is in the trip's base currency, so one message never mixes currencies. On a phone it opens the share sheet straight into LINE rather than copy, switch app, find the group, paste. The button disappears once everything is settled.

#### On the trip

- **Trip Mode & Quick-Expense FAB** — A trip in progress opens on today's itinerary, and the hero carries a "Day N / M" bar with the days already travelled tinted on the timeline rail. Landing respects which tabs the trip has turned on, so hiding the itinerary tab opens the first visible one instead. On mobile a floating 記帳 button stays within thumb reach from any tab.
- **Souvenirs & Shopping List** — Card grid or compact list, with the choice remembered. Tags, photos and quick check-off; items without a photo skip the image area rather than showing a placeholder. Checked items slide to the bottom, so it stays obvious which one was just ticked.
- **Trip Recap & Celebrations** — When a trip ends, a recap card — days, itinerary items, unique places — appears under the hero with a one-time confetti burst. Clearing the last outstanding settlement gets one too.

#### LINE

- **LINE Bot Expense Input** — Link a LINE group or DM to a trip with a one-time code, then log expenses by typing in the chat — description, amount, currency, payer and split, synced back to the app.
- **Daily LINE Push & Receipt Logging** — At 8am local time the group gets that day's plan: times aligned into a column you can scan down, a multi-day stay showing which day it is on, a backup marked and stepped back. Local time comes from the destination's coordinates and is corrected by the device whenever the app is opened during the trip — tickets get booked in advance from home, so a reading is only taken when today falls inside the trip. The day after it ends, one settlement summary says who still owes whom. Drop a receipt photo into the group and it becomes an expense; a picture with no amount in it is passed over in silence, since nine out of ten photos in a group chat are scenery. `/trip` answers for today where the trip is, not where the server is — checking the plan over breakfast in Rome should not hand back yesterday.

#### Sharing & collaboration

- **Sharing & Collaboration** — Read-only links that ask which tabs to expose before handing over the URL: unticked tabs never appear on the shared page and their data never reaches the recipient's browser at all, so a link can show the itinerary while keeping the costs to yourself. A trip has one share link, so changing the selection also changes what an already-sent link shows. Members with edit access are redirected straight to the full editor. Owners can remove members; members can leave.
- **Copy an Itinerary from a Share Link** — Someone looking at your trip can turn it into one of their own: pick a departure date and the whole itinerary shifts to start there, each day's plan and ordering unchanged. What travels is the plan — times, places, notes, photos — while expenses, members and the photo album stay with the original, because those belong to that trip rather than to the plan. Photos come across as links to the originals, so they disappear if the original trip is deleted. Copying can be turned off per link.
- **Claim Your Identity After Joining** — When joining a trip, pick which split-bill name is you. Owners manage the name ↔ account bindings from the trip page.
- **Export to Google Sheets** — One button asks which tabs to export and each becomes its own sheet, in the same order as the app. An empty tab produces no empty sheet. The file lands in your own Google Drive, and Google only ever grants access to files this app created — nothing else in the Drive is reachable. The itinerary sheet is one row per item in timeline order; columns that would be blank for this trip simply do not appear.

#### Photos & looking back

- **Photo Wall** — Google Photos albums in a justified gallery with a lightbox — swipe to move, double-tap to zoom, videos play inline.
- **Photo Frame Export** — Export a photo with a camera info bar read from its EXIF — focal length, aperture, shutter, ISO, date — and the brand's own logo. Aspect ratio, frame and background colour are yours to pick.
- **Travel Passport** — One book holding every trip, the ones you created and the ones you were invited to alike — someone else opening the trip does not mean you were not there. Past the cover is the data page, then the entry stamps: one per country per trip, so three visits to Japan leave three stamps, each stamp's shape, angle and ink derived from the country code so the same country always looks the same. The record page carries logged flight distance, the longest flight and trip, and the country visited most — a flight counts only when both airports have known coordinates, and the rest are stated as excluded, because treating an unknown airport as zero produces a number that looks precise and is wrong. Records with nothing to say disappear: a country visited once is not the country you visit most. Then a page per year, saveable as an image. The way in is a passport tucked into the corner of the globe — tap it and it flies to the middle and opens. It is a book that actually turns: drag a page and the paper bows under your finger. Without WebGL, or for anyone who asked for reduced motion, it falls back to flat pages with the same content.

#### Admin console

- **Admin Console** — A private console only the named administrator can open; to anyone else the address does not exist. It answers one question: where did this go? Type a name, or narrow it with chips like delete / last 7 days / itinerary, and every result opens in place to show which fields changed, old value beside new. Anything edited or deleted can be put back from the row itself, and the restore is recorded too. Sign-ins get their own list, failed attempts included. The foot of every page states which build is live, so "what does the bottom of your screen say" answers the version question in one line.
- **Share-Link Views & AI Spend in the Admin** — Logins, logouts, failed attempts and share-link opens all sit under 來訪, because they answer the same question — who touched this system and when. A share link opening is recorded with the trip, device and IP, deduplicated so one person refreshing is one entry rather than thirty. AI usage has its own page: every Gemini call with tokens, duration and whether it failed — failures included, because counting only successes makes usage look low when it is actually hitting a wall. Thinking tokens are counted too; they are billed as output but reported separately, and were six times the visible output on the first call measured. A monthly budget stops the AI features before the bill runs away rather than after. Apify's quota sits on the same page, because when it runs out the share flow just says "could not read" and nobody would connect the two.
- **Server Error Log** — Uncaught exceptions from route handlers, Server Components and Server Actions are captured through Next's `onRequestError` hook rather than a try/catch in every endpoint, so new endpoints are covered the moment they are written. The same error on the same route is recorded once every five minutes — a broken endpoint being polled would otherwise bury everything else under thousands of identical rows. Responses that merely return a 500 without throwing are deliberately left out: those are expected outcomes, and mixing them in would hide the crashes that need attention.
- **Image Storage & Cleanup** — One page shows how much space itinerary photos take against the 1 GB the free plan allows, turning amber past 80% — hitting the ceiling makes uploads fail outright, and finding out then is too late. Deleting an item drops the database reference but leaves the file, because the same URL can be shared by several trips and deleting it would break someone else's. Instead the page lists files nothing points at that have sat for more than 24 hours — that window covers a photo uploaded but not yet saved, which would otherwise come back broken the moment the user hits save. The check is recomputed when the button is pressed rather than trusting a figure that may be minutes old.
- **LINE Message Simulator** — An admin page that holds a conversation with the bot without going through LINE. Pick a trip, type into a phone-shaped chat, and the cards come back exactly as the group would see them — buttons included, and they work: confirming a split writes the expense for real, because a preview that only draws the layout can look right while the thing behind it is broken. Anything it writes gets a delete beside it. The two pushed cards can be previewed for any date without waiting for eight in the morning or sending a message to anyone.

#### Foundations

- **PWA & Offline Caching** — Cached locally across every tab, with skeleton screens so a reopened trip is readable before the network answers.
- **Responsive UI** — Sidebar on desktop, a bottom nav with a sliding indicator on mobile. Shared components keep the app and the public share pages looking like the same product. Built with Tailwind CSS 4 and Ant Design 6.

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

#### 規劃行程

- **互動式 3D 地球儀** — WebGL 的飛行弧線動畫，目的地存的是真實座標而不是國名，所以航跡落在真正去過的地方。旅程清單開頭是一段旅遊足跡——年份跨度、趟數、國家數與總天數。
- **開 App 時的落點** — 有正在進行的旅程就直接進那趟。都結束、最近 14 天也沒回頭看過任何一趟時，落在旅遊護照——淡季沒有「現在」可以看，但走過的路還在。這個判斷一次開啟只做一次，所以從護照回到清單不會又被帶走。
- **進階行程規劃** — 時間軸上的跨日事件，帶天氣、分類 icon、富文字備註與照片。跨日的住宿會出現在它覆蓋的每一天：第一天保留完整卡片，後面幾天是一條精簡狀態條，標「住宿中 3/9 天」，最後一天再加退房時間。那幾天即使沒有其他安排也會出現，天氣也涵蓋整段——住九晚就是旅程的九天，不是一天。
- **口袋名單與備案** — 還沒決定哪一天的地方，先放在行程最上面的「口袋名單」，一行 chip。點開就跟一般行程一樣可以填，拖到某一天就排進去，排好的也能拖回來。頂部那排日期本身就是放置目標，行程長的時候不必為了搆到畫面外的那天先捲半天。正式行程／備案／想去是同一個欄位的三種值，所以編輯表單裡是一個選擇器，不是散在卡片上的幾顆按鈕。備案在卡片左緣立一條直立標——左緣是整張卡唯一沒有東西跟它搶的地方——當天再決定。口袋名單會出現在唯讀分享連結上，因為「去哪」本來就是一起吵出來的。
- **從 IG／Threads 分享存進口袋名單** — 在 reel 或貼文按分享、選 Travel Tracker，地點就進了某一趟的口袋名單。IG 交出來的只有一個網址，而它的頁面對未登入的請求沒有任何 metadata，所以內文是另外取回來交給 AI 讀的：要的是內文裡點名的那個地方，不是地點標籤上的城市——標著「Florence, Italy」的貼文，講的通常是裡面的某一座廣場。講了好幾個地方就給你好幾個，各附一句那則貼文怎麼形容它，存之前由你勾選：猜錯的東西留在精挑的清單裡，之後清掉要花的力氣比當初省下的還多。攻略會留下來——去哪買票、什麼時段去、要注意什麼——而不是壓成一句話。存到哪一趟是拿地點的國家去對的。Reels 的封面會問要不要當卡片照片但預設不勾，那是發文者自己挑的一幀，現在很多是標題卡而不是現場。僅限 Android，需要先把 App 加到主畫面。
- **筆記分頁（富文字 + AI）** — 全隊共享的富文字編輯器，六個區塊 chip 可以生成旅遊注意事項、該帶什麼、地鐵攻略。預設閱讀模式；沒存的編輯會留成本機草稿，切分頁不會不見。閱讀與編輯用同一套排版，存檔前後看到的完全一樣。行程備註與旅程簡介也是同一個編輯器。
- **路線分頁** — 登機證風格的交通段落卡片——航班、火車、巴士。
- **AI 機票自動匯入** — 把登機證的圖片或 PDF 丟給 Gemini，航班資訊自己填好。

#### 費用與分帳

- **多幣別費用追蹤** — 任何幣別都能記，帶即時匯率，結算時統一換算成那趟的基準幣別。標記成已付是所有成員都看得到，不只你自己。表單記得上一個付款人、也能存完接著加下一筆——花費本來就是一串一串出現的。已結束的旅程預設打開統計而不是清單。
- **行程與記帳打通** — 每張行程卡在 meta 那列尾端顯示這一筆花了多少。點下去打開的記帳表單，名稱、分類、日期都已經填好，不必離開行程頁就能記。費用清單也可以只看某一筆行程的花費。
- **AI 收據掃描** — 拍一張收據，Gemini 把金額、幣別、分類與描述填進記帳表單。
- **催款訊息** — 一鍵把誰欠誰多少變成一則可以貼進群組的訊息。只列還沒付的——重複列已經結清的，只會讓人以為自己欠了兩次——金額統一是那趟的基準幣別，一則訊息不會混幣別。手機上直接開分享選單送進 LINE，省掉複製、切 App、找群組、貼上那一整串。全部結清之後按鈕就消失。

#### 旅途中

- **旅途中模式與快速記帳** — 進行中的旅程打開就落在今天的行程上，hero 有「第 N / M 天」的進度條，時間軸也把走過的日子染色。落點會照那趟開了哪些分頁走，關掉行程分頁就落在第一個看得到的。手機上有一顆浮動的「記帳」，在任何分頁都在拇指構得到的地方。
- **伴手禮與購物清單** — 卡片或精簡清單兩種排版，選過會記住。可以加標籤、上傳照片、快速打勾；沒有照片的就不留圖片區，而不是放一張佔位圖。打勾的會滑到最下面，剛勾掉哪一個一目了然。
- **旅程回顧與慶祝** — 旅程結束時，hero 下方出現一張回顧卡（天數、行程數、去過的地方），配一次彩帶。結清最後一筆分帳也會有。

#### LINE

- **LINE Bot 快速記帳** — 用一組連結碼把 LINE 群組或私聊綁到某一趟，之後在聊天室打字就能記帳——描述、金額、幣別、付款人與平分對象，即時同步回 App。
- **LINE 每日推播與收據記帳** — 當地早上八點，群組收到當日行程：時間對齊成一欄可以直接掃，跨日住宿標著進行到第幾天，備案標出來並降一階。當地時間從目的地座標推算，旅途中打開 App 時用裝置校正——提前訂票時人還在出發地，所以只在今天落在旅程期間內才採用。結束的隔天推一次結算摘要。群組裡丟一張收據就記帳；認不出金額的圖安靜略過，群組裡十張有九張是風景照。`/trip` 回的是旅程當地的今天而不是伺服器的今天——在羅馬吃早餐時問行程，不該拿到昨天那份。

#### 分享與協作

- **分享與共同編輯** — 唯讀分享連結，產生前先問這條要露出哪些分頁：沒勾的不會出現在分享頁，資料也完全不會送到對方的瀏覽器——所以可以只分享行程、把費用留給自己。一趟旅程只有一條分享連結，所以改了範圍之後，之前貼出去的那條看到的東西也跟著變。有編輯權限的成員開啟時直接跳到完整編輯介面。擁有者可以移除成員，成員也可以自己離開。
- **從分享連結複製行程** — 看到別人行程的人可以把它變成自己的一趟：選一個出發日，整份行程平移到那天開始，每天的安排與順序都不變。帶走的是行程本身——時間、地點、備註、照片——費用、成員與相簿留在原本那趟，因為那些屬於那趟旅程，不屬於這份安排。照片是連到原本那幾張，所以原旅程被刪掉時會跟著不見。每條連結都能單獨關掉複製。
- **加入旅程後認領身份** — 加入旅程時挑出分帳名單裡哪一個是你。擁有者可以在旅程頁管理「成員名稱 ↔ 帳號」的綁定。
- **匯出 Google 試算表** — 一顆按鈕先問要匯出哪些分頁，每個分頁各成一張工作表，順序照 App 裡的分頁。沒有內容的分頁不會產生空白工作表。檔案存在你自己的 Google Drive，而 Google 只會授權這個 App 自己建立的檔案，Drive 裡其他東西碰不到。行程那張是一列一筆、照時間軸排序；這趟用不到的欄位就不會出現。

#### 相簿與回顧

- **旅遊照片牆** — Google 相簿以齊行版面呈現，附燈箱檢視——滑動換張、雙擊放大，影片直接播放。
- **照片框架匯出** — 把照片匯出成帶相機資訊列的樣子，資料從 EXIF 讀出來——焦段、光圈、快門、ISO、日期——配上該品牌的 logo。比例、外框與底色可以自己挑。
- **旅遊護照** — 一本涵蓋所有旅程的護照，自己建的和被邀請的一樣算——別人開的旅程不代表你沒去過。封面之後是資料頁，接著是入境章：一趟一國一枚，去日本三次就是三枚，每一枚的形狀、角度與墨色都由國碼決定，所以同一個國家永遠長一樣。紀錄頁有已記錄航段的里程、最長的一段航程與最長的一趟、去最多次的國家——航段只在兩端機場都查得到座標時才算，其餘明白標示為未納入，因為把不知道的機場當成零，會得到一個看起來精確但是錯的數字。沒有東西可講的紀錄就整格不出現：只去過一次的國家不是「去最多次」。之後是一年一頁，可以存成圖片。入口是地球角落那本護照，點下去它會飛到中間打開。它是真的會翻的書：拖著紙頁，紙會在指下彎折。沒有 WebGL、或是要求減少動態的人，會退回沒有翻頁的平面版本，內容一樣。

#### 後台

- **後台操作紀錄** — 只有被指定為管理員的帳號打得開，其他人連這個網址存在都看不到。它回答一個問題：這筆東西怎麼不見了？打一個名字，或用「刪除」「近 7 天」「行程」這些 chips 收斂，每筆結果原地展開看到哪幾個欄位被改了、舊值新值並排。被改掉或刪掉的可以直接從那一列還原，還原本身也會留下紀錄。登入另成一份清單，含失敗的嘗試。每一頁的最下方標著現在線上是哪一版，「你最下面寫什麼」一句話就回答得了版本問題。
- **分享連結瀏覽與 AI 花費監測** — 登入、登出、失敗的嘗試與分享連結被打開都歸在「來訪」，因為這些回答的是同一個問題——誰在什麼時候碰到了這個系統。分享連結被打開時記下是哪一趟、什麼裝置、哪個 IP，並做去重，所以一個人重整十幾次是一筆而不是十幾筆。AI 用量有自己一頁：每一次 Gemini 呼叫的 token、耗時與成功與否——失敗也記，因為只記成功的會讓用量看起來很低，實際上是一直在撞牆。思考 token 也算進去，它按輸出計費卻另外回報，實測第一筆就是可見輸出的六倍。並設每月預算，在帳單跑掉之前就停用，而不是之後。Apify 的額度放同一頁，因為它用完時分享流程只會說「讀取失敗」，沒有人會把兩件事連起來。
- **伺服器異常紀錄** — route handler、Server Component 與 Server Action 的未攔截例外，透過 Next 的 `onRequestError` 統一捕捉，不是在每支端點各寫一次 try/catch——所以新寫的端點一上線就被涵蓋。同一條路徑的同一種錯誤五分鐘只記一次，否則一支壞掉又被輪詢的端點，會用幾千筆一模一樣的紀錄埋掉其他所有錯誤。只回 500 但沒有拋出例外的不記：那是預期中的結果，混進來只會蓋掉真正需要處理的當機。
- **圖片儲存用量與清理** — 一頁看行程照片佔了多少空間，免費方案共 1 GB，超過八成轉成警示色——撞到上限時上傳會直接失敗，那時候才知道就太晚了。刪掉行程只會讓資料庫的參照消失、檔案還留著，因為同一個網址可能被多筆行程共用，刪了會把別人那趟弄破。所以改成列出「沒有人指向、而且放超過 24 小時」的檔案一次清掉——那 24 小時是留給剛上傳還沒按儲存的圖，否則使用者一存檔就得到一張破圖。按下清理時判定會重算，不吃畫面上那份可能已經過期幾分鐘的快照。
- **LINE 訊息模擬器** — 後台的一頁，不透過 LINE 就能和 bot 對話。選一趟行程，在手機大小的聊天框裡打字，回來的卡片就是群組會看到的那些——按鈕也是真的能按：確認分帳會真的寫進費用，因為只畫得出版面的預覽看起來都對，背後壞掉也看不出來。寫進去的每一筆旁邊都有刪除。兩張推播卡可以指定任何一天預覽，不用等早上八點、也不用真的推給誰。

#### 基礎

- **PWA 與快取** — 每個分頁都在本機快取，配骨架畫面，所以重新打開一趟旅程時，網路還沒回來就已經讀得到東西。
- **響應式介面** — 桌機側邊欄，手機底部導航列配一顆會滑的指示球。共用元件讓 App 與對外的分享頁看起來是同一個產品。以 Tailwind CSS 4 與 Ant Design 6 建成。

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
