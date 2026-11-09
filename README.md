# Expense Tracker

Sami's spending tracker, the partner app to [Pay Tracker](https://github.com/FardinSami75/Pay-Tracker). It reads bank and card statements, sorts every purchase into a category, and compares each month's spending with the pay Pay Tracker says is coming in. It warns when you're on pace to spend more than you earn.

**Live site:** https://fardinsami75.github.io/Expense-Tracker/

It runs on the same two free services as Pay Tracker, and the **same Supabase project**:

- **GitHub Pages** hosts the website (this repository).
- **Supabase** stores the data and handles sign-in. Same login as Pay Tracker, and it reads your shifts, rates and Mercor entries from there (read-only).

Only the code is in this repository. No spending data is stored here.

---

## Features

### This month at a glance
- **Spent so far vs pay this month.** Pay is every payday landing in the month, worked out from your logged and scheduled shifts with the same rules as Pay Tracker, after tax.
- **Projection** to the end of the month. Day-to-day spending is projected at your current pace; bills (rent, phone, subscriptions, fees) are not, and last month's bills are expected if they haven't come in yet.
- **Safe per day:** how much you can spend each day for the rest of the month and still break even.
- **Warnings:**
  - red when you've spent more than this month's pay, or you're on pace to;
  - amber when you reach your warning level (80% of pay by default);
  - green when you're on track.
- Past months show what you kept or went short by.

### Where it went
- Spending by category, with the change from last month. Tap a category to list its purchases.
- Top shops for the month.
- A six-month chart of spending vs pay (also shown as a table).

### Statement import
- Upload **PDF statements** or **CSV / Excel** downloads. You can pick several files at once and go through them one by one.
- **CSV / Excel:** Amex, CIBC, RBC, Neo, Simplii and Tangerine layouts are recognised; any other bank works by picking the columns once, and the layout is remembered.
- **PDF:** the transactions are read in your browser (the file isn't uploaded anywhere). The bank, account type and last 4 digits are picked up to name the account (e.g. "CIBC Visa 7788"). When the statement shows opening and closing balances, the preview checks the lines add up to the closing balance, so you know nothing was missed or misread. Scanned (image-only) PDFs can't be read; use the CSV download for those.
- **Several accounts in one file:** RBC's CSV download includes all your accounts; each line is filed under its own account (e.g. "RBC Chequing 4567", "RBC Savings 4321").
- Lines with the same date and amount as something already imported from another file (e.g. a PDF and a CSV of the same month) are held back as probable duplicates, with an option to import them anyway.
- A preview shows every line, its category, and the totals **before anything is saved**.
- **Importing the same file twice adds nothing twice.** Overlapping statements are fine.
- **Not counted as spending:** card payments (e.g. "PAYMENT RECEIVED - THANK YOU", or paying Amex from your bank), transfers between your own accounts, and pay deposits (pay comes from Pay Tracker instead).
- **Refunds** count as money back in the shop's category.
- **e-Transfers** go under "Transfers to people" with the person's name. Money a friend sends back counts as money back. Change the category of one (e.g. to Eating out for your half of dinner) and tick "Always" to do it for that person every time.

### Paying for other people
- **Split a bill:** paid the whole table's bill? Tap the line (or tick **I paid for someone else** when adding one) and enter **my share**. A $300 charge with an $80 share counts as **$80** of spending; the $220 is tracked under **Owed to you**.
- **Bought something for someone:** tap **None of it was mine**. The charge counts as $0 of your spending, and the full amount is owed to you.
- **Getting paid back:** e-Transfers you receive while you're owed money are filed as **Paid back for something I bought them**. That's not income and not spending, so nothing is counted twice. The owed total goes down as they pay. You can also set any money-in line to this by hand.

### Chexy rent
- Rent paid through Chexy is split into two lines: the rent itself, which is **not counted** as spending, and Chexy's **1.75% card fee**, which counts under Fees & interest. For example, an $814 charge becomes $800 rent (not counted) + $14 fee.

### Categories that learn
- Purchases are sorted automatically (groceries, eating out, gas, rent, bills, subscriptions, shopping, and more).
- Tap any line to change its category, amount, date or note. Tick **Always do this for …** to fix every past and future line from that shop.
- **Make your own categories:** Settings → Categories, or pick **＋ New category…** from any category list. Tick "Monthly bill" for things paid once a month so they aren't projected forward. Removing one moves its lines to Other.
- A **Gifts** category is built in.
- Anything it couldn't sort is marked **sort** and counted at the top of "Where it went".

### Instalment plans
- Add each plan (e.g. Amex instalments) with its monthly amount, first payment month and number of payments.
- Plan payments count in each month's spending. Shows payments made, what's left, and the payoff month.
- Mark the original big purchase as **On an instalment plan** so it isn't counted twice.
- The monthly instalment fee on the statement counts as Fees & interest.

### Apple Pay automatic logging
- An iPhone Shortcut sends every Apple Pay tap here straight away and shows a notification like *"Logged $12.34 at Tim Hortons. $1,240 of $1,620 pay used · about $41/day left."* (or a ⚠️ warning).
- When the statement is imported later, the matching line replaces the tap, so it's never counted twice.
- Set-up steps are in the app under **Settings → Apple Pay automatic logging**.

### Also
- Manual entry for cash or anything else.
- Download all transactions as CSV, or a full backup as JSON.
- Shares the light/dark theme setting with Pay Tracker.

---

## Setup (one time)

1. **Database:** in Supabase (the Pay Tracker project), open **SQL Editor → New query**, paste all of `setup.sql`, and click **Run**. It only adds new tables; Pay Tracker's data isn't touched. Safe to run again.
2. **Website:** create a new GitHub repository called `Expense-Tracker`, upload `index.html`, `engine.js`, `config.js`, `setup.sql` and `README.md`, then go to **Settings → Pages**, choose **Deploy from a branch → main → / (root)**, and save.
3. Open the site and sign in with your Pay Tracker email and password. Since both sites are on `fardinsami75.github.io`, signing in to one usually signs you in to the other.
4. Upload your first statement under **Add → Statement**.
5. Optional: set up the Apple Pay shortcut from **Settings**.
6. On iPhone: open the site in Safari → Share → **Add to Home Screen**.

`config.js` holds the same Supabase URL and publishable key as Pay Tracker. The key is safe to publish: the database only shows each signed-in person their own rows.

---

## How the numbers work

- **Spending** = everything marked "Spending" in the month (refunds and paybacks subtract) + instalment plan payments due that month.
- **Pay** = gross pay from Pay Tracker for paydays in the month × take-home % (90% by default; change it in Settings). Mercor is counted in full because no tax is taken off. Stampede has no pay schedule in Pay Tracker, so its shifts count on the day worked.
- Pay only includes shifts you've logged or scheduled, so add upcoming shifts in Pay Tracker for the best warnings.
- The Apple Pay notification compares against this month's pay as last saved when you opened the site.

## Files

| File | What it is |
|---|---|
| `index.html` | The site |
| `engine.js` | Statement reading (CSV, Excel, PDF), categories, pay and projection maths |
| `config.js` | Supabase connection (shared with Pay Tracker) |
| `setup.sql` | Database tables and the Apple Pay function |
