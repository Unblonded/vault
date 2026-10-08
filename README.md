# Vault

Vault is a self-hosted file browser and storage server. It supports Windows, macOS, and Linux and provides authenticated, per-user file storage, uploads, previews, sharing, archive operations, and transfer and disk metrics.

## Requirements

- Node.js 18.15 or newer
- npm
- A modern browser
- Optional: 7-Zip for extracting archive formats other than ZIP

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
