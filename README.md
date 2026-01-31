# WERNERPOOL v2

Solo Bitcoin Mining Pool for Umbrel

![WERNERPOOL](images/logo.png)

## Features

- **Full Stratum V1 Protocol Support** - Compatible with all ASIC miners
- **Real-time Dashboard** - Monitor hashrate, workers, and shares
- **Worker Management** - Track individual miner statistics
- **Best Difficulty Scoreboard** - Compete for the highest difficulty shares
- **Network Statistics** - Track difficulty adjustments and block rewards
- **Persistent Storage** - Your mining stats are saved across restarts
- **Dark Mode UI** - Beautiful, modern interface styled in WERNERPOOL brand colors

## Installation on Umbrel

### From Community App Store

1. Go to your Umbrel's App Store settings
2. Add this repository URL: `https://github.com/YOUR_USERNAME/wernerpool`
3. Find WERNERPOOL in the app store and install

### Manual Installation

1. SSH into your Umbrel
2. Clone this repository:
   ```bash
   cd ~/umbrel/app-data
   git clone https://github.com/YOUR_USERNAME/wernerpool.git
   ```
3. Start the app:
   ```bash
   cd ~/umbrel
   ./scripts/app install wernerpool
   ```

## Configuration

### Connecting Your Miners

Configure your ASIC miners with the following settings:

- **Stratum URL:** `stratum+tcp://YOUR_UMBREL_IP:3333`
- **Username:** `YOUR_BTC_ADDRESS.WORKER_NAME`
- **Password:** `x` (or anything)

Example:
```
URL: stratum+tcp://192.168.1.100:3333
User: bc1q...your_address.antminer01
Pass: x
```

## Ports

| Port | Service | Description |
|------|---------|-------------|
| 3333 | Stratum | Mining connection port |
| 3334 | Web UI  | Dashboard access |
| 3335 | API     | Internal API (not exposed) |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     WERNERPOOL v2                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │   Stratum   │    │    API      │    │    UI       │ │
│  │   Server    │───▶│   Server    │◀───│  Dashboard  │ │
│  │  (Port 3333)│    │ (Port 3335) │    │ (Port 3334) │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│         │                  │                            │
│         │                  │                            │
│         ▼                  ▼                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │              SQLite Database                     │   │
│  │         (Persistent stats storage)               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
         │
         │ Bitcoin RPC
         ▼
┌─────────────────────────────────────────────────────────┐
│                 Bitcoin Core Node                        │
│                   (Umbrel Bitcoin)                       │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

- Bitcoin Core (installed via Umbrel)

## Credits

WERNERPOOL v2 is based on:
- [public-pool](https://github.com/benjamin-wilson/public-pool) by Benjamin Wilson
- [public-pool-ui](https://github.com/benjamin-wilson/public-pool-ui) by Benjamin Wilson

Inspired by [BlitzPool](https://blitzpool.yourdevice.ch/)

## License

GPL-3.0 License

## Support

For issues and feature requests, please open an issue on GitHub.

---

**Happy Solo Mining!** ⛏️
