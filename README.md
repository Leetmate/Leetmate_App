# Leetmate

**A Chrome extension that keeps you accountable on LeetCode with a virtual pet companion.**

Leetmate turns your LeetCode practice into a rewarding experience. A browser pet accompanies you as you code, reminds you to stay consistent, and grows with you—all while you earn coins, customize your pet, and compete with friends.

---

## Overview

Leetmate is a browser extension that integrates with LeetCode to help you build a daily coding habit. Your in-extension pet depends on you: its happiness decays over time if you skip LeetCode, and it thrives when you show up every day. Earn coins through in-app games, spend them on clothes and stat boosts for your pet, and connect with other users to battle, compare progress, and show off your pet’s style.

---

## Features

### 🐾 Virtual Pet Companion
- **Browser pet** that lives in the extension and accompanies you while you browse
- **Reminders** to do LeetCode so you don’t forget your daily practice
- **Happiness system** that decays over time when you don’t do LeetCode—keep your pet happy by staying consistent

### 🪙 Coins & Rewards
- Earn **coins** by playing in-extension games
- Use coins to:
  - **Dress your pet** with clothes and accessories
  - **Boost pet stats** with items
  - **Increase pet happiness** with treats and upgrades

### 👥 Social & Competition
- **Friends**: Add and remove friends who also use Leetmate
- **Battles**: Battle friends or other users in the extension
- **Progress tracking**: See your friends’ LeetCode progress and how their pets are styled
- **Community**: Compete and compare with other Leetmate users

---

## Tech Stack

| Layer        | Technology |
|-------------|------------|
| **Extension** | HTML, CSS, JavaScript (Chrome Extension) |
| **Backend**   | Firebase Firestore (data storage) |
| **Auth**      | Firebase OAuth (Email + Google sign-in) |

---

## Getting Started

### Prerequisites
- [Google Chrome](https://www.google.com/chrome/) (or a Chromium-based browser)
- A Firebase project with Firestore and Authentication (Email + Google) enabled

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/Leetmate_App.git
   cd Leetmate_App
   ```
2. Configure Firebase (e.g. add your config in the extension’s auth/storage setup).
3. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked** and select the extension directory

*(Detailed setup and environment variables will be added as the project is built out.)*

---

## Project Status

Leetmate is in active development. Core features (pet, coins, happiness, auth, Firestore) and social features (friends, battles, progress) are being implemented.

---

## License

This project is currently unlicensed. See repository for details.

---

*Stay consistent. Keep your pet happy. Level up together.* 🚀
