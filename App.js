import { useEffect, useState } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { requestPermissions } from './components/Notifications';
import HomePage from './components/HomePage';
import Statics  from './components/Statics';
import Setting, { DEFAULT_THRESHOLDS } from './components/Setting';

const Tab = createBottomTabNavigator();

// ─── Icons ────────────────────────────────────────────────────────────────────
const HomeIcon = ({ color }) => (
  <View style={{ alignItems: 'center', justifyContent: 'flex-end', width: 24, height: 22 }}>
    <View style={{
      width: 0, height: 0,
      borderLeftWidth: 12, borderRightWidth: 12, borderBottomWidth: 10,
      borderLeftColor: 'transparent', borderRightColor: 'transparent',
      borderBottomColor: color, marginBottom: -1,
    }} />
    <View style={{
      width: 16, height: 11, borderWidth: 2, borderTopWidth: 0,
      borderColor: color, borderRadius: 1,
      alignItems: 'center', justifyContent: 'flex-end',
    }}>
      <View style={{ width: 5, height: 7, backgroundColor: color, borderRadius: 1 }} />
    </View>
  </View>
);

const StaticsIcon = ({ color }) => (
  <View style={{ flexDirection: 'row', alignItems: 'flex-end', width: 24, height: 22, gap: 3, paddingBottom: 1 }}>
    {[8, 14, 10, 20, 15].map((h, i) => (
      <View key={i} style={{ width: 3.5, height: h, backgroundColor: color, borderRadius: 2 }} />
    ))}
  </View>
);

const SettingsIcon = ({ color }) => (
  <View style={{ width: 24, height: 22, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: 20, height: 20, borderRadius: 10,
      borderWidth: 2.5, borderColor: color,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }} />
    </View>
  </View>
);

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  // Thresholds shared between Settings (edit) and HomePage (check)
  const [thresholds, setThresholds] = useState(() => {
    const t = {};
    Object.entries(DEFAULT_THRESHOLDS).forEach(([k, v]) => {
      t[k] = { min: v.min, max: v.max };
    });
    return t;
  });

  // alertsEnabled is global — toggled in Settings, consumed in HomePage
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  // Safe permission request — won't crash in Expo Go SDK 53+
  useEffect(() => {
    requestPermissions().then((granted) => {
      if (!granted) setAlertsEnabled(false);
    });
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#45B7D1',
          tabBarInactiveTintColor: '#95A5A6',
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          tabBarIcon: ({ color }) => {
            if (route.name === 'Home')       return <HomeIcon color={color} />;
            if (route.name === 'Statistics') return <StaticsIcon color={color} />;
            if (route.name === 'Settings')   return <SettingsIcon color={color} />;
          },
        })}
      >
        {/* HomePage receives thresholds + alertsEnabled to fire notifications */}
        <Tab.Screen name="Home">
          {() => <HomePage thresholds={thresholds} alertsEnabled={alertsEnabled} />}
        </Tab.Screen>

        <Tab.Screen name="Statistics" component={Statics} />

        {/* Settings receives everything so the toggle syncs globally */}
        <Tab.Screen name="Settings">
          {() => (
            <Setting
              thresholds={thresholds}
              onThresholdsChange={setThresholds}
              alertsEnabled={alertsEnabled}
              onAlertsEnabledChange={setAlertsEnabled}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 10,
  },
  tabLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginTop: 2 },
  tabItem:  { paddingVertical: 4 },
});