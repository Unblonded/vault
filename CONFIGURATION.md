# Vault accounts

Vault supports Windows, macOS, and Linux. Install Node.js 18.15 or newer, then run `npm install` in the project folder before starting the server with `node server.js`. JAR decompilation requires Node.js 22.7 or newer.

Edit `login.js` in the project folder to add or change accounts:

```js
module.exports = {
  USERS: [
    { USERNAME: 'alice', PASSWORD: 'your-password' },
    { USERNAME: 'bob', PASSWORD: 'another-password' },
  ],
};
```

Save the file and restart the server. Keep `login.js` in the project folder, outside `public`; it is loaded by Node and is not served as a public website file.

## Storage location

By default, files are stored in the `storage` folder next to `server.js`. On Windows, an existing `D:\cloudbox` folder is kept as the default so an existing installation continues to use its current files. To use another location, set `STORAGE_DIR` before starting the server:

```powershell
$env:STORAGE_DIR = 'D:\cloudbox'
node server.js
```

```sh
STORAGE_DIR=/srv/vault node server.js
```

Use a path valid for the operating system where Vault is running. The configured directory is created automatically.

## Extracting archive formats

ZIP files can be extracted directly. Extracting RAR, 7z, TAR, and other supported formats requires 7-Zip to be installed on the server and available on `PATH` as `7z.exe`, `7z`, or `7zz`. Vault tries the applicable command names for the server OS.

On macOS, Homebrew can install 7-Zip with `brew install sevenzip`; on Debian/Ubuntu Linux, install `7zip` or `p7zip-full` using the distribution's package manager. Ensure the command is on `PATH`, or set `SEVEN_ZIP_PATH` to its full path before starting the server. Examples:

```powershell
$env:SEVEN_ZIP_PATH = 'C:\Program Files\7-Zip\7z.exe'
node server.js
```

```sh
SEVEN_ZIP_PATH=/opt/homebrew/bin/7zz node server.js
```

Extraction is staged and checked before the contents are placed in a new folder. Archives with unsafe paths, unsupported special files, more than 20,000 entries, or more than 10 GB of expanded data are rejected.

Clicking a supported non-JAR archive in the file browser opens a temporary workspace where its contents can be browsed and operated on. The original archive is unchanged; temporary edits are discarded when the workspace is closed or after two hours without activity. Move files out of the workspace to keep them.

Open a JAR file and choose **Decompile** to create a temporary explorer workspace containing its original contents and generated `.java` files beside the corresponding `.class` files. JARs use ZIP handling and do not require 7-Zip or a Java runtime. Decompilation is performed on the server with a JavaScript CFR port and is limited to 2,000 class files and 128 MB of class data per JAR. The source output is capped at 256 MB; the JAR is not modified or executed. Closing the workspace returns to the original folder but retains the generated workspace for an unchanged JAR. Choosing **Decompile** again reopens it without running the decompiler again. The cached workspace is removed after two hours of inactivity.

Source previews use local, language-aware syntax highlighting when available and fall back to readable plain text for unrecognized formats.

Choose **Download selected** to download selected files individually in their original formats. When folders are selected, their files are included as separate downloads and folder structure is not preserved. Allow multiple automatic downloads for Vault if your browser prompts; if only one file starts, enable that permission in the browser's site settings. A bulk request is limited to 5,000 files.

Disk busy percentage is reported on Windows and Linux. macOS reports read/write throughput when available but does not expose the same busy-time counter through this implementation.
