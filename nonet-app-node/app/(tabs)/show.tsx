import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWallet } from "@/contexts/WalletContext";
import { useBle } from "@/contexts/BleContext";
import DynamicBackground from "@/components/DynamicBackground";

// --- Theme Constants ---
const THEME = {
  bg: "#0F172A",
  glassBg: "rgba(255, 255, 255, 0.08)",
  glassBorder: "rgba(255, 255, 255, 0.2)",
  primary: "#79D93E",
  secondary: "#8B5CF6",
  success: "#10B981",
  danger: "#EF4444",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
};

interface UserProfile {
  realUpiId: string;
  hopHandle: string;
  phoneNumber?: string;
  name?: string;
}

export default function SettingsDashboard(): React.JSX.Element {
  const { userWalletAddress, logout } = useWallet();
  const bleContext = useBle() as any;
  const isRelayEnabled = bleContext.isRelayEnabled ?? true;
  const setIsRelayEnabled = bleContext.setIsRelayEnabled;
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const p = await AsyncStorage.getItem("@user_profile");
      if (p) {
        setProfile(JSON.parse(p));
      } else {
        // Fallback for demo
        setProfile({
          hopHandle: "user@hoppay",
          realUpiId: "user@okhdfc"
        });
      }
    } catch {}
  };

  const handleMenuPress = (route: any) => {
    router.push(route);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Dynamic drifting background */}
      <DynamicBackground />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* User Profile Glass Card */}
        <BlurView intensity={70} tint="dark" style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{profile?.hopHandle?.charAt(0).toUpperCase() || "H"}</Text>
          </View>
          
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{profile?.name || "Ravi Kumar"}</Text>
            <Text style={styles.userHandle}>{profile?.hopHandle || "ravi@hoppay"}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.profileDetailRow}>
            <Feather name="at-sign" size={14} color={THEME.textMuted} />
            <Text style={styles.profileDetailText}>UPI: {profile?.realUpiId || "ravikumar@okhdfcbank"}</Text>
          </View>
          <View style={styles.profileDetailRow}>
            <Feather name="phone" size={14} color={THEME.textMuted} />
            <Text style={styles.profileDetailText}>{profile?.phoneNumber || "+91 98765 43210"}</Text>
          </View>
        </BlurView>

        {/* Network Section */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionLabel}>NETWORK PARTICIPATION</Text>
          <Text style={[styles.profileDetailText, { marginLeft: 8, marginBottom: 12, marginRight: 8, fontSize: 13, lineHeight: 18 }]}>Toggle your device's role as a packet transferrer in the BLE mesh network. Turning this off saves battery but reduces network resilience.</Text>
          
          <BlurView intensity={50} tint="dark" style={styles.menuCard}>
            <View style={styles.menuRow}>
              <View style={[styles.menuIconBox, { backgroundColor: isRelayEnabled ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)" }]}>
                <Feather name="radio" size={20} color={isRelayEnabled ? THEME.success : THEME.danger} />
              </View>
              <Text style={styles.menuLabel}>Relay Node Active</Text>
              <Switch 
                value={isRelayEnabled} 
                onValueChange={(val) => setIsRelayEnabled && setIsRelayEnabled(val)}
                trackColor={{ false: "#333", true: THEME.success }}
                ios_backgroundColor="#333"
              />
            </View>
          </BlurView>
        </View>

        {/* Menu Section */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionLabel}>PREFERENCES</Text>
          
          <BlurView intensity={50} tint="dark" style={styles.menuCard}>
            
            {/* Account Details */}
            <TouchableOpacity style={styles.menuRow} onPress={() => handleMenuPress("/settings/account")}>
              <View style={[styles.menuIconBox, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
                <Feather name="user" size={20} color={THEME.primary} />
              </View>
              <Text style={styles.menuLabel}>Account Details</Text>
              <Feather name="chevron-right" size={20} color={THEME.textMuted} />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            {/* Display QR Option */}
            <TouchableOpacity style={styles.menuRow} onPress={() => handleMenuPress("/receive")}>
              <View style={[styles.menuIconBox, { backgroundColor: "rgba(139, 92, 246, 0.15)" }]}>
                <Feather name="maximize" size={20} color={THEME.secondary} />
              </View>
              <Text style={styles.menuLabel}>Display QR</Text>
              <Feather name="chevron-right" size={20} color={THEME.textMuted} />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            {/* Notifications */}
            <TouchableOpacity style={styles.menuRow} onPress={() => handleMenuPress("/settings/notifications")}>
              <View style={[styles.menuIconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                <Feather name="bell" size={20} color={THEME.success} />
              </View>
              <Text style={styles.menuLabel}>Notifications Settings</Text>
              <Feather name="chevron-right" size={20} color={THEME.textMuted} />
            </TouchableOpacity>

          </BlurView>
        </View>

        {/* System Section */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionLabel}>SYSTEM & SECURITY</Text>
          
          <BlurView intensity={50} tint="dark" style={styles.menuCard}>
            
            {/* Privacy & Security */}
            <TouchableOpacity style={styles.menuRow} onPress={() => handleMenuPress("/settings/privacy")}>
              <View style={[styles.menuIconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                <Feather name="lock" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.menuLabel}>Privacy & Security</Text>
              <Feather name="chevron-right" size={20} color={THEME.textMuted} />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            {/* About HopPay */}
            <TouchableOpacity style={styles.menuRow} onPress={() => handleMenuPress("/settings/about")}>
              <View style={[styles.menuIconBox, { backgroundColor: "rgba(255, 255, 255, 0.1)" }]}>
                <Feather name="info" size={20} color="#FFF" />
              </View>
              <Text style={styles.menuLabel}>About HopPay</Text>
              <Feather name="chevron-right" size={20} color={THEME.textMuted} />
            </TouchableOpacity>

          </BlurView>
        </View>

        {/* Danger Zone */}
        <View style={styles.menuSection}>
          <Text style={[styles.sectionLabel, { color: THEME.danger }]}>DANGER ZONE</Text>
          
          <BlurView intensity={50} tint="dark" style={[styles.menuCard, { borderColor: "rgba(239,68,68,0.3)" }]}>
            
            {/* Log Out */}
            <TouchableOpacity style={styles.menuRow} onPress={() => {
              Alert.alert("Log Out", "Are you sure you want to end your session?", [
                { text: "Cancel", style: "cancel" },
                { text: "Log Out", style: "destructive", onPress: async () => {
                   await AsyncStorage.removeItem("@user_profile");
                   await logout();
                   router.replace("/");
                }}
              ]);
            }}>
              <View style={[styles.menuIconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                <Feather name="log-out" size={20} color="#F59E0B" />
              </View>
              <Text style={[styles.menuLabel, { color: "#F59E0B" }]}>Log Out</Text>
              <Feather name="chevron-right" size={20} color="#F59E0B" />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            {/* Delete Account */}
            <TouchableOpacity style={styles.menuRow} onPress={() => handleMenuPress("/settings/delete-account")}>
              <View style={[styles.menuIconBox, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                <Feather name="trash-2" size={20} color={THEME.danger} />
              </View>
              <Text style={[styles.menuLabel, { color: THEME.danger }]}>Delete Account</Text>
              <Feather name="chevron-right" size={20} color={THEME.danger} />
            </TouchableOpacity>

          </BlurView>
        </View>

        <Text style={styles.versionText}>Hop Pay Offline v1.0.0 (Hackathon)</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 120, // Clear the bottom tab space
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: THEME.text,
    letterSpacing: 1,
  },
  profileCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: THEME.glassBg,
    borderColor: THEME.glassBorder,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    marginBottom: 32,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFF",
  },
  profileInfo: {
    alignItems: "center",
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: THEME.text,
    marginBottom: 4,
    textAlign: "center",
  },
  userHandle: {
    fontSize: 16,
    fontWeight: "600",
    color: THEME.primary,
    textAlign: "center",
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: THEME.glassBorder,
    marginVertical: 20,
  },
  profileDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  profileDetailText: {
    fontSize: 14,
    fontWeight: "500",
    color: THEME.textMuted,
    marginLeft: 12,
    fontFamily: "monospace",
  },
  menuSection: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.textMuted,
    letterSpacing: 2,
    marginBottom: 12,
    marginLeft: 8,
  },
  menuCard: {
    borderRadius: 20,
    backgroundColor: THEME.glassBg,
    borderColor: THEME.glassBorder,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: THEME.text,
  },
  rowDivider: {
    height: 1,
    backgroundColor: THEME.glassBorder,
    marginLeft: 72, // Align with text
  },
  versionText: {
    textAlign: "center",
    color: THEME.textMuted,
    fontSize: 12,
    marginTop: 20,
    fontFamily: "monospace",
  }
});
