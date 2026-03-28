import { Tabs } from 'expo-router';
import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 24,
          left: 20,
          right: 20,
          elevation: 0,
          backgroundColor: Platform.OS === 'ios' ? 'rgba(15, 20, 18, 0.95)' : 'rgba(15, 20, 18, 0.98)',
          borderRadius: 32,
          height: 64,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
        },
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#6B7280',
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginBottom: 8,
        },
        tabBarItemStyle: {
          paddingVertical: 8,
        },
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: 'rgba(15, 20, 18, 0.95)', borderRadius: 32 }} />
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <Feather size={24} name="home" color={color} style={focused && styles.iconActive} />,
        }}
      />
      <Tabs.Screen
        name="receive"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => <Feather size={24} name="camera" color={color} style={focused && styles.iconActive} />,
        }}
      />
      <Tabs.Screen
        name="show"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, focused }) => <Feather size={24} name="credit-card" color={color} style={focused && styles.iconActive} />,
        }}
      />
      <Tabs.Screen
        name="mesh"
        options={{
          title: 'Radar',
          tabBarIcon: ({ color, focused }) => <Feather size={24} name="radio" color={color} style={focused && styles.iconActive} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconActive: {
    textShadowColor: 'rgba(16, 185, 129, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  }
});
