import { Platform, PermissionsAndroid } from "react-native";
import Constants from "expo-constants";

export interface PermissionStatus {
  camera: boolean;
  bluetooth: boolean;
  allGranted: boolean;
}

/**
 * Request Bluetooth permissions (Android only)
 * Shows native permission dialogs directly
 */
export const requestBluetoothPermissions = async (): Promise<boolean> => {
  // Skip if not Android
  if (Platform.OS !== "android") {
    // iOS - Bluetooth permissions are handled automatically
    console.log(
      "📱 iOS detected - Bluetooth permissions handled automatically"
    );
    return true;
  }

  // Skip if running in Expo Go
  const executionEnvironment = Constants.executionEnvironment;
  if (executionEnvironment === "storeClient") {
    console.log(
      "📱 Expo Go detected - Skipping Bluetooth permissions (not available in Expo Go)"
    );
    return true;
  }

  try {
    const androidVersion = Platform.Version as number;

    let bluetoothPermissions: string[] = [];

    if (androidVersion >= 31) {
      // Android 12+ requires new Bluetooth permissions
      bluetoothPermissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ];
    } else {
      // Android 11 and below - These permissions are deprecated but still needed for older devices
      // Casting to any to bypass TypeScript checks for deprecated permissions
      bluetoothPermissions = [
        "android.permission.BLUETOOTH" as any,
        "android.permission.BLUETOOTH_ADMIN" as any,
      ];
    }

    const bluetoothResults = await PermissionsAndroid.requestMultiple(
      bluetoothPermissions as any
    );

    // Check if all Bluetooth permissions were granted
    return Object.values(bluetoothResults).every(
      (result) => result === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (error) {
    console.error("Error requesting Bluetooth permissions:", error);
    return false;
  }
};

/**
 * Check current permission status without requesting
 */
export const checkPermissionStatus = async (): Promise<PermissionStatus> => {
  const results: PermissionStatus = {
    camera: false,
    bluetooth: false,
    allGranted: false,
  };

  try {
    // Check camera permission
    // Note: This function should be called from a React component, not directly
    // For now, we'll skip camera check in status function
    results.camera = false;

    // Check Bluetooth permissions (Android)
    if (Platform.OS === "android") {
      const bluetoothScan = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
      );

      results.bluetooth = bluetoothScan;
    } else {
      results.bluetooth = true; // iOS handles automatically
    }

    results.allGranted = results.camera && results.bluetooth;

    return results;
  } catch (error) {
    console.error("Error checking permission status:", error);
    return results;
  }
};
