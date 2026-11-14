# Vedant Dalvi: Portfolio Facts (single source of truth)

**Rules for whoever builds the site**
- Use only facts in this file. If something is missing, leave a visible `TODO` in `src/content.json`. Never invent numbers, dates, download counts, user counts or testimonials.
- Items marked **[CONFIRM]** are uncertain. Use the wording given here, and list them in your final summary so I can verify them.
- Do not publish a phone number anywhere on the site.
- Do not publish client names, internal Wipro URLs, ticket data or credentials. Describe the work generically.
- Do not show readable visitor names or wishes from Global Wishes. Blur or avoid them in any screenshot.

---

## Identity and contact
- Name: Vedant Dalvi
- Location: Pune, India
- Email: vedantdalvi05@gmail.com
- Site: vedantdalvi.in
- LinkedIn: TODO
- GitHub: TODO
- ArtStation: https://www.artstation.com/vedant_jpg

**Headline:** Application engineer by day, builder of worlds by night.
**Short role line:** Application Packaging Engineer · Developer · 3D artist · Game maker

## Story (used in the "License Agreement" step)
- Started learning to code at 17, because I wanted to make my own video games.
- Studied animation to bring those game ideas to life (BSc Animation, CGPA 9.24).
- Diploma in Computer Engineering before that.
- Became interested in Japanese through anime and films, and started learning it in 2018.
- Today: working in enterprise IT at Wipro, building apps, games and 3D web projects on the side.

## Career timeline [CONFIRM dates]
Source: the most detailed (June) resume. Some older resumes list Application Packaging Engineer from Aug 2023 instead of Aug 2024.

1. **Aug 2023 to Aug 2024: Wipro Technologies, Pune. RDS SME / IT Support Analyst (Service Desk)**
   - Started as a Service Desk Analyst supporting global users, then became an SME.
   - Created user accounts, managed group memberships and assigned application packages by provisioning users into Azure AD security groups.
   - Administered Exchange Online: created, modified and troubleshot Distribution Lists and Shared Mailboxes.
   - Resolved operating system, hardware and network issues for global end users under strict SLAs.
   - Built browser automation scripts for ServiceNow with Tampermonkey (ticket auto-refresh, priority alerts, session keep-alive).
   - Led DSAT analysis, reporting automation and team training (from earlier resume).
2. **Aug 2024 to present: Wipro Technologies, Pune. Application Packaging Engineer**
   - Manages the full packaging lifecycle (MSI, EXE) for enterprise clients using AdminStudio and InstallShield.
   - Writes wrapper scripts with the PowerShell App Deployment Toolkit (PSAppDeployToolkit) for install logic and user notifications.
   - Configures and manages deployments through Intune, including UAT, pilot phases and troubleshooting failures.
   - Packages and troubleshoots web applications, web configurations and driver components.
   - Uses ServiceNow to handle packaging requests and incidents.
3. **Aug 2022 to Oct 2022: Visiting Faculty (internship), Jagganath Rathi Vocational Guidance & Training Institute, Pune**
   - Taught graphic design tools and digital media basics to high school students.
4. **Freelance developer [CONFIRM or omit]:** older resumes list freelance full-stack and 3D game work, with differing date ranges (July 2022 to July 2024, or 2020 to present). Do not show dates until confirmed.

## Automation project: ServiceNow and Exchange pipeline
- Tech: PowerShell, ServiceNow API, Exchange Online.
- A central PowerShell script scans ServiceNow for new requests about Distribution Lists and Shared Mailboxes.
- It reads the ticket details, signs in to Exchange Online securely, and creates or modifies the list or mailbox and its memberships and permissions.
- It posts technical updates back to the ticket and closes it automatically when done, removing manual effort.
- Visual idea: tickets travel along a conveyor into a machine and come out closed.
- Do not claim time saved or ticket counts unless I provide them.

## Personal projects

### Global Wishes
- Live: https://globalwishes.in
- Tagline on the site: "Release a Lantern". Visitors type a wish (name optional) and a glowing lantern floats into a shared night sky in real time.
- Visible features (from screenshot): a live wish counter ("Global Wishes: 721" at the time of the screenshot), hundreds of glowing orange lanterns, hover/zoom on a lantern shows the wisher's name and date, a bottom bar with "Your Name (Optional)", "Type your wish..." and a "Release Lantern" button.
- Stack: React, Three.js, MongoDB (MERN). Started Feb 2026.
- Do not write "thousands of people" or any user count. The live counter is the honest number.
- Screenshot: assets/global-wishes.png

### The Void (University / final year project)
- 2.5D platformer made with Godot 4, inspired by games like The Last Night and Replaced.
- Role: lead developer. Did all backend (game logic) and some frontend.
- Video: https://youtu.be/9S4ZA0rcceU (title "University Project | The Void Game", about 6 minutes)
- Look: post-apocalyptic city at dusk, rusted towers and a "Spicy Ramen" billboard, a trench-coated character running along a highway, health counter in the HUD.
- Screenshot: assets/the-void.png

### J-Station (Android, Flutter)
- Play Store: https://play.google.com/store/apps/details?id=com.spawner.j_station
- A Japanese internet radio streaming app. Browse stations from Japan (for example Bay Wave, BeFM, Big B Radio Jpop, City Pop Radio), tap to play, with a Now Playing screen, album art and a mini player at the bottom. Soft "neumorphic" style buttons.
- **[CONFIRM]** One older resume also says "podcast". Say "radio streaming" unless you confirm podcast support.
- **Ignore** older resume wording that calls J-Station a JLPT study app. The screenshots show it is a radio app.
- Screenshots: assets/j-station-now-playing.png, assets/j-station-list.png

### JLPT Flashcards (Android, Flutter)
- Play Store: https://play.google.com/store/apps/details?id=com.spawner.jlpt_flashcards
- Vocabulary flashcards for JLPT levels N5 to N1. Tap a card to reveal the meaning, move between cards, hear pronunciation, see progress ("1 / 10", "Learned 0/10") and a daily streak counter.
- **[CONFIRM]** Older resumes mention Firebase, spaced repetition (SRS) and kanji etymology. The screenshots do not show these. Only mention them if they are real and in the shipped app.
- Screenshots: assets/jlpt-flashcards-home.png, assets/jlpt-flashcards-card.png

### 3D and games
- 3D models made with Blender and Maya, shown on ArtStation: https://www.artstation.com/vedant_jpg
- Games made with Unity and Godot: classics like Ping Pong and Snake, 2D platformers, a 3D first-person shooter, and 3D horror games. Some knowledge of Unreal Engine.

## Education
- BSc Animation, Fergusson College, Pune. Aug 2020 to Jun 2023. CGPA 9.24.
- Diploma in Computer Engineering, D.Y. Patil School of Engineering (Polytechnic), Pune. Aug 2016 to Jun 2019. 75%.

## Skills (for the "Choose Components" step)
- **Packaging:** MSI, EXE, AdminStudio, InstallShield, PSAppDeployToolkit
- **Deployment and identity:** Intune, Azure AD, Exchange Online, ServiceNow
- **Automation:** PowerShell, ServiceNow API, Tampermonkey (JavaScript)
- **Development:** Flutter, Dart, React, Node.js, MongoDB, Three.js, Python, Java, JavaScript
- **Games and 3D:** Godot (GDScript), Unity, Blender, Maya
- **Also used (older resumes, show lightly or omit):** Kotlin, Express, Office 365

## Languages
- English (professional), Hindi (native), Marathi (native)
- Japanese: JLPT N4 certified, N3 in progress. The current site still says N3. Use N4 certified, N3 in progress.

## Open items for Vedant to confirm
1. Packaging Engineer start date: Aug 2024 or Aug 2023.
2. Freelance work: include with dates, or leave out.
3. J-Station: radio only, or radio and podcasts.
4. JLPT Flashcards: do Firebase and SRS exist in the shipped app?
5. LinkedIn and GitHub URLs.
6. Final resume PDF to offer for download.

## Assets in the project folder
- resume.pdf (latest, to be supplied)
- assets/global-wishes.png, the-void.png, j-station-now-playing.png, j-station-list.png, jlpt-flashcards-home.png, jlpt-flashcards-card.png
- lantern.png (from globalwishes.in)
