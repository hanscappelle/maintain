# Garageboek

A web app that uses only local data to keep track of vehicles and their maintenance history. Add motorcycles, cars, or other wheeled vehicles and record the date, mileage, work performed, notes, and optional costs for each service. View each vehicle's history and a mileage chart over time. Registrations and vehicles can be edited or deleted.

![Finlit-demo](<assets/Screenshot 2026-11-19 at 10.54.08.png>)

![Finlit-demo](<assets/Screenshot 2026-11-19 at 10.54.15.png>)

![Finlit-demo](<assets/Screenshot 2026-11-19 at 10.54.24.png>)

## Online version and data storage

The published website is available at [betyre.alwaysdata.net/maintain](https://betyre.alwaysdata.net/maintain/). It is also available on Android through [this Play Store link](https://play.google.com/store/apps/details?id=be.android.hcpl.toerke).

There is no data stored there either. All data is available only in your browser cache. Clearing your browser cache also deletes your data.

You can export the data and import it again to keep it yourself. Do this regularly to always retain a copy of the latest version. The advantage of this implementation is that we do not need login credentials or centralized data storage.

## Usage

### Text and translations

The web interface is available in Dutch, English, and French. English is the default language; you can change the language in the header.

### Creating and managing vehicles

Create a vehicle first. Select it in the sidebar and add maintenance. The last selected view (the general dashboard or a vehicle) is remembered in the browser and restored after a refresh. If the last selected vehicle no longer exists, the first available vehicle is selected. The view and vehicle selection are not included in the JSON backup.

Use the menu button beside the logo to collapse or expand the sidebar. In the collapsed sidebar, vehicle buttons remain visible with initials; hover over a button to see the full name.

The chart uses the exact date and mileage of each registration and uses round increments of at least 100 km on the mileage axis; the table is sorted by date, newest first. For multiple registrations on the same date, the most recently created registration is considered the latest. Mileage values do not need to increase, so a replaced odometer can also be recorded. Costs are optional and are displayed in euros.

In the **Average consumption and energy cost** box, you can enter the average consumption and fuel price per liter or electricity price per kWh for each vehicle. Changes are saved automatically while you type. The energy cost per 100 km is calculated as soon as both values are entered. It is included, together with maintenance costs, in the total cost per kilometer.

Deleting a vehicle also permanently removes all associated maintenance history, vehicle notes, and scheduled work.

### Notes

For each vehicle, you can add separate notes in the sticky-note grid between the chart and the history. Use the three-dot menu on a note to edit or delete it or mark it as important. The marking can be removed through the same menu and is included in exports. These notes are separate from the notes in maintenance registrations.

Web addresses starting with `http://` or `https://` are clickable in notes and maintenance descriptions. They open in a new tab or window, depending on your browser settings.

### General dashboard

In the sidebar, select **Dashboard** to see statistics and important notes for active vehicles. Mileage progress is shown for each vehicle on a card in a grid. With two or more registrations on different dates, a chart of the recorded mileage up to today appears in the background; horizontal distances follow time, and the scale is specific to each vehicle. A card or note can be used to open the corresponding vehicle. The yearly average uses the distance between the first and last registration up to today, converted using 365.25 days per year. If the odometer decreases or there are registrations on only one date, no average is calculated.

The average cost per calendar year is the sum of the specified costs up to today, divided by the number of calendar years with registrations for that vehicle. Years without registrations do not count; the current year counts once a registration exists. Cost per kilometer is the sum of the specified costs up to today, divided by the distance between the first and last mileage registration. Future registrations and missing costs are not included. If no costs are specified, no average is shown. If the odometer decreases, the distance is zero, or there are insufficient mileage registrations, no cost per kilometer is shown.

### Archive

Choose **Archive** on a vehicle page when you no longer want to actively track the vehicle. It will then appear separately under **Archive** in the sidebar; select it there to view its history or choose **Restore** to make it active again. All registrations, notes, and scheduled work are retained and included in exports. Archived vehicles and their data are not included in the general dashboard, including important notes and planning. After restoration, their scheduled work appears again.

### Scheduled work

Under **Scheduled work** on the vehicle page, set a date, mileage, or both. The dashboard shows scheduled work for active vehicles, with reached and approaching work at the top. Work approaches within 30 days or 1,000 km; the **Attention needed** counter counts only approaching and reached work. The first reached threshold counts. Mileage is the most recently recorded reading up to today, not a prediction of the current reading. Without a mileage registration, a mileage threshold cannot be assessed; this work is shown separately and is not counted as approaching. These are not automatic notifications or maintenance advice; open the app to view them. After **Completed**, the work disappears from the plan; if desired, create a separate maintenance registration and plan the next service.

## Optional local installation

If you do not want to use the online version, you can also check out this project and run it locally with Node.js. Everything related to storage remains the same.

Requires: Node.js 20 or newer.

```sh
npm install
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). For automatic restarts during development, use `npm run dev`. If desired, set the `PORT` environment variable to use another port.

## Storage and JSON files

The app automatically saves changes in local storage for **the current browser and current address**. The data is not stored on the Node.js server and is not automatically written to a file. A different browser, computer, or port has separate storage. Clearing browser data or using a private window may delete this data.

- Choose **Create backup** to save all vehicles, maintenance records, vehicle notes, and scheduled work as a backup file. The file name contains the local date and time to the second, for example `garageboek-2026-11-21_09-42-49.json`. Download it again after changes; an earlier downloaded file is not updated automatically. Backups created in the same second receive the same suggested name; your browser may change it.
- Choose **Open file** to open a previously downloaded Garageboek file. After validation, the confirmation shows the number of vehicles and the total number of records in the current session and in the file. Records include maintenance registrations, notes, and scheduled work; archived vehicles count too. Choose **Replace** to replace the current data or **Merge** to add data. Both options automatically start a download of the current data as a backup. Check whether your browser allows the download and saved the file. Invalid files and cancelled imports do not change existing data and do not start a backup.
- When merging, vehicles are recognized by the exact same non-empty license plate, or, if both have no license plate, by the exact same name, make, and model. Maintenance is recognized per vehicle by date, mileage, and title; notes and scheduled work by title. Capitalization and punctuation must match. For matches, the longest value is kept in each text field; when text lengths are equal and for all other data (such as costs, dates, archive status, and important markers), the current value is retained, even if it is empty. Multiple possible matches are rejected. Review the data after merging; different records with the same identifying details may be interpreted as a single record.
- To use data on another computer: download the latest version, copy the file, and upload it there. Changes on different computers are not synchronized automatically.
- The notification that data is stored only in this browser can be dismissed. The dismissal choice is remembered locally, and the notification reappears when you add a vehicle to an empty garage or open a backup file.

New files have version `6` and contain `vehicles`, `maintenance`, `notes`, and `reminders`. Vehicles also include drivetrain, average consumption, and energy price; older files and browser data from versions `1` through `5` remain readable and receive empty default values for these fields. Vehicles from versions `1` through `4` are active by default. Older app versions cannot read version `6`. Reload any other open tabs after an update. Only files in this Garageboek format are supported. Browser storage may be rejected due to browser settings or storage limits; the app reports this if saving or importing fails.

## Translations

The text is stored in [`public/translations/`](public/translations/), with short English keys that are identical in every language. HTML uses `data-i18n` attributes for static text; JavaScript uses the shared helper in [`public/i18n.js`](public/i18n.js), for example `appText('dashboard')`. Placeholders such as `{summary}` are filled by the helper. Change translations in the locale files without changing the keys.

## Tests

```sh
npm test
```

## Security

The application listens only on `127.0.0.1` and has no user accounts or access control. It is intended for local, trusted use. Anyone with access to browser storage or an exported file can read the data. Do not expose the app directly to a network or the internet without appropriate security.
