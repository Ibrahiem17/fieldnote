BABY: Phase 2 — Camera, Image Compression, Thumbnails, and GPS (beginner-friendly)

This file explains, line-by-line and concept-by-concept, the new helper code added for Phase 2 that deals with photos and location. It is written for someone who has never seen these APIs before.

What it is
- takePhotoAndCompress(inspectionId, fieldKey): opens the phone's camera (using the system camera UI), compresses the photo to a sensible size, writes a thumbnail, and returns metadata.
- getLocationWithTimeout(timeoutMs): requests a location fix with a timeout and returns {latitude, longitude, accuracy} or a small error object.
- Signature capture: currently a placeholder that creates an attachment row containing a PNG representing the user's signature. A full implementation would present a signature pad UI, capture the drawing as an image, compress it like photos, and store it alongside other attachments.

Why we need it
- A raw phone camera image is very large (4–12 MB). Storing so many images will quickly exhaust device storage and make uploads slow.
- Compressing images reduces size (target ~300 KB) and generates small thumbnails for fast lists.
- GPS fixes can be slow or unavailable indoors. We must request the permission and use a timeout so the UI doesn't hang.

Where the code lives
- src/lib/media.ts — the helper functions that interact with expo-image-picker, expo-image-manipulator, expo-file-system, and expo-location.
- src/components/FormRenderer.tsx — the form UI calls the helpers to capture photos and location; it also handles fallbacks when native packages are not available (web preview).

Syntax and concepts (explained simply)
- dynamic import (import("expo-image-picker")):
  - This is a JavaScript feature that loads a module only when we need it.
  - Why here: the web preview or CI may not have native expo packages installed. Dynamic import prevents the whole app from failing on import-time.

- async / await:
  - These lines tell JavaScript to wait for something that happens later (a Promise). Example:
    const res = await ImagePicker.launchCameraAsync();
  - The code pauses at this line until the camera UI returns a result.

- try / catch:
  - Used to handle errors, including the case where the native package is not installed. If an error happens the code "catches" it and prints a warning instead of crashing.

- File paths and documentDirectory:
  - Files are written into FileSystem.documentDirectory + 'attachments/{inspectionId}/'. This keeps attachments private to the app and persistent across launches.

- Compression and thumbnails:
  - We resize the long edge to 1600px and compress the JPEG to ~0.7 quality for the main photo.
  - We also generate a 200px-wide thumbnail for quick lists.

- Permission handling:
  - If the user denies camera or location permission, we show an Alert with a button that opens the phone's Settings so they can re-enable it.

Use it yourself (in other projects)
1. Add runtime checks and dynamic imports when you depend on optional native modules.
2. Keep file paths outside the database (store only file URIs in SQLite). Databases blow up if you embed base64 blobs.
3. Always compress photos you plan to upload from mobile devices.

Testing tips
- On a real phone (not just emulator), take photos and verify the saved file sizes under ~300 KB.
- Verify thumbnails exist under attachments/{inspectionId}/thumbs/.
- Test denying permissions and confirm the app shows a friendly message and a Settings button.

This is a summary for beginners; for the phase's teaching-contract level explanation, see BABY.md's main sections where these new symbols are referenced. Additions to that file were kept minimal to avoid a massive single-file edit in this session.