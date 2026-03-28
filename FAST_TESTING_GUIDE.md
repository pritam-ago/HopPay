# ⚡ Fast Testing Without Rebuilding APK Every Time

## The Problem
- APK builds take **15+ minutes** via EAS
- Testing small changes requires full rebuild
- BLE functionality requires physical device (won't work in Expo Go)

## The Solution: Development Build + Hot Reload 🚀

---

## 🎯 Recommended Workflow

### **Option 1: Development Build (One-Time Setup)** ⭐ BEST

Build **once**, test **forever** with instant hot reload!

#### **Step 1: Build Development APK (One Time)**
```bash
cd E:\devshouse26\HopPay\nonet-app-node
npx eas build --profile development --platform android
```

**What's Different:**
- ✅ Includes dev tools and debugging
- ✅ Supports **Expo Dev Client** (instant reload)
- ✅ All BLE features work (native modules included)
- ✅ Build once, update code instantly
- ⚡ Changes appear in **1-2 seconds** instead of 15 minutes!

#### **Step 2: Install Development APK on Phone**
Download and install the APK on your test devices (same as before)

#### **Step 3: Start Dev Server on PC**
```bash
cd E:\devshouse26\HopPay\nonet-app-node
npx expo start --dev-client
```

#### **Step 4: Connect Phone to Dev Server**
1. Open the development app on phone
2. Scan QR code shown in terminal
3. OR enter URL manually: `exp://172.16.41.78:8081`

#### **Step 5: Make Changes & See Instantly!** ⚡
- Edit any file in `nonet-app-node/`
- Save the file
- App reloads automatically in **1-2 seconds**
- No rebuild needed! 🎉

---

### **Option 2: Development Build via Local Build (Faster Initial Build)**

If EAS is slow, build locally:

```bash
cd E:\devshouse26\HopPay\nonet-app-node

# Generate native Android project
npx expo prebuild --platform android

# Build development APK locally
npx expo run:android --variant debug
```

This creates a debug APK with hot reload support.

---

### **Option 3: Conditional BLE Mode (Test Without BLE)**

For testing non-BLE features quickly:

#### **Add Mock BLE Mode:**

Create `nonet-app-node/utils/bleConfig.ts`:
```typescript
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Enable mock BLE mode for faster testing
export const MOCK_BLE_MODE = __DEV__ && Platform.OS === 'android';

export const isBleSupported = () => {
  if (MOCK_BLE_MODE) {
    console.log('🔧 MOCK BLE MODE - BLE disabled for faster testing');
    return false;
  }
  return Platform.OS === 'android' || Platform.OS === 'ios';
};
```

Then in `contexts/BleContext.tsx`, use this config:
```typescript
import { isBleSupported } from '../utils/bleConfig';

// In BleProvider component:
useEffect(() => {
  if (!isBleSupported()) {
    console.log('BLE not supported or mock mode - skipping BLE initialization');
    return;
  }
  // ... rest of BLE code
}, []);
```

This lets you test **relayer communication, UI, and transactions** without BLE mesh networking.

---

## 🔥 Hot Reload Workflow Comparison

### **Current Workflow (Production APK):**
```
1. Edit code
2. Build APK (15 minutes) ⏰
3. Download APK
4. Install on phone
5. Test
6. Find bug → Go to step 1 😭
```

### **Development Build Workflow:**
```
1. Build dev APK once (15 minutes) ⏰
2. Install on phone once
3. Start dev server (5 seconds)
4. Edit code
5. Save file → Auto reload (2 seconds) ⚡
6. Test immediately
7. Find bug → Go to step 4 (2 seconds!) 🎉
```

---

## 📋 Feature Testing Matrix

| Feature | Expo Go | Dev Build | Production APK |
|---------|---------|-----------|----------------|
| UI Changes | ✅ Instant | ✅ Instant | ❌ 15min rebuild |
| Logic/Code | ✅ Instant | ✅ Instant | ❌ 15min rebuild |
| BLE Mesh | ❌ No native | ✅ Works | ✅ Works |
| Camera/QR | ✅ Works | ✅ Works | ✅ Works |
| Relayer API | ✅ Works | ✅ Works | ✅ Works |
| Blockchain | ✅ Works | ✅ Works | ✅ Works |
| Hot Reload | ✅ Yes | ✅ Yes | ❌ No |
| Debug Tools | ✅ Yes | ✅ Yes | ⚠️ Limited |

---

## 🎯 Recommended Testing Strategy

### **Phase 1: Rapid Development (Dev Build)**
Use development build for:
- ✅ Testing relayer communication
- ✅ UI/UX improvements
- ✅ Transaction flow debugging
- ✅ QR code scanning
- ✅ BLE functionality testing
- ✅ Debug logging verification

**Rebuild only when:**
- Changing native dependencies (rare)
- Modifying `app.json` or `eas.json`
- Changing native Android configs

### **Phase 2: Final Testing (Production APK)**
Build production APK only for:
- Final end-to-end testing
- Performance verification
- App size optimization
- Release candidate testing

---

## ⚡ Quick Commands Reference

### **Start Development Server:**
```bash
cd E:\devshouse26\HopPay\nonet-app-node
npx expo start --dev-client
```

### **Start with Clear Cache:**
```bash
npx expo start --dev-client --clear
```

### **Start Relayer (Parallel Terminal):**
```bash
cd E:\devshouse26\HopPay\relayer
npm run dev
```

### **View Logs from Phone:**
```bash
# Android
npx react-native log-android

# Or use Metro bundler logs (shown in terminal)
```

### **Build Development APK (One Time):**
```bash
npx eas build --profile development --platform android
```

---

## 🔧 Troubleshooting Hot Reload

### **Changes Not Appearing:**
1. Press `r` in Metro terminal to reload manually
2. Shake phone → "Reload"
3. Clear cache: `npx expo start --dev-client --clear`

### **Can't Connect to Dev Server:**
1. Ensure phone and PC on same WiFi
2. Check PC IP: `ipconfig`
3. Update connection URL in app
4. Check firewall isn't blocking port 8081

### **BLE Not Working in Dev Build:**
- Dev build includes native modules - BLE should work!
- Check Android permissions granted
- Check Bluetooth is enabled
- Try restarting app

---

## 📱 Connection Methods to Dev Server

### **Method 1: QR Code (Easiest)**
```bash
npx expo start --dev-client
```
Scan QR code with dev app

### **Method 2: Manual URL**
Enter in dev app: `exp://172.16.41.78:8081`

### **Method 3: LAN Connection**
Dev app auto-discovers if on same network

---

## 🎯 Optimal Development Setup

### **Terminal 1: Metro Bundler**
```bash
cd E:\devshouse26\HopPay\nonet-app-node
npx expo start --dev-client
```

### **Terminal 2: Relayer**
```bash
cd E:\devshouse26\HopPay\relayer
npm run dev
```

### **Terminal 3: Relayer Logs (Optional)**
```bash
cd E:\devshouse26\HopPay\relayer
tail -f relayer.log
```

### **Phone: Development App**
- Open dev APK
- Connect to Metro bundler
- Test immediately after code changes!

---

## 💡 Pro Tips

### **1. Fast Refresh Features:**
- ⚡ Changes to React components reload instantly
- 🔄 State is preserved during reload
- 🐛 Errors show in-app overlay

### **2. Remote Debugging:**
- Shake phone → "Debug Remote JS"
- Open Chrome DevTools
- Set breakpoints, inspect state

### **3. Network Inspection:**
- Use React Native Debugger
- Monitor all API calls to relayer
- Inspect Redux/Context state (if used)

### **4. Conditional Features:**
```typescript
// Use __DEV__ for development-only code
if (__DEV__) {
  console.log('Development mode - extra logging enabled');
}

// Skip BLE in mock mode for faster testing
if (MOCK_BLE_MODE) {
  // Use direct relayer calls instead of mesh
}
```

---

## 🚀 Example Development Workflow

**Scenario:** You want to change the SMS message format

### **Without Dev Build (❌ Slow):**
1. Edit `relayer/sms.cjs` → 1 min
2. Restart relayer → 10 sec
3. Edit app UI to test → 1 min
4. Build APK → **15 minutes** ⏰
5. Download & install → 2 min
6. Test → 1 min
7. **Total: ~20 minutes per change**

### **With Dev Build (✅ Fast):**
1. Edit `relayer/sms.cjs` → 1 min
2. Restart relayer → 10 sec
3. Edit app UI to test → 1 min
4. Save file → **Auto reload in 2 seconds** ⚡
5. Test immediately → 1 min
6. **Total: ~3 minutes per change**

**Time Saved: 17 minutes per iteration!** 🎉

---

## 📦 When to Build Production APK

Build production APK only when:
- ✅ All features tested in dev build
- ✅ Ready for deployment/demo
- ✅ Need to test app size/performance
- ✅ Final QA before release

**Rule of Thumb:**
- **Dev Build:** Daily development (1 build per day or less)
- **Production APK:** Final testing only (1-2 builds per week)

---

## 🎯 Action Items

### **Immediate (Today):**
1. Build development APK:
   ```bash
   npx eas build --profile development --platform android
   ```

2. Install on both test phones

3. Start dev server:
   ```bash
   npx expo start --dev-client
   ```

4. Connect phone and test hot reload!

### **Ongoing Development:**
- Edit code → Save → Test (2 seconds)
- Only rebuild when changing native configs
- Build production APK for final testing only

---

## ✅ Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Iteration Speed** | 15-20 min | 2-3 min |
| **Builds Per Day** | 4-6 builds | 1 build (reused) |
| **Testing Efficiency** | ❌ Painful | ✅ Enjoyable |
| **BLE Testing** | ✅ Works | ✅ Works |
| **Debug Experience** | ⚠️ Limited | ✅ Full featured |

**You'll save hours of build time and test 10x faster!** 🚀
