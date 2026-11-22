# Google Play store assets

The English listing text is in [listing-en.txt](listing-en.txt). The 512 × 512
PNG icon and 1024 × 500 JPEG feature graphic are ready for Play Console.
The four 1080 × 2146 JPEG phone screenshots were captured from a separate
Android preview installation on a Pixel 9a using the English sample backup.
The device status and navigation bars were cropped out.
The four 1920 × 1116 JPEG landscape tablet screenshots use the same sample
backup in the Android app on an emulator configured with a 1920 × 1200 display
at 224 dpi (approximately 10 inches). The system bars were cropped out.
The graphic sources can be regenerated on macOS with:

```sh
swift android/store-assets/create-graphics.swift android/store-assets
```

[sample-data.json](sample-data.json) is a fictional Garageboek backup for
demonstration. Import it only into a separate test installation: replacing
data removes existing records, while merging can change existing records.
Use **Open file** and select English to reproduce the sample content.

Garageboek stores data locally and does not provide automatic backups or
maintenance notifications. Check the listing and images against the release
version and current Play Console requirements before publishing.
