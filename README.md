# Vault

Vault is a self-hosted file browser and storage server. It supports Windows, macOS, and Linux and provides authenticated, per-user file storage, uploads, previews, sharing, archive operations, and transfer and disk metrics.

Vault does not impose a per-file upload size limit. Actual maximums depend on available storage, the filesystem, and any reverse proxy. The Upload panel has a **Use chunked uploads for files over 90 MB** option, enabled by default. It sends large files in 8 MiB chunks (up to three at once), which is recommended behind reverse proxies. The choice is saved in the browser. Turn it off to send each file as one request; servers or proxies may reject large single requests.

Folder cards show the total size of regular files in that folder and its subfolders. Hidden `.vault-tmp` workspaces and symbolic links are excluded from the calculation.

Click or tap a file or folder once to open it. Use Ctrl/Cmd-click to select items, then Shift-click to select a range; on touch devices, use the always-visible card checkmarks. **Select all** selects the visible items. Press Ctrl/Cmd+C to copy selected files and folders, navigate to the destination, then press Ctrl/Cmd+V to paste them. Existing names are kept when available; collisions are named `Copy - <name>`, with numbered prefixes for further collisions. Folder copies include nested files and empty folders but omit hidden `.vault-tmp` workspaces. Choose **Download selected** to start a separate, original-file download for each selected item. Files inside selected folders are included and downloaded individually (folder structure is not preserved). If the browser asks, allow multiple automatic downloads for Vault; if only one starts, enable that permission in the browser's site settings. Very large selections are limited to 5,000 files.

Use **Expand** in the Files panel heading for the full-screen explorer view. Vault remembers that expanded/collapsed choice in the browser.

## Requirements

- Node.js 18.15 or newer (Node.js 22.7 or newer for JAR decompilation)
- npm
- A modern browser
- Optional: 7-Zip for extracting archive formats other than ZIP

Open a `.jar` file and choose **Decompile** to browse its contents with generated Java source files alongside the originals. JAR decompilation runs on the Vault server, does not require Java or 7-Zip, and requires Node.js 22.7 or newer. Each JAR is limited to 2,000 class files and 128 MB of class data.

Closing a decompiled workspace returns to the original folder but keeps its generated files cached for the same unchanged JAR. Choosing **Decompile** again reopens that workspace without reprocessing the JAR; it is removed after two hours of inactivity. Vault never runs JAR code: it reads the archive as ZIP data and analyzes `.class` files using the JavaScript CFR decompiler in an isolated, memory-limited worker.

Source files are shown with language-aware syntax highlighting where supported. The highlighter and language definitions are served locally; if a language definition is unavailable, the file remains readable as plain text.

## Install

Clone the repository and install its dependencies:

```sh
git clone https://github.com/Unblonded/vault.git
cd vault
npm install
```

On Windows, run these commands in PowerShell, Command Prompt, or a terminal with Git and Node.js available.

## Configure accounts

Create a `login.js` file in the project root, beside `server.js`:

```js
module.exports = {
  USERS: [
    { USERNAME: 'alice', PASSWORD: 'replace-with-a-strong-password' },
  ],
};
```

Add one entry per account. Usernames may contain letters, numbers, underscores, and hyphens. Keep passwords private. `login.js` is excluded from Git and must not be placed in the public folder.

## Start the server

```sh
node server.js
```

Open [http://localhost:5500](http://localhost:5500) and sign in with an account configured above. The server listens on all network interfaces by default, so another device on the same network can connect using the host computer's LAN IP address, for example `http://192.168.1.50:5500`. Allow Node.js through the host firewall if needed.

To listen only on the local computer, set `HOST` before starting:

```powershell
$env:HOST = '127.0.0.1'
node server.js
```

```sh
HOST=127.0.0.1 node server.js
```

## Storage location

By default, files are stored in a `storage` folder beside `server.js`. For compatibility, Windows installations with an existing `D:\cloudbox` directory continue to use that location. Set `STORAGE_DIR` to choose another path:

```powershell
$env:STORAGE_DIR = 'D:\cloudbox'
node server.js
```

```sh
STORAGE_DIR=/srv/vault node server.js
```

The server creates the configured storage directory and separate folders for each account. Back up this storage directory along with the project `data` directory; `data` contains the authentication signing key and persisted share links. Do not commit or share either directory.

## Archive support

ZIP creation, extraction, and temporary archive browsing are built in. Operations on RAR, 7z, TAR, and other supported formats require 7-Zip on the server. Vault looks for `7z.exe` on Windows and `7z` or `7zz` on macOS/Linux.

If it is not on `PATH`, set `SEVEN_ZIP_PATH`:

```powershell
$env:SEVEN_ZIP_PATH = 'C:\Program Files\7-Zip\7z.exe'
node server.js
```

```sh
SEVEN_ZIP_PATH=/opt/homebrew/bin/7zz node server.js
```

Archive contents are validated before extraction. Opening an archive creates a temporary workspace; edits there do not change the original archive and are discarded when the workspace is closed or has been idle for two hours. Move files out of the workspace to keep them.

## Disk metrics

Storage capacity is measured on the filesystem containing the configured storage directory. Disk busy percentage is available on Windows and Linux. macOS reports read/write throughput when available, but does not expose the same busy-time percentage through this implementation.

## Security and configuration

- Keep `login.js`, `data/`, and stored files private and backed up securely.
- Use strong, unique account passwords.
- The server uses HTTP by default. For access beyond a trusted local network, put it behind a properly configured HTTPS reverse proxy and protect network access with your firewall.
- Optional server settings: `STORAGE_DIR`, `HOST`, `SEVEN_ZIP_PATH`, and `NODE_ENV`.

See [CONFIGURATION.md](./CONFIGURATION.md) for additional account and archive configuration details.
