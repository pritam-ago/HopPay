import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function DynamicBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "#000000" }} />
      <LinearGradient
        colors={["#0D2818", "#000000", "#0D2818"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  }
});
