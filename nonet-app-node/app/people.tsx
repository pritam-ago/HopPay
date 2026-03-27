import React from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import DynamicBackground from "@/components/DynamicBackground";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.15)", glassBorder: "rgba(255, 255, 255, 0.25)",
  primary: "#3B82F6", text: "#F8FAFC", textMuted: "#94A3B8"
};

const CONTACTS_DB = [
  { id: "alice@hoppay", name: "Alice", letter: "A", color: "#3B82F6" },
  { id: "bob@hoppay", name: "Bob", letter: "B", color: "#8B5CF6" },
  { id: "charlie@hoppay", name: "Charlie", letter: "C", color: "#22C55E" },
  { id: "david@hoppay", name: "David", letter: "D", color: "#F59E0B" },
  { id: "emma@hoppay", name: "Emma", letter: "E", color: "#EC4899" },
  { id: "frank@hoppay", name: "Frank", letter: "F", color: "#A855F7" },
  { id: "grace@hoppay", name: "Grace", letter: "G", color: "#F43F5E" },
  { id: "hannah@hoppay", name: "Hannah", letter: "H", color: "#14B8A6" },
  { id: "ian@hoppay", name: "Ian", letter: "I", color: "#EAB308" },
  { id: "jack@hoppay", name: "Jack", letter: "J", color: "#6366F1" },
  { id: "karen@hoppay", name: "Karen", letter: "K", color: "#84CC16" },
  { id: "merchant@icici", name: "Merchant", letter: "M", color: "#10B981" },
];

export default function PeoplePage(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <DynamicBackground />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All People</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <BlurView intensity={90} tint="dark" style={styles.glassCard}>
          <Text style={styles.cardHeader}>Saved Contacts (12 Max)</Text>
          <View style={styles.gridContainer}>
            {CONTACTS_DB.map((person) => (
              <TouchableOpacity key={person.id} style={styles.gridItem} onPress={() => router.push({ pathname: "/transaction", params: { initId: person.id } })}>
                <View style={[styles.avatar, { backgroundColor: person.color }]}>
                  <Text style={styles.initial}>{person.letter}</Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
                <Text style={styles.handle} numberOfLines={1}>{person.id}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </BlurView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingTop: 40, zIndex: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.glassBg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: THEME.glassBorder },
  headerTitle: { fontSize: 20, fontWeight: "700", color: THEME.text },
  content: { paddingVertical: 24, paddingHorizontal: 24, paddingBottom: 60 },
  glassCard: { borderRadius: 24, padding: 24, backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1 },
  cardHeader: { color: THEME.text, fontWeight: "800", fontSize: 18, marginBottom: 24 },
  gridContainer: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -12, rowGap: 30 },
  gridItem: { width: "33.33%", paddingHorizontal: 8, alignItems: "center" },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", marginBottom: 12, borderWidth: 2, borderColor: THEME.glassBorder },
  initial: { fontSize: 24, fontWeight: "800", color: "#FFF" },
  name: { fontSize: 13, fontWeight: "700", color: THEME.text, marginBottom: 4 },
  handle: { fontSize: 11, color: THEME.textMuted },
});
