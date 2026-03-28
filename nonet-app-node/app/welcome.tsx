import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useWallet } from "@/contexts/WalletContext";
import { useCameraPermissions } from "expo-camera";
import { requestBluetoothPermissions } from "@/utils/permissions";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME = {
  bg: "#0F172A",
  glassBg: "rgba(255, 255, 255, 0.05)",
  glassBorder: "rgba(255, 255, 255, 0.1)",
  primary: "#3B82F6",
  secondary: "#8B5CF6",
  success: "#10B981",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
};

const generateMockSeedPhrase = () => {
  const words = ["abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid"];
  const seed = [];
  for (let i = 0; i < 12; i++) seed.push(words[Math.floor(Math.random() * words.length)]);
  return seed.join(" ");
};

export default function WelcomePage(): React.JSX.Element {
  const { isLoggedIn, createWallet } = useWallet();
  const [, requestCameraPermission] = useCameraPermissions();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [realUpiId, setRealUpiId] = useState("");
  const [hopHandle, setHopHandle] = useState("");
  const [seedPhrase, setSeedPhrase] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isLoggedIn) router.replace("/(tabs)");
  }, [isLoggedIn]);

  const handlePhoneSubmit = () => {
    if (phone.length < 10) return Alert.alert("Invalid", "Please enter a valid phone number.");
    setStep(2);
  };

  const handleOtpSubmit = () => {
    if (otp !== "1234") return Alert.alert("Simulated OTP", "Please enter 1234 for the simulation.");
    setStep(3);
  };

  const handlePersonalInfoSubmit = () => {
    if (name.length < 2 || dob.length < 4 || gender.length < 3) {
      return Alert.alert("Invalid", "Please fill out all personal fields.");
    }
    setStep(4);
  };

  const handleUpiSubmit = async () => {
    if (!realUpiId.includes("@") || hopHandle.length < 3) {
      return Alert.alert("Invalid", "Please enter a real UPI ID and a valid @hoppay handle.");
    }

    await AsyncStorage.setItem("@user_profile", JSON.stringify({
      realUpiId,
      hopHandle: `${hopHandle}@hoppay`,
      name,
      dob,
      gender,
      phoneNumber: phone
    }));

    setSeedPhrase(generateMockSeedPhrase());
    setStep(5);
  };

  const finalizeWallet = async () => {
    try {
      setIsCreating(true);
      await requestCameraPermission();
      await requestBluetoothPermissions();
      await createWallet();
    } catch (e) {
      Alert.alert("Error", "Failed to construct wallet. Try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Welcome to Hop Pay</Text>
      <Text style={styles.subtitle}>Enter your phone number to get started.</Text>
      <TextInput
        style={styles.input}
        placeholder="Phone Number (e.g. 9876543210)"
        placeholderTextColor={THEME.textMuted}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TouchableOpacity style={styles.primaryButton} onPress={handlePhoneSubmit}>
        <Text style={styles.primaryButtonText}>Send OTP</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Verify OTP</Text>
      <Text style={styles.subtitle}>Enter 1234 for this simulation.</Text>
      <TextInput
        style={styles.input}
        placeholder="4-digit OTP"
        placeholderTextColor={THEME.textMuted}
        keyboardType="number-pad"
        maxLength={4}
        value={otp}
        onChangeText={setOtp}
        secureTextEntry
      />
      <TouchableOpacity style={styles.primaryButton} onPress={handleOtpSubmit}>
        <Text style={styles.primaryButtonText}>Verify & Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>About You</Text>
      <Text style={styles.subtitle}>Help us identify you on the mesh network.</Text>

      <Text style={styles.label}>Full Name</Text>
      <TextInput style={styles.input} placeholder="e.g. Ravi Kumar" placeholderTextColor={THEME.textMuted} value={name} onChangeText={setName} />

      <Text style={styles.label}>Date of Birth</Text>
      <TextInput style={styles.input} placeholder="DD/MM/YYYY" placeholderTextColor={THEME.textMuted} value={dob} onChangeText={setDob} keyboardType="numbers-and-punctuation" />

      <Text style={styles.label}>Gender</Text>
      <TextInput style={styles.input} placeholder="e.g. Male / Female" placeholderTextColor={THEME.textMuted} value={gender} onChangeText={setGender} />

      <TouchableOpacity style={styles.primaryButton} onPress={handlePersonalInfoSubmit}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Link Your Bank</Text>
      <Text style={styles.subtitle}>Decentro uses this to settle funds directly to your bank account.</Text>

      <Text style={styles.label}>Real Bank UPI ID (Destination)</Text>
      <TextInput style={styles.input} placeholder="e.g. name@icici" placeholderTextColor={THEME.textMuted} autoCapitalize="none" value={realUpiId} onChangeText={setRealUpiId} />

      <Text style={styles.label}>Choose a Hop Pay Handle</Text>
      <View style={styles.handleInputContainer}>
        <TextInput style={[styles.input, { flex: 1, marginBottom: 0, borderRightWidth: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]} placeholder="yourname" placeholderTextColor={THEME.textMuted} autoCapitalize="none" value={hopHandle} onChangeText={setHopHandle} />
        <View style={styles.handleSuffix}><Text style={styles.handleSuffixText}>@hoppay</Text></View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleUpiSubmit}>
        <Text style={styles.primaryButtonText}>Link & Secure</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Secure Your Wallet</Text>
      <Text style={styles.subtitle}>Write down this 12-word seed phrase to recover your funds offline.</Text>
      <View style={styles.seedBox}>
        <Text style={styles.seedText}>{seedPhrase}</Text>
      </View>
      <TouchableOpacity style={[styles.primaryButton, isCreating && { opacity: 0.7 }]} onPress={finalizeWallet} disabled={isCreating}>
        {isCreating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>I've Saved It - Generate Wallet</Text>}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <BlurView intensity={30} tint="dark" style={styles.glassCard}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </BlurView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  keyboardView: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  blob1: { position: "absolute", top: "10%", left: "-20%", width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.primary, opacity: 0.3, transform: [{ scale: 1.5 }] },
  blob2: { position: "absolute", bottom: "10%", right: "-20%", width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.secondary, opacity: 0.3, transform: [{ scale: 1.5 }] },
  glassCard: { width: "100%", borderRadius: 24, padding: 24, backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1, overflow: "hidden" },
  formContainer: { width: "100%" },
  title: { fontSize: 28, fontWeight: "800", color: THEME.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: THEME.textMuted, marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: "700", color: THEME.textMuted, textTransform: "uppercase", marginBottom: 8, letterSpacing: 1 },
  input: { backgroundColor: "rgba(0,0,0,0.3)", borderColor: THEME.glassBorder, borderWidth: 1, borderRadius: 12, padding: 16, color: THEME.text, fontSize: 16, marginBottom: 16 },
  handleInputContainer: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  handleSuffix: { backgroundColor: "rgba(0,0,0,0.5)", borderColor: THEME.glassBorder, borderWidth: 1, borderLeftWidth: 0, borderTopRightRadius: 12, borderBottomRightRadius: 12, padding: 16, justifyContent: "center", height: 56 },
  handleSuffixText: { color: THEME.primary, fontWeight: "800" },
  seedBox: { backgroundColor: "rgba(0,0,0,0.5)", borderColor: THEME.glassBorder, borderWidth: 1, borderRadius: 12, padding: 20, marginBottom: 24 },
  seedText: { color: "#fff", fontSize: 18, lineHeight: 28, textAlign: "center", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", letterSpacing: 1 },
  primaryButton: { backgroundColor: THEME.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
});
