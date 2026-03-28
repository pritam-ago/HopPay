import { Tabs } from 'expo-router';
import React from 'react';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const THEME = {
  primary: "#3B82F6",
  textMuted: "#94A3B8",
  glassBg: "rgba(15, 23, 42, 0.7)", 
  glassBorder: "rgba(255, 255, 255, 0.05)",
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.textMuted,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
        },
        tabBarBackground: () => (
          <LinearGradient
            colors={["#000000", "#0D2818"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ),
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Feather size={24} name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="mesh"
        options={{
          title: 'Radar',
          tabBarIcon: ({ color }) => <Feather size={24} name="radio" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Tracker',
          tabBarIcon: ({ color }) => <Feather size={24} name="activity" color={color} />,
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color }) => <Feather size={24} name="award" color={color} />,
        }}
      />
      <Tabs.Screen
        name="show"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Feather size={24} name="settings" color={color} />,
        }}
      />
    </Tabs>
  );
}
