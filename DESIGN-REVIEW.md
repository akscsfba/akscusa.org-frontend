# Site design review and completed improvements

**Reviewed:** 2026-10-03 UTC

**Source revision:** `86a54b68c7f57f10b671e40dbcc669047c1a5f7c`

**Status:** All 24 design items are implemented. D09 and D17, D21-D24 complete
the earlier P1/P2 work; the final iteration is recorded in section 11.

The site has a distinctive, coherent editorial identity. Keep it. The strongest
next improvements are about helping a visitor **find the right action, understand
what changed, and reach the thing they came to read**. They do not require another
palette, new fonts, a new framework, or a site-wide redesign.

This document records **24 independently scoped work items: 5 P1, 14 P2, and
5 P3**, all complete.
Priority describes visitor impact and iteration order, not a release verdict.
Some items are confirmed interaction problems; others are explicitly marked
design experiments. An unchecked item is a proposal, not an assertion that the
existing implementation is broken.

This is the design implementation record. [QUALITY-GATE.md](QUALITY-GATE.md) remains the source
for release, editorial, CMS, and operational acceptance. Do not duplicate its
owner-dependent work here or reopen its settled architecture decisions.

## 1. Scope, evidence, and limits

| Item                        | Review coverage                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target                      | Local production build at `http://127.0.0.1:4322`, not the live deployment                                                                                                            |
| Framework and styling       | Static Astro, Tailwind CSS 4, shared CSS tokens, feature-local components                                                                                                             |
| Route coverage              | 129 sitemap routes plus the explicit branded 404: 130 routes                                                                                                                          |
| Responsive checks           | All 130 routes at 320, 375, 768, 1280, and 1920px: 650 route/viewport renders                                                                                                         |
| Visual coverage             | Screenshots of all 130 routes at 1280px; full-page captures of 31 representative routes at 375 and 1280px; first-screen captures of those representatives at 320, 768, and 1920px     |
| Additional inspection       | 2026 conference, long book descriptions, historical conference content, filtered indexes, navigation, topic fragments, poster/comic dialogs, game feedback, and the magazine document |
| Existing browser baseline   | `npm run test:browser`: 103 passed, 1 intentionally skipped, 0 failed, across Chromium and Firefox                                                                                    |
| Current layout health       | No document-level horizontal overflow in the 650-render inspection; no uncaught page JavaScript errors in that inspection                                                             |
| Accessibility baseline      | Existing axe, keyboard, reduced-motion, no-JavaScript, 200% text, and dialog regression checks passed                                                                                 |
| Changes made by this review | Documentation and retained evidence only; no application, content, schema, or CMS changes                                                                                             |

The skipped test is the Chromium CDP cold-font performance probe in Firefox, not
an ignored application failure. Passing automation does not measure whether a
contribution link is discoverable, whether a heading is covered after a fragment
jump, or whether 12px magazine text is comfortable to read.

Measurements below are **CSS pixels**. Most journey measurements use **375 x 800**
with loaded fonts and reduced motion; the route-wide audit uses a 900px viewport
height. Positions are document coordinates unless stated otherwise. They are
reproduction baselines, not permanent assertions about content that may change.

The retained [evidence.json](docs/design-review/evidence.json) contains the full
route/viewport inventory, representative paths, measurements, and browser
baseline. Before/after screenshots were inspected locally and moved outside the
repository after review. The compact measurement records remain in
`docs/design-review/`; screenshot names below describe inspected states, not
links to committed image files.

### Limits

- External requests were blocked during automated browsing. No call, email,
  payment, membership application, or testimony submission was made. A working
  local action does not establish that the external service completes its job.
- The external pattern image in
  `/interventions/misrepresentation-of-sb-403-explained/` was consequently not
  loaded. This establishes a remote dependency, **not** a confirmed public 404.
  Empty image elements in closed comic/toolkit dialogs are intentional and are
  not broken published media.
- Safari/WebKit, physical touch devices, real screen readers, production field
  performance, and authenticated CMS publishing were not accepted here. Those
  remain explicit acceptance gaps, not inferred passes.
- Visual inspection emphasizes page templates, exceptions, and representative
  reading/interaction states. Every route was rendered, but this is not a
  pixel-by-pixel audit of every paragraph or every comic panel.

## 2. Design direction to preserve

| Strength                  | Keep this invariant during iteration                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Institutional voice       | Archivo headings and controls, Instrument Sans interface text, Newsreader ledes and long-form reading                          |
| Brand hierarchy           | Ambedkar blue leads; teal accents structure; crimson signals urgency and care                                                  |
| Editorial rhythm          | Alternate ink/paper bands, ruled indexes, reading lists, and artwork; do not turn every section into three equal cards         |
| Page distinction          | `PageMasthead` for indexes/landing pages; `EntryHeader` for individual entries                                                 |
| Reading behavior          | Readable prose measures and full original copy; do not solve length by deleting arguments or rewriting submissions             |
| Artwork                   | Original poster/comic colors, complete artwork, entry-owned media, transcripts, and in-page viewers                            |
| Accessible enhancement    | Native disclosures/selects/dialogs, visible focus, meaningful labels, usable no-JavaScript content                             |
| Visitor-oriented records  | One reading-log entry per book, with its sessions and flyers together; do not return to a session-per-row administrative table |
| Static-first architecture | Presentation changes stay in components/browser modules; one-off copy stays static                                             |

Do not introduce saffron/orange, generated imagery, pill-shaped controls, floating
card walls, blurred blobs, dot fields, decorative grids, or new static rules
above every label. Do not stretch prose across the full desktop container just
to occupy whitespace.

**CMS versus static decision:** These TODOs are presentation and interaction
work. No new CMS collection is justified. Reuse the existing structured records
for dates, status, participation links, book relationships, and media. If a task
needs a new editorial assertion or a different external destination, obtain
editorial approval; do not manufacture a field or claim to make a layout easier.

## 3. Complete page-family review

Counts include each section's index where one exists. Author pages have no
standalone index. The magazine document was inspected separately from its shell.

| Surface              |          Routes | What works                                                                                      | Main next iteration                                                                        |
| -------------------- | --------------: | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Home                 |               1 | Strong slogan, institutional artwork, reading-first order, varied section rhythm                | Shelf orientation and archive wording: D16-D18                                             |
| Actions hub          |               1 | Four distinct routes with useful descriptions instead of a large menu wall                      | Preserve its compact index; apply D21 only to genuine decorative separators                |
| Helpline             |               1 | Emergency guidance, named support region, contact methods, proportionate flyer viewer           | Put the main-page contact action before qualifying questions: D01                          |
| Testimonies          |               1 | Original accounts preserved, topics, privacy note, long-page navigation                         | Early contribution path and unobscured fragments: D02-D03                                  |
| Articles             |               9 | Editorial lead, category filtering, serif prose, restrained cards                               | Local filter feedback, lead scope, long-title treatment: D06-D07, D12                      |
| Interventions        |              15 | Outcome/status distinctions and useful resources                                                | Same filter improvements; label residual archive artifacts: D06-D07, D20                   |
| Press Releases       |              18 | Clear statement hierarchy and press-contact facts                                               | Keep long mobile titles authoritative without exhausting the opening: D12                  |
| Conferences          |               8 | Latest conference separated from the archive; dates, venue, programme context                   | Distinguish old registration artwork from current actions: D19-D20                         |
| Programs             |              18 | Artwork is preserved and given meaningful prominence                                            | Title/date orientation before the tall mobile lead poster: D15                             |
| Book Readings        |              26 | Next-session participation is visible, native filters, one-book grouping, stacked flyers        | Search state and direct access to the record: D13-D14                                      |
| Books                |              11 | Recognizable covers, stable author relationships, session links                                 | Bring the detail-page cover into the opening on mobile: D08                                |
| Authors              |               8 | Biography, credited portrait, complete related shelf                                            | Preserve the editorial list; improve shared session targets through D10                    |
| Comics               |               3 | Artwork-first reader, per-panel transcripts, keyboard paging, focus return                      | Optional long-strip navigation: D23                                                        |
| Anti-caste Toolkit   |               1 | Scenario anchors, short sequences, local contribution prompts                                   | Preserve scenario flow; shared target sizing through D10                                   |
| Organization         |               1 | Substantive explanation and membership/records routes                                           | Preserve bounded prose and membership/records navigation; shared target sizing through D10 |
| Constitution         |               1 | Clear numbered sections and bounded prose                                                       | Preserve numbering, wording, and reading measure; no document rewrite needed               |
| General Body         |               1 | Meeting/date precision and labeled PDF links                                                    | Apply D21's geometry pass without changing archived documents                              |
| Join                 |               1 | Application offered early and late, dues and eligibility visible                                | Fix access to this already-good page from mobile navigation: D04                           |
| Donate               |               1 | Matching/direct giving distinguished; membership remains a stronger commitment                  | Put direct giving within reach on mobile: D05                                              |
| Contact              |               1 | General contact and confidential support clearly separated                                      | Optional desktop whitespace reduction: D22                                                 |
| Magazine             |               1 | Permanent URL, full-page opening, exact downloadable document, working contents links           | Readable screen typography inside the document: D09                                        |
| Who said What?!      |               1 | Historical context, native choices, per-question feedback, no-JS explanations                   | Optional next-question navigation: D24                                                     |
| Branded 404          |               1 | Recognizable chrome, recovery destinations, helpline route                                      | Preserve; no extra error-page infrastructure is needed for this review                     |
| Shared header/footer | Across the site | Short desktop tree, scrollable mobile sheet, accessible disclosures, useful footer destinations | D04, D10-D11; retain current navigation source of truth                                    |

The counts total **130**. These are coverage counts, not a completeness claim
about AKSC's historical record.

## 4. How to use the backlog

**P1:** Start here: support, contribution, orientation, or reading is substantially
harder than necessary.

**P2:** A useful, bounded improvement to hierarchy, feedback, or consistency.

**P3:** Optional refinement; compare against the current design and retain only
if it demonstrably helps.

**S:** One localized component/style change.

**M:** A few related surfaces or browser-state changes with focused regression
coverage. These are scope estimates, not delivery promises.

Ship one TODO at a time, or split its design and behavior steps into separate
changes. Keep screenshots at the same viewport/content state. Do not check off a
design experiment merely because code was written.

### D01. P1 / S - Put helpline contact before the qualifying questions

- [x] Move the existing main-page contact panel directly after the title, before
      `supportQuestions`. Keep emergency guidance first and preserve both
      original artworks.

**Observed:** On mobile the contact panel starts at **y=994**, after the banner,
heading, and three long questions. The utility-strip phone link does work at the
top, so this is not a claim that calling is impossible. The problem is that a
visitor who has entered the helpline page still reads a screening sequence before
its main contact action.

**Small design:** Heading, contact methods/privacy note, then recognition
questions and supporting copy. Avoid another sticky bar or another copy of the
phone number.

**Accept:** At 375 x 800, a main-page contact method is visible in the first
screen; at 320px both methods remain readable and comfortably actionable.
Emergency guidance, phone/email destinations, wording, and viewer behavior stay
unchanged.

**Start:** `app/features/anti-caste-helpline/components/AntiCasteHelpline.astro`.
**Evidence:** Mobile opening.

### D02. P1 / S - Let a testimony contributor act before reading the archive

- [x] Add an early, plainly labeled route to the existing testimony submission
      form after the privacy/content note. Keep the closing contribution panel.

**Observed:** The main-page **Share your testimony** link starts at
**y=46,849** at 375px. A visitor arriving to contribute is asked to traverse the
entire archive to discover that action.

**Small design:** One primary contribution link, a secondary route to confidential
support, and the existing privacy note. Do not put a promotional overlay over
testimonies or make submission look like an emergency service.

**Accept:** Contribution is available before the topic browser/first account;
support and contribution have distinct labels. The existing approved form URL
and every original testimony remain unchanged. Preserve the closing action for
readers who decide after reading.

**Start:** `app/features/testimonies/components/TestimoniesPage.astro`.
**Evidence:** Contribution position in `evidence.json` under `journeys`.

### D03. P1 / S - Stop the sticky topic browser covering testimony headings

- [x] Give both topic headings and individual testimony headings a scroll offset
      that clears the sticky header **and** the closed topic disclosure.

**Observed:** A direct fragment to
`#overrepresentation-of-upper-caste-hindus-in-the-tech-sector` places its H3 at
viewport **y=112-170** while the topic browser occupies **y=88-156**. Most of the
heading is covered. Topic-level H2 jumps have a larger offset and worked in the
sampled interaction.

**Small design:** Correct the mobile H3 offset or introduce a local shared offset
for this page's two sticky layers. Do not add large arbitrary spacing to every
heading on the site.

**Accept:** Direct fragment loads and topic-link clicks show the complete target
heading below both layers at 320, 375, and 768px, including enlarged text. Retain
the desktop offset, outside-click/Escape dismissal, and logical keyboard focus.
This is a confirmed clipping problem, not by itself a claim of WCAG AA failure.

**Start:** `app/features/testimonies/components/TestimoniesPage.astro`.
**Evidence:** Covered H3.

### D04. P1 / S - Put Join AKSC at the top of the mobile navigation sheet

- [x] Move the existing Join action above the navigation tree rather than adding
      a duplicate or hiding section destinations.

**Observed:** Opening the menu at 375 x 800 shows a sheet from **y=154 to 800**,
but the Join action's unscrolled position is **y=1,050**. The sheet scrolls
correctly; the primary action is simply one of its last discoveries. Desktop
already gives it persistent prominence.

**Small design:** Join first, then the existing Actions/Organization hierarchy.
Keep the helpline utility region separate and immediately available.

**Accept:** Join is visible without scrolling the open sheet at 320, 375, and
768px. All destinations remain reachable, no duplicate Join link is introduced,
and Escape, focus return, scroll lock, no-JS navigation, and breakpoint reset
continue working.

**Start:** `app/components/navigation/MobileNav.astro`.
**Evidence:** Open mobile menu.

### D05. P2 / S - Bring the donation action into the mobile opening

- [x] Offer the existing direct donation action in the masthead, with brief
      matching-gift context; keep the detailed giving/membership explanation.

**Observed:** **Donate to AKSC** begins at **y=1,390** on mobile because the
desktop aside follows the complete prose when stacked. A visitor who chose
Donate is already expressing an intent the opening does not let them complete.

**Small design:** Reuse the page's existing destination and button copy. Keep
membership as the stronger site-wide commitment; do not turn the site header into
a donation campaign.

**Accept:** A giving action is visible within the first 800px at 375px, employer
matching versus direct giving stays understandable, and there is no new payment
form, tracking flow, D1 route, or unapproved financial claim.

**Start:** `app/features/donate/components/DonateOverview.astro`.
**Evidence:** Mobile donation opening.

### D06. P2 / M - Put filter results beside the controls that change them

- [x] Add a visible, polite result/status line immediately below editorial filter
      controls. Distinguish the filtered archive count from any retained lead.

**Observed:** After selecting **Ambedkarite Thought**, the count reads
**3 articles** at **y=448**, while the controls are at **y=1,317** and only two
archive cards match. The third counted item is the retained lead. Announcement
exists, but the visible feedback is far above the action.

**Small design:** A local line such as a matched archive count with the selected
category, using the existing count nouns. One live announcement, not competing
live regions. Keep selected controls in place.

**Accept:** Feedback and the first result are visible together after filtering at
375px; counts match the stated scope; URL/reload behavior remains intact. Zero
matching archive cards produces an explicit local explanation, not a blank grid
or a misleading positive count.

**Start:** `app/features/editorial/components/EditorialIndex.astro`,
`app/features/editorial/index-filter.ts`.
**Evidence:** Selected filter.

### D07. P2 / M - Explain why an out-of-category featured entry remains

- [x] Make the retained lead's relationship to the selected category explicit.
      Prototype a contextual lead label before considering a behavior change.

**Observed:** Selecting **Ambedkarite Thought** retains a lead filed under
**Caste in the USA**. Retention is deliberate in `index-filter.ts`; it is not an
unintentional failure of the archive-card filtering.

**Small design:** Preserve the stable featured entry, but label it as an
unfiltered/latest feature and label the cards as category results. If this still
confuses visitors, separately compare hiding the nonmatching lead; do not silently
change both behavior and counts in a typography pass.

**Accept:** A visitor can tell which part is filtered without looking back at the
masthead. The category count is unambiguous, the lead is never duplicated, and
shared category URLs still open correctly.

**Start:** The same two modules as D06. **Dependency:** D06's count/status scope.

### D08. P2 / M - Show the book cover before edition housekeeping on mobile

- [x] Reorder the book detail opening so the title/byline and cover form one
      recognizable introduction; put edition facts after it.

**Observed:** On `/books/the-will-to-change/`, the cover begins at **y=1,042**
and the sessions heading at **y=1,366**. The mobile cover follows the summary and
complete edition/ISBN card. Desktop already shows it beside the introduction.

**Small design:** Keep the name first, then the cover and original summary in a
compact mobile introduction, followed by edition facts and sessions. Do not
truncate the full book-page summary or enlarge a decorative cover into a hero.

**Accept:** Title, author, and recognizable cover appear within the first mobile
screen for ordinary-length entries. The longest summaries still reflow at 320px
and 200% text; all copy, bibliographic details, credits, and session links remain.
Desktop retains its useful side-by-side cover placement.

**Start:** `app/features/books/components/BookDetail.astro`.
**Evidence:** Current fact-before-cover order.

### D09. P1 / M - Give the magazine a readable screen edition

- [x] Increase the magazine document's screen reading scale before changing its
      presentation shell or adding another document format.

**Observed:** The embedded document and full-page document use **12px body text
with 17.04px line height**. The small font belongs to the document itself, not to
an iframe shrinking a fixed-width page. Opening full-page therefore does not
solve the fundamental reading-size problem.

**Small design:** Make screen article text at least 16px with an appropriate
reading line height and measure; let contents metadata remain secondary.
Separate screen and print rules. Preserve the magazine's editorial identity
rather than forcing the whole supplied publication into the website's chrome.

**Accept:** Comfortable reading without mandatory zoom at 320, 375, and 768px;
no horizontal overflow in shell or document; working contents links; unchanged
substantive copy, embedded images, and article order. The downloaded document
must still be the exact served source. Review print output separately.

**Start:** `app/features/magazine/assets/aksc-10th-year-magazine.html`.
**Evidence:** Embedded mobile magazine.

### D10. P2 / M - Make compact controls comfortably touchable

- [x] Increase undersized shared controls in small, separately verified groups:
      compact buttons first, carousel controls second, session/filter/transcript
      controls third.

**Observed:** Compact `.btn-sm` controls are **34px high**, session chips **36px**,
editorial filters **40px**, carousel controls **40 x 40px**, and toolkit transcript
summaries approximately **28px high**. Carousel controls have adjacent shared
edges.

**Small design:** Target a 44px touch box for important standalone mobile
controls. Increase padding/minimum dimensions without changing the type scale or
turning compact controls into pills. Do not enlarge every inline prose citation.

**Accept:** Actual bounding boxes, not just icon sizes, meet the chosen 44px
mobile comfort target; adjacent controls are easy to distinguish; 320px layouts
and 200% text still fit. A sub-44px web control is **not automatically a WCAG
failure**: WCAG 2.2 AA uses a 24px minimum with defined exceptions.

**Start:** `app/styles/global.css`, home carousel components,
`app/features/artwork/components/PanelSequence.astro`, `EditorialIndex.astro`.

### D11. P2 / S - Make meaningful masthead metadata readable

- [x] Raise photo identification/credit text and essential count/date metadata to
      a readable small-text tier; leave decorative eyebrows subordinate.

**Observed:** Masthead image identification is **10px**, credit text **11px**,
and several small record labels are 10-11px. Long mobile credits wrap into a
visually dense uppercase block under otherwise generous editorial type.

**Small design:** Trial 12-13px for meaningful metadata, calmer tracking, and
normal-case credit prose. Preserve the complete license/creator attribution and
the current in-flow mobile placement.

**Accept:** Credits can be read at native mobile scale, do not overlap titles,
counts, or buttons, and remain complete at 320px and enlarged text. Check normal
text contrast against the lightest rendered image/gradient point, not only the
base blue token. Do not globally inflate every `.label`.

**Start:** `app/components/ui/PageMasthead.astro`; then only the record metadata
that fails the same reading check.

### D12. P2 / S - Add a restrained opening for exceptionally long entry titles

- [x] Prototype a compact display treatment for the longest entry headings while
      retaining their full wording and Archivo role.

**Observed:** The April 2021 Santa Clara County statement's uppercase title fills
much of the first mobile screen at 320px before its summary/date can begin.
Nothing overflows; the problem is the opening's information hierarchy.

**Small design:** Compare a slightly smaller size/less compressed leading for
exceptional titles, with the date/status visibly close to the heading. Do not
lowercase, rewrite, line-clamp, or ellipsize original titles without editorial
approval. Short entry titles should not become timid.

**Accept:** Full title is readable at 320px and 200% text; the opening makes its
date/status easy to find; ordinary article/book headings retain their existing
weight. No manual line breaks or per-slug CSS map.

**Start:** `app/components/ui/EntryHeader.astro`, with narrowly scoped caller
input if the comparison establishes a useful variant.
**Evidence:** Long mobile statement title.
**Type:** Design experiment, not a clipping defect.

### D13. P2 / M - Make a narrowed reading log bookmarkable

- [x] Persist the reading log's search/facet selection in a validated URL state,
      using the editorial filter's share/reload behavior as prior art.

**Observed:** Searching **Ambedkar** reduces the log from **11 entries to 4**,
but the URL stays unchanged. Reload restores 11 entries and an empty field.
Editorial category filters already retain their selection.

**Small design:** URL parameters for the visible log controls, restored on load,
with a clear-all action that removes them. Do not push a browser-history entry
for every keystroke. Review the privacy implications of sharing free text.

**Accept:** Copy/reload restores the same query, facets, controls, and result
count. Unknown/retired facet values safely show an understandable state.
Clearing returns the complete log and focus to search. No-JS still exposes all
entries, and no search telemetry or persistent customer data is introduced.

**Start:** `app/features/book-readings/log.ts`, existing pure search helpers.

### D14. P2 / S - Offer a direct jump to the reading record

- [x] Add one local **Browse past readings** jump near the next-session panel,
      targeting the existing `#reading-log` section.

**Observed:** The mobile page presents the masthead/next session and the complete
meeting-terms band before the searchable record. Both are useful, but a returning
visitor looking for a specific book has no direct in-page shortcut.

**Small design:** A secondary text/control link, not a second primary call to
action or another navigation bar. Keep joining the next session first.

**Accept:** One activation reaches the record heading/search below the sticky
header at every width; it works without JavaScript and respects reduced motion.
Do not duplicate the record or remove meeting information.

**Start:** `app/features/book-readings/components/BookReadingsOverview.astro`,
`NextSession.astro`, `ReadingLog.astro`.

### D15. P2 / S - Orient the program lead before its full-size poster

- [x] Compare a compact text title/date above the lead poster on mobile while
      keeping the artwork large and uncropped.

**Observed:** On `/programs/`, the lead poster begins at **y=751**, is **446px
high**, and its text title starts at **y=1,353**. The poster is deliberately
`order-first` below desktop; visitors can inspect it before knowing its
searchable title/date/status.

**Small design:** Show the existing lead label/title/date, then the original
poster, then supporting summary. Keep the desktop outer poster column. Prefer
reordering to adding duplicate headings.

**Accept:** A visitor can identify the program and whether it is past/upcoming
before interpreting flyer lettering. Artwork remains complete, recognizable,
and at a worthwhile size; focus order matches reading order.

**Start:** `app/features/editorial/components/EntryLead.astro`, verified against
`app/features/programs/components/ProgramsOverview.astro`.
**Evidence:** Mobile lead order.
**Type:** Design experiment; the current artwork-first order is intentional.

### D16. P2 / M - Show where a visitor is on the shelf/quotation carousel

- [x] Add a compact visible position cue alongside the existing controls, using
      the same current-slide calculation as the announced status.

**Observed:** Mobile shelf slides occupy a full row, with a hidden scrollbar and
no visible position count. Controls work and a live region announces manual
movement, but a sighted visitor sees neither the extent of the shelf nor their
position in it.

**Small design:** Plain text such as position/total, not a row of decorative
dots. Preserve the desktop preview of adjacent covers and the underlying
scrollable list. Account for multiple partly visible desktop slides.

**Accept:** Manual controls, touch scrolling, arrow keys, resize, wraparound, and
last-slide clamping all keep the cue accurate. It does not create continuous
screen-reader announcements or controls when everything fits.

**Start:** `app/features/home/carousel.ts`, `HomeReading.astro`,
`HomeQuotes.astro`. Share calculation, not a second carousel implementation.

### D17. P3 / M - Compare manual-first shelf browsing with automatic rotation

- [x] Run a focused comparison on the **book shelf only**: start paused and let
      the existing Play control opt into rotation.

**Observed:** The shelf advances every **5 seconds** when not paused by pointer,
focus, reduced motion, or document visibility. Its book descriptions can take
longer than that to read. Current pause and reduced-motion behavior works.

**Small design:** Change only the initial state in the experiment. Do not remove
the existing controls, rewrite the quotation carousel, or substitute a new motion
library. Compare visitor comprehension, not just visual liveliness.

**Accept:** Keep only if first-time visitors browse/find books more reliably.
Play/pause wording, focus pause, no-JS scrolling, and reduced-motion safeguards
remain correct. The quotation carousel is unchanged unless separately reviewed.

**Start:** Home shelf attributes and the shared carousel's existing initial-state
contract. **Dependency:** D16's visible orientation cue.
**Type:** Optional experiment, not a reported autoplay accessibility regression.

### D18. P2 / S - Distinguish recent work from the writing archive on Home

- [x] Prototype neutral archive-aware labels for the writing portion of
      **Latest from AKSC**, keeping genuinely recent action dates visible.

**Observed:** The latest article is dated **August 10, 2020**, while the site also
shows a 2026 conference and October 2026 reading. Collection ordering can be
correct while the word **Latest** still implies fresh publishing to a newcomer.

**Small design:** Clarify writing versus recent action with existing dates and a
neutral section label. Avoid a guessed freshness cutoff or an additional
editor-managed field solely for this layout.

**Accept:** A visitor can distinguish archival writing from current activity
without opening an entry. No dates, original summaries, sort order, or historical
articles are changed; no empty-state fiction about unpublished new work.

**Start:** `app/features/home/components/HomeLatest.astro`.

### D19. P2 / S - Mark historical registration artwork as historical

- [x] Add a concise archive-context notice to past conference pages that retain
      original registration calls to action.

**Observed:** The 2018 conference still contains prominent **REGISTER NOW!**
button artwork and registration links. Its date is present above, but the
document's strongest action reads like a current offer.

**Small design:** Make the event's historical status explicit before original
programme/registration material. Preserve original artwork and substantive
wording; do not invent a replacement checkout or present an old link as a newly
verified registration route.

**Accept:** A visitor cannot reasonably mistake the retained button for current
registration. Historical resources stay accessible. Any removal or destination
change needs content-owner approval. Use the shared calendar/status policy.

**Start:** Conference presentation through `EntryLayout.astro` and the conference
route/presenter. The original body is in
`cms/content/conferences/aksc-1st-annual-conference-2018/index.md`.

### D20. P2 / M - Explain incomplete archive embeds instead of dead UI copy

- [x] Inventory residual embed placeholders, starting with the 2018 conference's
      **This slideshow requires JavaScript.** line, and replace the implied
      interaction with an approved archive explanation or real preserved media.

**Observed:** That line survives as ordinary prose in the static conference
document; a matching slideshow is not supplied by the page. The SB 403
misrepresentation entry also references an external decorative pattern image,
which was blocked in this review.

**Small design:** First separate substantive media from platform residue.
Restore recoverable substantive media beside its owning entry, or explain the
actual limitation. Ask the owner before deleting substantive copy; do not fetch
or recreate artwork speculatively.

**Accept:** No instruction suggests enabling JavaScript will reveal a nonexistent
slideshow. Decorative remote residue is removed only after its role is confirmed;
substantive images/documents remain locally available under the shared media
rules. Do not describe the blocked external pattern as proven dead.

**Start:** The two named CMS entry bodies; `ProseContent.astro` only if a shared
fallback pattern is actually needed.

### D21. P3 / S - Finish the existing flat shape language, one feature at a time

- [x] Normalize remaining application `rounded-2xl` shapes and decorative static
      separators to the established visual system, starting with testimony topic
      panels and General Body document links.

**Observed:** Some older notes/topic panels, book-cover corners, speaker portraits,
and PDF-link boxes use larger radii than the site's small-radius direction.
Some section openers still use a static grey top rule where a shared accent rule
or spacing would be clearer.

**Small design:** One feature per pass. Reuse existing tokens/classes; keep real
list/table dividers, borders that group content, and meaningful warning edges.
Do not remove structural separators merely because they are grey.

**Accept:** Compare before/after at mobile and desktop; no pill-like shapes, extra
shadows, new overlay decoration, clipped focus rings, or cropped artwork.
Illustrated objects inside original posters/comics are not UI to restyle.

**Start:** `TestimoniesPage.astro`, `GeneralBodyOverview.astro`; expand only after
the first comparison is accepted.
**Type:** Optional visual consistency pass.

### D22. P3 / S - Reduce the empty desktop contact-card well

- [x] Compare intrinsic-height contact cards, or a compact ruled contact list,
      against the current equal-height pair.

**Observed:** At desktop the brief email card is stretched to the height of the
longer confidential-support card, with its button pushed to the bottom.
The opening turns a simple contact choice into a large field of empty paper.

**Small design:** First try intrinsic height without moving buttons away from
their explanatory text. Only then compare a list treatment. Preserve the
urgent-support distinction and the existing destinations.

**Accept:** The email path can be scanned immediately, confidential support
remains distinct, and 320/375px stacking stays sensible. Do not convert email into
an unrequested contact form or make the support note look promotional.

**Start:** `app/features/contact/components/ContactOverview.astro`.
**Evidence:** Desktop contact pair.
**Type:** Optional layout experiment.

### D23. P3 / M - Add a lightweight jump for long comic strips

- [x] Prototype a **Go to panel** control near the comic reader's existing
      transcript controls, targeting the existing per-panel anchors.

**Observed:** One comic contains **37 panels**. The modal has a useful panel
counter and arrow navigation, and each inline panel has an anchor, but the long
page has no direct way to choose a distant panel without scrolling through it.

**Small design:** A native select/jump control or comparably small keyboard-usable
index. Keep the default continuous strip. No automatic resume storage,
pagination rewrite, gamified progress, or mandatory modal reading.

**Accept:** Jumping reaches the chosen panel below the sticky header; the full
comic/transcripts remain in the HTML; panel counts, dialog close/Escape/outside
click, paging, and focus return still work. Keep only if the control reduces
navigation effort without cluttering short comics.

**Start:** `app/features/comics/components/ComicReader.astro` and the existing
panel IDs in `PanelSequence.astro`.
**Type:** Optional long-reader experiment; not needed for short toolkit sequences.

### D24. P3 / S - Offer the next question where game feedback appears

- [x] Prototype a secondary **Next question** link after each question's
      answer/explanation, using the existing question anchors.

**Observed:** The game offers question links at its opening and global progress
at its end. Individual answers have good local feedback, but a reader finishing
a long explanation must continue scrolling or return to the opening navigation
to orient toward the next question.

**Small design:** One local next-question link for nonfinal questions; a finish
route to the existing progress/actions panel on the final one. Keep the
educational text and answer controls as they are.

**Accept:** Clear labels, logical order, and unobscured target/focus; works without
JavaScript. No answer is submitted by navigation, all choices are retained, and
the historical note, checking, invalidation, explanations, and reset remain
unchanged.

**Start:** `GameQuestion.astro`, with next-anchor data from its presenter/caller.
**Type:** Optional wayfinding experiment.

## 5. Suggested iteration sequence

Each row is a theme, **not** one large PR. Items within a row can ship separately;
the only hard design dependencies are D07 after D06 and D17 after D16.

| Iteration                         | TODOs             | Visible outcome                                                          | Pause/checkpoint                                             |
| --------------------------------- | ----------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1. Support and contribution       | D01-D03           | Help/contribution appears early; testimony fragments stay readable       | Inspect both first-screen support and a deep-linked account  |
| 2. Mobile actions                 | D04-D05, D10      | Join/giving are discoverable and compact controls feel deliberate        | Keyboard/no-JS/menu-resize checks; narrow-screen screenshots |
| 3. Browsing feedback              | D06-D07, D13-D14  | Filter scope is legible and reading searches can be revisited            | Category mismatch, zero results, reload/share/clear          |
| 4. Entry recognition              | D08, D12, D15     | Covers and program identity arrive earlier; long titles retain authority | Compare short/long entries and flyer/no-flyer variants       |
| 5. Reading and historical context | D09, D11, D18-D20 | Magazine is comfortable; small metadata and archive actions are honest   | Screen/print comparison and editorial approval where needed  |
| 6. Optional refinement            | D16-D17, D21-D24  | Better orientation without adding a dashboard or decorative machinery    | Keep experiments only after visitor-oriented comparison      |

For D08, D12, D15, D17, D21-D24, capture a small comparison before generalizing.
A less dense screenshot is not automatically a better experience. Prefer evidence
that the visitor identifies the entry, finds the action, or moves through content
more easily.

Do not bundle token changes, content edits, filter behavior, and navigation
reordering into one "polish" change. That makes regressions and design tradeoffs
impossible to attribute.

## 6. Acceptance contract for every future iteration

1. **Reproduce the before state.** Use the named route, content, viewport, and
   interaction. Record when content changes invalidate a measurement.
2. **Keep the change bounded.** One shared mechanism per rule; use `~/` imports,
   feature-local browser modules, existing queries/presenters, date/publication
   policies, named theme tokens, and current media ownership.
3. **Compare at 320, 375, 768, 1280, and 1920px.** Check first-screen hierarchy
   and the affected deep section/state, not only full-page thumbnails. Also
   exercise a short mobile landscape viewport and 200% text.
4. **Measure the real requirement.** Check contact/action coordinates, visible
   heading bounds, actual target dimensions, result counts, and URL restoration
   as appropriate. `scrollWidth <= clientWidth` alone does not prove usability.
5. **Preserve accessibility.** Keyboard order, visible focus, native state,
   no-JS content, reduced motion, alternative text/transcripts, and dialog focus
   return must survive. Verify body/interactive text at 4.5:1 and focus indicators
   at 3:1 against their actual supported backgrounds.
6. **Run focused existing checks first.** Select the relevant tests under
   `scripts/browser/`; add a regression for the specific newly changed behavior.
   Run broader validation when a shared style/component affects many pages.
   Keep setup and command definitions in [README.md](README.md).
7. **Require editorial approval where relevant.** No rewritten testimony,
   inferred response/privacy promise, changed registration/payment destination,
   invented credit, deleted substantive copy, or new image chosen only to fit a
   layout.
8. **Close the TODO with evidence.** Inspect before/after screenshots, record changed
   surfaces, exact acceptance results, and any tradeoff. If an experiment fails,
   record the decision and retain the current implementation rather than
   checking it off as an improvement. Keep temporary captures outside the
   repository; retain written measurements and reproducible browser assertions.

### Further acceptance, not performed by this document

Physical-device and Safari checks should focus on the mobile sheet, nested
sticky testimony navigation, native pickers, poster/comic dialogs, and magazine
scrolling. Screen-reader acceptance should cover filter count/scope, reading URL
state, topic fragments, transcript disclosures, and game feedback.

Existing release questions about calendar refresh, the standing reading schedule,
approved external forms/registration, artists' credits, and report formats remain
in [QUALITY-GATE.md](QUALITY-GATE.md). This design review neither resolves those
questions nor authorizes deployment, transactions, commits, or publication.

## 7. Original visual observations

| Screenshot           | What it establishes                                               |
| -------------------- | ----------------------------------------------------------------- |
| Mobile menu          | Join is not in the initial visible sheet                          |
| Helpline opening     | Qualifying questions precede the main contact panel               |
| Donation opening     | No giving action in the first mobile screen                       |
| Article filter       | Local selected controls/results need scope/count context          |
| Testimony fragment   | Sticky topic browser covers the target H3                         |
| Magazine             | The document has a much smaller reading scale than the site       |
| Program lead         | Tall poster arrives before the text title                         |
| Book opening         | Edition facts arrive before the mobile cover                      |
| Long statement title | Mobile opening is dominated by an intact long uppercase headline  |
| Desktop contact      | Short email card is stretched beside the longer support card      |
| Poster viewer        | Working in-page, whole-artwork viewing to preserve                |
| Comic viewer         | Existing paging, counter, and transcript presentation to preserve |

The temporary screenshots behind these observations are not application assets
and are no longer staged or stored in the repository. Do not duplicate the
editorial media under them or treat a cropped viewport as permission to crop
original posters.

## 8. Implemented iteration: D01-D04

**Implemented:** 2026-10-03 UTC. This pass addresses access to support,
contribution, and the mobile membership action, without a visual-system redesign.
It remains static presentation/interaction work: no collection, schema,
editorial account, or external destination changed.

The original observations above describe the before state. The
[after measurements](docs/design-review/implemented-d01-d04/after-measurements.json)
record the same routes at 320, 375, 768, 1280, and 1920px.

| Item | Implementation and measured outcome                                                                                                                                                                                                                                                                                                                                                                                           | Matched after evidence       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| D01  | Contact now follows the title and precedes all three questions. At 375 x 800 the panel starts at y=602 rather than y=994; the complete phone link is at y=673-729 and the email link also fits in the opening. Both contact targets are at least 44px high at 320 and 375px. Emergency guidance, both original images, privacy wording, and destinations remain intact.                                                       | Helpline opening             |
| D02  | The existing submission URL appears immediately after the privacy note, alongside a distinctly labeled confidential-support route, before topics and accounts. Its first link now starts at y=794 rather than y=46,849 at 375px. The closing contribution/solidarity panel remains. Rendered account text has the same digest before and after at all five measured widths.                                                   | Opening, privacy and actions |
| D03  | Topic and account headings share a local offset calculated from the closed disclosure's actual height, sticky top, and a one-em gap. The reported H3 now starts at y=171 rather than y=112, below the topic browser ending at y=156. At 320px and 200% text, the wrapped browser ends at y=412 and the H3 starts at y=444. Desktop retains its 7rem offset. A conservative CSS fallback clears the layers without JavaScript. | Account fragment, 200% text  |
| D04  | The single existing mobile Join action is now the first sheet link, at y=178-222 rather than y=1,050 at 320 and 375px, with a 44px target. At 768px it is at y=144-188. The complete destination list is unchanged; the menu remains scrollable and works without JavaScript.                                                                                                                                                 | Mobile menu                  |

**Acceptance coverage:** Chromium and Firefox regression coverage lives in
`scripts/browser/support.spec.ts` and the existing navigation, enhancement,
reading, and page tests. It checks direct account fragments, keyboard topic
jumps, 200% text, short landscape reflow, local axe checks, both submission links,
Escape/focus return, outside dismissal, menu scroll reachability, and desktop
breakpoint reset. The topic disclosure now reuses the shared disclosure
enhancement, with feature-local measurement in `features/testimonies/topic-menu.ts`
rather than inline browser JavaScript.

**Verification outcome:** The full browser suite passed 119 tests with the
existing Firefox CDP performance probe intentionally skipped. Type checking,
lint, changed-file formatting, all 611 unit/architecture tests, the production
build, built-page verification, and the strict static link/media gate passed.

**Tradeoffs and limits:** Original banners and long-form copy are not shortened
to fit a screen. At 200% text, a long topic heading may continue below the viewport,
but its opening is not hidden behind either sticky layer. The no-JavaScript
fragment fallback leaves more space than the measured enhancement. The Join
and helpline target increases are local; D10's broader control-size audit remains
open. External forms, phone/email delivery, Safari, physical devices, and real
screen-reader acceptance remain outside this local verification.

## 9. Implemented iteration: D05-D07

**Implemented:** 2026-10-03 UTC. This bounded pass improves the donation opening
and editorial browsing feedback. Existing D01-D04 work is preserved.
**CMS versus static:** All changes are static presentation or progressive
enhancement; no collection, schema, editorial record, payment destination, or
tracking flow changed.

| Item | Implementation and measured outcome                                                                                                                                                                                                                                                                               | Before / after evidence            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| D05  | The existing matching-gift guidance and single direct-giving link now sit in the masthead. At 375 x 800, the complete 44px-high action is at y=594-638 rather than y=1,390. At 320px it is at y=626-670. Original prose and the membership explanation remain, with no duplicate donation action.                 | Before, after, 200% text           |
| D06  | Articles and interventions now have one polite, atomic status directly below their filters. Selecting Ambedkarite Thought reports **2 earlier articles**, not 3 including the lead. The masthead retains the complete **8 articles** total. Zero matches explicitly explain the empty archive and how to recover. | Before, after, empty-state fixture |
| D07  | The latest entry has an explicit always-visible note. The archive heading now precedes its controls, with scope text explaining that the latest entry is excluded from the result count. The lead is neither hidden nor duplicated, even when its category differs from the selection.                            | Before, after                      |

The matched [before](docs/design-review/implemented-d05-d07/before-measurements.json)
and [after](docs/design-review/implemented-d05-d07/after-measurements.json)
measurements cover all three routes at 320, 375, 768, 1280, and 1920px. Donation
prose digests, donation/membership destinations, lead titles/summaries/links,
archive text digests, and matching-card counts are unchanged across those states.
The screenshot comparison aligns filter controls at viewport y=120; the browser
regressions also assert that feedback and the first result heading are fully
visible at 375px immediately after keyboard selection, without repositioning.

**Acceptance coverage:** `scripts/browser/donate.spec.ts` and
`scripts/browser/editorial-filters.spec.ts` cover first-screen action bounds,
44px donation targets, archive-only and singular counts, selected states,
retained/mismatched leads, share/reload/clear behavior, unrelated query
preservation, unknown-term fallback, keyboard focus, no-JavaScript content,
200% text, short landscape, and automated accessibility checks. The empty-state
fixture changes an archive card's category only in the browser to model a
category represented solely by the lead; it does not modify editorial data.

**Contrast and layout:** The lower masthead's new interactive content required
a quieter mobile logo, not another overlay or card. Its image opacity is 75%
below the desktop breakpoint; desktop presentation is unchanged. Conservative
sampling of the rendered background found a minimum **5.78:1** for the matching
guidance and **3.66:1** for the donation focus indicator across the five widths.
The [additional measurements](docs/design-review/implemented-d05-d07/additional-measurements.json)
record the method and filter-note contrast. An explicit single-column donation
grid also prevents intrinsic-width overflow at 320px with 200% text.

**Verification outcome:** The scoped and shared-page Chromium/Firefox run
passed 68 tests. After the donation-only contrast adjustment and stricter
immediate-result assertions, all 26 donation/filter tests passed again. Type
checking, lint, application/test formatting, the six editorial presenter tests,
the production build, built-page verification, and the strict local link/media
gate passed.

**Tradeoffs and limits:** The giving action moves out of the sticky desktop
aside rather than being duplicated there; membership retains its sidebar.
The featured entry remains intentionally unfiltered. These are explanatory
scope labels, not evidence of user-study comprehension. At enlarged text the
page scrolls rather than compressing its copy. External donations were not
submitted, and Safari, physical devices, and real screen-reader acceptance
remain unverified. D08-D24 were still open at the end of that iteration; the
subsequent P2 pass is recorded below.

## 10. Implemented iteration: all remaining P2 items

**Implemented:** 2026-10-03. D08, D10-D16, and D18-D20 complete the P2 backlog.
The existing D01-D07 work is preserved. D09's magazine screen edition and the
five optional P3 experiments are deliberately outside this pass.

**CMS versus static:** These are static presentation and browser enhancements,
not new editorial collections or fields. D20 makes two factual archive cleanups
in the existing entry bodies; it does not rewrite their arguments or invitations.
No registration, donation, support, or membership destination changed.

| Item | Change and acceptance evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D08  | Book detail now reads title/byline, cover, full summary, then edition facts on mobile. At 375 x 800, the complete **The Will to Change** cover is at **y=492-741**, previously starting at **y=1,042**. **Buffalo Nationalism** moves from **y=1,679** to **y=492-744** without shortening its long summary. Desktop retains the right-hand cover. Book paragraph digests and destination lists match the before state.                                                                                                    |
| D10  | Compact buttons, session chips, editorial filters, carousel buttons, transcript summaries, and panel-anchor links have at least **44px** touch boxes. Carousel buttons have an 8px gap instead of shared edges. Inline prose citations and the site's type scale are not globally enlarged.                                                                                                                                                                                                                                |
| D11  | Masthead identification, attribution, and counts use the existing **14px interface-text tier**, with normal-case credit prose. Credits remain in flow at every width so long licenses and enlarged text cannot collide with content. Home reading dates/counts, recent-action dates, and reading-log counts get the same readable tier; decorative `.label` typography stays unchanged. Across 95 metadata regions, conservative rendered-background sampling found minimum **6.19:1 text** and **5.31:1 focus** contrast. |
| D12  | Editorial titles over 100 characters opt into a named compact display scale; ordinary entry and book titles keep their original scale. The first existing detail moves above an exceptional title rather than being duplicated. The reported statement's date is now visible before its heading; at 375px the full heading occupies **258px**, previously **386px**. Full wording, capitalization, and Archivo remain. Email and topic wrapping also keep this page within 320px at 200% text.                             |
| D13  | The reading log restores `q`, `book`, `author`, and `year` from the URL, validates facets against available controls, and uses `replaceState` rather than adding a history entry per keystroke. Unknown/retired facets are cleared with explicit status feedback. Clear removes only these parameters, retains unrelated query/hash state, and returns focus to search. A visible hint explains that shared links include search text. No storage or search telemetry is added.                                            |
| D14  | One **Browse past readings** link follows the next-session area and targets the existing `#reading-log` heading. Its native fragment link, focusable target, and local scroll margin work without JavaScript and clear the sticky header; the meeting terms and next-session participation remain intact.                                                                                                                                                                                                                  |
| D15  | Program label/date/status and the single title now precede the complete mobile lead poster, followed by its summary. At 375px the title moves from **y=1,353** to **y=921**; the poster retains its **335 x 446px** size and original proportions. Desktop keeps the poster in the outer column. DOM and keyboard reading order match, without duplicate headings.                                                                                                                                                         |
| D16  | Both shared carousels show a plain **position of total** cue driven by the same current-slide calculation as manual announcements. Buttons, arrow keys, native scrolling, resizing, wrapping, and the desktop clamped end update it. Native scrolling does not update the live region. Controls and the cue remain hidden when the row fits or JavaScript is unavailable. Automatic-rotation policy is unchanged; D17 remains open.                                                                                        |
| D18  | Home now distinguishes **From the writing archive** and **Recent action** under **Writing and action**, keeping original dates, summaries, destinations, and ordering. This removes the blanket implication of fresh publishing without inventing a freshness cutoff or an editorial field.                                                                                                                                                                                                                                |
| D19  | Past conference pages show a dated **Conference archive** notice before speakers and original programme/registration material. It explicitly identifies retained registration and fundraising appeals as historical, not current offers. The existing shared final-day calendar policy controls the notice; current/multi-day conferences do not prematurely acquire it. Original resources remain accessible.                                                                                                             |
| D20  | The residual-embed inventory found one slideshow instruction and one remote pattern. The 2018 conference now states that its original slideshow is not available in this record. The remote PNG was successfully retrieved and visually confirmed to be a decorative wiggle texture before its empty-alt embed was removed. It was **not** classified as a broken URL. All other body text, substantive images/documents, and historical destinations are unchanged.                                                       |

### Retained comparisons

The [before measurements](docs/design-review/implemented-p2/before-measurements.json)
and [after measurements](docs/design-review/implemented-p2/after-measurements.json)
cover ten representative surfaces at 320, 375, 768, 1280, and 1920px, with no
document-level overflow. Before screenshots use the existing local dev server;
after screenshots use the production build with loaded fonts and reduced motion.
Screenshots are retained at matching 375px and 1280px viewports.

| Surface             | Before  | After           |
| ------------------- | ------- | --------------- |
| Book opening        | Mobile  | Mobile, desktop |
| Exceptional title   | Mobile  | Mobile          |
| Program lead        | Mobile  | Mobile, desktop |
| Masthead metadata   | Mobile  | Mobile          |
| Shelf orientation   | Mobile  | Mobile          |
| Reading controls    | Mobile  | Mobile          |
| Home archive labels | Desktop | Desktop         |

The [contrast record](docs/design-review/implemented-p2/contrast.json) documents
the pixel-sampling method against loaded photographs, gradients, and grain,
including the lightest sampled background rather than just the base blue.
Additional evidence shows the historical notice
and a restored reading search.
The [jump measurements](docs/design-review/implemented-p2/jump-measurements.json)
confirm unobscured, focused targets at 200% text across all five widths, both
with and without JavaScript. The [carousel measurements](docs/design-review/implemented-p2/carousel-measurements.json)
record Chromium touch-swipe and automatic-rotation transitions from 1 of 8 to
2 of 8 on both carousels, with no live-region announcement.

**Regression coverage:** `scripts/browser/entry-design.spec.ts`,
`scripts/browser/reading-log.spec.ts`, and `scripts/browser/compact-controls.spec.ts`
cover the new opening order, original cover proportions, complete attribution,
exceptional-title scale, actual control dimensions, URL restoration/clearing,
unknown facets, no-JavaScript record access, carousel positions, archive context,
200% text, short landscape, and local accessibility. URL-state unit tests cover
encoding, duplicate parameters, invalid/absent facets, and unrelated state.
Conference presenter tests check the archive boundary through the effective final
day in both existing timezone cases.

**Verification outcome:** The full Chromium/Firefox suite passed **173 tests**,
with the existing Firefox-only CDP performance-probe skip. Type checking, lint,
changed-source formatting, all **614 unit/architecture tests**, production
build, built-page verification, and the strict local link/media gate passed.
The magazine document remains unchanged.

**Tradeoffs and limits:** More readable credits take slightly more vertical space;
they are not hidden or overlaid to keep a masthead artificially short. Long titles
remain complete rather than clamped, and enlarged text is allowed to scroll.
Search text is deliberately part of a shareable URL and may therefore appear in
browser history or ordinary requests on reload; the visible hint discloses the
sharing behavior. Archive explanations describe only what this implementation
actually contains. No external action was submitted. Physical touch devices,
Safari/WebKit, real screen readers, and visitor studies remain unverified.

## 11. Final iteration: D09, D17, D21-D24

**Implemented:** 2026-10-03. All design TODOs are now closed.
**CMS versus static:** Screen typography, browsing defaults, component geometry,
and native fragment navigation are presentation concerns. No CMS collection,
editorial field, external destination, or substantive content was added or changed.

| Item | Implementation and decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D09  | The magazine's screen body is **18px with 29.7px leading**, previously 12px with 17.04px leading. A single continuous column, bounded to 72ch including gutters, replaces screen newspaper columns. Article headings, excerpts, bylines, contents metadata, and tables scale with their roles; paragraphs are left aligned. Screen-only rules leave the supplied print styling intact. The entire body, including embedded image bytes and article order, is byte-identical to the original. The download is still the exact served HTML document. |
| D17  | Only the book shelf opts into `data-carousel-start-paused`. Visitors may read a description for longer than the former five-second interval without losing their place, then browse with the existing arrows, keyboard, or native scrolling. Play explicitly opts into rotation; pause, focus, visibility, and reduced-motion safeguards remain in the shared implementation. Quotations retain their original default.                                                                                                                            |
| D21  | Testimony topic panels, care notes, General Body download links, book covers, and speaker portraits use small corners. Round comic zoom/paging affordances become small rectangles. Decorative rules above quote attribution, next-session content, toolkit introductions, and biography prompts are removed; list/table dividers, grouped-panel borders, warning edges, and the actual biography disclosure boundary remain. No artwork proportions or original pixels change.                                                                    |
| D22  | Contact cards have intrinsic height and actions follow their explanation. At 1280px the email card shrinks from **401px to 201px**, and its description-to-action gap from **224px to 24px**. The support card remains 401px with its urgency note intact. Explicit single-column sizing and bounded, wrapping links also prevent overflow at 320px with 200% text.                                                                                                                                                                                |
| D23  | Comics longer than ten panels get a native **Go to panel** disclosure beside transcript controls. Its numbered anchor index reaches any panel directly, including panel 37, without JavaScript. The target receives focus below the sticky header; the continuous strip, every transcript, and the modal reader remain intact. Short sequences and toolkit scenarios get no extra control.                                                                                                                                                         |
| D24  | Each game question has an onward link after its explanation. Nonfinal questions say **Next question**; the final question reaches the progress section. That section has a no-JavaScript explanation and a return link independently of the enhanced scoring controls. Navigation never submits, checks, or clears an answer.                                                                                                                                                                                                                      |

**Comparison decisions:** Keep the shelf manual-first because it removes the
five-second reading deadline while preserving opt-in motion. Keep intrinsic
contact cards because the email action stays beside the text explaining it.
Keep the comic index collapsed because it gives direct access to distant panels
without interrupting continuous reading or adding a permanent toolbar. These are
visitor-oriented design decisions supported by measured behavior, not claims of
a first-time-visitor usability study.

**Regression coverage:** `scripts/browser/magazine.spec.ts` covers screen scale,
enlarged text, contents navigation, exact downloads, and print typography.
`scripts/browser/enhancement.spec.ts` checks manual-first/opt-in shelf behavior.
`scripts/browser/design-refinements.spec.ts` covers contact geometry and small
corners. `scripts/browser/reader-wayfinding.spec.ts` exercises panel and question
anchors at 320, 375, 768, 1280, and 1920px with and without JavaScript, plus
enlarged text, focus, modal paging, and accessibility. Existing game tests preserve
checking, invalidation, reset, and no-JavaScript explanations.

**Artifact cleanup:** All 65 staged review PNGs were moved to session artifacts,
and their Markdown links were removed. Existing quantitative JSON evidence stays
in `docs/design-review/`. New captures also stay outside the repository.

**Print comparison:** Before and after both produce 45 A4 pages. The print
opening and the rasterized editorial page are pixel-identical. This preserves
the supplied print edition; it does not claim to redesign its existing layout.
The affected contact, comic, game, and magazine surfaces also fit a 667 x 375
landscape viewport.

**Final verification:** `npm run validate` passed: type checking, lint,
formatting, all 615 unit/architecture tests, the production build, built-page
verification, strict local link/media checks, and 191 Chromium/Firefox browser
tests. The existing Firefox CDP-only performance probe is intentionally skipped.

**Limits:** Physical devices, Safari/WebKit, real screen readers, visitor studies,
and external transactions are not claimed as verified. The operational and
owner-dependent release work in `QUALITY-GATE.md` remains separate.
