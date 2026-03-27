import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { useBle } from "@/contexts/BleContext";

// --- Theme Constants (Glassmorphism + Dark Mode) ---
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

export default function MeshTrackerPage(): React.JSX.Element {
  const { isBroadcasting, getCurrentBroadcastInfo, masterState, hasInternet } = useBle();
  const currentBroadcast = getCurrentBroadcastInfo();

  // Extract the state of the active broadcast
  const activeState = currentBroadcast?.id ? masterState.get(currentBroadcast.id) : null;
  const isSettled = activeState?.isAck;
  
  // Animation Values
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulseOpacity1 = useRef(new Animated.Value(0.6)).current;
  const pulseOpacity2 = useRef(new Animated.Value(0.4)).current;

  // Mock Hop Counter for visuals
  const [hopCount, setHopCount] = useState(0);

  useEffect(() => {
    let anim1: Animated.CompositeAnimation;
    let anim2: Animated.CompositeAnimation;

    if (isBroadcasting && !isSettled) {
      const createPulse = (scaleVal: Animated.Value, opacityVal: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(scaleVal, {
                toValue: 4,
                duration: 2500,
                useNativeDriver: true,
              }),
              Animated.timing(opacityVal, {
                toValue: 0,
                duration: 2500,
                useNativeDriver: true,
              })
            ]),
            Animated.parallel([
              Animated.timing(scaleVal, { toValue: 1, duration: 0, useNativeDriver: true }),
              Animated.timing(opacityVal, { toValue: 0.6, duration: 0, useNativeDriver: true })
            ])
          ])
        );
      };

      anim1 = createPulse(pulse1, pulseOpacity1, 0);
      anim2 = createPulse(pulse2, pulseOpacity2, 1250);
      anim1.start();
      anim2.start();

      // Mock hop count increment organically over time
      const hopInterval = setInterval(() => {
        setHopCount(prev => prev < 3 ? prev + 1 : prev);
      }, 4000);

      return () => {
        anim1.stop();
        anim2.stop();
        clearInterval(hopInterval);
        pulse1.setValue(1);
        pulse2.setValue(1);
      };
    } else {
      pulse1.setValue(1);
      pulse2.setValue(1);
      pulseOpacity1.setValue(0);
      pulseOpacity2.setValue(0);
    }
  }, [isBroadcasting, isSettled]);

  const renderTimelineItem = (title: string, subtitle: string, isActive: boolean, isCompleted: boolean, isLast: boolean = false) => {
    return (
      <View style={styles.timelineItem}>
        {/* Node & Line */}
        <View style={styles.timelineTrack}>
          <View style={[
            styles.timelineNode, 
            isCompleted && styles.nodeCompleted, 
            isActive && !isCompleted && styles.nodeActive
          ]}>
            {isCompleted && <Feather name="check" size={12} color="#FFF" />}
          </View>
          {!isLast && <View style={[styles.timelineLine, (isCompleted || isActive) && styles.lineActive]} />}
        </View>
        
        {/* Content */}
        <View style={styles.timelineContent}>
          <Text style={[styles.timelineTitle, (isActive || isCompleted) && styles.textActive]}>{title}</Text>
          <Text style={styles.timelineSubtitle}>{subtitle}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Blobs */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Radar Section */}
        <View style={styles.radarSection}>
          <View style={styles.radarWrapper}>
            <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulse1 }], opacity: pulseOpacity1 }]} />
            <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulse2 }], opacity: pulseOpacity2 }]} />
            <View style={[styles.radarCenter, isSettled && styles.radarCenterSuccess]}>
              <Feather name={isSettled ? "check" : (hasInternet ? "wifi" : "radio")} size={32} color="#FFF" />
            </View>
          </View>

          <Text style={styles.radarStatusText}>
            {isSettled ? "Transaction Settled!" : (isBroadcasting ? "Broadcasting Offline..." : "Mesh Tracker Ready")}
          </Text>
          <Text style={styles.radarSubText}>
            {isBroadcasting && !isSettled ? `Relayed to ${hopCount} nearby devices` : "Hop Pay mesh network active"}
          </Text>
        </View>

        {/* Timeline Section */}
        <BlurView intensity={30} tint="dark" style={styles.timelineCard}>
          <Text style={styles.cardTitle}>Packet Journey</Text>
          
          {renderTimelineItem(
            "Payload Signed Offline",
            "Cryptographically verified intention to pay",
            true, // Active
            isBroadcasting || isSettled || false // Completed
          )}
          
          {renderTimelineItem(
            "Broadcasting via BLE",
            "Chunking packet and blasting to nearby physical devices",
            isBroadcasting,
            hopCount > 0 || isSettled || false
          )}
          
          {renderTimelineItem(
            `Relayed via Mesh (Hops: ${hopCount})`,
            "Nearby phones caught the packet and are re-broadcasting",
            hopCount > 0 && !isSettled,
            hopCount > 1 || isSettled || false
          )}
          
          {renderTimelineItem(
            "Found Internet Gateway",
            "A device with cellular connected to the mainland",
            isSettled || false,
            isSettled || false
          )}

          {renderTimelineItem(
            "Decentro API Settlement",
            "Real ₹ INR funds hit the receiver's connected bank account",
            isSettled || false,
            isSettled || false,
            true
          )}
        </BlurView>
        
        {isSettled && (
          <TouchableOpacity style={styles.receiptBtn}>
            <Feather name="file-text" size={20} color="#FFF" style={{marginRight: 8}}/>
            <Text style={styles.receiptBtnText}>View Receipt</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  blob1: {
    position: "absolute",
    top: 50,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: THEME.secondary,
    opacity: 0.15,
  },
  blob2: {
    position: "absolute",
    bottom: 50,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: THEME.primary,
    opacity: 0.15,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
  },
  radarSection: {
    alignItems: "center",
    justifyContent: "center",
    height: 280,
    marginBottom: 16,
  },
  radarWrapper: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  radarCenter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.primary,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  radarCenterSuccess: {
    backgroundColor: THEME.success,
    shadowColor: THEME.success,
  },
  pulseCircle: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.primary,
    zIndex: 1,
  },
  radarStatusText: {
    fontSize: 22,
    fontWeight: "800",
    color: THEME.text,
    marginTop: 40,
    letterSpacing: 0.5,
  },
  radarSubText: {
    fontSize: 14,
    color: THEME.primary,
    marginTop: 8,
    fontWeight: "600",
  },
  timelineCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: THEME.glassBg,
    borderColor: THEME.glassBorder,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: THEME.text,
    marginBottom: 24,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 0,
  },
  timelineTrack: {
    alignItems: "center",
    width: 30,
    marginRight: 16,
  },
  timelineNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.bg,
    borderWidth: 2,
    borderColor: THEME.glassBorder,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  nodeActive: {
    borderColor: THEME.primary,
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  nodeCompleted: {
    borderColor: THEME.success,
    backgroundColor: THEME.success,
  },
  timelineLine: {
    width: 2,
    height: 50,
    backgroundColor: THEME.glassBorder,
    marginVertical: -2,
    zIndex: 1,
  },
  lineActive: {
    backgroundColor: THEME.primary,
    opacity: 0.5,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 30,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: THEME.textMuted,
    marginBottom: 4,
  },
  textActive: {
    color: THEME.text,
  },
  timelineSubtitle: {
    fontSize: 13,
    color: THEME.textMuted,
    opacity: 0.7,
  },
  receiptBtn: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: THEME.glassBorder,
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  receiptBtnText: {
    color: THEME.text,
    fontWeight: "700",
    fontSize: 15,
  }
});
