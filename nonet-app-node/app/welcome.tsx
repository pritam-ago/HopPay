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
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useWallet } from "@/contexts/WalletContext";
import { useCameraPermissions } from "expo-camera";
import { requestBluetoothPermissions } from "@/utils/permissions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

const THEME = {
  bg: "#050C07",          // Deep dark green
  inputBg: "#0F1A12",     // Dark box for inputs
  border: "#172A1B",      // Input border
  primary: "#79D93E",     // Cashpay Lime green
  primaryDark: "#132515", // Dark action button bg
  text: "#FFFFFF",
  textMuted: "#6B8573",   // Muted green-grey
};

const generateMockSeedPhrase = () => {
  const words = ["abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid"];
  const seed = [];
  for (let i = 0; i < 12; i++) seed.push(words[Math.floor(Math.random() * words.length)]);
  return seed.join(" ");
};

// The Top Logo shared across form steps
const FormHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
  <View style={styles.formHeaderBlock}>
    <View style={styles.miniLogoWrap}>
      <Feather name="dollar-sign" size={20} color={THEME.bg} style={{ textAlign: "center", top: -2 }} />
    </View>
    <Text style={styles.formMiniTitle}>HopPay</Text>
    <Text style={styles.formMainTitle}>{title}</Text>
    <Text style={styles.formSubtitle}>{subtitle}</Text>
  </View>
);

const InputField = ({ icon, placeholder, value, onChangeText, keyboardType = "default", maxLength, secureTextEntry }: any) => (
  <View style={styles.inputContainer}>
    <Feather name={icon} size={18} color={THEME.textMuted} style={styles.inputIcon} />
    <TextInput
      style={styles.inputText}
      placeholder={placeholder}
      placeholderTextColor={THEME.textMuted}
      keyboardType={keyboardType}
      maxLength={maxLength}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
    />
  </View>
);

export default function WelcomePage(): React.JSX.Element {
  const { isLoggedIn, createWallet } = useWallet();
  const [, requestCameraPermission] = useCameraPermissions();

  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5>(0); // 0 is Intro
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

  const handleDobChange = (text: string) => {
    let cleaned = text.replace(/\D/g, "");
    if (cleaned.length >= 5) {
      cleaned = cleaned.slice(0, 2) + "/" + cleaned.slice(2, 4) + "/" + cleaned.slice(4, 8);
    } else if (cleaned.length >= 3) {
      cleaned = cleaned.slice(0, 2) + "/" + cleaned.slice(2);
    }
    setDob(cleaned);
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

  const renderIntro = () => (
    <View style={styles.introContainer}>
      <View style={styles.illustrationWrap}>
        <View style={styles.illCenter}>
          <Feather name="refresh-ccw" size={60} color={THEME.primary} />
          <View style={styles.illPhoneLeft}>
            <Feather name="smartphone" size={30} color={THEME.textMuted} />
          </View>
          <View style={styles.illPhoneRight}>
            <Feather name="smartphone" size={30} color={THEME.textMuted} />
          </View>
        </View>
      </View>

      <Text style={styles.introTitle}>Welcome to HopPay</Text>
      <Text style={styles.introSubtitle}>Smarter way to Send money anytime,{"\n"}anywhere strictly offline.</Text>

      <View style={styles.pageIndicatorContainer}>
        <View style={styles.pageDotActive} />
        <View style={styles.pageDotInactive} />
        <View style={styles.pageDotInactive} />
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => Alert.alert("Coming Soon", "Wallet restoration from seed phrase is under development.")}>
          <Text style={styles.secondaryButtonText}>Restore Wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(1)}>
          <Text style={styles.primaryButtonText}>Create New Account</Text>
        </TouchableOpacity>

        <View style={styles.bottomTextRow}>
          <Text style={styles.bottomTextNormal}>New user here? </Text>
          <Text style={styles.bottomTextHighlight}>Sign up</Text>
        </View>
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.formContainer}>
      <FormHeader title="Sign in to your account" subtitle="Welcome back! Please enter your phone number to get started." />

      <View style={styles.inputsBlock}>
        <InputField icon="phone" placeholder="eg. 9841234567" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handlePhoneSubmit}>
        <Text style={styles.primaryButtonText}>Send OTP</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.formContainer}>
      <FormHeader title="Verify your number" subtitle="Enter exactly 1234 to clear this simulation." />

      <View style={styles.inputsBlock}>
        <InputField icon="lock" placeholder="4-digit OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={4} secureTextEntry />
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleOtpSubmit}>
        <Text style={styles.primaryButtonText}>Verify & Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.formContainer}>
      <FormHeader title="About You" subtitle="Help us identify you on the mesh network." />

      <View style={styles.inputsBlock}>
        <InputField icon="user" placeholder="Full Name (e.g. Ravi Kumar)" value={name} onChangeText={setName} />
        <InputField icon="calendar" placeholder="Date of Birth (DD/MM/YYYY)" value={dob} onChangeText={handleDobChange} keyboardType="number-pad" maxLength={10} />
        <InputField icon="users" placeholder="Gender (Male / Female)" value={gender} onChangeText={setGender} />
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handlePersonalInfoSubmit}>
        <Text style={styles.primaryButtonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.formContainer}>
      <FormHeader title="Link Your Details" subtitle="Decentro uses this to settle funds directly offline." />

      <View style={styles.inputsBlock}>
        <InputField icon="briefcase" placeholder="Real Bank UPI ID (name@icici)" value={realUpiId} onChangeText={setRealUpiId} />

        <View style={[styles.inputContainer, { paddingRight: 0 }]}>
          <Feather name="at-sign" size={18} color={THEME.textMuted} style={styles.inputIcon} />
          <TextInput style={[styles.inputText, { flex: 1 }]} placeholder="Choose a Handle" placeholderTextColor={THEME.textMuted} autoCapitalize="none" value={hopHandle} onChangeText={setHopHandle} />
          <View style={styles.handleSuffix}><Text style={styles.handleSuffixText}>@hoppay</Text></View>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleUpiSubmit}>
        <Text style={styles.primaryButtonText}>Link & Secure</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.formContainer}>
      <FormHeader title="Secure Your Wallet" subtitle="Write down this 12-word seed phrase to recover your funds." />

      <View style={styles.seedBox}>
        <Text style={styles.seedText}>{seedPhrase}</Text>
      </View>

      <TouchableOpacity style={[styles.primaryButton, isCreating && { opacity: 0.7 }]} onPress={finalizeWallet} disabled={isCreating}>
        {isCreating ? <ActivityIndicator color={THEME.bg} /> : <Text style={styles.primaryButtonText}>I've Saved It - Generate Wallet</Text>}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Background purely matching the provided mockup */}
      <View style={styles.backgroundWrapper} pointerEvents="none">
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: THEME.bg }} />
        <LinearGradient
          colors={["#113117", THEME.bg, THEME.bg]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        {step === 0 && renderIntro()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  backgroundWrapper: { ...StyleSheet.absoluteFillObject, zIndex: -1 },
  keyboardView: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },

  // INTRO Styles
  introContainer: { width: "100%", flex: 1, justifyContent: "flex-end", paddingBottom: 20 },
  illustrationWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  illCenter: { position: "relative", justifyContent: "center", alignItems: "center", width: 220, height: 220, borderRadius: 110, backgroundColor: THEME.primaryDark, borderWidth: 1, borderColor: THEME.border },
  illPhoneLeft: { position: "absolute", left: 10, top: 40, transform: [{ rotate: "-15deg" }] },
  illPhoneRight: { position: "absolute", right: 10, bottom: 40, transform: [{ rotate: "15deg" }] },

  introTitle: { fontSize: 26, fontWeight: "900", color: THEME.text, textAlign: "center", marginBottom: 12 },
  introSubtitle: { fontSize: 13, color: THEME.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 30 },

  pageIndicatorContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 32 },
  pageDotActive: { width: 20, height: 6, borderRadius: 3, backgroundColor: THEME.primary, marginHorizontal: 4 },
  pageDotInactive: { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.border, marginHorizontal: 4 },

  actionsContainer: { width: "100%", gap: 16 },
  secondaryButton: { backgroundColor: THEME.primaryDark, borderRadius: 12, paddingVertical: 18, alignItems: "center", borderWidth: 1, borderColor: THEME.border },
  secondaryButtonText: { color: THEME.primary, fontSize: 15, fontWeight: "700" },

  bottomTextRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 12 },
  bottomTextNormal: { color: THEME.textMuted, fontSize: 12, fontWeight: "500" },
  bottomTextHighlight: { color: THEME.primary, fontSize: 12, fontWeight: "700" },

  // FORM Styles
  formContainer: { width: "100%" },
  formHeaderBlock: { alignItems: "center", marginBottom: 32 },
  miniLogoWrap: { backgroundColor: THEME.primary, width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 8, transform: [{ rotate: "-4deg" }] },
  formMiniTitle: { color: THEME.primary, fontSize: 22, fontWeight: "900", marginBottom: 16, letterSpacing: -0.5 },
  formMainTitle: { color: THEME.text, fontSize: 24, fontWeight: "700", marginBottom: 8 },
  formSubtitle: { color: THEME.textMuted, fontSize: 13, textAlign: "center", paddingHorizontal: 20 },

  inputsBlock: { gap: 16, marginBottom: 24 },
  inputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.inputBg, borderColor: THEME.border, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, height: 56 },
  inputIcon: { marginRight: 12 },
  inputText: { flex: 1, color: THEME.text, fontSize: 15, fontWeight: "500" },

  handleSuffix: { paddingHorizontal: 16, borderLeftWidth: 1.5, borderColor: THEME.border, height: "100%", justifyContent: "center", alignItems: "center" },
  handleSuffixText: { color: THEME.primary, fontWeight: "700", fontSize: 13 },

  seedBox: { backgroundColor: THEME.inputBg, borderColor: THEME.border, borderWidth: 1.5, borderRadius: 14, padding: 24, marginBottom: 24, alignItems: "center" },
  seedText: { color: THEME.primary, fontSize: 18, lineHeight: 32, textAlign: "center", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", letterSpacing: 1 },

  primaryButton: { backgroundColor: THEME.primary, borderRadius: 12, paddingVertical: 18, alignItems: "center" },
  primaryButtonText: { color: THEME.bg, fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
});
